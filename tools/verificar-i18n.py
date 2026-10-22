#!/usr/bin/env python3
"""Confere se o português (index.html) e o inglês (i18n.js) andam juntos.

Falha quando uma chave existe numa língua e falta na outra, quando há texto vazio,
chave repetida no dicionário, ou a mesma chave com dois textos diferentes no HTML.
Só biblioteca padrão; nada é alterado. Saída 0 = em sincronia, 1 = divergência,
2 = arquivo ilegível (o checador não conseguiu conferir; nunca conta como verde).

    python3 tools/verificar-i18n.py
"""

from html.parser import HTMLParser
from pathlib import Path
import re
import sys

RAIZ = Path(__file__).resolve().parent.parent
# Chaves que o script.js usa fora de um data-i18n: "__title" troca o document.title.
ESPECIAIS = {"__title": "title"}


class Pagina(HTMLParser):
    """Guarda o HTML interno de cada elemento com data-i18n, como o script.js faz."""

    VAZIOS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}

    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.textos = {}
        self.abertos = []  # [chave, profundidade, partes]
        self.profundidade = 0
        self.titulo = None

    def handle_starttag(self, tag, attrs):
        self._registrar(self.get_starttag_text())
        if tag in self.VAZIOS:
            return
        self.profundidade += 1
        chave = dict(attrs).get("data-i18n")
        if chave is not None:
            self.abertos.append([chave, self.profundidade, []])
        if tag == "title":
            self.titulo = ""

    def handle_endtag(self, tag):
        if tag in self.VAZIOS:
            return
        if self.abertos and self.abertos[-1][1] == self.profundidade:
            chave, _, partes = self.abertos.pop()
            self.textos.setdefault(chave, []).append("".join(partes).strip())
        self.profundidade -= 1
        self._registrar(f"</{tag}>")

    def handle_data(self, data):
        if self.titulo is not None and not self.abertos and self.profundidade and data.strip():
            self.titulo += data
        self._registrar(data)

    def handle_entityref(self, name):
        self._registrar(f"&{name};")

    def handle_charref(self, name):
        self._registrar(f"&#{name};")

    def _registrar(self, trecho):
        for _, _, partes in self.abertos:
            partes.append(trecho)


def bloco(texto, inicio):
    """Corpo de um objeto literal a partir do "{" em `inicio`, pulando strings e comentários."""
    profundidade, i, aspas = 0, inicio, None
    while i < len(texto):
        c = texto[i]
        if aspas:
            if c == "\\":
                i += 1
            elif c == aspas:
                aspas = None
        elif texto.startswith("/*", i):
            i = texto.index("*/", i) + 1
        elif c in "\"'`":
            aspas = c
        elif c == "{":
            profundidade += 1
        elif c == "}":
            profundidade -= 1
            if profundidade == 0:
                return texto[inicio + 1:i]
        i += 1
    raise ValueError("objeto sem fechamento")


def pares(corpo):
    """Pares chave: "texto" do nível de cima de um objeto (sem comentários)."""
    corpo = re.sub(r"/\*.*?\*/", "", corpo, flags=re.S)
    return re.findall(r'(?:"((?:[^"\\]|\\.)*)"|([A-Za-z_$][\w$]*))\s*:\s*"((?:[^"\\]|\\.)*)"', corpo)


def objeto(texto, nome, depois=0):
    achado = re.compile(rf"(?:^|[\s{{,]){re.escape(nome)}\s*:\s*\{{").search(texto, depois)
    if not achado:
        raise ValueError(f"objeto '{nome}' não encontrado")
    inicio = achado.end() - 1
    return bloco(texto, inicio), inicio


def main():
    problemas = []
    try:
        pagina = Pagina()
        pagina.feed((RAIZ / "index.html").read_text(encoding="utf-8"))
        script = (RAIZ / "i18n.js").read_text(encoding="utf-8")
        raiz = script.index("window.CV_I18N")
        en_corpo, _ = objeto(script, "en", raiz)
        ui_corpo, ui_inicio = objeto(script, "ui", raiz)
        ui_pt, _ = objeto(ui_corpo, "pt")
        ui_en, _ = objeto(ui_corpo, "en")
    except (OSError, ValueError) as erro:
        print(f"verificar-i18n: não consegui ler os arquivos: {erro}", file=sys.stderr)
        return 2

    ingles = {}
    for aspas, nua, valor in pares(en_corpo):
        chave = aspas or nua
        if chave in ingles:
            problemas.append(f"chave repetida em i18n.js (a última vence em silêncio): {chave}")
        ingles[chave] = valor

    for chave, textos in sorted(pagina.textos.items()):
        if len(set(textos)) > 1:
            problemas.append(f"data-i18n=\"{chave}\" tem textos diferentes em português: um inglês só não serve aos dois")
        if any(not t for t in textos):
            problemas.append(f"português vazio em data-i18n=\"{chave}\"")
        if chave not in ingles:
            problemas.append(f"falta inglês para data-i18n=\"{chave}\"")
    for chave, valor in sorted(ingles.items()):
        if chave in ESPECIAIS:
            if not pagina.titulo or not pagina.titulo.strip():
                problemas.append(f"{chave}: <{ESPECIAIS[chave]}> em português está vazio")
        elif chave not in pagina.textos:
            problemas.append(f"inglês sem par no index.html (chave órfã): {chave}")
        if not valor.strip():
            problemas.append(f"inglês vazio: {chave}")
    for chave in ESPECIAIS:
        if chave not in ingles:
            problemas.append(f"falta inglês para {chave}")

    rotulos = {lingua: {(a or n): v for a, n, v in pares(c)} for lingua, c in (("pt", ui_pt), ("en", ui_en))}
    for chave in sorted(set(rotulos["pt"]) ^ set(rotulos["en"])):
        problemas.append(f"ui: '{chave}' existe só em {'pt' if chave in rotulos['pt'] else 'en'}")
    for lingua, valores in rotulos.items():
        problemas += [f"ui.{lingua}.{chave} vazio" for chave, valor in sorted(valores.items()) if not valor.strip()]

    usos = sum(len(t) for t in pagina.textos.values())
    print(f"i18n: {len(pagina.textos)} chaves no index.html ({usos} usos), {len(ingles)} em inglês, "
          f"{len(rotulos['pt'])} rótulos de interface")
    for problema in problemas:
        print("  - " + problema)
    print("em sincronia" if not problemas else f"{len(problemas)} divergência(s)")
    return 1 if problemas else 0


if __name__ == "__main__":
    sys.exit(main())
