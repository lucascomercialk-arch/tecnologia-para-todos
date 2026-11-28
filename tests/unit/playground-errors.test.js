import { describe, expect, it } from 'vitest';
import { createBrowserContext } from './vm-env.js';

function createPlaygroundEnv() {
  const { windowObj } = createBrowserContext([
    'js/highlight.js',
    'data/i18n/ui.js',
    'js/i18n.js',
    'js/playground.js',
  ]);
  windowObj.TPT.i18n.init();
  return {
    syntax: windowObj.TPT.syntax,
    playground: windowObj.TPT.playground,
    i18n: windowObj.TPT.i18n,
    translations: windowObj.TPT_TRANSLATIONS,
  };
}

describe('TPT.syntax (highlightPython & escapeHtml)', () => {
  it('escapa caracteres HTML perigosos contra XSS', () => {
    const { syntax } = createPlaygroundEnv();
    expect(syntax.escapeHtml(`<script>alert("x" & 'y')</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot; &amp; &#39;y&#39;)&lt;/script&gt;'
    );
  });

  it('destaca palavras-chave, builtins, constantes, strings, números, comentários e funções', () => {
    const { syntax } = createPlaygroundEnv();
    const html = syntax.highlightPython(
      'import random\n# comentario\nif True:\n    x = random.randint(1, 6)\n    print("oi")'
    );
    expect(html).toContain('<span class="tok-kw">import</span>');
    expect(html).toContain('<span class="tok-com"># comentario</span>');
    expect(html).toContain('<span class="tok-kw">if</span>');
    expect(html).toContain('<span class="tok-const">True</span>');
    expect(html).toContain('<span class="tok-fn">randint</span>');
    expect(html).toContain('<span class="tok-num">1</span>');
    expect(html).toContain('<span class="tok-bi">print</span>');
    expect(html).toContain('<span class="tok-str">&quot;oi&quot;</span>');
  });
});

describe('TPT.playground.translateError', () => {
  const cases = [
    {
      label: 'SyntaxError (aspas abertas)',
      err: { type: 'SyntaxError', message: 'unterminated string literal', line: 1, codeLine: 'print("oi)' },
      expectedKey: 'syntaxQuotes',
    },
    {
      label: 'SyntaxError (parêntese não fechado)',
      err: { type: 'SyntaxError', message: "'(' was never closed", line: 2, codeLine: 'print("oi"' },
      expectedKey: 'syntaxParen',
    },
    {
      label: 'SyntaxError (dois pontos faltando)',
      err: { type: 'SyntaxError', message: "expected ':'", line: 3, codeLine: 'if idade >= 18' },
      expectedKey: 'syntaxColon',
    },
    {
      label: 'SyntaxError (= em vez de ==)',
      err: { type: 'SyntaxError', message: 'invalid syntax', line: 4, codeLine: 'if x = 10:' },
      expectedKey: 'syntaxAssign',
    },
    {
      label: 'SyntaxError genérico',
      err: { type: 'SyntaxError', message: 'invalid syntax', line: 1, codeLine: '123 abc' },
      expectedKey: 'syntaxGeneric',
    },
    {
      label: 'IndentationError',
      err: { type: 'IndentationError', message: 'expected an indented block', line: 2, codeLine: 'print(x)' },
      expectedKey: 'indentExplanation',
    },
    {
      label: 'TabError',
      err: { type: 'TabError', message: 'inconsistent use of tabs', line: 2, codeLine: 'print(x)' },
      expectedKey: 'indentExplanation',
    },
    {
      label: 'NameError com inicial maiúscula',
      err: { type: 'NameError', message: "name 'Print' is not defined", line: 1, codeLine: 'Print("oi")' },
      expectedKey: 'nameCapitalExplanation',
      vars: { name: 'Print' },
    },
    {
      label: 'NameError booleano minúsculo',
      err: { type: 'NameError', message: "name 'true' is not defined", line: 1, codeLine: 'ativo = true' },
      expectedKey: 'nameBoolExplanation',
      vars: { cap: 'True' },
    },
    {
      label: 'NameError com sugestão',
      err: { type: 'NameError', message: "name 'nom' is not defined", line: 2, codeLine: 'print(nom)', suggestion: 'nome' },
      expectedKey: 'nameUnknownExplanation',
      vars: { name: 'nom' },
    },
    {
      label: 'TypeError concatenação str + int',
      err: { type: 'TypeError', message: 'can only concatenate str (not "int") to str', line: 1, codeLine: '"a" + 1' },
      expectedKey: 'typeConcatExplanation',
    },
    {
      label: 'TypeError not callable',
      err: { type: 'TypeError', message: "'str' object is not callable", line: 1, codeLine: 'print("x")' },
      expectedKey: 'typeCallableExplanation',
    },
    {
      label: 'ValueError int()',
      err: { type: 'ValueError', message: "invalid literal for int() with base 10: 'abc'", line: 1, codeLine: 'int("abc")' },
      expectedKey: 'valueIntExplanation',
    },
    {
      label: 'ValueError float()',
      err: { type: 'ValueError', message: "could not convert string to float: '5,5'", line: 1, codeLine: 'float("5,5")' },
      expectedKey: 'valueFloatExplanation',
    },
    {
      label: 'ValueError list.remove()',
      err: { type: 'ValueError', message: 'list.remove(x): x not in list', line: 2, codeLine: 'xs.remove("uva")' },
      expectedKey: 'valueRemoveExplanation',
    },
    {
      label: 'IndexError',
      err: { type: 'IndexError', message: 'list index out of range', line: 1, codeLine: 'xs[5]' },
      expectedKey: 'indexExplanation',
    },
    {
      label: 'ZeroDivisionError',
      err: { type: 'ZeroDivisionError', message: 'division by zero', line: 1, codeLine: '10 / 0' },
      expectedKey: 'zeroExplanation',
    },
    {
      label: 'AttributeError',
      err: { type: 'AttributeError', message: "'int' object has no attribute 'append'", line: 1, codeLine: 'n.append(1)' },
      expectedKey: 'attrExplanation',
    },
    {
      label: 'ModuleNotFoundError com nome do módulo',
      err: { type: 'ModuleNotFoundError', message: "No module named 'pandas'", line: 1, codeLine: 'import pandas' },
      expectedKey: 'importModuleExplanation',
      vars: { mod: 'pandas' },
    },
    {
      label: 'ImportError genérico',
      err: { type: 'ImportError', message: 'cannot import name foo', line: 1, codeLine: 'from time import foo' },
      expectedKey: 'importGenericExplanation',
    },
    {
      label: 'Erro desconhecido usa fallback padrão',
      err: { type: 'RuntimeError', message: 'algo inesperado', line: 5, codeLine: 'raise RuntimeError()' },
      expectedKey: 'defaultExplanation',
    },
  ];

  it.each(cases)('traduz $label em pt, es e en', ({ err, expectedKey, vars }) => {
    const { playground, i18n } = createPlaygroundEnv();
    const byLang = {};
    for (const lang of ['pt', 'es', 'en']) {
      i18n.setLang(lang);
      const out = playground.translateError(err);
      expect(out.explanation).toBe(i18n.t(`playground.errors.${expectedKey}`, vars));
      expect(out.title.length).toBeGreaterThan(0);
      expect(out.tip.length).toBeGreaterThan(0);
      expect(out.line).toBe(err.line);
      byLang[lang] = `${out.title}::${out.explanation}`;
    }
    expect(byLang.pt).not.toBe(byLang.es);
    expect(byLang.pt).not.toBe(byLang.en);
    expect(byLang.es).not.toBe(byLang.en);
  });
});
