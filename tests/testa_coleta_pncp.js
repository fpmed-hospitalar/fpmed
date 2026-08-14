// SUITE testa_coleta_pncp — O COLETOR TEM QUE SOBREVIVER A FONTE CAINDO.
//
// O PNCP caiu 4 VEZES em dois dias (04/08, 05/08 manha, 05/08 ~21h e ~23h -- as duas ultimas
// medidas por mim, com timeout confirmado). O coletor existe pra que a tela deixe de depender
// disso: com indice proprio ela tem dado sempre, e o PNCP vira fonte de ATUALIZACAO em vez de
// dependencia de tempo real.
//
// >>> O QUE ESTA SUITE PROTEGE nao e o caminho feliz -- e o comportamento na QUEDA. Coletor que
//     so foi testado com a API no ar e um coletor que ninguem sabe o que faz no dia que importa.
//
//   node tests/testa_coleta_pncp.js
const { esperaBackoff, criaBreaker, janela, normaliza, valida, yyyymmdd, FALHAS_ATE_ABRIR }
  = require('../tools/coleta_pncp.js');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_coleta_pncp — resiliencia do coletor\n');

// ══════════ 1. BACKOFF — insistir de imediato numa API caida so piora ══════════
ok('1. 1a espera e 1s', esperaBackoff(0) === 1000, esperaBackoff(0));
ok('2. dobra a cada tentativa', esperaBackoff(1) === 2000 && esperaBackoff(2) === 4000 && esperaBackoff(3) === 8000);
ok('3. *** tem TETO de 30s ***', esperaBackoff(10) === 30000, esperaBackoff(10));
ok('4. ...e o teto vale pra qualquer expoente (sem isso, a 20a tentativa esperaria 12 dias)',
  esperaBackoff(50) === 30000, esperaBackoff(50));

// ══════════ 2. CIRCUIT BREAKER — parar e voltar depois ══════════
// Sem ele, uma queda longa vira um laco batendo na porta e uma conta de execucao no CI.
{
  const b = criaBreaker(3);
  ok('5. nasce fechado', b.aberto === false);
  b.falhou(); b.falhou();
  ok('6. 2 falhas ainda nao abrem (limite 3)', b.aberto === false, b.seguidas);
  ok('7. *** a 3a falha ABRE ***', b.falhou() === true && b.aberto === true);
}
{
  const b = criaBreaker(3);
  b.falhou(); b.falhou();
  b.ok();                                   // um sucesso no meio
  ok('8. *** sucesso ZERA o contador (falha isolada nao derruba a rodada) ***', b.seguidas === 0, b.seguidas);
  b.falhou(); b.falhou();
  ok('9. ...e depois do zero, 2 falhas ainda nao abrem', b.aberto === false, b.seguidas);
}
ok('10. o limite padrao e 5', FALHAS_ATE_ABRIR === 5, FALHAS_ATE_ABRIR);

