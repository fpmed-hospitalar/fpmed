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

  // ── EMPRESAS DO CLIENTE ───────────────────────────────────────────────────────────────────
  // Sempre devolve LISTA. O molde pode ter cliente com 2 CNPJs (matriz e filial, ou duas razoes
  // sociais disputando licitacao) e quem consome nao deve precisar saber quantas sao.
  function empresas() {
    var e = cfg().empresas;
    return Array.isArray(e) ? e : (e ? [e] : []);
  }
  // A que o funil mostra por padrao. Sem `principal` marcada, cai na primeira — e se nao houver
  // nenhuma, devolve null em vez de um objeto vazio: quem chama tem que decidir o que fazer com
  // "cliente sem empresa cadastrada", nao receber um badge em branco achando que esta tudo certo.
  function empresaPrincipal() {
    var l = empresas();
    if (!l.length) return null;
    for (var i = 0; i < l.length; i++) if (l[i] && l[i].principal) return l[i];
    return l[0];
  }
  function tituloJanela(sufixo) {
    var p = (cfg().marca && cfg().marca.produto) || 'LIMEDTEC';
    return p + ' — ' + nome() + (sufixo ? ' · ' + sufixo : '');
  }

  // ── TEMA: as cores do cliente viram variaveis CSS ───────────────────────────────────────────
  // Roda como script BLOQUEANTE no <head>, antes do corpo pintar - senao a tela aparece com a cor
  // do molde e troca na frente do usuario. E so ESCREVE as variaveis: a folha de estilo de cada
  // tela continua sendo a dona do layout.
  // >>> TELA QUE DECLARA O PRÓPRIO TEMA MANDA NELE. `data-tema` no <html> da tela significa
  //     "esta tela é dona da própria paleta — não escreva cor aqui".
  //
  //     POR QUE ISTO PRECISOU EXISTIR (regressão medida no ar em 05/08, 20h25): o setProperty
  //     abaixo escreve as variáveis como STYLE INLINE no <html>, e style inline VENCE qualquer
  //     `:root{}` de folha de estilo. A tela de Licitações é a única escura do sistema e declara
  //     `:root{--bg:#0B1622}` — que era silenciosamente trocado pelo #F5F9FC do cliente. O
  //     resultado no ar: fundo branco, "Encontrar" branco-no-branco ilegível e os painéis
  //     escuros boiando num fundo claro. Nas telas claras ninguém percebeu porque o --bg delas
  //     (#F4F7FA) e o do cliente (#F5F9FC) são quase a mesma cor — o defeito existia em todas,
  //     mas só uma tinha contraste pra denunciar.
  //
  //     Fazer a tela escura brigar com `!important` seria tratar o sintoma e deixar a armadilha
  //     montada pro próximo nome de variável que colidir. Aqui a regra fica explícita e vale pra
  //     qualquer cliente do molde que um dia tenha uma tela de paleta própria.
  // >>> AS MESMAS CORES SÃO ESCRITAS DUAS VEZES, e isso é uma passagem, não um descuido (06/08).
  //     A origem do molde resolveu a colisão acima de um jeito melhor que o `data-tema`: em vez de
  //     a tela pedir pra ser deixada em paz, o molde passou a OFERECER com prefixo (`--lt-bg`) e
  //     cada tela ESCOLHE (`--bg: var(--lt-bg, #0f1620)`). Nome prefixado não colide com o `--bg`
  //     que a tela já tinha — o problema deixa de existir em vez de ser contornado.
  //     Aqui os DOIS conjuntos são escritos porque as telas da FPMED (7 telas, escritas antes
  //     disso) ainda recebem o tema pelos nomes crus. Trocar só o mapa mudaria a cor das 7 de uma
  //     vez, num porte que era pra ser "entrou uma tela nova" — e regressão de cor é o tipo de
  //     coisa que só aparece no ar, com alguém tentando trabalhar.
  //     >>> PENDÊNCIA REGISTRADA: a virada (largar os nomes crus e converter as 7 telas pra
  //         `var(--lt-*)`) é item de SYNC com teste próprio, não efeito colateral deste porte.
  var CORES_CRUAS = { bg: '--bg', painel: '--panel', painel2: '--panel2', destaque: '--ciano',
    destaque2: '--ciano2', texto: '--txt', borda: '--borda' };
  var CORES_LT = { bg: '--lt-bg', painel: '--lt-panel', painel2: '--lt-panel2', destaque: '--lt-ciano',
    destaque2: '--lt-ciano2', texto: '--lt-txt', borda: '--lt-borda' };

  function aplicaTema() {
    if (typeof document === 'undefined') return;
    var m = cfg().marca || {};
    var el = document.documentElement;
    var c = m.cores || {};
    // o produto é identidade, não cor: entra mesmo na tela de tema próprio
    if (m.produto) el.setAttribute('data-limedtec-produto', m.produto);
    // >>> O `data-tema` continua cortando OS DOIS conjuntos, e não só os nomes crus. Escrever
    //     `--lt-*` numa tela de paleta própria seria inerte (ela não pede por eles) — mas a
    //     garantia que o `testa_tema_tela_propria` protege é justamente a mais simples de
    //     verificar: "nesta tela o tema do cliente NÃO ESCREVE NADA". Trocar isso por "escreve,
    //     mas é inofensivo" custa a asserção e não compra nada. Quando as 7 telas migrarem pro
    //     `var(--lt-*)`, aí a regra muda junto com elas — e com teste novo.
    if (el.getAttribute('data-tema')) return;          // a tela declarou tema — não sobrescreve
    Object.keys(CORES_LT).forEach(function (k) { if (c[k]) el.style.setProperty(CORES_LT[k], c[k]); });
    Object.keys(CORES_CRUAS).forEach(function (k) { if (c[k]) el.style.setProperty(CORES_CRUAS[k], c[k]); });
  }

  raiz.LIMEDTEC = { cfg: cfg, banco: banco, urlBanco: urlBanco, chaveBanco: chaveBanco,
    edge: edge, rest: rest, nome: nome, tituloJanela: tituloJanela, aplicaTema: aplicaTema,
    empresas: empresas, empresaPrincipal: empresaPrincipal };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.LIMEDTEC;
})(typeof window !== 'undefined' ? window : globalThis);
