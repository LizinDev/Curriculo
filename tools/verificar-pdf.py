#!/usr/bin/env python3
"""Confere se os dois PDFs para download acompanham o currículo publicado.

Segue o botão de download do index.html em cada língua e procura, no texto do PDF,
a revisão, o cargo atual e os títulos dos projetos dessa língua, além do endereço
de cada projeto público, e que o arquivo tem duas páginas. Pega o caso em que o site é atualizado e o PDF fica para trás.
Precisa do pdftotext e do pdfinfo (poppler). Saída 0 = em dia, 1 = PDF desatualizado,
2 = não deu para conferir (nunca conta como verde).

    python3 tools/verificar-pdf.py
"""

from html import unescape
from pathlib import Path
import importlib.util
import re
import subprocess
import sys
import unicodedata

RAIZ = Path(__file__).resolve().parent.parent
# Textos que não quebram de linha no PDF (datas em coluna estreita quebram e saem embaralhadas).
CHAVES = ("mast-rev", "c1-role", "tarefas-h3", "pdf-h3", "tool3-h3")


def normal(texto):
    """Sem tags, acentos, caixa, pontuação nem quebra de linha: o PDF troca hífens e espaços."""
    texto = unescape(re.sub(r"<[^>]+>", "", texto))
    texto = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "", texto)


def carregar_i18n():
    sys.dont_write_bytecode = True  # sem __pycache__ em tools/
    espec = importlib.util.spec_from_file_location("verificar_i18n", Path(__file__).with_name("verificar-i18n.py"))
    modulo = importlib.util.module_from_spec(espec)
    espec.loader.exec_module(modulo)
    return modulo


def main():
    problemas = []
    try:
        i18n = carregar_i18n()
        html = (RAIZ / "index.html").read_text(encoding="utf-8")
        pagina = i18n.Pagina()
        pagina.feed(html)
        script = (RAIZ / "i18n.js").read_text(encoding="utf-8")
        corpo, _ = i18n.objeto(script, "en", script.index("window.CV_I18N"))
        ingles = {a or n: v for a, n, v in i18n.pares(corpo)}
        portugues = {c: t[0] for c, t in pagina.textos.items()}
        tag = re.search(r"<a\b[^>]*\bdata-pdf-en=[^>]*>", html).group(0)
        arquivos = {
            "pt": re.search(r'\bhref="([^"]+)"', tag).group(1),
            "en": re.search(r'\bdata-pdf-en="([^"]+)"', tag).group(1),
        }
        repos = set(re.findall(r"https://github\.com/(LizinDev/[\w.-]+)", html)) - {"LizinDev/Curriculo"}
        textos = {
            lingua: subprocess.run(["pdftotext", str(RAIZ / nome), "-"], check=True,
                                   capture_output=True, text=True).stdout
            for lingua, nome in arquivos.items()
        }
        paginas = {
            lingua: int(re.search(r"Pages:\s+(\d+)", subprocess.run(
                ["pdfinfo", str(RAIZ / nome)], check=True, capture_output=True, text=True).stdout).group(1))
            for lingua, nome in arquivos.items()
        }
    except (OSError, ValueError, AttributeError, subprocess.CalledProcessError) as erro:
        print(f"verificar-pdf: não consegui conferir: {erro}", file=sys.stderr)
        return 2

    for lingua, dicionario in (("pt", portugues), ("en", ingles)):
        conteudo = normal(textos[lingua])
        if paginas[lingua] != 2:
            problemas.append(f"{arquivos[lingua]}: tem {paginas[lingua]} página(s), o combinado são 2")
        for chave in CHAVES:
            if chave not in dicionario:
                print(f"verificar-pdf: a chave {chave} não existe mais em {lingua}; atualize CHAVES", file=sys.stderr)
                return 2
            if normal(dicionario[chave]) not in conteudo:
                problemas.append(f"{arquivos[lingua]}: falta \"{dicionario[chave]}\" ({chave})")
        problemas += [f"{arquivos[lingua]}: falta o link {repo}" for repo in sorted(repos) if normal(repo) not in conteudo]

    print(f"pdf: {len(arquivos)} arquivos, {len(CHAVES)} textos e {len(repos)} repositórios por língua")
    for problema in problemas:
        print("  - " + problema)
    print("em dia" if not problemas else f"{len(problemas)} divergência(s)")
    return 1 if problemas else 0


if __name__ == "__main__":
    sys.exit(main())
