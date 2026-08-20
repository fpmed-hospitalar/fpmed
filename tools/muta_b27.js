/* ══════════════════════════════════════════════════════════════════════════════════════════════
   muta_b27.js — APONTA AS CATRACAS DA B27 PARA O MATERIAL DE VERDADE E TENTA QUEBRÁ-LAS
   (20/08/2026)

   ══ POR QUE ELE EXISTE, E É A LIÇÃO MAIS CARA DA RODADA PASSADA ═════════════════════════════
   Na B26 eu escrevi um detector e o provei contra fixtures que eu mesmo tinha escrito, no mesmo
   minuto, com o mesmo chute. Detector e prova concordavam perfeitamente — e os dois estavam
   errados juntos, com relatório verde. A frase que ficou:

     "um detector provado só contra exemplos que eu mesmo escrevi herda o meu engano inteiro,
      e herda em silêncio, com relatório verde."

   A defesa não é escrever mais fixtures: é apontar o instrumento para o MATERIAL DE VERDADE e
   tentar quebrá-lo lá. É o que este arquivo faz — ele pega os arquivos reais da fatia, planta
   dentro deles o defeito exato que cada catraca promete pegar, e COBRA VERMELHO.

   ══ E ELE MEDE OS DOIS LADOS ════════════════════════════════════════════════════════════════
   As mutações `deveRuir: true` são defeitos: a catraca TEM de ficar vermelha. As `deveRuir:
   false` são mudanças legítimas — prosa que cita a palavra proibida, comentário novo — e a
   catraca TEM de deixar passar. Uma catraca que fica vermelha com as duas não protege nada: ela
   só ensina a ignorar vermelho.

   ══ NADA É ESCRITO NO REPOSITÓRIO ═══════════════════════════════════════════════════════════
   Tudo acontece numa cópia temporária, apagada no fim. O repositório não é tocado nem quando
   este arquivo é interrompido no meio (a cópia vive em `os.tmpdir()`).

     node tools/muta_b27.js
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');

/* Os arquivos que as duas suítes leem. A lista é explícita: copiar o repositório inteiro levaria
   junto `segredos.local.txt`, e mutação nenhuma justifica multiplicar cópia de segredo no disco. */
const ARQUIVOS = [
  'fpmed_documentos.html', 'fpmed_tema.css', 'limedtec-config.js',
  'fpmed_licitacoes.html', 'fpmed_negocios.html', 'fpmed_giovana.html', 'fpmed_ajuda.html',
  'fpmed_declaracoes.html', 'fpmed_pecas.html', 'fpmed_conferidor.html',
  'ddl/documentos_arquivo.sql',
  'supabase/functions/avisar-certidao/index.ts',
  'supabase/functions/enviar-boletim/index.ts',
  'tools/regua_visual.js',
  'tests/telas_adotadas.json',
  'tests/testa_arquivar_e_avisar.js',
  'tests/testa_token_definido.js',
];

const TELA = 'fpmed_documentos.html';
const FN = 'supabase/functions/avisar-certidao/index.ts';
const DDL = 'ddl/documentos_arquivo.sql';

/* CADA MUTAÇÃO DIZ QUAL SUÍTE ELA DESAFIA. Sem isso, uma mutação que quebra a suíte ERRADA
   passaria por sucesso — e eu ficaria acreditando que a catraca A pega um defeito que na verdade
   só a catraca B viu. */
