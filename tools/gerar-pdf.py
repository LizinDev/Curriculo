#!/usr/bin/env python3
"""Gera os dois PDFs para download a partir da própria página.

Sobe um servidor local, abre o index.html em cada língua (?lang=pt, ?lang=en) no
Chromium sem janela e imprime em A4 com a folha print.css. Sobrescreve os PDFs da
raiz e falha se algum não sair com exatamente duas páginas.
Precisa do Chromium e do pdfinfo (poppler). Saída 0 = gerados, 1 = fora de duas
páginas, 2 = não deu para gerar.

    python3 tools/gerar-pdf.py
"""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import threading

RAIZ = Path(__file__).resolve().parent.parent
PDFS = {"pt": "Pedro-Henrique-Braz-Moreira-CV.pdf", "en": "Pedro-Henrique-Braz-Moreira-CV-EN.pdf"}


class Silencioso(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    navegador = next((n for n in ("chromium", "google-chrome-stable", "google-chrome") if shutil.which(n)), None)
    if not navegador or not shutil.which("pdfinfo"):
        print("gerar-pdf: preciso do Chromium e do pdfinfo (poppler)", file=sys.stderr)
        return 2
    servidor = ThreadingHTTPServer(("127.0.0.1", 0), partial(Silencioso, directory=str(RAIZ)))
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    fora = 0
    try:
        for lingua, nome in PDFS.items():
            with tempfile.TemporaryDirectory() as perfil:
                destino = Path(perfil) / nome
                subprocess.run(
                    [navegador, "--headless=new", f"--user-data-dir={perfil}/chromium", "--no-pdf-header-footer",
                     "--virtual-time-budget=6000", f"--print-to-pdf={destino}",
                     f"http://127.0.0.1:{servidor.server_port}/index.html?lang={lingua}"],
                    check=True, capture_output=True, timeout=90)
                info = subprocess.run(["pdfinfo", str(destino)], check=True, capture_output=True, text=True).stdout
                paginas = int(re.search(r"Pages:\s+(\d+)", info).group(1))
                if paginas != 2:
                    fora += 1
                shutil.copyfile(destino, RAIZ / nome)
                print(f"{nome}: {paginas} página(s)")
    except (OSError, subprocess.SubprocessError, AttributeError) as erro:
        print(f"gerar-pdf: {erro}", file=sys.stderr)
        return 2
    finally:
        servidor.shutdown()
    return 1 if fora else 0


if __name__ == "__main__":
    sys.exit(main())
