/* ════════════════════════════════════════════════════════════════════════════════════════════
   testa_fila_ean_executa.js — AS TRÊS FUNÇÕES DA FILA DE EAN SÃO CHAMADAS DE VERDADE · B20

   ══ POR QUE ESTE ARQUIVO EXISTE, E É UMA HISTÓRIA CARA ══════════════════════════════════════
   A fila "Produtos sem EAN" nasceu na B10 e NUNCA DESENHOU UMA LINHA. Em 14/08 a B17 mediu o
   banco e achou o que o código-fonte não contava: `cotacoes` com 8.832 linhas, EAN em ZERO delas.
   A causa não era regra de negócio: `hdr()` e `esc()` não existiam nesta tela, as três funções da
   fatia chamavam os dois, e todas as três estouravam `ReferenceError` na PRIMEIRA LINHA ÚTIL.

   *** E NENHUMA SUÍTE VIU, POR UM MOTIVO QUE VALE MAIS QUE O DEFEITO. *** As suítes recortavam a
   FUNÇÃO por âncora e rodavam só ela. `hdr` e `esc` são de FORA dela — então o recorte rodava
   verde enquanto a tela real quebrava. O arquivo "tem o código", e o código está escrito certo.
   O que faltava era o CHÃO embaixo dele, e chão não aparece em recorte.

   ══ ENTÃO ESTA SUÍTE NÃO LÊ CÓDIGO-FONTE: ELA EXECUTA ═══════════════════════════════════════
   Ela monta um DOM mínimo (o suficiente para as funções acharem os elementos que procuram), um
   `fetch` de mentira que responde o que o teste mandar, e CHAMA as três. Se qualquer símbolo de
   fora sumir de novo — `hdr`, `esc`, `LIMEDTEC`, `EAN_CACHE`, o que for — o `ReferenceError`
   estoura AQUI, com o nome do símbolo no recado, e não na frente do operador.

   >>> O QUE ELA NÃO PROVA, E SAI DECLARADO EM VEZ DE VIRAR VERDE: ela não prova que a gravação
   chega ao banco com o crachá do navegador. Isso é a lição da B16 (prova com `service_role`
   passa por cima da RLS e responde a outra pergunta), e exige uma SESSÃO — o trabalhador não
   loga. O que falta está nomeado no RELATORIO_B.md, não escondido atrás de um verde.

     node tests/testa_fila_ean_executa.js
   ════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'fpmed_giovana.html'), 'utf8')
               .replace(/\r\n/g, '\n');
const pega = re => (HTML.match(re) || [])[0] || '';

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => {
  if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '\n         ' + e : '')); }
};
console.log('SUITE testa_fila_ean_executa — a fila de EAN roda de verdade (fatia B20)\n');

/* ── 1 · AS PEÇAS, ARRANCADAS DO ARQUIVO ────────────────────────────────────────────────────
   O recorte é por âncora, como nas outras suítes — a diferença está no que se faz com ele. */
const PECAS = {
  '_escEd':            /function _escEd\(s\)\{[\s\S]*?\n\}/,
  'esc':               /function esc\(s\)\{ return _escEd\(s\); \}/,
  // >>> A ÂNCORA DO `hdr` É DE UMA LINHA SÓ, E ISSO É CONSERTO: com `[\s\S]*?}` ela parava no
  //     PRIMEIRO fecha-chaves, que é o do `Object.assign({}` — e o recorte saía sintaticamente
  //     quebrado. Recorte por âncora preguiçosa é como uma suíte "encontra" a função errada.
  'hdr':               /function hdr\(\)\{[^\n]*\}/,
  'eanValido':         /function eanValido\(v\) \{[\s\S]*?\n\}/,
  '_eanAviso':         /function _eanAviso\(id, html, cor\) \{[\s\S]*?\n\}/,
  'eanDigitado':       /let _eanTimer = \{\};\nfunction eanDigitado\(id\) \{[\s\S]*?\n\}/,
  'buscarEanNaCmed':   /async function buscarEanNaCmed\(id, ean\) \{[\s\S]*?\n\}/,
  'eanEscolher':       /function eanEscolher\(id, i\) \{[\s\S]*?\n\}/,
  'eanAplicar':        /function eanAplicar\(id, linha\) \{[\s\S]*?\n\}/,
  'abrirPendenciaEan': /async function abrirPendenciaEan\(alvo\) \{[\s\S]*?\n\}/,
};
const fonte = {};
for (const [nome, re] of Object.entries(PECAS)) fonte[nome] = pega(re);
const faltando = Object.keys(PECAS).filter(k => !fonte[k]);
/* ÂNCORA QUEBRADA NÃO É "PASSOU". Um recorte que não achou nada roda vazio e fica verde — é
   assim que uma suíte deixa de proteger sem ninguém perceber que ela parou. */
