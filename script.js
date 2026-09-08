/* =============================================================
   Interações da página.

   São três, e só três:
     1. troca de idioma PT/EN
     2. índice grudado que marca a seção em que você está
     3. copiar contato (com estados e aviso, porque copiar
        não tem efeito visível na página)

   A animação de entrada é 100% CSS — não há observador de rolagem
   revelando seção por seção. Carregado com `defer`, o DOM já existe.
   ============================================================= */
(function () {
  'use strict';

  const { en: DICT, ui: UI } = window.CV_I18N;

  /* ---------- ano do rodapé ---------- */
  const yearEl = document.getElementById('yr');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- idioma ------------------------------------------------
     O PT é o que está escrito no HTML; guardamos o original de cada
     elemento e trocamos para o dicionário EN quando pedido.
     ------------------------------------------------------------------ */
  const STORAGE_KEY = 'cv-lang';
  const i18nEls = document.querySelectorAll('[data-i18n]');
  const langButtons = document.querySelectorAll('.lang button');
  const ptOriginal = new WeakMap();
  const ptTitle = document.title;
  // Leitura protegida como a escrita mais abaixo. Em janela privada, ou com
  // armazenamento de site bloqueado, getItem lanca — e como isto roda na
  // inicializacao, a excecao derrubava o script inteiro: sem troca de idioma,
  // sem copiar, sem indice ativo. A pagina precisa abrir mesmo sem storage.
  let idiomaSalvo = null;
  try { idiomaSalvo = localStorage.getItem(STORAGE_KEY); } catch (_) { /* modo privado */ }
  let lang = idiomaSalvo === 'en' ? 'en' : 'pt';

  i18nEls.forEach((el) => ptOriginal.set(el, el.innerHTML));

  function applyLang(next) {
    lang = next === 'en' ? 'en' : 'pt';
    const toEN = lang === 'en';

    i18nEls.forEach((el) => {
      const key = el.getAttribute('data-i18n');
      el.innerHTML = toEN && DICT[key] != null ? DICT[key] : ptOriginal.get(el);
    });

    // os botões de copiar acabaram de ter o rótulo reescrito: zera o estado
    document.querySelectorAll('.copy').forEach((btn) => {
      btn.classList.remove('is-done', 'is-error');
      btn.removeAttribute('aria-busy');
    });

    document.documentElement.lang = toEN ? 'en' : 'pt-BR';
    document.title = toEN ? DICT.__title : ptTitle;

    langButtons.forEach((b) => {
      const on = b.dataset.lang === lang;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });

    try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) { /* modo privado */ }
  }

  langButtons.forEach((b) => b.addEventListener('click', () => applyLang(b.dataset.lang)));
  if (lang === 'en') applyLang('en');

  /* ---------- copiar contato ---------------------------------------- */
  const toast = document.getElementById('toast');
  let toastTimer;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      // writeText pode ficar pendente para sempre se a aba perder o foco;
      // sem esse limite o botão travaria em "ocupado".
      await Promise.race([
        navigator.clipboard.writeText(text),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('clipboard timeout')), 3000)
        )
      ]);
      return;
    }
    // contexto inseguro (http): caminho antigo
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:absolute;left:-9999px;top:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    if (!ok) throw new Error('execCommand copy failed');
  }

  let resetTimer;

  document.querySelectorAll('.copy').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.setAttribute('aria-busy', 'true');

      try {
        await copyText(btn.getAttribute('data-copy'));
        // UI[lang] lido DEPOIS do await, nao antes: quem troca o idioma
        // enquanto a copia acontece via um "Copied" em pagina portuguesa.
        btn.textContent = UI[lang].done;
        btn.classList.add('is-done');
        btn.classList.remove('is-error');
        showToast(UI[lang].toastDone);
      } catch (_) {
        btn.textContent = UI[lang].failed;
        btn.classList.add('is-error');
        btn.classList.remove('is-done');
        showToast(UI[lang].toastFail);
      } finally {
        btn.removeAttribute('aria-busy');
      }

      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        document.querySelectorAll('.copy').forEach((b) => {
          b.textContent = UI[lang].copy;
          b.classList.remove('is-done', 'is-error');
        });
      }, 2200);
    });
  });

  /* ---------- índice: marca a seção corrente ------------------------ */
  const indexLinks = document.querySelectorAll('.mast__index a');
  const indexStrip = document.querySelector('.mast__index ul');
  const linkByHash = new Map(
    [...indexLinks].map((link) => [link.getAttribute('href').slice(1), link])
  );
  const sections = document.querySelectorAll('main section[id]');

  // mantém o item ativo visível quando a tira rola na horizontal (celular)
  function keepInView(link) {
    if (!indexStrip || indexStrip.scrollWidth <= indexStrip.clientWidth) return;
    const left = link.offsetLeft;
    const right = left + link.offsetWidth;
    const viewLeft = indexStrip.scrollLeft;
    const viewRight = viewLeft + indexStrip.clientWidth;
    if (left < viewLeft) indexStrip.scrollLeft = left - 16;
    else if (right > viewRight) indexStrip.scrollLeft = right - indexStrip.clientWidth + 16;
  }

  if ('IntersectionObserver' in window && sections.length) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const link = linkByHash.get(entry.target.id);
          if (!link || link.classList.contains('is-active')) return;
          // aria-current junto da classe: o destaque da secao atual era so
          // visual, entao quem navega por leitor de tela nao tinha como saber
          // em que parte do curriculo estava.
          indexLinks.forEach((l) => {
            l.classList.remove('is-active');
            l.removeAttribute('aria-current');
          });
          link.classList.add('is-active');
          link.setAttribute('aria-current', 'true');
          keepInView(link);
        });
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
    );
    sections.forEach((section) => spy.observe(section));
  }
})();
