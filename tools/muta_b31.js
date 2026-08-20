/* ══════════════════════════════════════════════════════════════════════════════════════════════
   muta_b31.js — APONTA A CATRACA DO CAMINHO DE ENTRADA PARA O MATERIAL DE VERDADE (20/08/2026)

   Mesma lei do `muta_b30.js`, e ela vem da B26: *"um detector provado só contra exemplos que eu
   mesmo escrevi herda o meu engano inteiro, e herda em silêncio, com relatório verde."* A
   `tests/testa_ata_entrada.js` é apontada aqui para os arquivos REAIS da fatia, com o defeito
   plantado dentro deles, e cobrada de vermelho.

   ══ O QUE ESTA FATIA TEM DE PARTICULAR ══════════════════════════════════════════════════════
   O defeito central desta fatia **já aconteceu de verdade e foi medido no banco** — não é uma
   hipótese que eu escrevi. A `negocio_itens_ganhos` guarda o rastro pela coluna `confirmacao`, e
   os DOIS caminhos possíveis estavam quebrados, para lados opostos, sem levantar erro:
     · OMITIR a coluna deixa o `default 1` e a lista velha e a nova aparecem MISTURADAS;
     · mandar `0` com a trigger antiga dava 2, 3 e 4 para um lote de 3, e a view mostrava UMA.
   *Marcar três itens e a tela mostrar um* é o sintoma, e ele tem cara de tela que não carregou.

   ══ E ELA MEDE OS DOIS LADOS ════════════════════════════════════════════════════════════════
   `deveRuir: true` são defeitos — a catraca TEM de ficar vermelha. `deveRuir: false` são
   mudanças legítimas (prosa que nomeia o que a regra proíbe) — e a catraca TEM de deixar passar.
   Catraca que fica vermelha com as duas não protege nada; ela só ensina a apagar comentário.

     node tools/muta_b31.js
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const ARQUIVOS = [
  'fpmed_ata_entrada.js', 'fpmed_negocios.html', 'sw.js', 'ddl/entrada_da_ata.sql',
  'tests/testa_ata_entrada.js',
  // A SEGUNDA SUÍTE E O MOTOR QUE ELA CARREGA — ver o bloco `SUITES` abaixo.
  'tests/testa_ata_saldo.js', 'fpmed_ata_saldo.js', 'ddl/ata_saldo.sql',
  // A régua do A é lida no `require` da suíte, e desde a fatia A37 ela mesma `require` a prova do
  // papel congelado. Sem os dois, o controle acusaria "já está vermelha" sobre arquivo faltando —
  // que é abortar por causa da lista de cópia, e não por causa do código medido.
  'tools/regua_visual.js', 'tools/prova_papel_congelado.js',
  'fpmed_tema.css', 'tests/telas_adotadas.json',
];
/* ══ DUAS SUÍTES, E NÃO UMA — E O MOTIVO É UMA MEDIÇÃO ═══════════════════════════════════════
   A B31 mexeu em DOIS pedaços da `fpmed_negocios.html`: o quadro de marcar (recorte da
   `testa_ata_entrada`) e o estado vazio da validade, que fica ACIMA dele e é recorte da
   `testa_ata_saldo` desde a B30. Rodando só a primeira, duas mutações reais — o convite virando
   aviso âmbar e o convite deixando de negar o *"não vence"* — apareciam como ESCAPADAS, e não
   eram: a promessa está guardada, pela suíte vizinha.
   >>> A PERGUNTA QUE ESTA FERRAMENTA FAZ É *"a catraca DA CASA vê este defeito?"*, e não *"este
       arquivo de teste vê?"*. Um recorte que não bate com o outro é assunto de organização; um
       defeito que ninguém vê é assunto de faturamento. Medir por arquivo confundiria os dois. */
const SUITES = ['testa_ata_entrada.js', 'testa_ata_saldo.js'];
const SUITE = SUITES.join(' + ');
const MOTOR = 'fpmed_ata_entrada.js';
const NEG = 'fpmed_negocios.html';
const DDL = 'ddl/entrada_da_ata.sql';

