/* ══════════════════════════════════════════════════════════════════════════════════════════════
   SUITE testa_arquivar_e_avisar — A CATRACA DA FATIA B27 (20/08/2026)

   Ela guarda três promessas que, se cederem, cedem em silêncio:

   1. **ARQUIVAR NUNCA VIRA DELETE.** O cofre existe para PROVAR: quem tirou uma CND de lá um dia
      vai precisar mostrar que ela existiu, e em que dia. No dia em que alguém "simplificar" o
      botão trocando o PATCH por um DELETE, a tela continua parecendo idêntica — o documento some
      do mesmo jeito — e a perda só aparece meses depois, quando o órgão pedir a certidão que
      valia em agosto. É o tipo de estrago que nenhum teste de tela pega e nenhum usuário reporta.

   2. **DESARQUIVAR NÃO APAGA O CARIMBO.** Quem desfaz um ato não desfaz o fato de ter feito. Um
      `arquivado_em: null` no PATCH da volta seria a linha mais natural de escrever, e a mais
      errada: o cofre perderia a única prova de que o documento já esteve fora.

   3. **O E-MAIL NÃO CARREGA DOCUMENTO, E NÃO SAI SOZINHO.** A REGRA DE PRIVACIDADE do
      `docs/TELEMETRIA.md` proíbe mandar conteúdo de documento e CNPJ para fora. E o disparo
      automático não existe nesta fatia de propósito — mandar e-mail sozinho, sem o dono ter visto
      um, é o tipo de automação que não se liga sem ele ver primeiro.

   ══ E ELA COBRA DO CÓDIGO, NÃO DA PROSA ═════════════════════════════════════════════════════
   Todo assert roda sobre o texto SEM COMENTÁRIO (`semComentario`, da régua do A). A B26 provou o
   preço de não fazer isso: um assert que aceita o comentário como prova do código não está
   provando o código — apagar `globalmedgo.com.br` da LISTA passava verde porque o nome continuava
   escrito no comentário logo acima.

     node tests/testa_arquivar_e_avisar.js
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { semComentario } = require('../tools/regua_visual.js');
const RAIZ = path.join(__dirname, '..');
const R = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8').replace(/\r\n/g, '\n');

const TELA = semComentario(R('fpmed_documentos.html'));
const FN   = semComentario(R('supabase', 'functions', 'avisar-certidao', 'index.ts'));
const BOL  = semComentario(R('supabase', 'functions', 'enviar-boletim', 'index.ts'));
const DDL  = R('ddl', 'documentos_arquivo.sql').replace(/^\s*--[^\n]*$/gm, '');

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + '. ' + t + (e !== undefined ? '  [' + JSON.stringify(e).slice(0, 300) + ']' : '')); } n++; };
console.log('SUITE testa_arquivar_e_avisar — a catraca da fatia B27\n');

// recorta o corpo de uma função pelas próprias chaves (e não por distância em caracteres: a
// lição da `testa_remetente_compliance`, onde uma régua de 400 chars ficou vermelha porque
// alguém escreveu código legítimo no meio — assert que quebra por nada treina a ignorar vermelho)
function corpo(txt, assinatura) {
  const i = txt.indexOf(assinatura);
  if (i < 0) return '';
  let j = txt.indexOf('{', i), prof = 0, k = j;
  if (j < 0) return '';
  do { if (txt[k] === '{') prof++; else if (txt[k] === '}') prof--; k++; } while (k < txt.length && prof > 0);
  return txt.slice(i, k);
}

// ── 1. ARQUIVAR NÃO É DELETE ────────────────────────────────────────────────────────────────
console.log('── 1. arquivar não é delete ──');
ok('a tela não manda DELETE em lugar nenhum', !/method\s*:\s*['"]DELETE['"]/i.test(TELA),
  (TELA.match(/method\s*:\s*['"]DELETE['"]/ig) || []));
const CONF = corpo(TELA, 'async function confirmarArquivamento');
ok('confirmarArquivamento existe e usa PATCH', /method\s*:\s*['"]PATCH['"]/.test(CONF));
ok('...e ele grava os QUATRO campos: ativo=false, carimbo, motivo e a limpeza da volta',
  /ativo\s*:\s*false/.test(CONF) && /arquivado_em\s*:/.test(CONF)
  && /arquivado_motivo\s*:/.test(CONF) && /desarquivado_em\s*:\s*null/.test(CONF),
  CONF.slice(CONF.indexOf('body:'), CONF.indexOf('body:') + 220));
/* O MOTIVO É OBRIGATÓRIO, e o assert cobra que a recusa venha ANTES do fetch: uma validação
   depois da gravação é uma validação decorativa. */
