/* =============================================================
   Traduções (PT é o padrão escrito no HTML; EN vem daqui).
   Cada chave corresponde a um atributo data-i18n no index.html.
   `copy` guarda os rótulos do botão de copiar / toast por idioma.
   ============================================================= */
window.CV_I18N = {
  en: {
    __title: "Pedro Henrique Braz Moreira — Legal Operations Controller",
    railtag: "Control sheet",
    "nav-perfil": "Profile", "nav-exp": "Experience", "nav-form": "Education",
    "nav-comp": "Skills", "nav-proj": "Projects", "nav-cont": "Contact",
    download: "Download CV (PDF)",

    "hero-eyebrow": "Law Graduate · Legal Operations Controller",
    "hero-role": "// deadline control · case workflow · automations",
    "hero-thesis": "Deadline control, case workflow and <em>automations</em> — the legal routine of major accounts, organized and under control.",
    "ficha-funcao": "Role", "ficha-funcao-v": "Legal Controller — Hasson Advogados",
    "ficha-local": "Location", "ficha-local-v": "Curitiba, Paraná · Brazil",
    "ficha-foco": "Focus", "ficha-foco-v": "Civil law · Case control & management",
    "ficha-idiomas": "Languages", "ficha-idiomas-v": "Portuguese · English · German",

    "s1-eyebrow": "§ 01 · Profile",
    "s1-h2": "Law and automation, integrated",
    "s1-lede": "Law graduate from PUC-PR, with solid experience in civil legal routines, case control and deadline management for large corporate accounts. Currently <strong>Legal Controller at <a class=\"ilink\" href=\"https://hassonadvogados.com.br/sobre/\" target=\"_blank\" rel=\"noopener\">Hasson Advogados</a></strong>, serving clients such as O Boticário and BRF. Combines a technical foundation in Civil, Labor and Medical Law with an uncommon edge in the field: command of multiple court systems and legal software, plus programming skills that drive automation and the organization of workflows.",

    "s2-eyebrow": "§ 02 · Experience", "s2-h2": "Career",
    "c1-now": "● current", "c1-date": "Sep 2025 — Present", "c1-area": "Civil law", "c1-role": "Legal Controller",
    "c1-b1": "Control and management of procedural deadlines for a high-volume corporate portfolio, with clients such as O Boticário and BRF.",
    "c1-b2": "Filing of petitions and case tracking across the main court systems (PJe, EPROC, Projudi and Esaj).",
    "c1-b3": "Preparation of periodic managerial and procedural reports for clients.",
    "c1-b4": "Management of information and workflows in legal platforms such as LegalOne and CPJ.",
    "c2-date": "May 2023 — Sep 2024", "intern": "Law Internship",
    "c2-b1": "Support in drafting defenses and other legal documents in Medical Law cases.",
    "c2-b2": "Drafting of initial petitions, filings and other documents in Labor claims.",
    "c2-b3": "Direct client assistance and guidance on procedural questions.",
    "c2-b4": "Deadline tracking and document filing in the CPJ, Projudi, Esaj and PJe systems.",
    "c3-date": "Mar 2020 — Mar 2021", "intern2": "Law Internship",
    "c3-b1": "Legal research in Civil, Real Estate and Banking Law.",
    "c3-b2": "Drafting of petitions and other legal documents.",
    "c3-b3": "Document filing and case tracking in courts and tribunals.",
    "c3-b4": "Preparation of monthly reports for clients.",

    "s3-eyebrow": "§ 03 · Education", "s3-h2": "Education & Languages",
    "edu-h3": "Bachelor of Laws (LL.B.)", "edu-org": "PUC-PR · Curitiba/PR · 2020 — 2024 · Class of 2025",
    "lang-label": "Languages",
    "lang-en": "<strong>English</strong> — Advanced · full course at Phil Young's",
    "lang-de": "<strong>German</strong> — Advanced · Centro Europeu (Curitiba)",
    "lang-pt": "<strong>Portuguese</strong> — Native",

    "s4-eyebrow": "§ 04 · Skills", "s4-h2": "Tools & Domains",
    "k-sistemas": "Systems & courts", "chip-office": "Microsoft Office",
    "k-tecnicas": "Technical",
    "tec-1": "Control and management of procedural deadlines",
    "tec-2": "Petition filing and case tracking",
    "tec-3": "Legal drafting and research",
    "tec-4": "Managerial and procedural reporting",
    "k-dif": "Edge", "dif-1": "Programming skills applied to automating and organizing legal routines",
    "k-comp": "Soft skills",
    "soft-1": "Organization", "soft-2": "Communication", "soft-3": "Negotiation",
    "soft-4": "Teamwork", "soft-5": "Attention to detail",

    "s5-eyebrow": "§ 05 · Projects", "s5-h2": "Law turned into code",
    "s5-lede": "Tools I built to automate my own legal routine — deadline control, CNJ communications and migration between systems. Open source on GitHub.",
    "p1-h3": "Legal Automation", "p1-p": "Automates the creation of appointments, hearings and tasks in NovaJus (LegalOne) via Selenium, with a graphical interface and three operation modes — full hearing, defense and registration.",
    "p2-h3": "CNJ Communications", "p2-p": "Dashboard that queries the public PJe/CNJ API (DJEN) in real time: subpoenas, notices and trial dockets. Filters, auto-refresh, handled-status marking and Excel export.",
    "p3-h3": "ELAW → LegalOne Migration", "p3-p": "Command-line tool that migrates cases from the ELAW Gerencial system to the LegalOne template, with automatic field mapping (court, area, dates, values) and a reconciliation report.",
    "p4-h3": "More on GitHub", "p4-p": "Other experiments and tools — from legal tech to the Linux desktop. See the full profile with repositories and recent activity.",

    "s6-eyebrow": "§ 06 · Contact", "s6-h2": "Let's talk",
    "c-email": "Email", "copy": "Copy", "ref-label": "Reference"
  },

  /* rótulos do botão de copiar + mensagem do toast, por idioma */
  copy: {
    pt: { copy: "Copiar", done: "Copiado", toast: "Copiado para a área de transferência" },
    en: { copy: "Copy",   done: "Copied",  toast: "Copied to clipboard" }
  }
};