// ══════════ 3. JANELA INCREMENTAL ══════════
// Reprocessar tudo toda vez e o jeito garantido de bater em rate limit e de a coleta ficar
// mais lenta a cada mes que passa.
const D = s => new Date(s + 'T12:00:00');
{
  const j = janela(null, D('2026-08-05'), null);
  ok('11. *** primeira coleta (sem carimbo) pega 30 dias ***', yyyymmdd(j.ini) === '20260707', yyyymmdd(j.ini));
  // 30 dias INCLUSIVE dos dois extremos: 07/07 a 05/08 sao 30 dias contando os dois.
  ok('12. ...ate hoje', yyyymmdd(j.fim) === '20260805', yyyymmdd(j.fim));
}
{
  const j = janela(D('2026-08-04'), D('2026-08-05'), null);
  ok('13. *** com carimbo, volta 2 dias de sobreposicao ***', yyyymmdd(j.ini) === '20260802', yyyymmdd(j.ini));
  // a sobreposicao existe porque publicacao pode ser CORRIGIDA depois; reler 2 dias e barato
  // perto de perder uma alteracao e nunca mais reve-la.
}
{
  const j = janela(D('2026-08-04'), D('2026-08-05'), 30);
  ok('14. --dias força a janela e ignora o carimbo', yyyymmdd(j.ini) === '20260707', yyyymmdd(j.ini));
}
{
  // "N dias" tem que significar a MESMA coisa nos dois caminhos. A 1a versao usava -30 no
  // padrao e -N+1 no forcado: `--dias 30` dava 30 dias e o padrao dava 31. Dois significados
  // da mesma palavra na mesma funcao vira bug de contagem meses depois.
  const padrao = janela(null, D('2026-08-05'), null);
  const forcado = janela(null, D('2026-08-05'), 30);
  ok('14b. *** a janela padrao de 30 dias e IGUAL a de --dias 30 ***',
    yyyymmdd(padrao.ini) === yyyymmdd(forcado.ini), [yyyymmdd(padrao.ini), yyyymmdd(forcado.ini)]);
  ok('14c. --dias 1 e so o dia de hoje', yyyymmdd(janela(null, D('2026-08-05'), 1).ini) === '20260805');
}
{
  // carimbo no FUTURO (relogio errado, restore de backup): a janela nao pode inverter
  const j = janela(D('2027-01-01'), D('2026-08-05'), null);
  ok('15. carimbo no futuro nao gera janela invertida', j.ini <= j.fim, [yyyymmdd(j.ini), yyyymmdd(j.fim)]);
}

// ══════════ 4. NORMALIZAÇÃO E CHAVE NATURAL ══════════
const X = {
  orgaoEntidade: { cnpj: '01.612.092/0001-23', razaoSocial: 'MUNICIPIO DE URUACU' },
  unidadeOrgao: { nomeUnidade: 'SEC SAUDE', municipioNome: 'URUACU', ufSigla: 'GO' },
  anoCompra: 2026, sequencialCompra: 42, numeroCompra: '(6128) | 32-0/2026',
  numeroControlePNCP: '01612092000123-1-000042/2026',
  modalidadeNome: 'Pregão Eletrônico', modalidadeId: 6, modoDisputaNome: 'Aberto',
  situacaoCompraNome: 'Divulgada', objetoCompra: 'AQUISICAO DE MEDICAMENTOS',
  valorTotalEstimado: 1234567.89, dataPublicacaoPncp: '2026-08-04T10:00:00',
  dataAberturaProposta: '2026-08-04T08:00:00', dataEncerramentoProposta: '2026-08-19T09:00:00',
  linkSistemaOrigem: 'https://x',
};
{
  const n = normaliza(X);
  ok('16. *** o CNPJ vira so digitos (a chave natural nao pode depender de pontuacao) ***',
    n.cnpj === '01612092000123', n.cnpj);
  ok('17. ano e sequencial viram numero', n.ano === 2026 && n.sequencial === 42);
  ok('18. portal e PNCP (a coluna existe pra Comprasnet/Licitanet entrarem depois)', n.portal === 'PNCP');
  ok('19. data_publicacao fica so a data', n.data_publicacao === '2026-08-04', n.data_publicacao);
  ok('20. UF e municipio saem da unidade, nao do orgao', n.uf === 'GO' && n.municipio === 'URUACU');
  ok('21. *** o `bruto` guarda a resposta inteira ***', n.bruto === X);
  // o bruto nao e luxo: no dia em que faltar um campo, ele esta la e nao e preciso recoletar
  ok('22. ...inclusive campos que a tabela nao tem coluna', n.bruto.numeroControlePNCP === X.numeroControlePNCP);
}
{
  ok('23. *** sem CNPJ o registro NAO entra (nao ha chave natural) ***',
    valida(normaliza({ ...X, orgaoEntidade: {} })) === false);
  ok('24. sem ano idem', valida(normaliza({ ...X, anoCompra: null })) === false);
  ok('25. sem sequencial idem', valida(normaliza({ ...X, sequencialCompra: null })) === false);
  ok('26. com os tres, entra', valida(normaliza(X)) === true);
}
{
  // dedup entre UF x modalidade: a mesma licitacao pode voltar em duas buscas
  const a = normaliza(X), b = normaliza({ ...X });
  const k = r => `${r.cnpj}|${r.ano}|${r.sequencial}`;
  ok('27. a mesma licitacao gera a MESMA chave (dedup entre buscas)', k(a) === k(b), [k(a), k(b)]);
}

