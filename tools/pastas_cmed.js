/* ============================================================================================
   ONDE MORAM AS PLANILHAS DA CMED — em um lugar só.

   FRONTEIRA: este arquivo não lê planilha, não carrega nada e não decide nada. Ele só responde
   "em que pastas eu procuro?" e "qual é a mais nova que casa com este padrão?".

   ── POR QUE ELE EXISTE (13/08/2026) ──────────────────────────────────────────────────────────
   Quatro ferramentas procuravam as planilhas com `C:/fpmed` escrito à mão, cada uma com a sua
   cópia do laço de descoberta. Quando as planilhas saíram da raiz para `dados_cmed/` — porque
   o repositório é PÚBLICO e planilha de dados não entra nele —, as quatro quebrariam, cada uma
   com uma mensagem de erro diferente.
   >>> A ORDEM DE BUSCA É `dados_cmed/` PRIMEIRO, RAIZ DEPOIS. A raiz continua valendo de
       propósito: é onde o navegador larga um download, e obrigar a mover antes de rodar seria
       um passo a mais para ganhar nada. O que a pasta resolve é o repositório, não o fluxo.
   >>> E A RAIZ É FALLBACK, NÃO DESTINO: quem largar na raiz vê um aviso dizendo para mover.
       Planilha na raiz de um repo público é a mesma família do "Calendario 2025.xlsm", que
       ficou a um `git add -A` de virar commit (ver .gitignore).

   >>> O NOME NÃO COMEÇA COM `_`, E ISSO NÃO É ESTILO: o .gitignore tem `tools/_*`, criado em
       04/08 depois que um `_acesso_temp.js` entrou no repo público. Um módulo compartilhado
       chamado `_pastas_cmed.js` seria ignorado, e as quatro ferramentas quebrariam no clone
       exigindo um arquivo que nunca foi publicado. A regra está certa; o nome é que estava.
   ============================================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const PASTA_DADOS = path.join(RAIZ, 'dados_cmed');

// dados_cmed/ primeiro; a raiz é o fallback de quem acabou de baixar.
function pastas() {
  return [PASTA_DADOS, RAIZ].filter(d => { try { return fs.statSync(d).isDirectory(); } catch (e) { return false; } });
}

/* Devolve o caminho da planilha MAIS NOVA que casa com o padrão, ou null.
   >>> "Mais nova" é por data de modificação do arquivo, e isso é uma escolha com defeito
       conhecido: baixar de novo uma edição velha a faz parecer nova. Quem decide de verdade
       qual edição é essa é o `atualiza_cmed.js`, que LÊ A DATA DE PUBLICAÇÃO DE DENTRO da
       planilha e RECUSA carregar uma edição mais velha que a base. Aqui é só ordenação. */
function achar(padrao, explicito) {
  if (explicito) {
    const p = path.isAbsolute(explicito) ? explicito : path.join(RAIZ, explicito);
    return fs.existsSync(p) ? p : null;
  }
  const achados = [];
  for (const dir of pastas()) {
    for (const f of fs.readdirSync(dir)) {
      if (!padrao.test(f)) continue;
      const cheio = path.join(dir, f);
      achados.push({ cheio, dir, t: fs.statSync(cheio).mtimeMs });
    }
  }
  if (!achados.length) return null;
  achados.sort((a, b) => b.t - a.t);
  const alvo = achados[0];
  if (alvo.dir === RAIZ) {
    console.log('  [aviso] planilha na RAIZ do repo: ' + path.basename(alvo.cheio));
    console.log('          mova para dados_cmed/ — o repositorio e publico e a raiz nao e lugar de dado.');
  }
  return alvo.cheio;
}

const ondeProcurei = () => pastas().map(d => path.relative(RAIZ, d) || '(raiz)').join(' e ');

module.exports = { RAIZ, PASTA_DADOS, pastas, achar, ondeProcurei };
