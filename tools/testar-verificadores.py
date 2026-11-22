#!/usr/bin/env python3
"""Prova que os verificadores acusam o que deviam: estraga cópias e espera a saída 1.

Cada caso troca um trecho numa cópia temporária do repositório e roda um verificador.
Um verificador que continua verde depois do estrago é o defeito que este teste procura.
Saída 0 = todos acusaram (e todos passam sem estrago), 1 = algum não acusou,
2 = não deu para testar.

    python3 tools/testar-verificadores.py          # os três
    python3 tools/testar-verificadores.py --sem-pdf # sem poppler
"""

from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

RAIZ = Path(__file__).resolve().parent.parent
I18N, COMP, PDF = "verificar-i18n.py", "verificar-competencias.py", "verificar-pdf.py"
# montado em pedaços: este arquivo também é varrido atrás de telefone
FALSO = "9" + "0000"
CELULA = '<td class="u"><a href="#exp-2"><span class="vh">PJe, Pacheco</span></a></td>'
# (o que o estrago simula, verificador, arquivo, trecho, troca)
CASOS = (
    ("chave sem inglês", I18N, "i18n.js", '"nav-exp":', '"nav-xxx":'),
    ("rótulo de leitor de tela sem inglês", I18N, "index.html", ' data-aria-en="Résumé sections"', ""),
    ("marca vazia na tabela", COMP, "index.html", CELULA, '<td class="u"></td>'),
    ("marca com destino errado", COMP, "index.html", CELULA, CELULA.replace("#exp-2", "#exp-3")),
    ("marca com nome errado", COMP, "index.html", CELULA, CELULA.replace("PJe, Pacheco", "Projudi, Pacheco")),
    ("link numa célula sem marca", COMP, "index.html", CELULA, CELULA.replace(' class="u"', "")),
    ("texto do cargo mudou", COMP, "index.html", "Prazos processuais de uma carteira", "Tarefas processuais de uma carteira"),
    ("texto do cargo mudou só em inglês", COMP, "i18n.js", "Procedural deadlines for a", "Procedural tasks for a"),
    ("contagem de projetos", COMP, "index.html", "<b>6</b>", "<b>9</b>"),
    ("total da coluna", COMP, "index.html", '<b class="disp">10</b>', '<b class="disp">11</b>'),
    ("frase da seção em inglês", COMP, "i18n.js", '"17 skills', '"18 skills'),
    ("conclusão do curso", PDF, "index.html", "Concluído em 2024", "Concluído em 2023"),
    ("data de emprego no site", PDF, "index.html", "Desde set 2025", "Desde set 2024"),
    ("data de emprego em inglês", PDF, "i18n.js", "May 2023 to Sep 2024", "May 2022 to Sep 2024"),
    ("PDF não regerado", PDF, "cv/textos.json", "Relatórios gerenciais e processuais periódicos", "Relatórios trimestrais"),
    ("cargo do site", PDF, "index.html", 'data-i18n="c1-role">Controller Jurídico', 'data-i18n="c1-role">Coordenação Jurídica'),
    ("escritório do site", PDF, "index.html", "Pacheco Sociedade de Advocacia</span>", "Pacheco Advogados</span>"),
    ("nível de idioma", PDF, "index.html", "Avançado, Centro Europeu", "Básico, Centro Europeu"),
    ("sistema novo só no site", PDF, "index.html", 'data-q="Projudi"', 'data-q="Themis"'),
    ("telefone num arquivo novo", PDF, "notas.txt", None, f"fale comigo: +55 11 {FALSO} 0000\n"),
    ("telefone em outro formato", PDF, "README.md", "## License", f"11.{FALSO}-0000\n\n## License"),
)
TROCAS_DE_PDF = (
    ("PDF de duas páginas e sem telefone (o de antes)", PDF, "bc54e30"),
)


def copia(pasta):
    destino = Path(pasta) / "copia"
    shutil.copytree(RAIZ, destino, ignore=shutil.ignore_patterns("telefone.txt", "__pycache__"))
    return destino


def rodar(destino, verificador):
    return subprocess.run([sys.executable, "-B", str(destino / "tools" / verificador)], capture_output=True, text=True)


def main():
    sem_pdf = "--sem-pdf" in sys.argv[1:]
    verificadores = [v for v in (I18N, COMP, PDF) if not (sem_pdf and v == PDF)]
    falhas = 0
    with tempfile.TemporaryDirectory() as pasta:
        limpa = copia(pasta)
        for v in verificadores:
            r = rodar(limpa, v)
            if r.returncode != 0:
                print(f"testar-verificadores: {v} já sai {r.returncode} sem estrago:\n{r.stdout}{r.stderr}", file=sys.stderr)
                return 2
    casos = [c for c in CASOS if c[1] in verificadores]
    for nome, verificador, arquivo, trecho, troca in casos:
        with tempfile.TemporaryDirectory() as pasta:
            destino = copia(pasta)
            alvo = destino / arquivo
            if trecho is None:
                alvo.write_text(troca, encoding="utf-8")
                subprocess.run(["git", "-C", str(destino), "add", "-N", arquivo], check=True, capture_output=True)
            else:
                texto = alvo.read_text(encoding="utf-8")
                if trecho not in texto:
                    print(f"testar-verificadores: o caso \"{nome}\" não acha o trecho em {arquivo}", file=sys.stderr)
                    return 2
                alvo.write_text(texto.replace(trecho, troca, 1), encoding="utf-8")
            r = rodar(destino, verificador)
            if r.returncode != 1:
                falhas += 1
                print(f"  - {verificador} saiu {r.returncode} com: {nome}")
    if not sem_pdf:
        for nome, verificador, commit in TROCAS_DE_PDF:
            with tempfile.TemporaryDirectory() as pasta:
                destino = copia(pasta)
                pdf = "Pedro-Henrique-Braz-Moreira-CV.pdf"
                antigo = subprocess.run(["git", "-C", str(RAIZ), "show", f"{commit}:{pdf}"], capture_output=True)
                if antigo.returncode != 0:
                    print(f"  (pulado, clone raso: {nome})")
                    continue
                (destino / pdf).write_bytes(antigo.stdout)
                r = rodar(destino, verificador)
                if r.returncode != 1 or "páginas" not in r.stdout or "0 telefone" not in r.stdout:
                    falhas += 1
                    print(f"  - {verificador} saiu {r.returncode} com: {nome}")
    print(f"{len(casos)} estragos em {len(verificadores)} verificadores")
    print("todos acusados" if not falhas else f"{falhas} passaram despercebidos")
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