// ══════════ 5. AS DECISÕES QUE ESTÃO NO CÓDIGO ══════════
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'tools', 'coleta_pncp.js'), 'utf8');
  const ddl = fs.readFileSync(path.join(__dirname, '..', 'ddl', 'licitacoes.sql'), 'utf8');
  ok('28. *** o coletor NUNCA apaga (coleta que falha deixa a tela igual, nunca vazia) ***',
    !/method:\s*'DELETE'/.test(src) && /NUNCA APAGA/.test(src));
  ok('29. *** o carimbo de frescor so avanca se a rodada terminou bem ***',
    /const okDeVerdade = !breaker\.aberto && !erro;/.test(src) && /if \(okDeVerdade\) st\.ultima_ok/.test(src));
  ok('30. ...e o motivo esta escrito (avancar numa rodada que falhou faria a tela mentir)',
    /faria a tela mentir sobre a idade do dado/.test(src));
  ok('31. o upsert usa a chave natural, senao cada rodada duplicaria tudo',
    /on_conflict=portal,cnpj,ano,sequencial/.test(src) && /resolution=merge-duplicates/.test(src));
  // 04/08 (consulta de JANELA, 7 dias de uma vez): com 50 a API nao respondia; com 10, ~450ms.
  // 10/08 (consulta de UM DIA, depois que a varredura mudou): 10 -> 437ms · 20 -> 764ms ·
  //        50 -> 778ms, todas HTTP 200. O que nao cabia era o VOLUME da janela larga.
  // E o 10 tinha virado O GARGALO: contra a cota do PNCP (7 requisicoes e 429), 10 por pagina
  // nao fecha um dia de 7 UFs x 3 modalidades. As DUAS medicoes ficam registradas no arquivo --
  // apagar a de 04/08 faria alguem "voltar" o 50 pra tela, onde a janela ainda e larga.
  ok('32. tamanhoPagina 50 na coleta (um dia por consulta), com as DUAS medicoes registradas',
    /TAM_PAGINA = 50/.test(src) && /04\/08/.test(src) && /10\/08/.test(src));
  ok('33. a tabela se chama `licitacoes` com coluna portal, nao `licitacoes_pncp`',
    /create table if not exists public\.licitacoes \(/.test(ddl) && /portal\s+text not null default 'PNCP'/.test(ddl));
  ok('34. *** `authenticated` NAO escreve na tabela (quem grava e a edge function) ***',
    !/create policy [a-z_]+ on public\.licitacoes for (insert|update|delete)/.test(ddl));
  ok('35. e a chave natural e unica no banco, nao so no coletor',
    /unique index[^;]*licitacoes_natural_uk[^;]*\(portal, cnpj, ano, sequencial\)/is.test(ddl));
  ok('36. existe carimbo de frescor em tabela propria (senao cada tela inventa o seu)',
    /create table if not exists public\.coleta_status/.test(ddl));
}