ok(n + '. *** (controle) as 10 pecas foram encontradas no arquivo ***',
  faltando.length === 0, 'nao achei: ' + faltando.join(', ')); n++;
if (faltando.length) { console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)'); process.exit(1); }

/* ── 2 · O DOM MÍNIMO ───────────────────────────────────────────────────────────────────────
   Só o que as funções procuram: `getElementById`, `innerHTML`, `style` e `value`. Um DOM
   completo aqui seria uma segunda implementação do navegador, e é ela que passaria a ter bugs. */
function montaDom() {
  const els = new Map();
  const novo = id => ({ id, value: '', innerHTML: '', style: {} });
  return {
    els,
    document: {
      getElementById: id => {
        if (!els.has(id)) els.set(id, novo(id));
        return els.get(id);
      },
    },
  };
}

/* O `fetch` de mentira. Ele guarda o que foi pedido (para o teste conferir o cabeçalho) e
   responde o que o caso mandar — inclusive FALHANDO, que é metade do que se quer medir. */
function montaFetch(resposta) {
  const chamadas = [];
  const fn = async (url, opts) => {
    chamadas.push({ url: String(url), opts: opts || {} });
    const r = typeof resposta === 'function' ? resposta(String(url)) : resposta;
    if (r instanceof Error) throw r;
    return {
      ok: r.ok !== false,
      status: r.status || 200,
      headers: { get: k => (r.headers || {})[String(k).toLowerCase()] || null },
      json: async () => r.json,
    };
  };
  fn.chamadas = chamadas;
  return fn;
}

/* Monta o ambiente e devolve as funções JÁ LIGADAS a ele. `H` é o objeto de cabeçalho que a tela
   mantém; `LIMEDTEC.rest` é o endereço; `EAN_CACHE` é o mapa da própria tela. */
function ambiente(resposta) {
  const dom = montaDom();
  const fetchFalso = montaFetch(resposta);
  const win = {};
  const corpo = Object.values(fonte).join('\n\n')
    + '\nreturn { abrirPendenciaEan, buscarEanNaCmed, eanAplicar, eanDigitado, eanEscolher, eanValido };';
  const cria = new Function('document', 'fetch', 'window', 'LIMEDTEC', 'EAN_CACHE', 'H',
                            'setTimeout', 'clearTimeout', corpo);
  const api = cria(dom.document, fetchFalso, win,
                   { rest: t => 'https://exemplo.invalid/rest/v1/' + t },
                   new Map(), { apikey: 'cracha-de-mentira' },
                   (fn) => { fn(); return 1; }, () => {});
  return { api, dom, fetchFalso, win };
}

/* ── 3 · AS TRÊS FUNÇÕES SÃO CHAMADAS. É ESTE O ASSERT QUE A B10 NÃO TINHA. ─────────────────*/
async function chama(rotulo, fn) {
  try { await fn(); return null; }
  catch (e) { return (e && e.name === 'ReferenceError' ? 'REFERENCIA QUE SUMIU -> ' : '') + e.message; }
}

