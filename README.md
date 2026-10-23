# Currículo

The CV of Pedro Henrique Braz Moreira, in Portuguese and English:
**<https://lizindev.github.io/Curriculo/>**

One static page with no framework and no build step. The Portuguese text lives in
`index.html`, the English text in `i18n.js`, and the PT/EN switch swaps one for the
other in place and remembers the choice. A PDF version of the CV is linked from the page.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | the page, with the Portuguese text |
| `i18n.js` | the English text, keyed like the HTML |
| `script.js` | language switch and page behaviour |
| `styles.css`, `tokens.css` | layout and design tokens |
| `og-image.png`, `og-template.html` | the link-preview image and the page it was rendered from |
| `tools/verificar-i18n.py` | checks that both languages have the same keys; CI runs it on every push |

## Preview locally

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## License

The code (HTML structure, CSS, JavaScript and the checker) is under the
[MIT License](LICENSE). The CV itself, meaning its text, personal details and the PDF,
is not covered: all rights reserved.