// ══════════ 6. A TELA LÊ DO BANCO PRIMEIRO ══════════
// Era o ponto do item 10: enquanto a tela consultasse o PNCP a cada busca, ela continuaria
// inutil nos dias em que ele cai -- que foram 4 em dois dias.
{
  const fs = require('fs'), path = require('path');
  const tela = fs.readFileSync(path.join(__dirname, '..', 'fpmed_licitacoes.html'), 'utf8');
  // >>> A GARANTIA FICOU MAIS FORTE EM 10/08, e o assert acompanhou: o banco deixou de ser
  //     consultado "quando nao e ao vivo" e passou a ser consultado SEMPRE — no "Atualizar
  //     agora" ele vira REDE DE SEGURANCA. Pedir dado fresco nao pode custar o dado que ja se
  //     tinha, que foi o que pintou a tela de vermelho com resultado na mao (urgencia do
  //     Natanael, 10/08).
  ok('37. *** a busca consulta o NOSSO banco SEMPRE, antes do PNCP ***',
    /doBanco = await buscarNoBanco\(uf, mod, de, ate\);/.test(tela)
    && !/if\(!aoVivo\)\{\s*\n\s*const doBanco = await buscarNoBanco/.test(tela));
  ok('37b. ...e so RENDERIZA direto do banco quando nao e "Atualizar agora"',
    /if\(!aoVivo && doBanco && doBanco\.length\)\{/.test(tela));
  /* ══ ESTE ASSERT ESTAVA CERTO E A PREMISSA DELE ERA FALSA — MEDIDO EM 14/08 (fatia A21) ═════
     Ele cobrava que o banco devolvesse o `bruto` CRU, "porque e a mesma forma que o render ja
     consome". A frase valia quando so o `coleta_pncp.js` gravava. Depois a fatia A13 mandou o
     `coleta_pncp_busca.js` gravar pela API de BUSCA, que responde OUTRA forma — e ninguem
     reconferiu esta linha.
     >>> MEDIDO CONTRA O BANCO: 3.476 das 3.876 linhas tem `objetoCompra` (forma da consulta) e
         **400 tem `_coleta:'busca'`** (forma da busca). Nessas 400 o render lia `objetoCompra`,
         `orgaoEntidade`, `modalidadeNome` e `numeroControlePNCP` como `undefined` — cartao sem
         titulo, sem objeto, com "R$ 0" de valor e sem a chave do funil.
     >>> ENTAO O QUE O ASSERT COBRA AGORA E A TRADUCAO, e ele cobra que ela seja UMA: `select=bruto`
         continua (nao ha segunda consulta), e as tres portas de leitura passam pelo mesmo
         `normalizaBruto`. Sem essa contagem, alguem acrescenta a quarta porta sem tradutor e as
         400 voltam a ser mudas. */
  ok('38. o banco devolve o `bruto`, e a tela TRADUZ as duas formas numa so',
    /select=bruto/.test(tela) && /function normalizaBruto\(b\)/.test(tela)
    && !/j\.map\(x => x\.bruto\)/.test(tela)
    && (tela.match(/normalizaBruto\(x\.bruto\)/g) || []).length === 3);
  ok('38b. ...e o que a busca NAO manda continua nulo, nunca zero (prazo, valor, SRP)',
    /if\(b\.objetoCompra != null \|\| b\.orgaoEntidade\) return b;/.test(tela)
    && !/dataAberturaProposta:/.test(tela.slice(tela.indexOf('function normalizaBruto'),
        tela.indexOf('function normalizaBruto') + 2400))
    && /function celValor\(v\)/.test(tela));
  // sem isso haveria um segundo caminho de codigo pra divergir do primeiro com o tempo
  ok('39. *** banco vazio ou fora CAI pro ao vivo (nunca mostra vazio dizendo que nao ha licitacao) ***',
    /if\(doBanco && doBanco\.length\)\{/.test(tela) && /catch\(e\)\{ return null; \}/.test(tela));
  ok('40. a tela diz DE ONDE veio o que esta nela', /do nosso índice/.test(tela) && /ao vivo do PNCP/.test(tela));
  ok('41. ...e de QUANDO (o carimbo da coleta)', /coletados em \$\{/.test(tela) || /coletados em /.test(tela));
  ok('42. avisa quando a ultima coleta falhou', /a última coleta falhou/.test(tela));
  ok('43. e tem o botao "Atualizar agora", que forca o ao vivo',
    /function atualizarAgora\(\)\{ buscar\(true\); \}/.test(tela) && /onclick="atualizarAgora\(\)"/.test(tela));
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
