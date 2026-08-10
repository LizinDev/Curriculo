/* =============================================================
   Traduções. O português é o que está escrito no index.html;
   o inglês vem daqui. Cada chave corresponde a um data-i18n.

   Ao editar um texto no HTML, edite a chave equivalente aqui —
   as duas línguas andam juntas.
   ============================================================= */
window.CV_I18N = {
  en: {
    __title: "Pedro Henrique Braz Moreira — Legal Operations Controller",

    /* ---------- cabeçalho ---------- */
    skip: "Skip to content",
    "mast-sheet": "Control sheet",
    "mast-place": "Curitiba, Brazil",
    "mast-rev": "Rev. Aug 2026",
    download: "Download CV",

    "nav-perfil": "Profile",
    "nav-exp": "Experience",
    "nav-form": "Education",
    "nav-comp": "Skills",
    "nav-proj": "Projects",
    "nav-cont": "Contact",

    /* ---------- dobra ---------- */
    thesis: "Deadline control, case workflow and <span class=\"ul\">automation</span> — the legal routine of major accounts, organised and under control.",

    "ficha-funcao": "Role",
    "ficha-funcao-v": "Legal Controller — Hasson Advogados",
    "ficha-foco": "Focus",
    "ficha-foco-v": "Civil law · Case control & management",
    "ficha-local": "Location",
    "ficha-local-v": "Curitiba, Paraná · Brazil",
    "ficha-idiomas": "Languages",
    "ficha-idiomas-v": "Portuguese · English · German",

    /* ---------- perfil ---------- */
    "s1-h2": "Law and automation, integrated",
    "s1-lede": "Law graduate from PUC-PR, with solid experience in civil legal routines, case control and deadline management for large corporate accounts. Currently <strong>Legal Controller at <a class=\"ilink\" href=\"https://hassonadvogados.com.br/sobre/\" target=\"_blank\" rel=\"noopener\">Hasson Advogados</a></strong>, serving clients such as O Boticário and BRF. Combines a technical foundation in Civil, Labour and Medical Law with an uncommon edge in the field: command of multiple court systems and legal software, plus programming skills that drive automation and the organisation of workflows.",

    /* ---------- experiência ---------- */
    "s2-h2": "Track record",
    "c1-date": "Sep 2025 — Present",
    "c1-now": "current",
    "c1-role": "Legal Controller",
    "c1-where": " · Curitiba/PR · Civil law",
    "c1-b1": "Control and management of procedural deadlines for a high-volume corporate portfolio, with clients such as O Boticário and BRF.",
    "c1-b2": "Filing of petitions and case tracking across the main court systems (PJe, EPROC, Projudi and Esaj).",
    "c1-b3": "Preparation of periodic managerial and procedural reports for clients.",
    "c1-b4": "Management of information and workflows in legal platforms such as LegalOne and CPJ.",

    "c2-date": "May 2023 — Sep 2024",
    intern: "Law Internship",
    "c2-where": " · Curitiba/PR",
    "c2-b1": "Support in drafting defences and other legal documents in Medical Law cases.",
    "c2-b2": "Drafting of initial petitions, filings and other documents in Labour claims.",
    "c2-b3": "Direct client assistance and guidance on procedural questions.",
    "c2-b4": "Deadline tracking and document filing in the CPJ, Projudi, Esaj and PJe systems.",

    "c3-date": "Mar 2020 — Mar 2021",
    intern2: "Law Internship",
    "c3-where": " · Curitiba/PR",
    "c3-b1": "Legal research in Civil, Real Estate and Banking Law.",
    "c3-b2": "Drafting of petitions and other legal documents.",
    "c3-b3": "Document filing and case tracking in courts and tribunals.",
    "c3-b4": "Preparation of monthly reports for clients.",

    /* ---------- formação ---------- */
    "s3-h2": "Education &amp; languages",
    "edu-h3": "Bachelor of Laws (LL.B.)",
    "edu-org": "Curitiba/PR · 2020 — 2024 · Class of 2025",
    "lang-pt-n": "Portuguese",
    "lang-pt-v": "Native",
    "lang-en-n": "English",
    "lang-en-v": "Advanced · Phil Young's",
    "lang-de-n": "German",
    "lang-de-v": "Advanced · Centro Europeu",

    /* ---------- competências ---------- */
    "s4-h2": "Tools &amp; domains",
    "k-sistemas": "Court systems",
    "k-plataformas": "Legal platforms",
    "chip-office": "Microsoft Office",
    "k-tecnicas": "Technical",
    "tec-all": "Control and management of procedural deadlines · Petition filing and case tracking · Legal drafting and research · Managerial and procedural reporting",
    "k-dif": "Edge",
    "dif-1": "Programming skills applied to automating and organising legal routines",
    "k-comp": "Soft skills",
    "soft-all": "Organisation · Communication · Negotiation · Teamwork · Attention to detail",

    /* ---------- projetos ---------- */
    "s5-h2": "Law turned into code",
    "s5-lede": "Tools I built to automate my own legal routine — deadline control, CNJ communications and migration between systems. Open source on GitHub.",
    "p1-h3": "Legal Automation",
    "p1-p": "Automates the creation of appointments, hearings and tasks in NovaJus (LegalOne) via Selenium, with a graphical interface and three operation modes — full hearing, defence and registration.",
    "p2-h3": "CNJ Communications",
    "p2-p": "Dashboard that queries the public PJe/CNJ API (DJEN) in real time: subpoenas, notices and trial dockets. Filters, auto-refresh, handled-status marking and Excel export.",
    "p3-h3": "ELAW → LegalOne Migration",
    "p3-p": "Command-line tool that migrates cases from the ELAW Gerencial system to the LegalOne template, with automatic field mapping (court, area, dates, values) and a reconciliation report.",
    "p4-h3": "More on GitHub",
    "p4-p": "Other experiments and tools — from legal tech to the Linux desktop. See the full profile with repositories and recent activity.",

    /* ---------- contato ---------- */
    "s6-h2": "Let's talk",
    "c-email": "Email",
    copy: "Copy",
    "ref-label": "Reference",

    /* ---------- colofão ---------- */
    "col-doc": "Document",
    "col-doc-v": "Curriculum vitae of Pedro Henrique Braz Moreira, Legal Controller. Single static page, no trackers. A PDF version is available for download at the top.",
    "col-type": "Typography",
    "col-type-1": "for headings",
    "col-type-2": "for body",
    "col-type-3": "for data",
    "col-src": "Source",
    "col-src-v": "HTML, CSS and JavaScript written by hand. Published on GitHub Pages."
  },

  /* rótulos do botão copiar + mensagens do toast, por idioma */
  ui: {
    pt: {
      copy: "Copiar",
      done: "Copiado",
      failed: "Falhou",
      toastDone: "Copiado para a área de transferência",
      toastFail: "Não foi possível copiar — selecione e copie manualmente"
    },
    en: {
      copy: "Copy",
      done: "Copied",
      failed: "Failed",
      toastDone: "Copied to clipboard",
      toastFail: "Couldn't copy — please select and copy manually"
    }
  }
};
