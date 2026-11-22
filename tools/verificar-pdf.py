#!/usr/bin/env python3
"""Confere se os dois PDFs para download acompanham o currículo publicado.

Segue o botão de download do index.html em cada língua e exige, no texto do PDF, os
fatos que os dois têm em comum: revisão, cargos, escritórios, curso, idiomas, sistemas
da tabela de competências. O e-mail é o de cv/textos.json. Exige também uma página só e exatamente um telefone
celular (ele mora no PDF e não pode sumir nem aparecer no site).
Precisa do pdftotext e do pdfinfo (poppler). Saída 0 = em dia, 1 = divergência,
2 = não deu para conferir (nunca conta como verde).

    python3 tools/verificar-pdf.py
"""

from html import unescape
from pathlib import Path
import importlib.util
import json
import re
import subprocess
import sys
import unicodedata

RAIZ = Path(__file__).resolve().parent.parent
CHAVES = ("mast-rev", "c1-role", "intern", "edu-h3", "lang-pt-n", "lang-en-n", "lang-de-n")
TELEFONE = re.compile(r"\(\d{2}\) ?9\d{4}-\d{4}")
# Arquivos de texto publicados: o telefone não pode estar em nenhum deles.
PUBLICADOS = ("index.html", "i18n.js", "script.js", "README.md", "cv/textos.json", "tools/gerar-pdf.py")


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


def rodar(*comando):
    return subprocess.run(comando, check=True, capture_output=True, text=True).stdout


def main():
    problemas = []
    try:
        i18n = carregar_i18n()
        html = (RAIZ / "index.html").read_text(encoding="utf-8")
        pagina = i18n.Pagina()
        pagina.feed(html)
        script = (RAIZ / "i18n.js").read_text(encoding="utf-8")
        corpo, _ = i18n.objeto(script, "en", script.index("window.CV_I18N"))
        dicionarios = {"pt": {c: t[0] for c, t in pagina.textos.items()}, "en": {a or n: v for a, n, v in i18n.pares(corpo)}}
        tag = re.search(r"<a\b[^>]*\bdata-pdf-en=[^>]*>", html).group(0)
        arquivos = {"pt": re.search(r'\bhref="([^"]+)"', tag).group(1), "en": re.search(r'\bdata-pdf-en="([^"]+)"', tag).group(1)}
        # o e-mail do PDF é o pessoal, de propósito; o do site é o do escritório
        emails = {l: t["email"] for l, t in json.loads((RAIZ / "cv/textos.json").read_text(encoding="utf-8")).items()}
        # escritórios e sistemas são iguais nas duas línguas
        fixos = re.findall(r'<p class="org"><span class="src">([^<]+)</span>', html)
        fixos += [m for m in re.findall(r'data-q="([^"]+)" data-qe="\1">\1</button>', html) if m not in ("QML", "TypeScript")]
        if len(fixos) < 8:
            raise ValueError("não achei os escritórios e os sistemas no index.html")
        textos = {l: rodar("pdftotext", str(RAIZ / n), "-") for l, n in arquivos.items()}
        paginas = {l: int(re.search(r"Pages:\s+(\d+)", rodar("pdfinfo", str(RAIZ / n))).group(1)) for l, n in arquivos.items()}
        publicos = {n: (RAIZ / n).read_text(encoding="utf-8") for n in PUBLICADOS}
    except (OSError, ValueError, KeyError, AttributeError, subprocess.CalledProcessError) as erro:
        print(f"verificar-pdf: não consegui conferir: {erro}", file=sys.stderr)
        return 2

    for lingua, dicionario in dicionarios.items():
        nome, conteudo = arquivos[lingua], normal(textos[lingua])
        if paginas[lingua] != 1:
            problemas.append(f"{nome}: tem {paginas[lingua]} páginas, o combinado é uma")
        for chave in CHAVES:
            if chave not in dicionario:
                print(f"verificar-pdf: a chave {chave} não existe mais em {lingua}; atualize CHAVES", file=sys.stderr)
                return 2
            if normal(dicionario[chave]) not in conteudo:
                problemas.append(f"{nome}: falta \"{dicionario[chave]}\" ({chave})")
        problemas += [f"{nome}: falta \"{x}\"" for x in [*fixos, emails[lingua]] if normal(x) not in conteudo]
        # ordem do fluxo: é a que os leitores automáticos de currículo usam
        fluxo = normal(rodar("pdftotext", "-raw", str(RAIZ / nome), "-"))
        ordem = [fluxo.find(normal(x)) for x in (fixos[2], "Legal One e CPJ" if lingua == "pt" else "Legal One and CPJ", fixos[1], fixos[0], dicionario["edu-h3"])]
        if -1 in ordem or ordem != sorted(ordem):
            problemas.append(f"{nome}: a ordem de leitura não é cargo, tarefas do cargo, cargo seguinte, formação")
        telefones = len(TELEFONE.findall(textos[lingua]))
        if telefones != 1:
            problemas.append(f"{nome}: tem {telefones} telefone(s), o combinado é um")
    problemas += [f"{nome}: tem telefone, que só pode estar no PDF" for nome, texto in publicos.items() if TELEFONE.search(texto)]

    print(f"pdf: {len(arquivos)} arquivos, {len(CHAVES) + len(fixos) + 1} fatos por língua, telefone só no PDF")
    for problema in problemas:
        print("  - " + problema)
    print("em dia" if not problemas else f"{len(problemas)} divergência(s)")
    return 1 if problemas else 0


if __name__ == "__main__":
    sys.exit(main())
