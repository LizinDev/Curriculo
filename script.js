/* =============================================================
   Interações da página.

     1. lógica pura: número CNJ, intervalos do pdf-splitter e a
        rodada do TarefasLegalOne (regras conferidas no código real)
     2. troca de idioma PT/EN e textos que o script monta
     3. demonstrações, busca no currículo e botões de copiar
     4. o cano que acende com a rolagem, o cabeçalho que recolhe e
        as ferramentas que param uma tela cada

   Carregado com `defer`: o DOM já existe. Nada sai do navegador.
   ============================================================= */
/* ---- lógica pura ---- */
var LOGIC = (function () {
  'use strict';
  // CNJ: NNNNNNN DD AAAA J TR OOOO, ISO 7064 mod 97-10
  function mod97(digits) {
    var r = 0;
    for (var i = 0; i < digits.length; i++) r = (r * 10 + (digits.charCodeAt(i) - 48)) % 97;
    return r;
  }
  function cnjParse(raw) {
    var d = String(raw).replace(/[\s.\-\/]/g, '');
    if (/[^0-9]/.test(d)) return { kind: 'chars' };
    if (d.length === 0) return { kind: 'empty' };
    if (d.length !== 20) return { kind: d.length < 20 ? 'short' : 'long', n: Math.abs(20 - d.length) };
    var s = {
      seq: d.slice(0, 7),
      dv: d.slice(7, 9),
      ano: d.slice(9, 13),
      j: d.slice(13, 14),
      tr: d.slice(14, 16),
      o: d.slice(16),
    };
    var body = s.seq + s.ano + s.j + s.tr + s.o;
    s.exp = String(98 - mod97(body + '00')).padStart(2, '0');
    s.ok = mod97(body + s.dv) === 1 && s.dv === s.exp;
    s.fmt = s.seq + '-' + s.dv + '.' + s.ano + '.' + s.j + '.' + s.tr + '.' + s.o;
    s.kind = 'full';
    return s;
  }
  var UF = [
    'AC',
    'AL',
    'AP',
    'AM',
    'BA',
    'CE',
    'DF',
    'ES',
    'GO',
    'MA',
    'MT',
    'MS',
    'MG',
    'PA',
    'PB',
    'PR',
    'PE',
    'PI',
    'RJ',
    'RN',
    'RS',
    'RO',
    'RR',
    'SC',
    'SE',
    'SP',
    'TO',
  ];
  function court(j, tr) {
    // '' quando o código não tem tribunal conhecido
    var n = +tr,
      sup = { 1: 'STF', 2: 'CNJ', 3: 'STJ', 5: 'TST', 6: 'TSE', 7: 'STM' };
    if (tr === '00') return sup[j] || '';
    if (tr === '90') return { 4: 'CJF', 5: 'CSJT' }[j] || '';
    if (j === '4') return n <= 6 ? 'TRF' + n : '';
    if (j === '5') return n <= 24 ? 'TRT' + n : '';
    if (j === '6') return n <= 27 ? 'TRE-' + UF[n - 1] : '';
    if (j === '7') return n <= 12 ? 'CJM ' + n : '';
    if (j === '8') return n <= 27 ? (n === 7 ? 'TJDFT' : 'TJ' + UF[n - 1]) : '';
    if (j === '9') return { 13: 'TJMMG', 21: 'TJMRS', 26: 'TJMSP' }[n] || '';
    return '';
  }
  // pdf-splitter: espelha pdfsplit/core.py (parse_ranges, validate_against, output_path_for, _dedupe)
  function pyInt(s) {
    if (!/^\s*[+-]?\d+(_\d+)*\s*$/.test(s)) return null;
    return parseInt(s.replace(/[_\s]/g, ''), 10);
  }
  function parseToken(tok) {
    var a,
      b,
      i = tok.indexOf('-');
    if (i >= 0) {
      a = pyInt(tok.slice(0, i));
      b = pyInt(tok.slice(i + 1));
    } else {
      a = b = pyInt(tok);
    }
    if (a === null || b === null) return { err: 'token', token: tok };
    if (a < 1) return { err: 'start', n: a };
    if (b < a) return { err: 'back', start: a, end: b };
    return { start: a, end: b, label: a === b ? String(a) : a + '-' + b };
  }
  function pdf(text, total, stem) {
    var toks = text
        .trim()
        .split(/[,\s]+/)
        .filter(Boolean),
      good = [],
      err = null;
    toks.forEach(function (t) {
      var r = parseToken(t);
      if (r.err) {
        err = err || r;
      } else good.push(r);
    });
    if (!err && !good.length) err = { err: 'none' };
    if (!err)
      good.some(function (r) {
        if (r.end > total) {
          err = { err: 'exceeds', label: r.label, total: total };
          return true;
        }
      });
    var taken = {},
      files = [];
    if (!err)
      good.forEach(function (r) {
        var base = stem + '_pages_' + r.label,
          name = base,
          k = 2;
        while (taken[name]) name = base + '_' + k++;
        taken[name] = 1;
        files.push({ name: name + '.pdf', count: r.end - r.start + 1 });
      });
    return { ranges: good, files: files, err: err };
  }
  return { mod97: mod97, cnjParse: cnjParse, court: court, pdf: pdf };
})();
/* ---- máquina de estados da rodada (regras do ledger do TarefasLegalOne) ---- */
var RodadaFSM = (function () {
  'use strict';
  // o que cada linha fictícia é no "Legal One" deste exemplo
  var TIPO = ['novo', 'tinha', 'novo', 'inexistente', 'falha', 'novo'];
  var N = TIPO.length,
    MAX_ERROS = 3;
  function copia(s) {
    return JSON.parse(JSON.stringify(s));
  }
  function abertura() {
    return {
      rodando: false,
      saida: 130,
      motivo: 'ctrlc',
      ledger: { 0: 'ok', 1: 'recadastrada' },
      run: {
        pular: false,
        retentar: false,
        fila: [0, 1, 2, 3, 4, 5],
        puladas: [],
        feitas: [0, 1],
        pos: 2,
        seguidos: 0,
        falha: false,
      },
    };
  }
  function nosso(x) {
    return x === 'ok' || x === 'recadastrada';
  }
  // retomada comum pula tudo que está no ledger; --retentar pula só ok e recadastrada
  function montarFila(ledger, retentar) {
    var f = [];
    for (var i = 0; i < N; i++) if (!(i in ledger) || (retentar && !nosso(ledger[i]))) f.push(i);
    return f;
  }
  function resultado(i, s) {
    if (s.run.falha) return 'erro';
    switch (TIPO[i]) {
      case 'tinha':
        return s.run.pular ? 'ja_existia' : 'recadastrada';
      case 'inexistente':
        return 'nao_encontrado';
      case 'ambiguo':
        return 'ambiguo';
      case 'falha':
        return s.ledger[i] === 'erro' ? 'ok' : 'erro';
      default:
        return 'ok';
    }
  }
  function reduzir(s0, ev) {
    var s = copia(s0),
      r = s.run,
      f,
      i,
      x;
    switch (ev.tipo) {
      case 'iniciar':
        if (s.rodando) return s;
        f = montarFila(s.ledger, !!ev.retentar);
        s.run = {
          pular: !!ev.pular,
          retentar: !!ev.retentar,
          fila: f,
          puladas: [],
          feitas: [],
          pos: 0,
          seguidos: 0,
          falha: !!ev.falha,
        };
        for (i = 0; i < N; i++) if (f.indexOf(i) < 0) s.run.puladas.push(i);
        if (!f.length) {
          s.saida = 0;
          s.motivo = 'nada';
          return s;
        }
        s.rodando = true;
        s.saida = null;
        s.motivo = null;
        return s;
      case 'passo':
        if (!s.rodando) return s;
        i = r.fila[r.pos];
        x = resultado(i, s);
        s.ledger[i] = x;
        r.feitas.push(i);
        r.pos++;
        if (x === 'erro') {
          if (++r.seguidos >= MAX_ERROS) {
            s.rodando = false;
            s.saida = 1;
            s.motivo = 'disjuntor';
            r.falha = false;
            return s;
          }
        } else r.seguidos = 0;
        if (r.pos >= r.fila.length) {
          s.rodando = false;
          s.saida = 0;
          s.motivo = 'fim';
          r.falha = false;
        }
        return s;
      case 'interromper': // a linha em andamento não é gravada
        if (!s.rodando) return s;
        s.rodando = false;
        s.saida = 130;
        s.motivo = 'ctrlc';
        r.falha = false;
        return s;
      case 'derrubar': // falha externa: cada linha vira erro até o disjuntor
        if (s.rodando && r.fila.length - r.pos + r.seguidos >= MAX_ERROS) {
          r.falha = true;
          return s;
        }
        if (s.rodando || montarFila(s.ledger, !!ev.retentar).length < MAX_ERROS) s = abertura();
        return reduzir(s, { tipo: 'iniciar', pular: ev.pular, retentar: ev.retentar, falha: true });
      case 'reiniciar':
        return abertura();
    }
    return s;
  }
  function contar(ledger) {
    var c = { ok: 0, recadastrada: 0, ja_existia: 0, nao_encontrado: 0, ambiguo: 0, erro: 0 };
    for (var k in ledger) c[ledger[k]]++;
    return c;
  }
  function naRodada(s, i) {
    var r = s.run;
    if (r.puladas.indexOf(i) >= 0) return 'pulada';
    if (r.feitas.indexOf(i) >= 0) return 'gravada';
    if (r.fila[r.pos] === i && s.rodando) return 'localizando';
    if (r.fila[r.pos] === i && s.motivo === 'ctrlc') return 'cortada';
    return 'fila';
  }
  function comando(pular, retentar) {
    return ['python main.py', '--planilha exemplo.xlsx', '--tarefa auto', '--executar'].concat(
      pular ? ['--pular-existentes'] : [],
      retentar ? ['--retentar'] : [],
    );
  }
  return {
    N: N,
    abertura: abertura,
    reduzir: reduzir,
    contar: contar,
    naRodada: naRodada,
    comando: comando,
    montarFila: montarFila,
  };
})();
if (typeof module !== 'undefined') module.exports = { LOGIC: LOGIC, RUN: RodadaFSM };