(async () => {
  {
    const { api, dom, fetchFalso } = ambiente({
      json: [{ produto: 'DIPIRONA 500MG', marca: 'HIPOLABOR', und: 'CX', estoque: 10 }],
      headers: { 'content-range': '0-0/8455' },
    });
    const erro = await chama('abrirPendenciaEan', () => api.abrirPendenciaEan(''));
    ok(n + '. *** abrirPendenciaEan RODA (nao estoura ReferenceError) ***', erro === null, erro); n++;
    const c0 = fetchFalso.chamadas[0] || { opts: {} };
    ok(n + '. e ela perguntou ao servidor com o cabecalho que a tela carrega (hdr)',
      fetchFalso.chamadas.length === 1 && !!((c0.opts || {}).headers || {}).apikey,
      JSON.stringify(c0.opts) + '  (chamadas: ' + fetchFalso.chamadas.length + ')'); n++;
    /* O TOTAL SAI DO `content-range`, e não do tamanho da página: a consulta corta em 1000, e
       contar as linhas diria "1.000 itens sem EAN" para sempre. Número que para de crescer é
       número que mente — e este número é o tamanho da fila que alguém precisa vencer. */
    const pintou = dom.document.getElementById('imp-pendencia').innerHTML;
    ok(n + '. *** a fila desenha o total do content-range (8.455), e nao o tamanho da pagina ***',
      /8\.455/.test(pintou), pintou.slice(0, 160)); n++;
  }

  {
    /* CONTAGEM IMPOSSÍVEL NÃO VIRA ZERO NEM CHUTE. Sem o `content-range`, a tela diz que não
       sabe — é a mesma regra do "sem referência" da BASE, aplicada ao tamanho da fila. */
    const { api, dom } = ambiente({ json: [], headers: {} });
    await api.abrirPendenciaEan('');
    const pintou = dom.document.getElementById('imp-pendencia').innerHTML;
    ok(n + '. sem o cabecalho de contagem, ela diz que NAO SABE (nao inventa numero)',
      /não consegui contar/.test(pintou) && !/\b0\b\s*<\/b>/.test(pintou), pintou.slice(0, 160)); n++;
  }

  {
    const { api, dom, fetchFalso } = ambiente({ json: [] });
    const erro = await chama('buscarEanNaCmed', () => api.buscarEanNaCmed('x', '7896112110347'));
    ok(n + '. *** buscarEanNaCmed RODA (nao estoura ReferenceError) ***', erro === null, erro); n++;
    ok(n + '. EAN que a CMED nao tem AVISA e deixa seguir (material/correlato nao e erro)',
      /não está na CMED/.test(dom.document.getElementById('x_ean_aviso').innerHTML)); n++;
    /* >>> O `|| {}` NÃO É ZELO SOBRANDO: a mutação desta fatia me mostrou por quê. Quando eu
       quebrei o `hdr` de propósito, a chamada não aconteceu, `chamadas[0]` virou `undefined` e
       este assert ESTOUROU um TypeError — o processo morreu aqui, os asserts seguintes nunca
       rodaram e a linha `RESULTADO:` nunca foi impressa. O `tests/run_all.js` lê essa linha com
       expressão regular: suíte que morre antes dela é contada como ZERO, e o placar do projeto
       fica BONITO justamente no dia em que a tela quebrou. Teste que morre em vez de reprovar é
       pior que teste que não existe, porque ele ocupa o lugar de um que reprovaria. */
    const chamada = fetchFalso.chamadas[0] || {};
    ok(n + '. (controle) ela consultou a cmed_pf pelos tres campos de EAN',
      /cmed_pf/.test(chamada.url || '') && /ean1\.eq\.|ean2\.eq\.|ean3\.eq\./.test(chamada.url || ''),
      chamada.url || '(nenhuma consulta foi feita)'); n++;
  }

  {
    /* *** FALHA DE LEITURA NÃO PODE VIRAR "NÃO ENCONTRADO". *** São coisas diferentes e pedem
       ações OPOSTAS: uma é "tente de novo", a outra é "digite à mão". Dizer a errada manda a
       pessoa para o caminho errado, e ela nem sabe que foi mandada. */
    const { api, dom } = ambiente(new Error('rede caiu'));
    await api.buscarEanNaCmed('y', '7896112110347');
    const aviso = dom.document.getElementById('y_ean_aviso').innerHTML;
    ok(n + '. *** portal fora do ar NAO vira "nao encontrado" — sao acoes opostas ***',
      /não consegui consultar/.test(aviso) && !/não está na CMED/.test(aviso), aviso); n++;
  }

  {
    /* *** A COLISÃO É O ASSERT MAIS IMPORTANTE DESTA SUÍTE. *** Escolher o primeiro de dois
       produtos que dividem o código é o palpite que a caixa proíbe com nome: um EAN errado não
       dá erro em canto nenhum — ele casa com OUTRO produto e traz um teto com cara de certo. */
    const { api, dom, win } = ambiente({ json: [
      { marca_norm: 'DIPIRONA A', subst_norm: 'DIPIRONA', apresentacao: '500MG CX 10', laboratorio: 'LAB A', registro: '1.0043.0155' },
      { marca_norm: 'DIPIRONA B', subst_norm: 'DIPIRONA', apresentacao: '500MG CX 20', laboratorio: 'LAB B', registro: '1.0043.0156' },
    ] });
    await api.buscarEanNaCmed('z', '7896112110347');
    const aviso = dom.document.getElementById('z_ean_aviso').innerHTML;
    ok(n + '. *** dois produtos no mesmo codigo: ela PERGUNTA, nao escolhe ***',
      /2 produtos/.test(aviso) && /eanEscolher/.test(aviso), aviso.slice(0, 140)); n++;
    ok(n + '. e nao preencheu NADA sozinha enquanto a pessoa nao escolheu',
      dom.document.getElementById('z_produto').value === '' &&
      dom.document.getElementById('z_marca').value === ''); n++;
    /* e quando a pessoa escolhe, aí sim ele aplica — a escolha é dela, e fica gravada. */
    const erro = await chama('eanEscolher/eanAplicar', () => api.eanEscolher('z', 1));
    ok(n + '. *** eanAplicar RODA (nao estoura ReferenceError) ***', erro === null, erro); n++;
    ok(n + '. e a escolha da PESSOA e que preenche (LAB B, o segundo)',
      dom.document.getElementById('z_marca').value === 'LAB B',
      dom.document.getElementById('z_marca').value); n++;
    ok(n + '. o registro ANVISA da linha escolhida fica guardado para gravar junto',
      (win._eanExtra || {}).z && win._eanExtra.z.registro_anvisa === '1.0043.0156',
      JSON.stringify(win._eanExtra)); n++;
  }

  {
    /* O QUE JÁ FOI DIGITADO NÃO SE SOBRESCREVE: quem digitou sabe de algo que a tabela não sabe
       (o fornecedor chama o mesmo produto por outro nome). */
    const { api, dom } = ambiente({ json: [] });
    dom.document.getElementById('w_produto').value = 'NOME QUE O FORNECEDOR USA';
    await api.eanAplicar('w', { marca_norm: 'OUTRO NOME', apresentacao: '10MG', laboratorio: 'LAB C' });
    ok(n + '. *** o que a pessoa digitou NAO e sobrescrito pela tabela ***',
      dom.document.getElementById('w_produto').value === 'NOME QUE O FORNECEDOR USA'); n++;
    ok(n + '. mas o campo VAZIO ao lado e preenchido (marca <- laboratorio)',
      dom.document.getElementById('w_marca').value === 'LAB C'); n++;
    /* >>> ESTE ASSERT NASCEU ERRADO E FOI CORRIGIDO CONTRA A TELA, e não a tela contra ele. Eu
       tinha escrito que a nota "(o que você digitou foi mantido)" sai sempre que algo é
       preservado. NÃO É a regra: ela sai só quando NADA foi preenchido — porque aí a tela
       parece não ter feito nada, e o silêncio precisa de explicação. Quando algum campo é
       preenchido, o resultado está na cara e a nota seria ruído.
       A tela estava certa e o teste estava errado. Um assert que eu tivesse "consertado"
       mexendo na tela teria trocado uma regra pensada por uma suposição minha. */
    ok(n + '. quando ALGO foi preenchido, a nota de "mantido" nao sai (o resultado esta a vista)',
      !/mantido/.test(dom.document.getElementById('w_ean_aviso').innerHTML)); n++;
  }

  {
    /* E O SILENCIO E QUE PRECISA DE EXPLICACAO: com os dois campos ja preenchidos, a tela nao
       muda nada, e sem a nota o operador conclui que o codigo nao funcionou. */
    const { api, dom } = ambiente({ json: [] });
    dom.document.getElementById('v_produto').value = 'JA TINHA';
    dom.document.getElementById('v_marca').value = 'JA TINHA TAMBEM';
    await api.eanAplicar('v', { marca_norm: 'OUTRO', apresentacao: '10MG', laboratorio: 'LAB D' });
    ok(n + '. *** quando NADA foi preenchido, a tela DIZ que manteve o que a pessoa escreveu ***',
      /mantido/.test(dom.document.getElementById('v_ean_aviso').innerHTML),
      dom.document.getElementById('v_ean_aviso').innerHTML); n++;
  }

  {
    /* DÍGITO VERIFICADOR ERRADO NÃO É "NÃO ENCONTRADO": é engano de digitação, e dizer a coisa
       certa poupa a pessoa de procurar um produto que ela nunca ia achar. E o mais importante:
       a tela NÃO vai ao servidor com um código que já se sabe quebrado. */
    const { api, dom, fetchFalso } = ambiente({ json: [] });
    dom.document.getElementById('k_ean').value = '7896112110348';   // último dígito trocado
    const erro = await chama('eanDigitado', () => api.eanDigitado('k'));
    ok(n + '. *** eanDigitado RODA (nao estoura ReferenceError) ***', erro === null, erro); n++;
    ok(n + '. *** codigo que nao fecha e DENUNCIADO, e nao consultado ***',
      /não fecha/.test(dom.document.getElementById('k_ean_aviso').innerHTML) &&
      fetchFalso.chamadas.length === 0,
      dom.document.getElementById('k_ean_aviso').innerHTML + ' | chamadas: ' + fetchFalso.chamadas.length); n++;
    ok(n + '. (controle) o EAN certo passa na conta do digito verificador e o errado nao',
      api.eanValido('7896112110347') === true && api.eanValido('7896112110348') === false); n++;
  }

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exit(f ? 1 : 0);
})();