ok('o motivo é obrigatório, e a recusa vem ANTES da gravação',
  CONF.indexOf('motivoEscolhido()') < CONF.indexOf('fetch(')
  && /if\s*\(\s*!\s*motivo\s*\)/.test(CONF));

// ── 2. DESARQUIVAR NÃO APAGA O CARIMBO ──────────────────────────────────────────────────────
console.log('── 2. desarquivar não apaga o carimbo ──');
const REST = corpo(TELA, 'async function restaurar');
ok('restaurar devolve à lista e carimba a volta',
  /ativo\s*:\s*true/.test(REST) && /desarquivado_em\s*:/.test(REST), REST.slice(0, 200));
/* >>> O ASSERT PELO AVESSO, e ele é o que importa aqui: a linha mais natural de escrever nesta
       função é `arquivado_em: null` — "limpar o que não vale mais". Ela é exatamente a que
       destrói a prova. Este assert reprova quem a escrever. */
ok('*** e ele NÃO limpa `arquivado_em` nem `arquivado_motivo` — o fato de ter sido arquivado fica ***',
  !/arquivado_em\s*:\s*null/.test(REST) && !/arquivado_motivo\s*:\s*null/.test(REST), REST.slice(0, 260));

// ── 3. A GAVETA E O PAINEL LEEM AS VIEWS CERTAS ─────────────────────────────────────────────
console.log('── 3. cada pergunta na view dela ──');
ok('a gaveta lê `v_documentos_arquivados` (e não o histórico, que enxerga substituído também)',
  /v_documentos_arquivados/.test(corpo(TELA, 'async function carregarArquivados')));
ok('o painel continua lendo `v_documentos_situacao`, que filtra `ativo` — é ela que faz o '
  + 'arquivado sair da contagem sem uma linha de código a mais',
  /v_documentos_situacao/.test(corpo(TELA, 'async function carregar(')));
/* A TELA NÃO PODE CONTAR ARQUIVADO DE PROPÓSITO NEM POR ENGANO: se alguém somar `ARQUIVADOS` no
   painel, o total deixa de fechar com o `group by` do banco e a prova ao vivo reprova. Aqui o
   assert é mais barato: a `contaSituacoes` recebe uma lista só, e ela é a da view da tela. */
