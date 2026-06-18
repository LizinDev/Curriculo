/* =============================================================
   Interações da página: ano do rodapé, troca de idioma (PT/EN),
   copiar contato, scroll-spy do índice e revelação ao rolar.
   Carregado com `defer`, então o DOM já existe ao executar.
   ============================================================= */
(function () {
  'use strict';

  const { en: DICT, copy: COPY } = window.CV_I18N;

  /* ---------- ano do rodapé ---------- */
  const yearEl = document.getElementById('yr');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- idioma (PT padrão no HTML, EN via dicionário) ---------- */
  const STORAGE_KEY = 'cv-lang';
  const i18nEls = document.querySelectorAll('[data-i18n]');
  const langButtons = document.querySelectorAll('.langtoggle button');
  const ptOriginal = new WeakMap();           // guarda o HTML PT original de cada elemento
  const ptTitle = document.title;
  let lang = localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'pt';

  i18nEls.forEach((el) => ptOriginal.set(el, el.innerHTML));

  function applyLang(next) {
    lang = next === 'en' ? 'en' : 'pt';
    const toEN = lang === 'en';

    i18nEls.forEach((el) => {
      const key = el.getAttribute('data-i18n');
      el.innerHTML = toEN && DICT[key] != null ? DICT[key] : ptOriginal.get(el);
    });

    document.documentElement.lang = toEN ? 'en' : 'pt-BR';
    document.title = toEN ? DICT.__title : ptTitle;
    langButtons.forEach((b) => b.classList.toggle('active', b.dataset.lang === lang));
    localStorage.setItem(STORAGE_KEY, lang);
  }

  langButtons.forEach((b) => b.addEventListener('click', () => applyLang(b.dataset.lang)));
  if (lang === 'en') applyLang('en');   // restaura preferência salva

  /* ---------- copiar contato + toast ---------- */
  const toast = document.getElementById('toast');
  let toastTimer;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1600);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      // fallback para contextos sem Clipboard API (ex.: http inseguro)
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  }

  document.querySelectorAll('.copy').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await copyText(btn.getAttribute('data-copy'));
      const labels = COPY[lang];
      btn.textContent = labels.done;
      btn.classList.add('done');
      showToast(labels.toast);
      setTimeout(() => {
        btn.textContent = labels.copy;
        btn.classList.remove('done');
      }, 1600);
    });
  });

  /* ---------- scroll-spy do índice ---------- */
  const indexLinks = document.querySelectorAll('.idx');
  const linkByHash = new Map(
    [...indexLinks].map((link) => [link.getAttribute('href').slice(1), link])
  );
  const sections = document.querySelectorAll('main section[id]');

  if ('IntersectionObserver' in window && sections.length) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          indexLinks.forEach((l) => l.classList.remove('is-active'));
          linkByHash.get(entry.target.id)?.classList.add('is-active');
        });
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
    );
    sections.forEach((section) => spy.observe(section));
  }

  /* ---------- revelação ao rolar (respeita prefers-reduced-motion) ---------- */
  const reveals = document.querySelectorAll('.reveal');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reduceMotion && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('in-view');
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.12 }
    );
    reveals.forEach((el) => revealObserver.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in-view'));
  }
})();
