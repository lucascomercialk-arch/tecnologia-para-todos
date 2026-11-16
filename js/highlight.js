/* =========================================================
   Tecnologia para Todos — Destaque de sintaxe Python
   ---------------------------------------------------------
   Usado nos cards da Trilha e no Glossário (sem precisar
   carregar o Monaco). As mesmas listas de palavras são usadas
   pelo tema do Monaco no Playground.
   ========================================================= */
(function () {
  'use strict';

  const TPT = (window.TPT = window.TPT || {});

  const KEYWORDS = [
    'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del',
    'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in',
    'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while',
    'with', 'yield', 'match', 'case',
  ];
  const CONSTANTS = ['True', 'False', 'None'];
  const BUILTINS = [
    'print', 'input', 'len', 'int', 'float', 'str', 'bool', 'list', 'dict', 'set', 'tuple',
    'range', 'type', 'abs', 'round', 'sum', 'min', 'max', 'sorted', 'reversed', 'enumerate',
    'zip', 'map', 'filter', 'any', 'all', 'chr', 'ord', 'isinstance', 'open', 'format', 'help',
  ];

  const KW = new Set(KEYWORDS);
  const CONST = new Set(CONSTANTS);
  const BI = new Set(BUILTINS);

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Grupos: 1 comentário | 2 string | 3 número | 4 identificador | 5 operador | 6 espaço | 7 outro
  const TOKEN_RE = new RegExp(
    [
      '(#[^\\n]*)',
      '((?:[fFrRbBuU]{1,2})?(?:"""[\\s\\S]*?(?:"""|$)|\'\'\'[\\s\\S]*?(?:\'\'\'|$)|"(?:\\\\.|[^"\\\\\\n])*"?|\'(?:\\\\.|[^\'\\\\\\n])*\'?))',
      '(\\b\\d+(?:\\.\\d+)?\\b)',
      '([A-Za-z_\\u00C0-\\u024F][\\w\\u00C0-\\u024F]*)',
      '(==|!=|>=|<=|\\+=|-=|\\*=|/=|//|\\*\\*|[=+\\-*/%<>])',
      '(\\s+)',
      '([\\s\\S])',
    ].join('|'),
    'g'
  );

  /** Converte código Python em HTML com <span class="tok-..."> */
  function highlightPython(code) {
    let html = '';
    let m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(code)) !== null) {
      const [tok, com, str, num, ident, op, ws] = m;
      if (com) html += `<span class="tok-com">${escapeHtml(com)}</span>`;
      else if (str) html += `<span class="tok-str">${escapeHtml(str)}</span>`;
      else if (num) html += `<span class="tok-num">${num}</span>`;
      else if (ident) {
        const rest = code.slice(TOKEN_RE.lastIndex);
        const isCall = /^\s*\(/.test(rest);
        let cls = 'tok-var';
        if (KW.has(ident)) cls = 'tok-kw';
        else if (CONST.has(ident)) cls = 'tok-const';
        else if (BI.has(ident)) cls = 'tok-bi';
        else if (isCall) cls = 'tok-fn';
        html += `<span class="${cls}">${escapeHtml(ident)}</span>`;
      } else if (op) html += `<span class="tok-op">${escapeHtml(op)}</span>`;
      else if (ws) html += ws;
      else html += `<span class="tok-punc">${escapeHtml(tok)}</span>`;
    }
    return html;
  }

  TPT.syntax = { KEYWORDS, CONSTANTS, BUILTINS, highlightPython, escapeHtml };
})();
