#!/usr/bin/env python3
"""Gera os dois PDFs do currículo: uma página A4 por língua, formal e legível por máquina.

O texto mora em cv/textos.json e o desenho em cv/cv.css. O telefone não fica no
repositório: vem de cv/telefone.txt (ignorado pelo git) e só aparece no PDF, nunca na
página. Sem esse arquivo o gerador para, para o telefone não sumir sem ninguém ver;
--sem-telefone diz que é de propósito.
Precisa do Chromium e do pdfinfo (poppler). Saída 0 = gerados, 1 = não coube em uma
página (nada é sobrescrito), 2 = não deu para gerar.

    python3 tools/gerar-pdf.py
"""

from base64 import b64encode
from html import escape
from pathlib import Path
import json
import re
import shutil
import subprocess
import sys
import tempfile

RAIZ = Path(__file__).resolve().parent.parent
CV = RAIZ / "cv"
LINKEDIN = "https://www.linkedin.com/in/pedro-henrique-braz-moreira-b25516231/"
SITE = "https://lizindev.github.io/Curriculo/"
GITHUB = "https://github.com/LizinDev"


def pagina(t, telefone):
    e = escape
    fontes = "".join(
        f'@font-face{{font-family:"Golos";font-weight:{p};src:url(data:font/woff2;base64,'
        f'{b64encode((CV / "fonts" / f"golos-{p}.woff2").read_bytes()).decode()}) format("woff2")}}'
        for p in (400, 600))
    contato = [f"<span>{e(t['local'])}</span>"]
    if telefone:
        contato.append(f"<span>{e(telefone)}</span>")
    contato += [f'<a href="mailto:{t["email"]}">{t["email"]}</a>', f'<a href="{LINKEDIN}">linkedin.com/in/pedro-henrique-braz-moreira-b25516231</a>',
                f'<a href="{SITE}">{SITE.removeprefix("https://").rstrip("/")}</a>', f'<a href="{GITHUB}">{GITHUB.removeprefix("https://")}</a>']
    empregos = "".join(
        f'<div class="emprego"><div class="cargo-linha"><h3>{e(x["cargo"])}<span>, {e(x["org"])}{", " + e(x["nota"]) if x["nota"] else ""}</span></h3>'
        f'<span class="datas">{e(x["datas"])}</span></div><ul>{"".join(f"<li>{e(i)}</li>" for i in x["itens"])}</ul></div>'
        for x in t["experiencia"])

    def lista(pares):
        return "<dl>" + "".join(f"<dt>{e(a)}</dt><dd>{e(b)}</dd>" for a, b in pares) + "</dl>"

    s, f = t["secoes"], t["formacao"]
    idiomas = ", ".join(f"{n} {v}" if i == 0 else f"{n[0].lower() + n[1:] if t['lang'] != 'en' else n} {v}" for i, (n, v) in enumerate(t["idiomas"]))
    return f"""<!DOCTYPE html>
<html lang="{t['lang']}"><head><meta charset="UTF-8"><title>{e(t['titulo'])}</title><meta name="author" content="Pedro Henrique Braz Moreira">
<style>{fontes}{(CV / 'cv.css').read_text(encoding='utf-8')}</style></head><body>
<header><h1>Pedro Henrique Braz Moreira</h1><p class="cargo">{e(t['cargo'])}</p><p class="contato">{"".join(contato)}</p></header>
<main>
<section><h2>{e(s['resumo'])}</h2><p>{e(t['resumo'])}</p></section>
<section><h2>{e(s['experiencia'])}</h2>{empregos}</section>
<section><h2>{e(s['formacao'])}</h2><div class="cargo-linha"><h3>{e(f['curso'])}<span>, {e(f['escola'])}</span></h3><span class="datas">{e(f['datas'])}</span></div><p class="idiomas">{e(idiomas)}</p></section>
<section><h2>{e(s['competencias'])}</h2>{lista(t['competencias'])}</section>
<section><h2>{e(s['automacao'])}</h2>{lista(t['automacao'])}</section>
</main>
<footer>{e(t['revisao'])}</footer>
</body></html>"""


def main():
    navegador = next((n for n in ("chromium", "google-chrome-stable", "google-chrome") if shutil.which(n)), None)
    if not navegador or not shutil.which("pdfinfo"):
        print("gerar-pdf: preciso do Chromium e do pdfinfo (poppler)", file=sys.stderr)
        return 2
    try:
        telefone = "" if "--sem-telefone" in sys.argv[1:] else (CV / "telefone.txt").read_text(encoding="utf-8").strip()
        textos = json.loads((CV / "textos.json").read_text(encoding="utf-8"))
        prontos = []
        with tempfile.TemporaryDirectory() as pasta:
            for lingua, t in textos.items():
                origem, destino = Path(pasta) / f"{lingua}.html", Path(pasta) / t["arquivo"]
                origem.write_text(pagina(t, telefone), encoding="utf-8")
                subprocess.run(
                    [navegador, "--headless=new", f"--user-data-dir={pasta}/chromium-{lingua}", "--no-pdf-header-footer",
                     "--virtual-time-budget=4000", f"--print-to-pdf={destino}", origem.as_uri()],
                    check=True, capture_output=True, timeout=90)
                info = subprocess.run(["pdfinfo", str(destino)], check=True, capture_output=True, text=True).stdout
                paginas = int(re.search(r"Pages:\s+(\d+)", info).group(1))
                print(f"{t['arquivo']}: {paginas} página(s)")
                if paginas != 1:
                    print("gerar-pdf: não coube em uma página; nada foi sobrescrito", file=sys.stderr)
                    return 1
                prontos.append((destino, RAIZ / t["arquivo"]))
            for destino, final in prontos:
                shutil.copyfile(destino, final)
    except FileNotFoundError as erro:
        print(f"gerar-pdf: falta {erro.filename} (o telefone mora em cv/telefone.txt; --sem-telefone gera sem ele)", file=sys.stderr)
        return 2
    except (OSError, KeyError, ValueError, AttributeError, subprocess.SubprocessError) as erro:
        print(f"gerar-pdf: {erro}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
