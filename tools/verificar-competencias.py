#!/usr/bin/env python3
"""Confere se a tabela de competências diz o mesmo que o texto do currículo.

Cada marca da tabela (cargo ou projeto) precisa aparecer no texto daquele cargo ou
projeto, e cada aparição precisa estar marcada, nas duas línguas. Confere também os
números: projetos por competência, total de cada coluna e tamanho de cada grupo.
Só biblioteca padrão; nada é alterado. Saída 0 = bate, 1 = divergência,
2 = não deu para conferir (nunca conta como verde).

    python3 tools/verificar-competencias.py
"""

from html import unescape
from html.parser import HTMLParser
from pathlib import Path
import importlib.util
import re
import sys
import unicodedata

RAIZ = Path(__file__).resolve().parent.parent
CARGOS = ("exp-3", "exp-2", "exp-1")  # na ordem das colunas; a quarta é a dos projetos
VAZIOS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}


def normal(texto):
    texto = unescape(re.sub(r"<[^>]+>", "", texto))
    return unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode().lower()


class Leitor(HTMLParser):
    """Guarda, por bloco [data-src], o HTML e a chave de cada elemento [data-g]; e as linhas da tabela."""

    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.pilha, self.blocos, self.capturas = [], {}, []
        self.linhas, self.linha, self.celula, self.grupos, self.totais = [], None, None, [], []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for c in self.capturas:
            c["partes"].append(self.get_starttag_text())
        if tag in VAZIOS:
            return
        self.pilha.append((tag, a))
        bloco = next((x["id"] for _, x in reversed(self.pilha) if "data-src" in x), None)
        if "data-g" in a and bloco:
            self.capturas.append({"fundo": len(self.pilha), "bloco": bloco, "chave": a.get("data-i18n"), "partes": []})
        classes = (a.get("class") or "").split()
        if tag == "tr":
            self.linha = {"q": None, "cel": [], "grupo": "g" in classes}
        elif tag == "button" and "sk" in classes:
            self.linha["q"], self.linha["qe"] = a["data-q"], a["data-qe"]
        elif tag == "td" and self.linha and not self.linha["grupo"] and "f" not in classes:
            self.celula = {"usada": "u" in classes, "numero": ""}
            self.linha["cel"].append(self.celula)
        elif tag == "b" and self.dentro("thead"):
            self.totais.append("")
        elif tag == "i" and self.linha and self.linha["grupo"]:
            self.grupos.append([0, ""])

    def dentro(self, tag):
        return any(t == tag for t, _ in self.pilha)

    def handle_endtag(self, tag):
        if tag in VAZIOS:
            return
        if self.capturas and self.capturas[-1]["fundo"] == len(self.pilha):
            c = self.capturas.pop()
            self.blocos.setdefault(c["bloco"], []).append((c["chave"], "".join(c["partes"])))
        for c in self.capturas:
            c["partes"].append(f"</{tag}>")
        if tag == "td":
            self.celula = None
        if tag == "tr" and self.linha and self.linha["q"]:
            self.linhas.append(self.linha)
            self.grupos[-1][0] += 1
        self.pilha.pop()

    def handle_data(self, data):
        for c in self.capturas:
            c["partes"].append(data)
        topo = self.pilha[-1][0] if self.pilha else ""
        if self.celula is not None and topo == "b":
            self.celula["numero"] += data.strip()
        elif topo == "b" and self.dentro("thead"):
            self.totais[-1] += data.strip()
        elif topo == "i" and self.grupos and self.linha and self.linha["grupo"]:
            self.grupos[-1][1] += data.strip()

    def handle_entityref(self, name):
        self.handle_data(unescape(f"&{name};"))


def main():
    try:
        espec = importlib.util.spec_from_file_location("verificar_i18n", Path(__file__).with_name("verificar-i18n.py"))
        i18n = importlib.util.module_from_spec(espec)
        sys.dont_write_bytecode = True
        espec.loader.exec_module(i18n)
        html = (RAIZ / "index.html").read_text(encoding="utf-8")
        script = (RAIZ / "i18n.js").read_text(encoding="utf-8")
        corpo, _ = i18n.objeto(script, "en", script.index("window.CV_I18N"))
        ingles = {a or n: v.replace('\\"', '"') for a, n, v in i18n.pares(corpo)}
        leitor = Leitor()
        leitor.feed(html)
        if not leitor.linhas or any(c not in leitor.blocos for c in CARGOS) or len(leitor.totais) != 4:
            raise ValueError("tabela ou cargos não encontrados")
    except (OSError, ValueError, KeyError, IndexError) as erro:
        print(f"verificar-competencias: não consegui conferir: {erro}", file=sys.stderr)
        return 2

    problemas = []
    projetos = [b for b in leitor.blocos if b not in CARGOS and b != "perfil"]
    for lingua in ("pt", "en"):
        def texto(bloco):
            partes = []
            for chave, trecho in leitor.blocos[bloco]:
                filhos = re.findall(r'data-i18n="([^"]+)"[^>]*>', trecho) if not chave else []
                if lingua == "en" and chave:
                    trecho = ingles[chave]
                elif lingua == "en" and filhos:
                    for f in filhos:
                        trecho = re.sub(r'(data-i18n="%s"[^>]*>)[^<]*' % re.escape(f), lambda m: m.group(1) + ingles[f], trecho)
                partes.append(normal(trecho))
            return " \n ".join(partes)

        textos = {b: texto(b) for b in leitor.blocos}
        for linha in leitor.linhas:
            termos = [normal(t) for t in linha["q" if lingua == "pt" else "qe"].split("|")]
            achou = [any(t in textos[c] for t in termos) for c in CARGOS]
            quantos = sum(any(t in textos[p] for t in termos) for p in projetos)
            marcas = [c["usada"] for c in linha["cel"][:3]]
            numero = int(linha["cel"][3]["numero"] or 0) if linha["cel"][3]["usada"] else 0
            if achou != marcas or quantos != numero:
                problemas.append(f"{lingua}: {linha['q']}: texto {achou} e {quantos} projeto(s), tabela {marcas} e {numero}")
    for i, total in enumerate(leitor.totais):
        conta = sum(linha["cel"][i]["usada"] for linha in leitor.linhas)
        if str(conta) != total:
            problemas.append(f"coluna {i + 1}: diz {total}, são {conta}")
    for quantas, escrito in leitor.grupos:
        if str(quantas) != escrito:
            problemas.append(f"grupo diz {escrito} competências, tem {quantas}")
    total = len(leitor.linhas)
    for lingua, frase in (("pt", html), ("en", ingles.get("d-k-l", ""))):
        achado = re.search(r'data-i18n="d-k-l">(\d+)' if lingua == "pt" else r"^(\d+)", frase)
        if not achado or int(achado.group(1)) != total:
            problemas.append(f"{lingua}: a frase da seção não diz {total} competências")

    print(f"competências: {total} linhas, {len(projetos)} projetos, 2 línguas")
    for problema in problemas:
        print("  - " + problema)
    print("a tabela bate com o texto" if not problemas else f"{len(problemas)} divergência(s)")
    return 1 if problemas else 0


if __name__ == "__main__":
    sys.exit(main())
