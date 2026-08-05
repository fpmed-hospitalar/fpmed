/* LIMEDTEC — ACESSO AO CONFIG DO CLIENTE.  Molde puro: nao conhece nenhum cliente.
 *
 * Dois arquivos, de proposito:
 *   cliente.config.js  = DADO   (muda por cliente; e o unico que o cria_cliente.js reescreve)
 *   limedtec-config.js = LOGICA (igual pra todo mundo; nunca e editado por cliente)
 * Se a logica morasse dentro do config, cada cliente teria a sua copia dela - e no dia de corrigir
 * um bug seria corrigir N vezes, que e exatamente o custo que a produtizacao existe pra matar.
 *
 * >>> A DECISAO QUE MAIS IMPORTA AQUI: `banco()` NAO TEM VALOR-PADRAO. Era tentador escrever
 *     `cfg.banco.url || 'https://...algum-banco...'` pra "nao quebrar". So que o cliente que
 *     esquecesse o config nao veria erro nenhum: veria o sistema funcionando lindamente,
 *     lendo o BANCO DE OUTRA EMPRESA. Preco, fornecedor e cliente alheios na tela dele.
 *     Isso e a violacao exata que o COMPLIANCE.md proibe, e ela chegaria disfarcada de sucesso.
 *     Entao: sem config, explode na cara de quem instalou, com o nome do arquivo que falta.
 *     Falhar alto e barato; vazar dado entre empresas nao tem desfazer.
 */
(function (raiz) {
  'use strict';

  function cfg() {
    var c = raiz.LIMEDTEC_CLIENTE;
    if (!c) throw new Error('LIMEDTEC: cliente.config.js não foi carregado. '
      + 'Ele precisa vir ANTES deste arquivo no <head>.');
    return c;
  }

  function banco() {
    var b = cfg().banco;
    // O PLACEHOLDER CONTA COMO AUSENTE. O cria_cliente.js escreve "https://PREENCHER.supabase.co",
    // que e uma string preenchida e passaria numa checagem de vazio — o sistema abriria e so
    // falharia la na frente, com erro de rede, longe da causa. Aqui ele para na hora, dizendo o
    // que falta.
    var falta = !b || !b.url || !b.anonKey
      || /PREENCHER/i.test(String(b.url)) || /PREENCHER/i.test(String(b.anonKey));
    if (falta) {
      throw new Error('LIMEDTEC: cliente.config.js está sem `banco.url` ou `banco.anonKey` '
        + '(ou ainda com o texto PREENCHER). Coloque o Supabase DESTE cliente — não existe valor '
        + 'padrão de propósito, para que uma instalação incompleta nunca leia o banco de outra empresa.');
    }
    return b;
  }

  // atalhos usados pelas telas
  function urlBanco() { return banco().url; }
  function chaveBanco() { return banco().anonKey; }
  function edge(nome) { return banco().url + '/functions/v1/' + nome; }
  function rest(caminho) { return banco().url + '/rest/v1/' + caminho; }

  function nome() { return cfg().nome || ''; }
  function tituloJanela(sufixo) {
    var p = (cfg().marca && cfg().marca.produto) || 'LIMEDTEC';
    return p + ' — ' + nome() + (sufixo ? ' · ' + sufixo : '');
  }

  // ── TEMA: as cores do cliente viram variaveis CSS ───────────────────────────────────────────
  // Roda como script BLOQUEANTE no <head>, antes do corpo pintar - senao a tela aparece com a cor
  // do molde e troca na frente do usuario. E so ESCREVE as variaveis: a folha de estilo de cada
  // tela continua sendo a dona do layout.
  function aplicaTema() {
    if (typeof document === 'undefined') return;
    var m = cfg().marca || {}, c = m.cores || {};
    var mapa = { bg: '--bg', painel: '--panel', painel2: '--panel2', destaque: '--ciano',
      destaque2: '--ciano2', texto: '--txt', borda: '--borda' };
    var el = document.documentElement;
    Object.keys(mapa).forEach(function (k) { if (c[k]) el.style.setProperty(mapa[k], c[k]); });
    if (m.produto) el.setAttribute('data-limedtec-produto', m.produto);
  }

  raiz.LIMEDTEC = { cfg: cfg, banco: banco, urlBanco: urlBanco, chaveBanco: chaveBanco,
    edge: edge, rest: rest, nome: nome, tituloJanela: tituloJanela, aplicaTema: aplicaTema };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.LIMEDTEC;
})(typeof window !== 'undefined' ? window : globalThis);