(function () {
  'use strict';
  var $ = function (id) {
    return document.getElementById(id);
  };

  var T = {
    pt: {
      hero: [
        ['prazos', 1, '> rotina sob controle', 1, 'Ver os projetos', '#projetos'],
        ['planilha', 0.86, '> tarefas cadastradas', 1, 'Ver TarefasLegalOne', '#tarefas'],
        ['PDF', 1, '> um arquivo por intervalo', 0.84, 'Ver pdf-splitter', '#pdf'],
        ['DataJud\ne DJEN', 0.5, '> linguagem simples', 1, 'Ver Hasson Portal', '#t-portal'],
      ],
      code: 'código',
      zero: 'Sequencial zero, só para o exemplo fictício.',
      swap: 'Esperados: {e}. Dois dígitos trocados. A conferência existe para pegar erros de digitação como este.',
      run: {
        ctrlc: 'Interrompida na linha {l}, que ficou de fora. {g} {p}, {f} na fila.',
        disj: 'PARADO: 3 falhas consecutivas. Os erros ficam no registro para -\u2060-\u2060retentar, já marcado.',
        fim: 'Fila concluída. {g} {p} nesta rodada.',
        fimE: ' Erros no registro: {e}. -\u2060-\u2060retentar já está marcado.',
        nada: 'Nada a fazer. Os 6 processos já estão no registro.',
        comeco: '{n} na fila, {k} já no registro.',
        passo: 'Linha {l}, {k} de {n} nesta rodada.',
        g: ['processo gravado', 'processos gravados'],
        nr: {
          pulada: 'pulada',
          gravada: 'gravada',
          localizando: 'localizando',
          cortada: 'não gravada',
          fila: 'na fila',
        },
        parar: 'Interromper (Ctrl+C)',
        repetir: 'Repetir o comando',
        exec: 'Executar',
        execR: 'Executar com -\u2060-\u2060retentar',
        dia: 'cadastrados_AAAA-MM-DD.xlsx',
        code: 'Código de saída {c}. ',
      },
      bad: 'Não confere.',
      ok: 'Confere.',
      badP: 'Os dígitos seriam {e}. O número traz {d}.',
      okP: 'Os dígitos verificadores são {d}.',
      badC: 'Inválido.',
      noSeg: 'Os dígitos conferem, mas o segmento 0 não existe.',
      noCourt: 'Os dígitos conferem, mas o tribunal {t} não existe no segmento {j}.',
      empty: 'Digite um número.',
      short: 'Faltam dígitos: {n}.',
      long: 'Dígitos a mais: {n}.',
      chars: 'Use só dígitos, ponto e hífen.',
      inc: 'Incompleto.',
      over: 'Longo demais.',
      unread: 'Ilegível.',
      wait: 'O formato é NNNNNNN-DD.AAAA.J.TR.OOOO, com 20 dígitos.',
      seq: ['Sequencial.', 'Ordem do processo na unidade de origem, reiniciada a cada ano.'],
      dv: [
        'Dígitos verificadores.',
        'Esperados: {e}. A conferência existe para pegar erros de digitação.',
        'Conferem.',
      ],
      ano: ['Ano', 'do ajuizamento.'],
      seg: ['Segmento.', 'Código não previsto.'],
      tri: ['Tribunal.', 'Código não previsto para este segmento.'],
      ori: ['Origem.', 'Processo originário do tribunal.', 'Código da unidade de origem no tribunal.'],
      J: [
        '',
        'Supremo Tribunal Federal',
        'Conselho Nacional de Justiça',
        'Superior Tribunal de Justiça',
        'Justiça Federal',
        'Justiça do Trabalho',
        'Justiça Eleitoral',
        'Justiça Militar da União',
        'Justiça dos Estados e do Distrito Federal e Territórios',
        'Justiça Militar Estadual',
      ],
      eTok: "'{token}' não é uma página ou intervalo válido.",
      eStart: 'As páginas começam em 1 (recebido {n}).',
      eBack: 'O intervalo {start}-{end} está invertido (o fim deve ser maior ou igual ao início).',
      eNone: 'Nenhum intervalo de páginas foi informado.',
      eExc: 'O intervalo {label} ultrapassa o documento ({total} páginas).',
      eNote: 'Código de saída 1. Nenhum arquivo é criado.',
      pg: ['página', 'páginas'],
      ov: 'Páginas em mais de um arquivo: {p}.',
      noOv: 'Nenhuma página se repete.',
      map: 'Mapa de {n} páginas. Intervalos: {r}. {o}',
      cel: { saida: 'saída', fechar: 'Fechar', fazia: 'O que eu fazia', cod: 'código', erro: 'erro', arq: ['arquivo', 'arquivos'] },
      less: 'Uma página a menos',
      more: 'Uma página a mais',
      title: document.title,
    },
    en: {
      hero: [
        ['deadlines', 1, '> routine under control', 1, 'See the projects', '#projetos'],
        ['spreadsheet', 0.74, '> tasks entered', 1, 'See TarefasLegalOne', '#tarefas'],
        ['PDF', 1, '> one file per range', 1, 'See pdf-splitter', '#pdf'],
        ['DataJud\nand DJEN', 0.5, '> plain language', 1, 'See Hasson Portal', '#t-portal'],
      ],
      code: 'code',
      zero: 'Sequence zero, only for the fictitious example.',
      swap: 'Expected: {e}. Two digits swapped. The check exists to catch typing errors like this one.',
      run: {
        ctrlc: 'Interrupted at row {l}, which was left out. {g} {p}, {f} queued.',
        disj: 'STOPPED: 3 errors in a row. The errors stay on record for -\u2060-\u2060retentar, already ticked.',
        fim: 'Queue finished. {g} {p} in this run.',
        fimE: ' Errors on record: {e}. -\u2060-\u2060retentar is already ticked.',
        nada: 'Nothing to do. All 6 cases are already on record.',
        comeco: '{n} queued, {k} already on record.',
        passo: 'Row {l}, {k} of {n} in this run.',
        g: ['case saved', 'cases saved'],
        nr: { pulada: 'skipped', gravada: 'saved', localizando: 'searching', cortada: 'not saved', fila: 'queued' },
        parar: 'Interrupt (Ctrl+C)',
        repetir: 'Repeat the command',
        exec: 'Run',
        execR: 'Run with -\u2060-\u2060retentar',
        dia: 'cadastrados_YYYY-MM-DD.xlsx',
        code: 'Exit code {c}. ',
      },
      bad: 'No match.',
      ok: 'Match.',
      badP: 'The check digits should be {e}. The number has {d}.',
      okP: 'The check digits are {d}.',
      badC: 'Invalid.',
      noSeg: 'The check digits match, but segment 0 does not exist.',
      noCourt: 'The check digits match, but court {t} does not exist in segment {j}.',
      empty: 'Type a number.',
      short: 'Missing digits: {n}.',
      long: 'Extra digits: {n}.',
      chars: 'Use digits, dots and hyphens only.',
      inc: 'Incomplete.',
      over: 'Too long.',
      unread: 'Unreadable.',
      wait: 'The format is NNNNNNN-DD.YYYY.J.TR.OOOO, 20 digits in all.',
      seq: ['Sequential number.', 'Order of the case in its unit of origin, restarted every year.'],
      dv: ['Check digits.', 'Expected: {e}. The check exists to catch typing errors.', 'They match.'],
      ano: ['Year', 'of filing.'],
      seg: ['Segment.', 'Code not in use.'],
      tri: ['Court.', 'Code not in use for this segment.'],
      ori: ['Origin.', 'Case that began in the court itself.', 'Code of the unit of origin within the court.'],
      J: [
        '',
        'Federal Supreme Court (STF)',
        'National Council of Justice (CNJ)',
        'Superior Court of Justice (STJ)',
        'Federal courts',
        'Labour courts',
        'Electoral courts',
        'Federal military courts',
        'State courts and Federal District',
        'State military courts',
      ],
      eTok: "'{token}' is not a valid page or range.",
      eStart: 'Page numbers start at 1 (got {n}).',
      eBack: 'Range {start}-{end} is backwards (end must be >= start).',
      eNone: 'No page ranges were provided.',
      eExc: 'Range {label} exceeds the document ({total} pages).',
      eNote: 'Exit code 1. No file is created.',
      pg: ['page', 'pages'],
      ov: 'Pages in more than one file: {p}.',
      noOv: 'No page is repeated.',
      map: 'Map of {n} pages. Ranges: {r}. {o}',
      cel: { saida: 'output', fechar: 'Close', fazia: 'What I did', cod: 'exit code', erro: 'error', arq: ['file', 'files'] },
      less: 'One page fewer',
      more: 'One page more',
      title: window.CV_I18N.en.__title,
    },
  };
  var DICT = window.CV_I18N.en,
    UI = window.CV_I18N.ui,
    KEY = 'cv-lang';
  var lang = 'pt',
    still = matchMedia('(prefers-reduced-motion: reduce)');
  function f(s, o) {
    return s.replace(/\{(\w+)\}/g, function (_, k) {
      return o[k];
    });
  }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  $('yr').textContent = String(new Date().getFullYear());

  /* ---- 1. CNJ ---- */
  var cnj = $('cnj'),
    CNJ0 = cnj.value,
    CNJ1 = '0000000-17.2026.8.16.0000';
  function drawCnj() {
    var t = T[lang],
      p = LOGIC.cnjParse(cnj.value),
      v = $('cnj-v'),
      o = $('cnj-o'),
      head,
      body,
      state = 'bad';
    o.textContent = '';
    if (p.kind !== 'full') {
      head = { empty: t.inc, short: t.inc, long: t.over, chars: t.unread }[p.kind];
      body = f(t[p.kind], p);
      $('cnj-c').textContent = '';
      var w = el('div');
      w.appendChild(el('dd', '', t.wait));
      w.firstChild.style.gridColumn = '1/-1';
      o.appendChild(w);
    } else {
      var c = LOGIC.court(p.j, p.tr),
        seg = t.J[+p.j];
      if (!p.ok) {
        head = t.bad;
        body = f(t.badP, { e: p.exp, d: p.dv });
      } else if (!seg) {
        head = t.badC;
        body = t.noSeg;
      } else if (!c) {
        head = t.badC;
        body = f(t.noCourt, { t: p.tr, j: p.j });
      } else {
        head = t.ok;
        body = f(t.okP, { d: p.dv });
        state = 'ok';
      }
      [
        [p.seq, t.seq[0], /^0+$/.test(p.seq) ? t.zero : t.seq[1]],
        [
          p.dv,
          t.dv[0],
          p.ok ? t.dv[2] : f(p.dv === p.exp[1] + p.exp[0] ? t.swap : t.dv[1], { e: p.exp }),
          p.ok ? 'fine' : 'hit',
        ],
        [p.ano, t.ano[0], t.ano[1]],
        [p.j, t.seg[0], seg ? seg + '.' : t.seg[1], seg ? '' : 'hit'],
        [p.tr, t.tri[0], c ? c + '.' : t.tri[1], c ? '' : 'hit'],
        [p.o, t.ori[0], p.o === '0000' ? t.ori[1] : t.ori[2]],
      ].forEach(function (r) {
        var d = el('div', r[3] || ''),
          dd = el('dd');
        dd.appendChild(el('b', '', r[1]));
        dd.appendChild(document.createTextNode(' ' + r[2]));
        d.appendChild(el('dt', '', r[0]));
        d.appendChild(dd);
        o.appendChild(d);
      });
      $('cnj-c').textContent = '98 − (' + [p.seq, p.ano, p.j, p.tr, p.o, '00'].join(' ') + ' mod 97) = ' + p.exp;
    }
    $('cnj-bad').setAttribute('aria-pressed', String(cnj.value === CNJ1));
    $('cnj-ok').setAttribute('aria-pressed', String(cnj.value === CNJ0));
    v.className = 'disp verdict ' + state;
    v.textContent = '';
    v.appendChild(el('b', '', head));
    v.appendChild(document.createTextNode(body));
  }
  cnj.addEventListener('input', drawCnj);
  cnj.addEventListener('blur', function () {
    var p = LOGIC.cnjParse(cnj.value);
    if (p.kind === 'full') cnj.value = p.fmt;
  });
  $('cnj-bad').addEventListener('click', function () {
    cnj.value = CNJ1;
    drawCnj();
  });
  $('cnj-ok').addEventListener('click', function () {
    cnj.value = CNJ0;
    drawCnj();
  });

  /* ---- rodada do TarefasLegalOne ---- */
  var F = RodadaFSM,
    run = F.abertura(),
    tick = 0,
    rr = $('run-r');
  function runMsg() {
    var t = T[lang].run,
      r = run.run,
      n = r.fila.length,
      g = r.feitas.length,
      e = F.contar(run.ledger).erro,
      p = t.g[g === 1 ? 0 : 1];
    if (run.rodando)
      return r.pos === 0
        ? f(t.comeco, { n: n, k: r.puladas.length })
        : f(t.passo, { l: r.fila[r.pos] + 2, k: r.pos + 1, n: n });
    if (run.motivo === 'ctrlc') return f(t.ctrlc, { l: r.fila[r.pos] + 2, g: g, p: p, f: n - r.pos });
    if (run.motivo === 'disjuntor') return t.disj;
    if (run.motivo === 'nada') return t.nada;
    return f(t.fim, { g: g, p: p }) + (e ? f(t.fimE, { e: e }) : '');
  }
  function drawRun() {
    var t = T[lang].run,
      c = F.contar(run.ledger),
      r = run.run,
      I = $('run-i').tBodies[0].rows,
      O = $('run-o').tBodies[0].rows,
      i,
      cad = 0;
    for (i = 0; i < F.N; i++) {
      var nr = F.naRodada(run, i),
        k = { pulada: 'was', gravada: '', localizando: 'cur', cortada: 'cut', fila: '' }[nr];
      I[i].className = O[i].className = k;
      O[i].cells[0].textContent = t.nr[nr];
      O[i].cells[1].textContent = run.ledger[i] || '–';
    }
    r.feitas.forEach(function (x) {
      if (run.ledger[x] === 'ok' || run.ledger[x] === 'recadastrada') cad++;
    });
    var cmd = $('run-c');
    cmd.textContent = '';
    F.comando(false, run.rodando ? r.retentar : rr.checked).forEach(function (w, n) {
      if (n) cmd.appendChild(document.createTextNode(' '));
      cmd.appendChild(el('span', 'nb', w));
    });
    $('run-e').textContent = run.rodando ? '…' : run.saida;
    $('run-m').textContent = runMsg();
    $('run-fl').textContent =
      run.rodando || run.motivo === 'nada'
        ? '\u00a0'
        : 'relatorio.csv, nao_encontrados.csv (' +
          (c.nao_encontrado + c.ambiguo) +
          ')' +
          (cad ? ', ' + t.dia + ' (' + (c.ok + c.recadastrada) + ')' : '');
    $('run-go').textContent = run.rodando
      ? t.parar
      : rr.checked
        ? t.execR
        : run.motivo === 'ctrlc'
          ? t.repetir
          : t.exec;
    rr.disabled = run.rodando;
  }
  function act(ev) {
    var was = run.rodando;
    run = F.reduzir(run, ev);
    if (was && !run.rodando && ev.tipo === 'passo') rr.checked = F.contar(run.ledger).erro > 0;
    if (ev.tipo === 'reiniciar') rr.checked = false;
    clearInterval(tick);
    tick = run.rodando
      ? setInterval(function () {
          act({ tipo: 'passo' });
        }, 700)
      : 0;
    drawRun();
    if (was !== run.rodando || ev.tipo !== 'passo')
      $('run-l').textContent = (run.rodando ? '' : f(T[lang].run.code, { c: run.saida })) + runMsg();
  }
  $('run-go').addEventListener('click', function () {
    act(run.rodando ? { tipo: 'interromper' } : { tipo: 'iniciar', retentar: rr.checked });
  });
  $('run-f').addEventListener('click', function () {
    act({ tipo: 'derrubar', retentar: rr.checked });
  });
  $('run-x').addEventListener('click', function () {
    act({ tipo: 'reiniciar' });
  });
  rr.addEventListener('change', drawRun);

  /* ---- linha da dobra: prazos | código ---- */
  var hs = 0;
  function drawHero() {
    var t = T[lang],
      h = t.hero[hs],
      a = $('h1a'),
      c = $('h1c');
    a.textContent = '';
    h[0].split('\n').forEach(function (w, i) {
      if (i) a.appendChild(el('br'));
      a.appendChild(document.createTextNode(w));
    });
    a.style.setProperty('--k', h[1]);
    $('h1b').textContent = t.code;
    c.textContent = h[2];
    c.style.setProperty('--k', h[3]);
    $('h1l').textContent = h[4];
    $('h1l').href = h[5];
  }
  $('valve').addEventListener('click', function () {
    hs = (hs + 1) % T[lang].hero.length;
    drawHero();
    var h = T[lang].hero[hs];
    $('h1s').textContent = h[0].replace('\n', ' ') + ' | ' + T[lang].code + ' ' + h[2];
    if (still.matches || !Element.prototype.animate) return;
    [
      ['h1a', 0, -28],
      ['h1b', 90, -20],
      ['h1c', 180, -20],
    ].forEach(function (x) {
      $(x[0]).animate(
        [
          { transform: 'translateX(' + x[2] + 'px)', opacity: 0.15 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 300, delay: x[1], fill: 'backwards', easing: 'cubic-bezier(.2,.7,.2,1)' },
      );
    });
  });

  /* ---- 2. pdf-splitter ---- */
  var rg = $('rg'),
    pages = 12;
  function shq(s) {
    return '"' + s.replace(/([\\"$`])/g, '\\$1') + '"';
  }
  function drawPdf() {
    var t = T[lang],
      r = LOGIC.pdf(rg.value, pages, 'exemplo'),
      m = $('map'),
      o = $('pdf-o'),
      i,
      hit = [];
    $('np').textContent = pages;
    $('np-d').disabled = pages <= 1;
    $('np-i').disabled = pages >= 40;
    $('np-d').setAttribute('aria-label', t.less);
    $('np-i').setAttribute('aria-label', t.more);
    document.querySelectorAll('[data-rg]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.rg === rg.value.trim()));
    });
    var cmd = 'pdfsplit-cli exemplo.pdf ' + shq(rg.value.trim());
    var pc = $('pdf-cmd');
    pc.textContent = '';
    cmd.split(' ').forEach(function (w, n) {
      if (n) pc.appendChild(document.createTextNode(' '));
      pc.appendChild(el('span', w.length < 26 ? 'nb' : '', w));
    });
    $('pdf-copy').setAttribute('data-copy', cmd);
    for (i = 1; i <= pages; i++)
      hit[i] = r.ranges.filter(function (x) {
        return x.start <= i && i <= x.end;
      }).length;
    m.textContent = '';
    m.style.setProperty('--n', pages);
    var ru = el('div', 'mrow ruler');
    for (i = 1; i <= pages; i++) {
      var show = pages <= 20 || i === 1 || i % 5 === 0;
      ru.appendChild(el('span', hit[i] > 1 ? 'two' : hit[i] ? 'one' : '', show ? i : ''));
    }
    m.appendChild(ru);
    r.ranges.slice(0, 14).forEach(function (x) {
      if (x.start > pages) return;
      var row = el('div', 'mrow'),
        e = Math.min(x.end, pages),
        wide = (e - x.start + 1) / pages >= 0.2;
      var b = el('div', 'band', wide ? x.label : '');
      b.style.gridColumn = x.start + '/' + (e + 1);
      row.appendChild(b);
      if (!wide) {
        var right = e <= pages * 0.7,
          l = el('div', 'bl' + (right ? '' : ' l'), x.label);
        l.style.gridColumn = right ? e + 1 + '/-1' : '1/' + x.start;
        row.appendChild(l);
      }
      m.appendChild(row);
    });
    var ov = [];
    for (i = 1; i <= pages; i++) if (hit[i] > 1) ov.push(i);
    var ovT = ov.length ? f(t.ov, { p: ov.join(', ') }) : t.noOv;
    m.setAttribute(
      'aria-label',
      f(t.map, {
        n: pages,
        r:
          r.ranges
            .map(function (x) {
              return x.label;
            })
            .join(', ') || '0',
        o: ovT,
      }),
    );
    o.textContent = '';
    if (r.err) {
      var k = { token: t.eTok, start: t.eStart, back: t.eBack, none: t.eNone, exceeds: t.eExc }[r.err.err];
      // 'Error' e 'Created' são literais da ferramenta real, em inglês nas duas línguas
      o.appendChild(el('p', 'mono err', 'Error: ' + f(k, r.err)));
      o.appendChild(el('p', 'note', t.eNote));
    } else {
      var criados = el('p', 'mono', 'Created ' + r.files.length + ' file(s) in exemplo_split:');
      criados.lang = 'en';
      o.appendChild(criados);
      var ul = el('ul', 'files');
      r.files.forEach(function (x) {
        var li = el('li');
        li.appendChild(el('span', 'mono', x.name));
        li.appendChild(el('span', '', x.count + ' ' + t.pg[x.count === 1 ? 0 : 1]));
        ul.appendChild(li);
      });
      o.appendChild(ul);
      o.appendChild(el('p', 'note', ovT));
    }
  }
  rg.addEventListener('input', drawPdf);
  document.querySelectorAll('[data-rg]').forEach(function (b) {
    b.addEventListener('click', function () {
      rg.value = b.dataset.rg;
      if (pages < 12) pages = 12;
      drawPdf();
    });
  });
  $('np-d').addEventListener('click', function () {
    pages = Math.max(1, pages - 1);
    drawPdf();
  });
  $('np-i').addEventListener('click', function () {
    pages = Math.min(40, pages + 1);
    drawPdf();
  });

  /* ---- 3. competências: cada linha abre o trecho que a prova ---- */
  var mx = document.querySelector('.mx'),
    sks = mx.querySelectorAll('.sk'),
    html = document.documentElement;
  function norm(s) {
    return Array.from(s, function (c) {
      var n = c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      return n.length === c.length ? n : c;
    }).join('');
  }
  function alts(q) {
    return norm(q)
      .split('|')
      .map(function (x) {
        return x.trim();
      })
      .filter(function (x) {
        return x.length > 1;
      });
  }
  function spans(tx, al) {
    // trechos [de, até) de qualquer alternativa, já unidos
    var nt = norm(tx),
      r = [];
    al.forEach(function (a) {
      for (var at = nt.indexOf(a); at >= 0; at = nt.indexOf(a, at + a.length)) r.push([at, at + a.length]);
    });
    r.sort(function (x, y) {
      return x[0] - y[0];
    });
    return r.reduce(function (m, x) {
      var l = m[m.length - 1];
      if (l && x[0] <= l[1]) l[1] = Math.max(l[1], x[1]);
      else m.push(x);
      return m;
    }, []);
  }
  function text(e) {
    return e.textContent.replace(/\s+/g, ' ').trim();
  }
  /* frases de cargos e projetos que citam a competência, uma entrada por lugar; o perfil não
     tem coluna na tabela e fica de fora, para a prova bater com as marcas */
  function provas(q) {
    var al = alts(q),
      r = [];
    document.querySelectorAll('.entry[data-src], .tool[data-src], .int-row[data-src]').forEach(function (box) {
      var fr = [];
      box.querySelectorAll('[data-g]').forEach(function (e) {
        // só o nome do projeto não prova nada: ele já é o rótulo
        if (e.matches('.src')) return;
        var mit = e.querySelector('.mit');
        text(mit ? mit.parentNode.firstElementChild : e)
          .split(/[.]\s+(?=[A-ZÀ-Ú])/)
          .forEach(function (x, i, t) {
            if (spans(x, al).length) fr.push(i < t.length - 1 ? x + '.' : x);
          });
      });
      if (!fr.length)
        box.querySelectorAll('.src[data-g]').forEach(function (e) {
          if (spans(text(e), al).length) fr.push(text(e));
        });
      if (fr.length) r.push([box, fr]);
    });
    return r;
  }
  function termo(b) {
    return lang === 'en' ? b.dataset.qe : b.dataset.q;
  }
  function escrever(b) {
    var ul = $(b.getAttribute('aria-controls')).querySelector('ul'),
      al = alts(termo(b));
    ul.textContent = '';
    provas(termo(b)).forEach(function (p) {
      var li = el('li'),
        a = el('a', '', text(p[0].querySelector('.src'))),
        d = el('div');
      a.href = '#' + p[0].id;
      p[1].forEach(function (tx) {
        var linha = el('p'),
          pos = 0;
        spans(tx, al).forEach(function (m) {
          linha.appendChild(document.createTextNode(tx.slice(pos, m[0])));
          linha.appendChild(el('mark', '', tx.slice(m[0], m[1])));
          pos = m[1];
        });
        linha.appendChild(document.createTextNode(tx.slice(pos)));
        d.appendChild(linha);
      });
      li.append(a, d);
      ul.appendChild(li);
    });
  }
  function abrirLinha(b, on) {
    var tr = b.closest('tr'),
      ev = $(b.getAttribute('aria-controls'));
    if (on) escrever(b);
    ev.hidden = !on;
    tr.classList.toggle('on', on);
    b.setAttribute('aria-expanded', String(on));
    if (!on) return;
    /* trecho abaixo da dobra: sobe o que der sem esconder a própria linha */
    var pad = getComputedStyle(html),
      falta = ev.getBoundingClientRect().bottom - (innerHeight - (parseFloat(pad.scrollPaddingBottom) || 24)),
      folga = tr.getBoundingClientRect().top - (parseFloat(pad.scrollPaddingTop) || 80);
    if (falta > 0 && folga > 0)
      scrollBy({ top: Math.min(falta, folga), behavior: still.matches ? 'auto' : 'smooth' });
  }
  // no HTML o botão vem desligado: sem script ele é só o nome da competência
  sks.forEach(function (b, i) {
    var tr = b.closest('tr'),
      ev = el('tr', 'ev'),
      td = el('td');
    ev.id = 'prova-' + i;
    ev.hidden = true;
    td.colSpan = tr.cells.length;
    td.appendChild(el('ul'));
    ev.appendChild(td);
    tr.after(ev);
    b.disabled = false;
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-controls', ev.id);
    // com script a marca é parte da linha, não um link: o caminho até o cargo está no trecho
    tr.querySelectorAll('td.u > a').forEach(function (a) {
      a.removeAttribute('href');
    });
  });
  mx.addEventListener('click', function (e) {
    var tr = e.target.closest('tbody tr'),
      b = tr && tr.querySelector('.sk');
    // quem está selecionando texto não quer abrir a linha
    if (!b || (!e.target.closest('.sk') && String(getSelection()))) return;
    abrirLinha(b, b.getAttribute('aria-expanded') !== 'true');
  });
  function drawProvas() {
    sks.forEach(function (b) {
      if (b.getAttribute('aria-expanded') === 'true') escrever(b);
    });
  }

  /* ---- celular: cada ferramenta abre numa folha e a saída fica numa gaveta embaixo ----
     Monta e desmonta sem recarregar: deitar o celular ou imprimir devolve a página inteira. */
  var CEL = matchMedia('screen and (max-width:739px), screen and (max-width:940px) and (min-height:481px)'),
    TRES = ['tarefas', 'leitor', 'pdf'],
    folhas = {},
    dobras = [],
    abertas = {},
    acha = 'onbeforematch' in document.documentElement,
    imprimindo = false,
    volta = null,
    vista = '',
    veio = false;
  function botao(cls) {
    var b = el('button', cls);
    b.type = 'button';
    return b;
  }
  /* o resultado de cada ferramenta numa palavra, na alça da gaveta */
  function resumo(id) {
    var t = T[lang].cel,
      n;
    if (id === 'tarefas') {
      var c = $('run-e').textContent;
      return [t.cod + ' ' + c, c !== '0' && c !== '…'];
    }
    if (id === 'leitor')
      return [$('cnj-v').querySelector('b').textContent.replace(/\.$/, '').toLowerCase(), $('cnj-v').classList.contains('bad')];
    n = document.querySelectorAll('#pdf-o .files li').length;
    return n ? [n + ' ' + t.arq[n === 1 ? 0 : 1], false] : [t.erro, true];
  }
  function drawCel() {
    var t = T[lang].cel;
    TRES.forEach(function (id) {
      var x = folhas[id];
      if (!x) return;
      var r = resumo(id);
      x.nome.textContent = t.saida;
      x.fecha.textContent = t.fechar;
      if (x.res.textContent !== r[0]) x.res.textContent = r[0];
      x.alca.classList.toggle('ruim', r[1]);
    });
    dobras.forEach(function (d) {
      if (d.rot) d.rot.textContent = t.fazia;
    });
  }
  function gaveta(x, on) {
    x.alca.setAttribute('aria-expanded', String(on));
    x.g.classList.toggle('aberta', on);
    x.c.inert = !on;
  }
  function fechar(id) {
    if (veio) {
      veio = false;
      history.back();
    } else folhas[id].d.close();
  }
  /* fechada, a ferramenta espera num bloco que a busca do navegador percorre (onde houver suporte);
     um <dialog> fechado não é pesquisável, e deixá-lo à vista travava o Chromium ao redimensionar */
  function esconde(x) {
    if (acha) x.espera.setAttribute('hidden', 'until-found');
    else x.espera.hidden = true;
    x.espera.appendChild(x.t);
  }
  function mostra(x) {
    x.d.appendChild(x.t);
    x.d.showModal();
  }
  function ir(id) {
    if (location.hash !== '#' + id) {
      history.pushState(null, '', '#' + id);
      veio = true;
    }
    rota();
  }
  function folha(id) {
    var t = $(id),
      x = (folhas[id] = { t: t, out: t.querySelector('.iobox > .out'), box: t.querySelector('.iobox') });
    x.d = el('dialog', 'folha');
    x.espera = el('div', 'espera');
    x.g = el('div', 'gav out');
    x.alca = botao('gav-h');
    x.c = el('div', 'gav-c');
    x.nome = el('span', 'disp');
    x.res = el('span', 'gav-r');
    x.res.setAttribute('aria-live', 'polite');
    x.alca.append(x.nome, x.res, el('i'));
    x.g.append(x.alca, x.c);
    x.fecha = botao('fecha');
    var nome = t.querySelector('.plate .name');
    nome.id = id + '-nome';
    x.d.setAttribute('aria-labelledby', nome.id);
    t.querySelector('.plate .out .w').appendChild(x.fecha);
    x.alca.addEventListener('click', function () {
      gaveta(x, x.alca.getAttribute('aria-expanded') !== 'true');
    });
    /* mexeu na ferramenta: a gaveta sobe e o botão continua à vista */
    t.querySelector('.body').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!x.d.open || !b || b.matches('.copy')) return;
      gaveta(x, true);
      setTimeout(function () {
        b.scrollIntoView({ block: 'center', behavior: still.matches ? 'auto' : 'smooth' });
      }, 260);
    });
    x.fecha.addEventListener('click', function () {
      fechar(id);
    });
    x.d.addEventListener('cancel', function (e) {
      e.preventDefault();
      fechar(id);
    });
    x.d.addEventListener('close', function () {
      // o aviso chega depois: a folha pode já ter sido desmontada (girar) ou reaberta (imprimir)
      if (x.d.open || !html.classList.contains('folhas')) return;
      esconde(x);
      veio = false;
      if (location.hash === '#' + id) history.replaceState(null, '', '#projetos');
    });
    /* a busca do navegador achou texto numa folha fechada */
    x.espera.addEventListener('beforematch', function () {
      if (!x.d.open) ir(id);
    });
    new MutationObserver(drawCel).observe(x.out, { childList: true, characterData: true, subtree: true });
  }
  function dobrar(caixa, st) {
    var d = el('details', 'dobra'),
      s = el('summary'),
      c = el('div', 'dobra-c'),
      o = { d: d, c: c, caixa: caixa, st: st, pai: st && st.parentNode, id: caixa.closest('[data-src]').id };
    d.open = !!abertas[o.id];
    [].slice.call(caixa.childNodes).forEach(function (n) {
      c.appendChild(n);
    });
    if (st) s.appendChild(st);
    else {
      o.rot = el('span');
      s.appendChild(o.rot);
    }
    d.append(s, c);
    caixa.appendChild(d);
    dobras.push(o);
  }
  function montar() {
    if (!window.HTMLDialogElement || html.classList.contains('folhas')) return;
    html.classList.add('folhas');
    TRES.forEach(function (id) {
      if (!folhas[id]) folha(id);
      var x = folhas[id];
      x.t.before(x.espera, x.d);
      x.c.appendChild(x.out);
      x.t.querySelector('.stage').appendChild(x.g);
      gaveta(x, x.alca.getAttribute('aria-expanded') === 'true');
      esconde(x);
    });
    ['exp-3', 'exp-2'].forEach(function (id) {
      dobrar($(id).querySelector('.out .w'));
    });
    document.querySelectorAll('.int-row .out .w').forEach(function (w) {
      dobrar(w, w.querySelector('.st'));
    });
    drawCel();
  }
  function desmontar() {
    if (!html.classList.contains('folhas')) return;
    html.classList.remove('folhas');
    TRES.forEach(function (id) {
      var x = folhas[id];
      x.box.appendChild(x.out);
      x.g.remove();
      if (x.d.open) x.d.close();
      x.espera.replaceWith(x.t);
      x.d.remove();
    });
    dobras.forEach(function (o) {
      abertas[o.id] = o.d.open;
      if (o.st) o.pai.prepend(o.st);
      while (o.c.firstChild) o.caixa.insertBefore(o.c.firstChild, o.d);
      o.d.remove();
    });
    dobras = [];
  }
  function rota() {
    if (!html.classList.contains('folhas')) return;
    var alvo = location.hash.slice(1),
      e = alvo && document.getElementById(alvo),
      dobra = e && e.matches('.entry, .int-row') && e.querySelector('.dobra');
    TRES.forEach(function (id) {
      if (id !== alvo && folhas[id].d.open) folhas[id].d.close();
    });
    if (folhas[alvo] && !folhas[alvo].d.open) mostra(folhas[alvo]);
    if (dobra) dobra.open = true;
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]'),
      id = a && a.getAttribute('href').slice(1);
    if (!a || !html.classList.contains('folhas') || TRES.indexOf(id) < 0) return;
    e.preventDefault();
    ir(id);
  });
  addEventListener('hashchange', rota);
  function aberta() {
    return TRES.filter(function (id) {
      return folhas[id] && folhas[id].d.open;
    })[0];
  }
  function foca(e) {
    if (e && e !== document.body && e.isConnected && e !== document.activeElement) e.focus({ preventScroll: true });
  }
  /* deitar leva à ferramenta que estava aberta; levantar reabre a que está à vista */
  function deitar() {
    var id = aberta(),
      foco = document.activeElement;
    desmontar();
    if (id) {
      var t = folhas[id].t,
        placa = t.querySelector('.plate');
      scrollTo({
        top: scrollY + folhas[id].box.getBoundingClientRect().top - placa.offsetHeight,
        behavior: 'instant',
      });
      vista = id;
    }
    foca(foco);
  }
  function levantar() {
    var id = vista,
      foco = document.activeElement;
    montar();
    vista = '';
    if (!id || !html.classList.contains('folhas')) return foca(foco);
    $('indice').scrollIntoView({ block: 'start', behavior: 'instant' });
    ir(id);
    if (folhas[id].t.contains(foco)) foca(foco);
  }
  /* a impressão recebe a página inteira e devolve a tela como estava */
  function antesDeImprimir() {
    if (imprimindo) return;
    imprimindo = true;
    volta = { id: aberta(), y: scrollY, foco: document.activeElement };
    desmontar();
  }
  function depoisDeImprimir() {
    if (!imprimindo) return;
    imprimindo = false;
    if (!CEL.matches) return;
    montar();
    scrollTo({ top: volta.y, behavior: 'instant' });
    if (volta.id && folhas[volta.id] && html.classList.contains('folhas')) ir(volta.id);
    foca(volta.foco);
  }
  addEventListener('beforeprint', antesDeImprimir);
  addEventListener('afterprint', depoisDeImprimir);
  CEL.addEventListener('change', function () {
    if (imprimindo) return;
    if (!matchMedia('screen').matches) antesDeImprimir();
    else (CEL.matches ? levantar : deitar)();
  });
  // sem os eventos de impressão (iOS), a volta à tela é o sinal
  matchMedia('screen').addEventListener('change', function (e) {
    if (e.matches) depoisDeImprimir();
  });
  if (CEL.matches) {
    montar();
    rota();
  }

  /* ---- idioma ---- */
  var nodes = document.querySelectorAll('[data-i18n]'),
    pt = new WeakMap();
  nodes.forEach(function (e) {
    pt.set(e, e.innerHTML);
  });
  function applyLang(next, first) {
    lang = next === 'en' ? 'en' : 'pt';
    var en = lang === 'en';
    nodes.forEach(function (e) {
      var k = e.getAttribute('data-i18n');
      e.innerHTML = en && DICT[k] != null ? DICT[k] : pt.get(e);
    });
    document.documentElement.lang = en ? 'en' : 'pt-BR';
    document.title = T[lang].title;
    // o que só o leitor de tela ouve também troca de língua
    document.querySelectorAll('[data-aria-en]').forEach(function (e) {
      e.dataset.ariaPt = e.dataset.ariaPt || e.getAttribute('aria-label');
      e.setAttribute('aria-label', en ? e.dataset.ariaEn : e.dataset.ariaPt);
    });
    var colunas = [].map.call(document.querySelectorAll('.mx thead a span'), function (c) {
      return c.textContent;
    });
    document.querySelectorAll('.mx tbody tr:not(.g):not(.ev)').forEach(function (tr) {
      [].forEach.call(tr.querySelectorAll('td:not(.f)'), function (td, i) {
        var v = td.querySelector('a .vh');
        if (v) v.textContent = tr.querySelector('.sk').textContent + ', ' + colunas[i];
      });
    });
    document.querySelectorAll('[data-pdf-en]').forEach(function (a) {
      a.dataset.pdfPt = a.dataset.pdfPt || a.getAttribute('href');
      a.setAttribute('href', en ? a.dataset.pdfEn : a.dataset.pdfPt);
    });
    document.querySelectorAll('.lang button').forEach(function (b) {
      var on = b.dataset.lang === lang;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    drawHero();
    drawRun();
    drawCnj();
    drawPdf();
    drawProvas();
    drawCel();
    if (!first)
      try {
        localStorage.setItem(KEY, lang);
      } catch (_) {}
  }
  document.querySelectorAll('.lang button').forEach(function (b) {
    b.addEventListener('click', function () {
      applyLang(b.dataset.lang);
    });
  });
  var saved = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch (_) {}
  var want = /[?&]lang=(pt|en)\b/.exec(location.search) || /[#&](en|pt)(?=&|$)/.exec(location.hash);
  applyLang(want ? want[1] : saved, true);

  /* ---- copiar ---- */
  var toast = $('toast'),
    tt,
    rt;
  function say(m) {
    toast.textContent = m;
    toast.classList.add('is-visible');
    clearTimeout(tt);
    tt = setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 2200);
  }
  function old(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:absolute;left:-9999px;top:0';
    document.body.appendChild(ta);
    ta.select();
    var ok = document.execCommand('copy');
    ta.remove();
    if (!ok) throw new Error('copy');
  }
  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await Promise.race([
          navigator.clipboard.writeText(text),
          new Promise(function (_, no) {
            setTimeout(function () {
              no(new Error('timeout'));
            }, 3000);
          }),
        ]);
        return;
      } catch (_) {}
    }
    old(text);
  }
  document.querySelectorAll('.copy').forEach(function (b) {
    b.addEventListener('click', async function () {
      b.setAttribute('aria-busy', 'true');
      try {
        await copyText(b.getAttribute('data-copy'));
        b.textContent = UI[lang].done;
        say(UI[lang].toastDone);
      } catch (_) {
        b.textContent = UI[lang].failed;
        say(UI[lang].toastFail);
      }
      b.removeAttribute('aria-busy');
      b.focus();
      clearTimeout(rt);
      rt = setTimeout(function () {
        document.querySelectorAll('.copy').forEach(function (x) {
          x.textContent = UI[lang].copy;
        });
      }, 2200);
    });
  });

  /* ---- seção atual no menu ---- */
  var links = document.querySelectorAll('.idx a'),
    strip = document.querySelector('.bar .idx');
  /* ---- rolagem: cano, cabeçalho e ferramentas ---- */
  (function () {
    var root = document.documentElement,
      bar = document.querySelector('.bar'),
      tools = document.querySelectorAll('.tool'),
      last = scrollY,
      queued = false;
    /* a ponta do cano fica a 62% da tela e só desce até o fim no último trecho */
    var fill = document.getElementById('fill'),
      marks = document.querySelectorAll('.yr');
    function flow() {
      var moving = !still.matches;
      root.classList.toggle('flow', moving);
      if (!moving) {
        fill.style.transform = '';
        return;
      }
      var vh = innerHeight,
        max = root.scrollHeight - vh,
        k = 0.62 + 0.38 * Math.min(1, Math.max(0, (scrollY - (max - vh * 0.6)) / (vh * 0.6))),
        head = vh * k;
      fill.style.transform = 'scaleY(' + k.toFixed(4) + ')';
      marks.forEach(function (m) {
        m.classList.toggle('on', m.getBoundingClientRect().top <= head);
      });
      tools.forEach(function (t) {
        var b = t.getBoundingClientRect();
        t.classList.toggle('on', b.top <= head);
        t.classList.toggle('off', b.bottom <= head);
      });
    }
    var stages = [].map.call(tools, function (t) {
        return { t: t, bar: t.querySelector('.outlet i'), step: 0 };
      }),
      hidden = false;
    function stage(jump) {
      var pin =
          root.classList.contains('flow') && getComputedStyle(tools[0].querySelector('.stage')).position === 'sticky',
        vh = innerHeight;
      root.classList.toggle('pin', pin);
      stages.forEach(function (x) {
        var b = x.t.getBoundingClientRect(),
          run = b.height - vh,
          q = run > 0 ? Math.min(1, Math.max(0, -b.top / run)) : 1;
        var n =
          !pin || b.bottom < vh ? 4 : b.top > vh * 0.55 ? 0 : b.top > vh * 0.18 ? 1 : q < 0.12 ? 2 : q < 0.3 ? 3 : 4;
        if (jump && b.top <= 4) n = 4;
        if (n > x.step) {
          x.step = n;
          x.t.dataset.step = n;
        }
        x.bar.style.transform = pin ? 'scaleX(' + (b.bottom <= vh ? 1 : q).toFixed(4) + ')' : '';
      });
    }
    /* zoom, letra grande ou tradução longa: se uma ferramenta não couber na tela, nenhuma fica presa */
    function fit() {
      root.classList.remove('nofit');
      var no = stages.some(function (x) {
        var b = x.t.querySelector('.body'),
          s = x.t.querySelector('.stage');
        return (
          getComputedStyle(s).position === 'sticky' &&
          (s.scrollHeight > s.clientHeight + 2 || b.scrollHeight > b.clientHeight + 2)
        );
      });
      root.classList.toggle('nofit', no);
    }
    addEventListener('resize', fit);
    // a letra reserva é mais alta que a definitiva: medir de novo a cada fonte que chega, senão a
    // primeira visita desliga o palco à toa e não volta atrás
    function medir() {
      fit();
      ask();
    }
    if (document.fonts) {
      document.fonts.ready.then(medir);
      document.fonts.addEventListener('loadingdone', medir);
    }
    addEventListener('load', medir);
    addEventListener('pageshow', medir);
    new MutationObserver(function () {
      fit();
      ask();
    }).observe(root, { attributes: true, attributeFilter: ['lang'] });
    setTimeout(fit, 0);
    function draw() {
      queued = false;
      var y = scrollY,
        d = y - last;
      last = y;
      var on = CEL.matches ? 48 : 60,
        a = tools[0].getBoundingClientRect().top,
        z = tools[tools.length - 1].getBoundingClientRect().bottom;
      /* uma faixa só para todas as ferramentas, com folga nas pontas, para o cabeçalho não piscar */
      if (!root.classList.contains('folhas')) {
        vista = '';
        tools.forEach(function (t) {
          var b = t.getBoundingClientRect();
          if (b.top < innerHeight / 2 && b.bottom > innerHeight / 2) vista = t.id;
        });
      }
      if (root.classList.contains('folhas')) hidden = false;
      else if (hidden) {
        if (a > on + 120 || z < -40) hidden = false;
      } else if (a <= on && z > 60) hidden = true;
      root.classList.toggle('past', scrollY > 260);
      flow();
      stage(Math.abs(d) > innerHeight * 0.9);
      root.classList.toggle('plated', hidden && !bar.querySelector(':focus-visible'));
    }
    function ask() {
      if (!queued) {
        queued = true;
        requestAnimationFrame(draw);
      }
    }
    addEventListener('scroll', ask, { passive: true });
    addEventListener('resize', ask);
    document.querySelector('main').addEventListener('focusin', function (e) {
      var t = e.target.closest('.tool');
      if (t) {
        t.dataset.step = 4;
        stages.forEach(function (x) {
          if (x.t === t) x.step = 4;
        });
      }
    });
    bar.addEventListener('focusin', ask);
    bar.addEventListener('focusout', ask);
    draw();
  })();
  /* o menu do celular não cabe inteiro: marca de que lado ainda há seção */
  function beiras() {
    var resto = strip.scrollWidth - strip.clientWidth;
    strip.toggleAttribute('data-antes', resto > 2 && strip.scrollLeft > 4);
    strip.toggleAttribute('data-depois', resto > 2 && strip.scrollLeft < resto - 4);
  }
  strip.addEventListener('scroll', beiras, { passive: true });
  if ('ResizeObserver' in window) {
    var ro = new ResizeObserver(beiras);
    ro.observe(strip);
    links.forEach(function (l) {
      ro.observe(l);
    });
  }
  beiras();
  /* aba atual da barra de baixo */
  var abas = document.querySelectorAll('.abas a[href^="#"]');
  function aba() {
    var q = abas[0];
    abas.forEach(function (a) {
      if (document.querySelector(a.hash).getBoundingClientRect().top < innerHeight * 0.5) q = a;
    });
    if (scrollY + innerHeight > html.scrollHeight - 80) q = abas[abas.length - 1];
    abas.forEach(function (a) {
      if (a === q) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }
  addEventListener('scroll', aba, { passive: true });
  addEventListener('resize', aba);
  aba();
  links.forEach(function (l) {
    l.addEventListener('focus', function () {
      requestAnimationFrame(function () {
        if (strip.scrollWidth > strip.clientWidth) strip.scrollLeft = l.offsetLeft - 52;
      });
    });
  });
  if ('IntersectionObserver' in window) {
    var by = {};
    links.forEach(function (a) {
      by[a.getAttribute('href').slice(1)] = a;
    });
    var spy = new IntersectionObserver(
      function (es) {
        es.forEach(function (x) {
          if (!x.isIntersecting) return;
          links.forEach(function (a) {
            a.classList.remove('is-active');
            a.removeAttribute('aria-current');
          });
          var a = by[x.target.id];
          if (!a) {
            strip.scrollLeft = 0;
            return;
          }
          a.classList.add('is-active');
          a.setAttribute('aria-current', 'true');
          if (strip.scrollWidth > strip.clientWidth) strip.scrollLeft = a.offsetLeft - 52;
        });
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    document.querySelectorAll('main > section[id]').forEach(function (s) {
      spy.observe(s);
    });
  }
})();