ok('o painel conta a lista da tela, e não a da gaveta',
  /contaSituacoes\(DOCS\)/.test(TELA) && !/contaSituacoes\(ARQUIVADOS/.test(TELA));

// ── 4. O DESTINATÁRIO É DADO, NÃO CONSTANTE ─────────────────────────────────────────────────
console.log('── 4. o destinatário vem do config, não do código ──');
ok('a tela não tem nenhum e-mail da empresa escrito à mão',
  !/@fpmed\.com\.br/.test(TELA), (TELA.match(/[\w.@-]*@fpmed\.com\.br/g) || []));
ok('ela lê o padrão do `cliente.config.js` (LIMEDTEC_CLIENTE.empresa.email)',
  /LIMEDTEC_CLIENTE[\s\S]{0,80}empresa[\s\S]{0,40}email/.test(TELA));
/* VAZIO GRAVA `null`, E NÃO O PADRÃO. Gravar o endereço de hoje congelaria no documento um valor
   que o config pode trocar amanhã — e aí o cofre avisaria o e-mail antigo, calado. */
ok('*** campo vazio grava `null` (o padrão se resolve na hora do aviso, não na hora de salvar) ***',
  /email_aviso\s*:\s*document\.getElementById\('f-email'\)\.value\.trim\(\)\s*\|\|\s*null/.test(TELA));
ok('e a substituição herda o destinatário da via anterior',
  /f-email'\)\.value\s*=\s*d\.email_aviso/.test(corpo(TELA, 'function abrirSubstituicao')));

// ── 5. A TELA NÃO SABE NENHUM SEGREDO ───────────────────────────────────────────────────────
console.log('── 5. a tela não guarda segredo ──');
ok('*** não há chave do Resend na tela (o repositório é público) ***',
  !/re_[A-Za-z0-9]{10,}/.test(TELA) && !/RESEND/i.test(TELA));
const ENV = corpo(TELA, 'async function enviarAvisoTeste');
ok('o envio passa pela edge function, e com o crachá DA SESSÃO',
  /functions\/v1\/avisar-certidao/.test(ENV) && /tokenDaSessao\(\)/.test(ENV));
/* >>> O CRACHÁ `anon` NÃO PODE SER O `Authorization` DESTA CHAMADA. Se ele for, qualquer visitante
       da página dispara e-mail — a porta fica escancarada com aparência de fechada, que é o
       formato exato do defeito da B16. O `apikey` continua sendo o anon (é o que identifica o
       projeto); o crachá é o token. */
ok('*** e o `Authorization` é o token, nunca a chave anon ***',
  /Authorization['"]?\s*:\s*['"]Bearer\s*['"]\s*\+\s*tk/.test(ENV), ENV.slice(ENV.indexOf('headers'), ENV.indexOf('headers') + 160));
ok('a tela lê `ok:false` do corpo, e não só o status HTTP (a trava responde 200 recusando)',
  /if\s*\(\s*!\s*j\.ok\s*\)/.test(ENV));

// ── 6. A FUNÇÃO: SEM service_role, UMA DEFINIÇÃO DE "VENCENDO", E SÓ GESTOR ──────────────────
console.log('── 6. a edge function ──');
ok('*** a função NÃO usa service_role em lugar nenhum — a RLS decide, como na B16 ***',
  !/SERVICE_ROLE/i.test(FN), (FN.match(/\w*SERVICE_ROLE\w*/gi) || []));
ok('ela lê `v_documentos_avisar` — uma definição de "vencendo", no banco',
  /v_documentos_avisar/.test(FN));
ok('...e não remonta a regra de vencimento por conta própria',
  !/current_date|dias_para_vencer\s*<=|validade\s*<=/.test(FN));
ok('só gestor envia (a mesma lista de cargos que a `cargo_gestor()` do banco usa)',
  /CARGOS_GESTOR\s*=\s*\[\s*"diretor",\s*"gerente",\s*"admin"\s*\]/.test(FN)
  && /!ehGestor/.test(FN));
ok('*** não há caminho automático: sem `{"teste":true}` ela recusa ***',
  /body\.teste\s*!==\s*true/.test(FN));
ok('...e a sonda diz isso por escrito, para a tela não precisar adivinhar',
  /automatico:\s*false/.test(FN));

// ── 7. O QUE O E-MAIL NÃO PODE CARREGAR ─────────────────────────────────────────────────────
console.log('── 7. a regra de privacidade ──');
const MONTA = corpo(FN, 'function montaEmail');
/* ══ A PRIMEIRA VERSÃO DESTE ASSERT REPROVOU O RODAPÉ DO PRÓPRIO E-MAIL ═══════════════════════
   Ele varria a função inteira atrás da palavra "cnpj" e ficou vermelho — porque o rodapé do
   e-mail DIZ, em português, "este aviso não carrega arquivo, anexo nem CNPJ". A frase é a promessa
   ao leitor, e ela é justamente o que se quer manter.
   >>> É o mesmo caso do comentário (bloco 0 desta suíte) numa roupa diferente: ali a prosa era
       para quem lê o código, aqui é para quem lê o e-mail. Nos dois a lição é a mesma — cobra-se
       do que a máquina EXECUTA. Num template, o que a máquina executa é o que está dentro de
       `${...}`; o resto é texto, e texto não vaza dado.
   Então o assert olha só as INTERPOLAÇÕES. Se alguém escrever `${d.cnpj}` ou `${doc.arquivo_path}`,
   ele reprova; se alguém prometer em português que não manda, ele deixa. */
const INTERPOLADO = (MONTA.match(/\$\{[\s\S]*?\}/g) || []).join(' | ');
for (const proibido of ['arquivo_path', 'arquivo_nome', 'cnpj', 'observacoes', 'arquivo_bytes', 'empresa_id']) {
  ok('o e-mail não INTERPOLA `' + proibido + '` (a prosa pode citá-lo; o valor não sai)',
    !new RegExp(proibido, 'i').test(INTERPOLADO),
    (INTERPOLADO.match(new RegExp('[^|]*' + proibido + '[^|]*', 'ig') || []) || []).slice(0, 3));
}
/* O QUE ELE PRECISA CARREGAR também é assert: um e-mail que não diz QUAL certidão está vencendo
   é inútil, e "inútil" também é um jeito de a fatia estar errada. */
ok('...e carrega o que o aviso precisa: nome, tipo, órgão, número e validade',
  ['d.nome', 'd.tipo', 'd.orgao_emissor', 'd.numero', 'd.validade'].every(c => MONTA.includes(c)));

// ── 8. A TRAVA DE COMPLIANCE, E AS DUAS CÓPIAS QUE TÊM DE CONCORDAR ─────────────────────────
console.log('── 8. o domínio da GlobalMed fora do e-mail da FPMED ──');
const listaDe = txt => {
  const m = txt.match(/const DOMINIOS_PROIBIDOS\s*=\s*\[([^\]]*)\]/);
  return m ? (m[1].match(/"([^"]+)"/g) || []).map(s => s.replace(/"/g, '')) : null;
};
const L_FN = listaDe(FN), L_BOL = listaDe(BOL);
ok('a lista existe na função nova', !!L_FN && L_FN.length > 0, L_FN);
ok('...e cobre os dois domínios da GlobalMed',
  !!L_FN && L_FN.includes('globalmedgo.com.br') && L_FN.includes('globalmed.com.br'), L_FN);
