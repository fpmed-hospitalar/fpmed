/* ══════════════════════════════════════════════════════════════════════════════════════════════
   dom_minimo.js — UM DOM DE MENTIRA, DO TAMANHO EXATO DO QUE PRECISA SER TESTADO (A16, 14/08)

   O projeto não tem jsdom, e pôr uma dependência de 3 MB no `package.json` só pra testar um
   diálogo seria trocar um problema pequeno por um permanente (versão, auditoria, tempo de
   instalação — para sempre). Este arquivo sabe exatamente o que a janela de custo usa: criar
   elemento, montar uma moldura de markup estático, achar por seletor simples, escrever texto,
   ouvir clique e tecla, focar e remover.

   >>> ELE É O CONTROLE DE SI MESMO. Um dublê que responde "sim" para tudo deixa o teste verde
       sobre nada. Este aqui não implementa o que não conhece: se a janela um dia usar um método
       que ele não tem, o teste ESTOURA em vez de passar em silêncio — que é o comportamento
       certo de um dublê, e o que separa "testei" de "achei que testei".

   >>> POR QUE ELE PODE SER SIMPLES: a moldura da janela é markup ESTÁTICO — nenhum dado passa
       pelo `innerHTML`. Um parser de fragmento com tag, atributo e texto basta, e o fato de
       bastar é a própria propriedade que o assert do escape cobra (o dado entra por
       `textContent`, nunca concatenado no markup — a lição da fatia A10).

   Quem usa: tests/testa_janela_custo.js (o caminho) e tools/prova_janela_custo.js (o banco).
   ═════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';

function criaDom() {
  const doc = {
    activeElement: null,
    _ouvintes: {},
    createElement: t => new El(t),
    getElementById(id) { return busca(doc.documentElement, e => e.attrs.id === id); },
    addEventListener(t, fn) { (doc._ouvintes[t] = doc._ouvintes[t] || []).push(fn); },
    removeEventListener(t, fn) { doc._ouvintes[t] = (doc._ouvintes[t] || []).filter(x => x !== fn); },
  };
  function El(tag) {
    this.tagName = String(tag).toUpperCase();
    this.attrs = {}; this._filhos = []; this.parentNode = null; this._ouvintes = {};
  }
  El.prototype.setAttribute = function (k, v) { this.attrs[k] = String(v); };
  El.prototype.getAttribute = function (k) { return this.attrs[k] === undefined ? null : this.attrs[k]; };
  El.prototype.appendChild = function (c) { c.parentNode = this; this._filhos.push(c); return c; };
  El.prototype.removeChild = function (c) { this._filhos = this._filhos.filter(x => x !== c); c.parentNode = null; };
  El.prototype.remove = function () { if (this.parentNode) this.parentNode.removeChild(this); };
  El.prototype.focus = function () { doc.activeElement = this; };
  El.prototype.addEventListener = function (t, fn) { (this._ouvintes[t] = this._ouvintes[t] || []).push(fn); };
  El.prototype.querySelector = function (s) { return busca(this, e => casa(e, s)); };
  El.prototype.querySelectorAll = function (s) { const r = []; anda(this, e => { if (casa(e, s)) r.push(e); }); return r; };
  Object.defineProperty(El.prototype, 'className', {
    get() { return this.attrs.class || ''; }, set(v) { this.attrs.class = String(v); },
  });
  Object.defineProperty(El.prototype, 'id', {
    get() { return this.attrs.id || ''; }, set(v) { this.attrs.id = String(v); },
  });
  Object.defineProperty(El.prototype, 'textContent', {
    get() { return this._filhos.map(x => (x.texto !== undefined ? x.texto : x.textContent)).join(''); },
    set(v) { this._filhos = (v === '' || v == null) ? [] : [{ texto: String(v) }]; },
  });
  Object.defineProperty(El.prototype, 'innerHTML', {
    get() { return this._html || ''; },
    set(v) { this._html = String(v); this._filhos = []; monta(this, String(v)); },
  });
  function monta(raiz, html) {
    const pilha = [raiz];
    const re = /<(\/?)([a-zA-Z0-9]+)((?:\s+[a-zA-Z-]+(?:="[^"]*")?)*)\s*>/g;
    let pos = 0, m;
    while ((m = re.exec(html))) {
      const txt = html.slice(pos, m.index);
      if (txt) pilha[pilha.length - 1]._filhos.push({ texto: txt });
      pos = m.index + m[0].length;
      if (m[1] === '/') { pilha.pop(); continue; }
      const el = new El(m[2]);
      const ra = /([a-zA-Z-]+)(?:="([^"]*)")?/g; let a;
      while ((a = ra.exec(m[3]))) el.setAttribute(a[1], a[2] === undefined ? '' : a[2]);
      pilha[pilha.length - 1].appendChild(el);
      pilha.push(el);
    }
    const resto = html.slice(pos);
    if (resto) pilha[pilha.length - 1]._filhos.push({ texto: resto });
  }
  function anda(el, fn) { (el._filhos || []).forEach(c => { if (c.texto === undefined) { fn(c); anda(c, fn); } }); }
  function busca(el, fn) { let achou = null; anda(el, c => { if (!achou && fn(c)) achou = c; }); return achou; }
  function casa(el, s) {
    const at = s.match(/^\[([a-zA-Z-]+)="([^"]*)"\]$/);
    if (at) return el.attrs[at[1]] === at[2];
    if (s[0] === '.') return (el.attrs.class || '').split(/\s+/).includes(s.slice(1));
    return el.tagName === s.toUpperCase();
  }
  doc.documentElement = new El('html');
  doc.head = doc.documentElement.appendChild(new El('head'));
  doc.body = doc.documentElement.appendChild(new El('body'));
  // Os três gestos de quem usa a janela, num lugar só (clicar, teclar, clicar fora).
  doc._clica = el => (el._ouvintes.click || []).forEach(fn => fn({ target: el, type: 'click', preventDefault() {} }));
  doc._tecla = k => (doc._ouvintes.keydown || []).forEach(fn => fn({ key: k, shiftKey: false, preventDefault() {} }));
  doc._mouseNo = (el, alvo) => (el._ouvintes.mousedown || []).forEach(fn => fn({ target: alvo, preventDefault() {} }));
  return doc;
}

module.exports = { criaDom };
