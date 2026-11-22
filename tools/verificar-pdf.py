#!/usr/bin/env python3
"""Confere se os dois PDFs para download acompanham o currículo publicado.

Três comparações, em cada língua:
  - o PDF traz cada texto de cv/textos.json (pega PDF que ninguém regerou);
  - cv/textos.json e o site contam os mesmos fatos: revisão, cargos, escritórios, datas
    dos empregos, conclusão do curso, idiomas e níveis, sistemas e plataformas;
  - a ordem de leitura do arquivo é cargo, tarefas do cargo, cargo seguinte, formação.
Exige também uma página e exatamente um telefone celular no PDF, e nenhum em nenhum
arquivo de texto rastreado (o histórico do git e os binários ficam fora desta conferência).
O e-mail do PDF é o de cv/textos.json, diferente do site de propósito.
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
# celular brasileiro, com ou sem +55, parênteses, ponto, espaço ou hífen
TELEFONE = re.compile(r"(?<![\d.])(?:\+?55[ .-]?)?\(?\d{2}\)?[ .-]?9[ .]?\d{4}[ .-]?\d{4}(?!\d)")
BINARIOS = (".pdf", ".png", ".woff2")
MESES = {m: i for i, par in enumerate((("jan",), ("fev", "feb"), ("mar",), ("abr", "apr"), ("mai", "may"), ("jun",), ("jul",), ("ago", "aug"), ("set", "sep"), ("out", "oct"), ("nov",), ("dez", "dec")), 1) for m in par}
CARGOS = ("exp-1", "exp-2", "exp-3")  # do mais novo ao mais antigo, como no PDF


def normal(texto):
    """Sem tags, acentos, caixa, pontuação nem quebra de linha: o PDF troca hífens e espaços."""
    texto = unescape(re.sub(r"<[^>]+>", "", texto))
    texto = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "", texto)


def datas(texto):
    """[(ano, mês)] na ordem: 'Mar 2020 a mar 2021' e 'mar 2020 – mar 2021' dão o mesmo."""
    return [(int(a), MESES[m.lower()]) for m, a in re.findall(r"\b([A-Za-z]{3}) (\d{4})\b", texto) if m.lower() in MESES]


def folhas(valor):
    if isinstance(valor, dict):
        return [x for v in valor.values() for x in folhas(v)]
    if isinstance(valor, list):
        return [x for v in valor for x in folhas(v)]
    return [valor]


def publicados():
    """Todo arquivo de texto rastreado pelo git (ou, fora de um clone, todo arquivo da pasta)."""
    try:
        nomes = rodar("git", "-C", str(RAIZ), "ls-files", "-z").split("\0")
    except (OSError, subprocess.CalledProcessError):
        nomes = [str(p.relative_to(RAIZ)) for p in RAIZ.rglob("*") if p.is_file() and ".git" not in p.parts and p.name != "telefone.txt"]
    return {n: (RAIZ / n).read_text(encoding="utf-8", errors="replace") for n in nomes if n and not n.endswith(BINARIOS) and (RAIZ / n).is_file()}


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
        publicos = publicados()
        cvs = json.loads((RAIZ / "cv/textos.json").read_text(encoding="utf-8"))
        sistemas = {g: re.findall(r'data-q="([^"]+)"', re.search(rf'data-i18n="d-{g}".*?</tbody>', html, re.S).group(0)) for g in ("mx-1", "mx-2")}
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
        # o PDF precisa trazer cada texto de cv/textos.json: pega PDF que ninguém regerou
        cv = cvs[lingua]
        usados = {k: v for k, v in cv.items() if k not in ("lang", "arquivo", "titulo")}
        for texto in folhas(usados):
            if texto and normal(texto) not in conteudo:
                problemas.append(f"{nome}: não traz \"{texto[:60]}\" de cv/textos.json (rode tools/gerar-pdf.py)")
        # e os fatos do cv/textos.json precisam ser os do site
        for i, (bloco, emprego) in enumerate(zip(CARGOS, cv["experiencia"])):
            c = bloco.replace("exp-", "c")
            no_site = datas(dicionario[f"{c}-date"])
            if not no_site or no_site != datas(emprego["datas"]):
                problemas.append(f"{lingua}: datas de {emprego['org']} no site ({dicionario[f'{c}-date']}) e no PDF ({emprego['datas']}) não batem")
            papel = dicionario[{"c1": "c1-role", "c2": "intern", "c3": "intern2"}[c]]
            escritorio = re.search(rf'id="{bloco}".*?<p class="org"><span class="src">([^<]+)<', html, re.S).group(1)
            if normal(papel) != normal(emprego["cargo"]) or normal(escritorio) != normal(emprego["org"]):
                problemas.append(f"{lingua}: cargo {i + 1} do PDF ({emprego['cargo']}, {emprego['org']}) não é o do site ({papel}, {escritorio})")
        fim = re.findall(r"\d{4}", dicionario["edu-org"])
        if not fim or fim[-1] != re.findall(r"\d{4}", cv["formacao"]["datas"])[-1]:
            problemas.append(f"{lingua}: conclusão do curso no site ({dicionario['edu-org']}) e no PDF ({cv['formacao']['datas']}) não batem")
        for sigla, (nome_l, nivel) in zip(("pt", "en", "de"), cv["idiomas"]):
            if normal(dicionario[f"lang-{sigla}-n"] + dicionario[f"lang-{sigla}-v"]) != normal(nome_l + nivel):
                problemas.append(f"{lingua}: idioma no site ({dicionario[f'lang-{sigla}-n']}, {dicionario[f'lang-{sigla}-v']}) e no PDF ({nome_l} {nivel}) não batem")
        if [normal(x) for x in sistemas["mx-1"]] and {normal(x) for x in sistemas["mx-1"]} != {normal(x) for x in cv["competencias"][1][1].split(",")}:
            problemas.append(f"{lingua}: sistemas de tribunais do site e do PDF não batem")
        if not {normal(x) for x in sistemas["mx-2"]} <= {normal(x) for x in cv["competencias"][2][1].split(",")}:
            problemas.append(f"{lingua}: plataformas do site e do PDF não batem")
        telefones = len(TELEFONE.findall(textos[lingua]))
        if telefones != 1:
            problemas.append(f"{nome}: tem {telefones} telefone(s), o combinado é um")
    problemas += [f"{nome}: tem telefone, que só pode estar no PDF" for nome, texto in publicos.items() if TELEFONE.search(texto)]

    print(f"pdf: {len(arquivos)} arquivos, {len(CHAVES) + len(fixos) + 1} fatos por língua, {len(publicos)} arquivos de texto sem telefone" if not any(TELEFONE.search(t) for t in publicos.values()) else "pdf: telefone fora do PDF")
    for problema in problemas:
        print("  - " + problema)
    print("em dia" if not problemas else f"{len(problemas)} divergência(s)")
    return 1 if problemas else 0


if __name__ == "__main__":
    sys.exit(main())