/* ══ AS DUAS CÓPIAS TÊM DE SER IGUAIS, CARACTERE A CARACTERE ═══════════════════════════════════
   A Management API sobe UM arquivo por função, então a mesma regra vive em dois lugares. Cópia
   solta é fonte dupla de verdade; cópia VIGIADA não é. Este assert é o cão de guarda: no dia em
   que alguém acrescentar um domínio numa e esquecer a outra, uma das duas portas fica aberta —
   e ela ficaria aberta em silêncio, porque cada função continua passando no teste dela. */
ok('*** e ela é IDÊNTICA à da `enviar-boletim` — duas portas, uma regra ***',
  !!L_FN && !!L_BOL && JSON.stringify(L_FN) === JSON.stringify(L_BOL), [L_FN, L_BOL]);
ok('a trava roda ANTES de montar e-mail ou chamar o provedor',
  FN.indexOf('remetenteProibido(REMETENTE)') > -1
  && FN.indexOf('remetenteProibido(REMETENTE)') < FN.indexOf('api.resend.com'));

// ── 9. O DDL É ADITIVO ──────────────────────────────────────────────────────────────────────
console.log('── 9. o esquema só cresce ──');
ok('*** nenhum DROP, DELETE ou TRUNCATE no DDL desta fatia ***',
  !/\b(drop\s+(table|view|column)|delete\s+from|truncate)\b/i.test(DDL),
  (DDL.match(/\b(drop\s+\w+|delete\s+from|truncate)\b/ig) || []));
ok('as cinco colunas entram com `add column if not exists`',
  (DDL.match(/add column if not exists/gi) || []).length === 5,
  (DDL.match(/add column if not exists\s+(\w+)/gi) || []));
ok('as views são `create or replace` (nunca `drop view`)',
  (DDL.match(/create or replace view/gi) || []).length >= 4);
/* `security_invoker` EM TODA VIEW NOVA: sem ele a view roda com os direitos de quem a criou e
   vira porta lateral por cima da RLS — exatamente o que a `v_documentos_avisar` não pode ser,
   porque ela carrega número de certidão e órgão emissor. */
ok('*** e toda view desta fatia é `security_invoker` (nenhuma porta lateral sobre a RLS) ***',
  (DDL.match(/create or replace view/gi) || []).length === (DDL.match(/security_invoker\s*=\s*on/gi) || []).length,
  [(DDL.match(/create or replace view/gi) || []).length, (DDL.match(/security_invoker/gi) || []).length]);
ok('`anon` é revogado de todas as views novas',
  /revoke all\s+on public\.v_documentos_arquivados\s+from anon/i.test(DDL)
  && /revoke all\s+on public\.v_documentos_avisar\s+from anon/i.test(DDL));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