const MUTACOES = [
  // ── O DEFEITO QUE FOI MEDIDO NO BANCO ─────────────────────────────────────────────────────
  /* Estas três são a fatia inteira. Nenhuma levanta exceção; todas produzem uma TELA PLAUSÍVEL
     com a lista errada. E a terceira é a pior: ela é o estado em que o código estava. */
  { nome: '*** a gravacao volta a OMITIR `confirmacao` (o default 1, e as duas listas misturadas) ***',
    deveRuir: true, arq: MOTOR, de: /\n        confirmacao: 0,/, para: '' },
  { nome: '*** a tela passa a escolher o numero da confirmacao (duas abas mandam o mesmo) ***',
    deveRuir: true, arq: MOTOR, de: /confirmacao: 0,/, para: 'confirmacao: 2,' },
  { nome: '*** a trigger volta a decidir LINHA A LINHA (lote de 3 vira 2,3,4 e a view mostra UMA) ***',
    deveRuir: true, arq: DDL,
    de: /perform set_config\(chave, new\.confirmacao::text, true\);/, para: '' },
  { nome: '*** o set_config perde o `true` e o numero GRUDA na conexao do PostgREST ***',
    deveRuir: true, arq: DDL,
    de: /perform set_config\(chave, new\.confirmacao::text, true\);/,
    para: 'perform set_config(chave, new.confirmacao::text, false);' },
  { nome: 'a chave da transacao deixa de ser por negocio (um lote com dois negocios se contamina)',
    deveRuir: true, arq: DDL,
    de: /chave := 'fpmed\.nig_' \|\| new\.negocio_id::text;/, para: "chave := 'fpmed.nig';" },

  // ── A LISTA SOBE COMPLETA, E NÃO O QUE MUDOU ──────────────────────────────────────────────
  /* Consequência direta da anterior: a view mostra só a confirmação mais alta, então subir só o
     que mudou APAGA DA VISTA todos os itens anteriores — sem erro, sem aviso, com o rastro
     intacto no banco para provar que eles existiam. */
  { nome: '*** so os itens TOCADOS agora sobem, e os anteriores somem da vista ***',
    deveRuir: true, arq: MOTOR,
    de: /if \(!marcado\) return;/, para: 'if (!marcado || !tocada) return;' },
  { nome: 'so os marcados NESTA sessao sobem (quem ja estava gravado some)', deveRuir: true, arq: MOTOR,
    de: /var marcado = m \? !!m\.marcado : c\.marcado;/, para: 'var marcado = !!(m && m.marcado);' },

  // ── `null` É "NÃO INFORMADO"; `0` É UMA AFIRMAÇÃO ─────────────────────────────────────────
  { nome: '*** o total do item vira R$ 0,00 quando falta preco ("ganhei este item de graca") ***',
    deveRuir: true, arq: MOTOR,
    de: /total: \(qtd != null && unit != null\) \? qtd \* unit : null,/,
    para: 'total: (qtd != null && unit != null) ? qtd * unit : 0,' },
  { nome: 'a quantidade em branco entra como zero', deveRuir: true, arq: MOTOR,
    de: /quantidade: qtd,\n        valor_unitario: unit,/,
    para: 'quantidade: qtd == null ? 0 : qtd,\n        valor_unitario: unit,' },
  { nome: 'o preco em branco entra como zero', deveRuir: true, arq: MOTOR,
    de: /valor_unitario: unit,/, para: 'valor_unitario: unit == null ? 0 : unit,' },
  { nome: 'campo vazio deixa de virar null e vira 0', deveRuir: true, arq: MOTOR,
    de: /if \(v === null \|\| v === undefined \|\| v === ''\) return null;/,
    para: "if (v === null || v === undefined) return null;\n    if (v === '') return 0;" },
  { nome: '*** o campo da tela nasce com ZERO em vez de vazio (a tela digita pelo usuario) ***',
    deveRuir: true, arq: NEG,
    de: /value="\$\{qtd == null \? '' : qtd\}"/, para: 'value="${qtd == null ? 0 : qtd}"' },
  { nome: '*** campo esvaziado na tela volta a zero em vez de "nao informado" ***',
    deveRuir: true, arq: NEG,
    de: /m\[qual\] = s === '' \? null : \(isFinite\(x\) \? x : null\);/,
    para: 'm[qual] = s === \'\' ? 0 : (isFinite(x) ? x : null);' },
  { nome: '*** o total marcado imprime R$ 0,00 quando nenhuma linha entrou nele ***',
    deveRuir: true, arq: NEG,
    de: /\(t\.comTotal \? brl\(t\.total\) : '<span class="sd-nao">sem preço informado<\/span>'\)/,
    para: 'brl(t.total)' },
  { nome: 'o contador de linhas sem preco some do total', deveRuir: true, arq: MOTOR,
    de: /if \(l\.valor_unitario == null\) t\.semPreco\+\+;/, para: '' },
  { nome: 'o contador de linhas sem quantidade some do total', deveRuir: true, arq: MOTOR,
    de: /if \(l\.quantidade == null\) t\.semQtd\+\+; else t\.unidades \+= l\.quantidade;/,
    para: 't.unidades += (l.quantidade || 0);' },

  // ── A ORIGEM: DIGITADO NUNCA SE CONFUNDE COM PUBLICADO ────────────────────────────────────
  { nome: '*** o que a tela grava passa a sair como publicado pelo PNCP ***', deveRuir: true, arq: MOTOR,
    de: /origem: \(c\.marcado && c\.origem && !tocada\) \? c\.origem : 'digitado',/,
    para: "origem: 'pncp'," },
  { nome: '*** a linha que veio da IA e REBAIXADA a "digitado" (a tela afirma que alguem digitou) ***',
    deveRuir: true, arq: MOTOR,
    de: /origem: \(c\.marcado && c\.origem && !tocada\) \? c\.origem : 'digitado',/,
    para: "origem: 'digitado'," },
  { nome: 'a linha TOCADA agora mantem a origem antiga (o numero novo herda a procedencia velha)',
    deveRuir: true, arq: MOTOR,
    de: /origem: \(c\.marcado && c\.origem && !tocada\) \? c\.origem : 'digitado',/,
    para: "origem: (c.marcado && c.origem) ? c.origem : 'digitado'," },
  /* A MARCA INVENTADA. Ela não é perguntada neste caminho de propósito: preenchê-la por dedução é
     chute num documento que vira faturamento e habilitação técnica. */
  { nome: 'a marca passa a ser deduzida do vencedor publicado', deveRuir: true, arq: MOTOR,
    de: /marca: c\.marca \|\| null,/, para: 'marca: c.marca || c.resultadoVencedor || null,' },

  // ── A QUANTIDADE DO EDITAL É SUGESTÃO, E SUGESTÃO PRECISA DE UM CLIQUE ────────────────────
  { nome: '*** a quantidade do edital passa a ser copiada SOZINHA para a gravacao ***',
    deveRuir: true, arq: MOTOR,
    de: /var qtd = m && m\.marcado \? num\(m\.quantidade\) : c\.quantidade;/,
    para: 'var qtd = m && m.marcado ? (num(m.quantidade) != null ? num(m.quantidade) : c.qtdEdital) : c.quantidade;' },
  { nome: '*** a copia do edital passa a APAGAR o que a pessoa digitou ***', deveRuir: true, arq: MOTOR,
    de: /if \(num\(m\.quantidade\) != null\) \{ saida\.push\(m\); return; \}/, para: '' },
  { nome: 'a copia passa a encher tambem os itens NAO marcados (195 linhas com numero)',
    deveRuir: true, arq: MOTOR,
    de: /if \(!m \|\| !m\.marcado\) return;/, para: 'if (!m) { m = { item: c.item, marcado: true, quantidade: null, unitario: null }; }' },
  { nome: 'o item sem quantidade no edital deixa de ser contado na copia', deveRuir: true, arq: MOTOR,
    de: /if \(c\.qtdEdital == null\) \{ semQtdNoEdital\+\+; saida\.push\(m\); return; \}/,
    para: 'if (c.qtdEdital == null) { saida.push(m); return; }' },
  { nome: '*** a referencia do edital entra DENTRO do campo de preco (a tela sugere o preco) ***',
    deveRuir: true, arq: NEG,
    de: /value="\$\{unit == null \? '' : unit\}"/, para: 'value="${unit == null ? (c.refEdital || \'\') : unit}"' },

  // ── A LISTA É DO EDITAL, E NÃO DO RESULTADO ──────────────────────────────────────────────
  /* MEDIDO: dos 192 itens com resultado publicado no único certame desta base, ZERO estão sob o
     nosso CNPJ. Uma lista feita do resultado nasceria vazia justamente na casa em que ela
     precisa funcionar. */
  { nome: '*** a lista de marcar passa a ser a do RESULTADO publicado (nasce vazia) ***',
    deveRuir: true, arq: MOTOR,
    de: /return \(itensEdital \|\| \[\]\)\.map\(function \(it\) \{/,
    para: 'return (itensEdital || []).filter(function (it) { return !!it.resultado_vencedor; }).map(function (it) {' },
  { nome: '*** o item publicado sob OUTRO CNPJ deixa de poder ser marcado ***', deveRuir: true, arq: MOTOR,
    de: /meu && rCnpj === meu \? 'meu_publicado' : 'de_outro'/,
    para: "meu && rCnpj === meu ? 'meu_publicado' : 'bloqueado'" },
  { nome: 'o item sem resultado passa a ser tratado como "nao ganhei"', deveRuir: true, arq: MOTOR,
    de: /var estado = g \? 'confirmado'/, para: "var estado = g ? 'confirmado'\n        : (!temResultado ? 'nao_ganhei'" },
  { nome: 'o CNPJ deixa de ser comparado so pelos digitos (pontuacao diferente vira "de outro")',
    deveRuir: true, arq: MOTOR,
    de: /function soNum\(s\) \{ return String\(s == null \? '' : s\)\.replace\(\/\\D\/g, ''\); \}/,
    para: "function soNum(s) { return String(s == null ? '' : s); }" },
  /* ══ AQUI ESTAVA `porItem[g.item_n]`, E ELA MEDIA ZERO ═══════════════════════════════════════
     A mutação trocava `porItem[String(g.item_n)]` por `porItem[g.item_n]` esperando que o item 7
     numérico deixasse de casar com o "7" texto do banco. Ela ESCAPOU, e fui ver por quê: em
     JavaScript **toda chave de objeto já é convertida para texto**, então `obj[7]` e `obj['7']`
     são a mesma chave. O `String()` daquela linha é DOCUMENTAÇÃO da regra, não o mecanismo dela —
     e trocá-lo é código equivalente, não defeito. Escrever "escapou" ali seria acusar a catraca de
     um buraco que não existe.
     >>> O MECANISMO DE VERDADE é o `item: k` que sai do candidato: é ele que vira `item_n` na
         gravação, e a coluna do banco é `text`. Devolver número ali manda número para uma coluna
         de texto e faz "07" e "7" virarem itens diferentes na ata do mesmo pregão — que é o
         defeito que a `ata_saldo.sql` já tinha pago para evitar. É essa a mutação que mede. */
  { nome: 'o numero do item sai do motor como NUMERO e vira chave diferente de "07" no banco',
    deveRuir: true, arq: MOTOR, de: /\n        item: k,/, para: '\n        item: it.numero_item,' },
  { nome: 'o selo do "publicado sob outro CNPJ" some da linha', deveRuir: true, arq: NEG,
    de: /: c\.estado === 'de_outro' \? '<span class="mk-selo outro">publicado sob outro CNPJ<\/span>'/,
    para: ": c.estado === 'de_outro' ? ''" },

  // ── NÚMERO IMPOSSÍVEL É RECUSADO, E DIZ QUAL LINHA ───────────────────────────────────────
  { nome: 'quantidade negativa deixa de ser recusada', deveRuir: true, arq: MOTOR,
    de: /if \(qtd != null && qtd < 0\) erros\.push\('item ' \+ c\.item \+ ': quantidade negativa'\);/, para: '' },
  { nome: 'a recusa deixa de dizer QUAL linha (numa lista de 195, e recusar sem dizer nada)',
    deveRuir: true, arq: MOTOR,
    de: /erros\.push\('item ' \+ c\.item \+ ': quantidade negativa'\);/, para: "erros.push('numero invalido');" },
  /* O EXCESSO DE ZELO É DEFEITO TAMBÉM: preço acima do teto, quantidade acima da do edital e item
     que o PNCP deu a outro são coisas que ACONTECEM. Barrar é a tela decidindo por quem tem a ata
     na mão. */
  /* A `para` DESTA MUTAÇÃO PRECISOU TER EFEITO. A primeira versão só declarava uma variável
     (`var _teto = true;`) e "escapou" — claro que escapou: ela não mudava comportamento nenhum.
     Mutação que não muda comportamento acusa um buraco na catraca que é buraco na mutação. */
  { nome: 'a quantidade maior que a do edital passa a ser BARRADA em vez de mostrada',
    deveRuir: true, arq: MOTOR,
    de: /if \(qtd != null && qtd < 0\) erros\.push\('item ' \+ c\.item \+ ': quantidade negativa'\);/,
    para: "if (qtd != null && qtd < 0) erros.push('item ' + c.item + ': quantidade negativa');\n      if (qtd != null && c.qtdEdital != null && qtd > c.qtdEdital) erros.push('item ' + c.item + ': acima do edital');" },

  // ── ARQUIVAR, E NÃO APAGAR ───────────────────────────────────────────────────────────────
  { nome: '*** o motivo do arquivamento deixa de ser obrigatorio (a gaveta vira cemiterio anonimo) ***',
    deveRuir: true, arq: MOTOR,
    de: /if \(!m\) return \{ ok: false, erro: 'escolha o motivo — a gaveta sem motivo é um cemitério anônimo\.' \};/,
    para: "if (!m) m = 'sem motivo';" },
  { nome: '"outro" passa a poder ser gravado sem texto', deveRuir: true, arq: MOTOR,
    de: /if \(!t\) return \{ ok: false, erro: 'escreva o motivo\.' \};/, para: '' },
  { nome: '*** o arquivamento deixa de carimbar a data (a gaveta filtra por `arquivado_em`) ***',
    deveRuir: true, arq: MOTOR,
    de: /arquivado_em: agoraISO \|\| new Date\(\)\.toISOString\(\),/, para: '' },
  { nome: 'o autor do arquivamento some do carimbo', deveRuir: true, arq: MOTOR,
    de: /arquivado_por: quem \|\| null,/, para: '' },
  { nome: '*** desarquivar passa a APAGAR o carimbo de saida (quem desfaz o ato desfaz o fato) ***',
    deveRuir: true, arq: MOTOR,
    de: /return \{ arquivado: false, arquivado_em: null,\n             desarquivado_em: agoraISO \|\| new Date\(\)\.toISOString\(\) \};/,
    para: 'return { arquivado: false, arquivado_em: null, arquivado_motivo: null, arquivado_por: null };' },
  { nome: '*** a v_atas_vigencia passa a filtrar pela BANDEIRA e a aba Ata fica em branco ***',
    deveRuir: true, arq: DDL, de: /and n\.arquivado_em is null/, para: 'and not n.arquivado' },
  { nome: '*** a gaveta passa a contar as 108 atas que nasceram arquivadas na importacao ***',
    deveRuir: true, arq: DDL, de: /and n\.arquivado_em is not null/, para: 'and n.arquivado' },
  { nome: 'aparece um DELETE no DDL (ata e papel de prova)', deveRuir: true, arq: DDL,
    de: /notify pgrst, 'reload schema';/,
    para: "delete from public.ata_saldo where negocio_id = 2569;\nnotify pgrst, 'reload schema';" },
  { nome: 'as views novas passam a enxergar sem cracha (security_invoker some)', deveRuir: true, arq: DDL,
    de: /create or replace view public\.v_atas_arquivadas\n  with \(security_invoker = on\) as/,
    para: 'create or replace view public.v_atas_arquivadas as' },
  { nome: 'o anon passa a enxergar a gaveta', deveRuir: true, arq: DDL,
    de: /revoke all  on public\.v_atas_arquivadas from anon;/, para: '' },
  { nome: 'a gaveta deixa de ser concedida a quem esta logado', deveRuir: true, arq: DDL,
    de: /grant select on public\.v_atas_arquivadas to authenticated;/, para: '' },
  { nome: 'o DDL passa a usar `drop view` (a regra da casa e aditivo)', deveRuir: true, arq: DDL,
    de: /create or replace view public\.v_atas_vigencia/,
    para: 'drop view public.v_atas_vigencia;\ncreate view public.v_atas_vigencia' },

  // ── A TELA ───────────────────────────────────────────────────────────────────────────────
  { nome: 'o Negocios deixa de carregar o motor do caminho de entrada', deveRuir: true, arq: NEG,
    de: /<script src="fpmed_ata_entrada\.js"><\/script>/, para: '' },
  { nome: '*** a tela monta a linha do banco por conta propria (a segunda implementacao) ***',
    deveRuir: true, arq: NEG,
    de: /const r = E\.linhasParaGravar\(cands, marcasDaTela\(cands\), quem\);/,
    para: 'const r = { linhas: cands.filter(c => MARCAS[c.item]).map(c => ({ item_n: c.item, quantidade: MARCAS[c.item].quantidade, valor_unitario: MARCAS[c.item].unitario, origem: "digitado" })), erros: [], mudou: true };' },
  { nome: 'a tela calcula o total marcado por conta propria', deveRuir: true, arq: NEG,
    de: /const t = E\.totaisMarcacao\(cands, marcas\);/,
    para: 'const t = { marcados: marcas.filter(m => m.marcado).length, semQtd: 0, semPreco: 0, comTotal: 1, total: 0, unidades: 0 };' },
  { nome: '*** a gravacao passa a olhar so o codigo HTTP, e nao quantas linhas voltaram ***',
    deveRuir: true, arq: NEG,
    de: /Array\.isArray\(volta\) && volta\.length === r\.linhas\.length/, para: 'rq.ok' },
  { nome: 'gravar ZERO itens deixa de pedir confirmacao (um clique distraido apaga a lista)',
    deveRuir: true, arq: NEG,
    de: /if\(!r\.linhas\.length && !confirm\(/, para: 'if(false && !confirm(' },
  { nome: 'o erro de leitura dos itens passa a se parecer com "este certame nao tem itens"',
    deveRuir: true, arq: NEG,
    de: /'Não consegui ler os itens do certame<\/b>'/, para: "'Este certame não tem itens</b>'" },
  { nome: 'o aviso de que a lista sobe INTEIRA some do quadro', deveRuir: true, arq: NEG,
    de: /Gravar registra a <b>lista inteira<\/b> '/, para: "'" },
  { nome: '*** o convite da validade vira um aviso AMBAR de erro (o dono nao errou nada) ***',
    deveRuir: true, arq: NEG,
    de: /\? '<div class="mk-convite"><b>Informe a validade<\/b>/,
    para: '? \'<div class="salvo" style="color:var(--ambar-700)"><b>Informe a validade</b>' },
  { nome: 'o convite deixa de negar o "nao vence"', deveRuir: true, arq: NEG,
    de: /<b>Sem data não é “não vence”:<\/b> ata vence, em regra em doze meses/,
    para: 'A validade não foi informada' },
  { nome: 'digitar no campo passa a repintar a tabela (o cursor volta pro fim a cada tecla)',
    deveRuir: true, arq: NEG,
    de: /  const cx = document\.querySelector\('#ata-marcar \.at-total'\);/,
    para: '  pintaMarcarGanhos(id);\n  const cx = document.querySelector(\'#ata-marcar .at-total\');' },
  { nome: 'arquivar deixa de avisar a lista da manha (a ata arquivada continua no topo da tela)',
    deveRuir: true, arq: NEG,
    de: /    carregarVaiEmbora\(\);   \/\/ a ata sai da lista da manhã na mesma hora/, para: '' },
  { nome: 'a caixinha de marcar deixa de ter rotulo para o leitor de tela', deveRuir: true, arq: NEG,
    de: /aria-label="marcar o item \$\{esc\(c\.item\)\} como ganho por mim"/, para: '' },
  { nome: 'marcar itens ganhos deixa de ser acao de gestor', deveRuir: true, arq: NEG,
    de: /  if\(!ehGestor\(\)\)\{\n    box\.innerHTML = TIT \+ '<div class="salvo">marcar itens ganhos é ação de gestor\.<\/div>';\n    return;\n  \}/,
    para: '' },

  // ── A CASCA ──────────────────────────────────────────────────────────────────────────────
  { nome: 'o motor sai da casca do service worker', deveRuir: true, arq: 'sw.js',
    de: /\n\s*'\.\/fpmed_ata_entrada\.js',[^\n]*\n/, para: '\n' },
  /* O PADRÃO É GENÉRICO DE PROPÓSITO. Fixar o número exato faz a mutação parar de casar no dia do
     próximo bump — e mutação que não casa não fica vermelha: ela se declara "escapada" e o placar
     acusa um buraco que não existe. Foi o que aconteceu com a `muta_b29` na B30. */
  { nome: 'a casca ganha arquivo novo mas ninguem bumpa a versao', deveRuir: true, arq: 'sw.js',
    de: /limedtec-fpmed-\d{4}-\d{2}-\d{2}-\d+/, para: 'limedtec-fpmed-2026-08-20-87' },

  // ── AS QUE **NÃO** PODEM FICAR VERMELHAS ─────────────────────────────────────────────────
  /* A prosa desta casa NOMEIA o que a regra proíbe — é a única maneira de um comentário ensinar
     uma regra. Se a catraca cobrar do comentário, o conserto vira "apagar a explicação", e
     explicação apagada é a causa da próxima geração do mesmo defeito. Esta metade do controle já
     pegou o autor uma vez, na B29, e de novo na B32 (a palavra `rgba()` dentro de um comentário). */
  { nome: 'um comentario explica por que a linha nunca sai com total 0', deveRuir: false, arq: MOTOR,
    de: /function linhasParaGravar\(cands, marcas, quem\) \{/,
    para: '/* nunca total: 0 aqui: isso diria "ganhei este item de graca" */\n  function linhasParaGravar(cands, marcas, quem) {' },
  { nome: 'um comentario cita `origem: pncp` como o erro a evitar', deveRuir: false, arq: MOTOR,
    de: /function totaisMarcacao\(cands, marcas\) \{/,
    para: "/* jamais origem: 'pncp' neste caminho: aqui tudo e digitado por gente */\n  function totaisMarcacao(cands, marcas) {" },
  { nome: 'um comentario cita o `default 1` como a armadilha do banco', deveRuir: false, arq: MOTOR,
    de: /function copiaQuantidades\(cands, marcas\) \{/,
    para: '/* omitir confirmacao deixa o default 1 e a linha nunca sucede a anterior */\n  function copiaQuantidades(cands, marcas) {' },
  { nome: 'a tela ganha comentario citando value="0" como proibido', deveRuir: false, arq: NEG,
    de: /function pintaMarcarGanhos\(id\)\{/,
    para: '/* aqui nunca sai value="0" nem R$ 0,00 no lugar de "sem preco informado" */\nfunction pintaMarcarGanhos(id){' },
  { nome: 'o DDL ganha comentario explicando por que nao ha DELETE', deveRuir: false, arq: DDL,
    de: /-- ── PERMISSÃO ─/,
    para: '-- nao existe delete from aqui, e o motivo e a lei do cofre: arquivar, nao apagar\n-- ── PERMISSÃO ─' },
  { nome: 'o DDL ganha comentario citando `not arquivado` como o filtro errado', deveRuir: false, arq: DDL,
    de: /create index if not exists negocios_arquivado_em_idx/,
    para: '-- jamais `where not arquivado`: as 108 atas da importacao ja nascem com a bandeira\ncreate index if not exists negocios_arquivado_em_idx' },
];

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'muta-b31-'));
function semeia() {
  for (const rel of ARQUIVOS) {
    const dest = path.join(TMP, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(RAIZ, rel), dest);
  }
}
// Vermelha em QUALQUER uma das duas já é a catraca da casa vendo o defeito. O nome de quem pegou
// vai junto: saber qual suíte mordeu é o que permite mudar um recorte sem apagar uma promessa.
function roda() {
  let verde = true, saida = '', quem = [];
  for (const s of SUITES) {
    try { execFileSync(process.execPath, [path.join(TMP, 'tests', s)], { stdio: 'pipe', encoding: 'utf8' }); }
    catch (e) { verde = false; quem.push(s.replace(/^testa_|\.js$/g, '')); saida += String((e.stdout || '') + (e.stderr || '')); }
  }
  return { verde: verde, saida: saida, quem: quem.join(', ') };
}

console.log('=== MUTACAO DA FATIA B31 — a catraca do caminho de entrada contra o material de verdade ===\n');
semeia();
const ctrl = roda();
console.log(`  controle · ${SUITE} ${ctrl.verde ? 'VERDE' : '*** JA ESTA VERMELHA ***'}`);
if (!ctrl.verde) {
  // Sem este passo, uma suíte já vermelha faria TODA mutação `deveRuir:true` "passar" — e o placar
  // sairia cheio sem ter provado nada. É o formato exato do detector cego da B26.
  console.log(ctrl.saida.split('\n').filter(l => /FALHA/.test(l)).slice(0, 6).join('\n'));
  console.log('\n>>> ABORTADO: com a suite ja vermelha, a mutacao nao prova nada.');
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(1);
}
console.log('');

let pegou = 0, escapou = 0, falso = 0;
const escapadas = [], falsas = [];
for (const m of MUTACOES) {
  semeia();
  const alvo = path.join(TMP, m.arq);
  const antes = fs.readFileSync(alvo, 'utf8').replace(/\r\n/g, '\n');
  const depois = antes.replace(m.de, m.para);
  if (depois === antes) {
    escapou++; escapadas.push(m.nome + '  (o padrao nao casou — o alvo mudou de forma)');
    console.log(`  ?? ${m.nome}\n     >>> o padrao nao casou; esta mutacao nao mediu nada`);
    continue;
  }
  fs.writeFileSync(alvo, depois, 'utf8');
  const r = roda();
  if (m.deveRuir) {
    if (!r.verde) { pegou++; console.log(`  ok  ${m.nome}  ->  vermelha (${r.quem}), como devia`); }
    else { escapou++; escapadas.push(m.nome); console.log(`  ** ESCAPOU: ${m.nome}  ->  a catraca ficou VERDE`); }
  } else {
    if (r.verde) { pegou++; console.log(`  ok  ${m.nome}  ->  passou, como devia (nao e defeito)`); }
    else {
      falso++; falsas.push(m.nome);
      console.log(`  ** FALSO VERMELHO: ${m.nome}`);
      console.log('     ' + r.saida.split('\n').filter(l => /FALHA/.test(l)).slice(0, 2).join('\n     '));
    }
  }
}
fs.rmSync(TMP, { recursive: true, force: true });

console.log('\n== PLACAR ==');
console.log(`  ${pegou} de ${MUTACOES.length} mutacoes se comportaram como deviam`);
console.log(`  ${escapou} escaparam · ${falso} falso(s) vermelho(s)`);
if (escapadas.length) console.log('\n  ESCAPARAM:\n   - ' + escapadas.join('\n   - '));
if (falsas.length) console.log('\n  FALSO VERMELHO:\n   - ' + falsas.join('\n   - '));
process.exitCode = (escapou || falso) ? 1 : 0;