const MUTACOES = [
  // ── as que TÊM de ficar vermelhas ────────────────────────────────────────────────────────
  { nome: 'arquivar vira DELETE', suite: 'testa_arquivar_e_avisar.js', deveRuir: true, arq: TELA,
    de: /(async function confirmarArquivamento[\s\S]*?)method:'PATCH'/, para: "$1method:'DELETE'" },
  { nome: 'o motivo deixa de ser obrigatório', suite: 'testa_arquivar_e_avisar.js', deveRuir: true, arq: TELA,
    de: /const motivo = motivoEscolhido\(\);\n  if\(!motivo\)\{/, para: "const motivo = motivoEscolhido() || 'sem motivo';\n  if(false){" },
  { nome: 'o motivo some do PATCH de arquivamento', suite: 'testa_arquivar_e_avisar.js', deveRuir: true, arq: TELA,
    de: /arquivado_motivo: motivo, /, para: '' },
  /* ESTA É A MUTAÇÃO MAIS IMPORTANTE DO ARQUIVO. `arquivado_em: null` é a linha mais natural que
     alguém escreveria ao "limpar" a volta — e é a que destrói a prova de que o documento já
     esteve fora do cofre. Ela tem de ser impossível de passar despercebida. */
  { nome: 'desarquivar "limpa" o carimbo (arquivado_em: null)', suite: 'testa_arquivar_e_avisar.js', deveRuir: true, arq: TELA,
    de: /(async function restaurar[\s\S]*?)ativo:true, desarquivado_em/, para: '$1ativo:true, arquivado_em:null, desarquivado_em' },
  { nome: 'a gaveta passa a ler o histórico (e mostra substituído como arquivado)', suite: 'testa_arquivar_e_avisar.js', deveRuir: true, arq: TELA,
    de: /v_documentos_arquivados\?select=\*&order=arquivado_em\.desc/, para: 'v_documentos_historico?select=*' },
  { nome: 'o e-mail padrão é congelado no documento em vez de resolvido na hora', suite: 'testa_arquivar_e_avisar.js', deveRuir: true, arq: TELA,
    de: /email_aviso: document\.getElementById\('f-email'\)\.value\.trim\(\) \|\| null/,
    para: "email_aviso: document.getElementById('f-email').value.trim() || EMAIL_EMPRESA" },
  { nome: 'a tela chama a função com o crachá anon (porta escancarada)', suite: 'testa_arquivar_e_avisar.js', deveRuir: true, arq: TELA,
    de: /Authorization: 'Bearer ' \+ tk, 'Content-Type':'application\/json'/,
    para: "Authorization: 'Bearer ' + SB_KEY, 'Content-Type':'application/json'" },
  { nome: 'alguém cola a chave do Resend na tela', suite: 'testa_arquivar_e_avisar.js', deveRuir: true, arq: TELA,
    de: /const SB_H  = /, para: "const RESEND_API_KEY = 're_AbCdEf1234567890';\nconst SB_H  = " },
  { nome: 'a função passa a usar service_role', suite: 'testa_arquivar_e_avisar.js', deveRuir: true, arq: FN,
    de: /const ANON = Deno\.env\.get\("SUPABASE_ANON_KEY"\)!;/,
    para: 'const ANON = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;' },
  { nome: 'o caminho automático nasce (o `teste` deixa de ser obrigatório)', suite: 'testa_arquivar_e_avisar.js', deveRuir: true, arq: FN,
    de: /if \(body\.teste !== true\) \{/, para: 'if (false) {' },
  { nome: 'o CNPJ entra no e-mail', suite: 'testa_arquivar_e_avisar.js', deveRuir: true, arq: FN,
    de: /\$\{esc\(d\.nome\)\}/, para: '${esc(d.nome)} ${esc(d.cnpj)}' },
  { nome: 'a lista de domínios proibidos perde um domínio', suite: 'testa_arquivar_e_avisar.js', deveRuir: true, arq: FN,
    de: /\["globalmedgo\.com\.br", "globalmed\.com\.br"\]/, para: '["globalmedgo.com.br"]' },
  { nome: 'a função remonta a regra de vencimento por conta própria', suite: 'testa_arquivar_e_avisar.js', deveRuir: true, arq: FN,
    de: /const docs = await rd\.json\(\);/,
    para: 'const docs = (await rd.json()).filter((d: any) => d.validade <= current_date);' },
  { nome: 'o DDL ganha um `drop view`', suite: 'testa_arquivar_e_avisar.js', deveRuir: true, arq: DDL,
    de: /create or replace view public\.v_documentos_arquivados/,
    para: 'drop view if exists public.v_documentos_arquivados;\ncreate or replace view public.v_documentos_arquivados' },
  { nome: 'uma view nova perde o `security_invoker` (porta lateral sobre a RLS)', suite: 'testa_arquivar_e_avisar.js', deveRuir: true, arq: DDL,
    de: /create or replace view public\.v_documentos_avisar\n  with \(security_invoker = on\) as/,
    para: 'create or replace view public.v_documentos_avisar as' },
  { nome: 'a grade de espaço some da ilha (o defeito real da B25)', suite: 'testa_token_definido.js', deveRuir: true, arq: TELA,
    de: /\n\s*--esp-1:4px;[^\n]*\n/, para: '\n' },

  // ── as que NÃO podem ficar vermelhas ─────────────────────────────────────────────────────
  /* A tela do cofre é a mais comentada do projeto, e a prosa dela nomeia o que ela proíbe — é a
     única maneira de um comentário ensinar uma regra. Se a catraca cobrar do comentário, o
     conserto vira "apagar a explicação", e explicação apagada é a causa da próxima geração do
     mesmo defeito. Estas três mutações medem exatamente isso. */
  { nome: 'um comentário novo explica por que arquivar NÃO é DELETE', suite: 'testa_arquivar_e_avisar.js', deveRuir: false, arq: TELA,
    de: /async function confirmarArquivamento/,
    para: "/* nada aqui usa method:'DELETE', e a razao e a lei do cofre */\nasync function confirmarArquivamento" },
  { nome: 'o rodapé do e-mail promete, em português, que não manda CNPJ', suite: 'testa_arquivar_e_avisar.js', deveRuir: false, arq: FN,
    de: /Este aviso não carrega arquivo, anexo nem CNPJ/,
    para: 'Este aviso nunca leva CNPJ, cnpj, nem o arquivo_path do documento' },
  { nome: 'um comentário cita `var(--esp-9)`, que não existe', suite: 'testa_token_definido.js', deveRuir: false, arq: TELA,
    de: /\.arqbox\{/, para: '/* a forma var(--esp-9) seria um token que ninguem define */\n.arqbox{' },
  { nome: 'uma regra nova usa fallback declarado `var(--esp-9, 36px)`', suite: 'testa_token_definido.js', deveRuir: false, arq: TELA,
    de: /\.arqbox\{/, para: '.arqfuturo{padding:var(--esp-9, 36px)}\n.arqbox{' },
];

// ── a cópia temporária ────────────────────────────────────────────────────────────────────────
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'muta-b27-'));
function semeia() {
  for (const rel of ARQUIVOS) {
    const dest = path.join(TMP, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(RAIZ, rel), dest);
  }
}
function rodaSuite(suite) {
  try {
    execFileSync(process.execPath, [path.join(TMP, 'tests', suite)], { stdio: 'pipe', encoding: 'utf8' });
    return { verde: true, saida: '' };
  } catch (e) {
    return { verde: false, saida: String((e.stdout || '') + (e.stderr || '')) };
  }
}

console.log('=== MUTAÇÃO DA FATIA B27 — as catracas contra o material de verdade ===\n');
semeia();

// ── 0. o controle: sem mutação nenhuma, as duas suítes têm de estar verdes ───────────────────
// Sem este passo, uma suíte já vermelha faria TODA mutação `deveRuir:true` "passar" — e o
// relatório sairia 16/16 sem ter provado nada. É o mesmo formato do detector cego da B26.
let base = true;
for (const s of ['testa_arquivar_e_avisar.js', 'testa_token_definido.js']) {
  const r = rodaSuite(s);
  console.log(`  controle · ${s.padEnd(30)} ${r.verde ? 'VERDE' : '*** JÁ ESTÁ VERMELHA ***'}`);
  if (!r.verde) { base = false; console.log(r.saida.split('\n').filter(l => /FALHA/.test(l)).slice(0, 6).join('\n')); }
}
if (!base) {
  console.log('\n>>> ABORTADO: com uma suíte já vermelha, a mutação não prova nada.');
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(1);
}
console.log('');

let pegou = 0, escapou = 0, falsoVermelho = 0;
const escapadas = [], falsas = [];

for (const m of MUTACOES) {
  semeia();                                    // volta ao original antes de cada mutação
  const alvo = path.join(TMP, m.arq);
  const antes = fs.readFileSync(alvo, 'utf8').replace(/\r\n/g, '\n');
  const depois = antes.replace(m.de, m.para);
  if (depois === antes) {
    /* MUTAÇÃO QUE NÃO APLICOU NÃO É MUTAÇÃO QUE PASSOU. Se o alvo mudou de forma e o `de` não
       casa mais, este arquivo estaria medindo o nada e dizendo verde — que é exatamente o
       defeito que ele existe para combater. Então ela conta como ESCAPADA, com o motivo. */
    escapou++; escapadas.push(m.nome + '  (o padrão não casou — o alvo mudou de forma)');
    console.log(`  ?? ${m.nome}\n     >>> o padrão não casou no arquivo real; esta mutação não mediu nada`);
    continue;
  }
  fs.writeFileSync(alvo, depois, 'utf8');
  const r = rodaSuite(m.suite);
  if (m.deveRuir) {
    if (!r.verde) { pegou++; console.log(`  ok  ${m.nome}  ->  vermelha, como devia`); }
    else { escapou++; escapadas.push(m.nome); console.log(`  ** ESCAPOU: ${m.nome}  ->  a catraca ficou VERDE`); }
  } else {
    if (r.verde) { pegou++; console.log(`  ok  ${m.nome}  ->  passou, como devia (não é defeito)`); }
    else {
      falsoVermelho++; falsas.push(m.nome);
      console.log(`  ** FALSO VERMELHO: ${m.nome}`);
      console.log('     ' + r.saida.split('\n').filter(l => /FALHA/.test(l)).slice(0, 2).join('\n     '));
    }
  }
}

fs.rmSync(TMP, { recursive: true, force: true });

const total = MUTACOES.length;
console.log('\n══ PLACAR ══');
console.log(`  ${pegou} de ${total} mutações se comportaram como deviam`);
console.log(`  ${escapou} escaparam (defeito que a catraca não vê)`);
console.log(`  ${falsoVermelho} falso(s) vermelho(s) (a catraca cobra de quem não fez nada errado)`);
if (escapadas.length) console.log('\n  ESCAPARAM:\n   - ' + escapadas.join('\n   - '));
if (falsas.length) console.log('\n  FALSO VERMELHO:\n   - ' + falsas.join('\n   - '));
process.exitCode = (escapou || falsoVermelho) ? 1 : 0;
