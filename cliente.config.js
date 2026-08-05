/* ═══════════════════════════════════════════════════════════════════════════════════════════
   LIMEDTEC — CONFIG DO CLIENTE.  Este arquivo e a UNICA coisa que muda entre um cliente e outro.
   Cliente 001: FPMED Hospitalar.

   A REGRA QUE ESTE ARQUIVO EXISTE PRA SUSTENTAR: nada de marca, cor, nome, e-mail, telefone,
   URL de banco ou validade de licenca vive no codigo do produto. Tudo mora aqui. O molde
   (motor, telas, service worker, licenca) e igual pra todo mundo; o que difere e este arquivo.

   >>> O QUE NUNCA ENTRA AQUI: a service_role do Supabase. A chave anon e publica por desenho
       (ela ja esta no gm-auth.js e o repo e publico); a service_role da controle total do banco
       e vive em segredos.local.txt, que e gitignore.
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
(function (raiz) {
  var CFG = {
    // O rotulo "001" veio do pedido do Lemuel (FPMED = primeiro cliente externo do produto).
    // NOTA PRA QUANDO EXISTIR UM REGISTRO CENTRAL DE CLIENTES: a instalacao de origem tambem se
    // chama 001 no config dela. Como cada instalacao vive num repo e num banco proprios, hoje
    // nao ha colisao de fato — mas no dia de listar clientes num lugar so, um dos dois muda.
    id: '001',
    nome: 'FPMED',
    nomeCompleto: 'FPMED Hospitalar',

    // ── BANCO DESTE CLIENTE ──────────────────────────────────────────────────────────────────
    // Supabase DA FPMED (ref xzdowrksuswekwffoluk). A chave anon e publica por desenho: ela so
    // identifica o projeto, quem manda no acesso e a RLS. A service_role NUNCA vem pra ca.
    // Nao existe valor-padrao pra estes dois campos no molde, e isso e proposital: instalacao sem
    // banco configurado tem que EXPLODIR, nunca cair no banco de outra empresa.
    banco: {
      url: 'https://xzdowrksuswekwffoluk.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6ZG93cmtzdXN3ZWt3ZmZvbHVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NzE2MTMsImV4cCI6MjEwMDI0NzYxM30.Pk-SlV_pZdniESyrajDdfHdHcnmyCwCMtP_TrShh75Y',
    },

    // ── EMPRESA(S) DO CLIENTE ────────────────────────────────────────────────────────────────
    // Decisao do Lemuel (05/08): a empresa do cliente ja NASCE CADASTRADA. Ele nao abre o
    // sistema numa tela vazia pedindo pra "adicionar sua empresa" — isso e trabalho que o
    // fornecedor do software ja tem como fazer, porque o dado veio no cadastro dele.
    //
    // POR QUE MORA AQUI E NAO SO NO BANCO: este arquivo e o unico que o cria_cliente escreve.
    // Com a empresa aqui, cliente novo do LIMEDTEC nasce com a empresa dele cadastrada SEM
    // ninguem lembrar de rodar nada — o seeder (tools/semeia_empresa.js) le daqui. Se o dado
    // vivesse so no banco, cada instalacao nova dependeria de alguem lembrar de inserir.
    //
    // LISTA, e nao objeto, de proposito: o molde pode ter cliente com 2 CNPJs (matriz e filial,
    // ou duas razoes sociais disputando licitacao). `principal: true` marca a que aparece por
    // padrao. Hoje a FPMED tem uma so, e NAO existe tela de gestao — e registro semeado, so.
    //
    // ⚠️ DUPLICACAO CONHECIDA, registrada em vez de escondida: a razao social, o CNPJ e a IE
    //    TAMBEM estao escritos a mao no cabecalho do PDF de proposta (fpmed_giovana.html) e no
    //    sistema_final, desde o rebrand de 22/07. Sao duas fontes da mesma verdade. Unificar
    //    exige mexer no documento que vai pro cliente, o que e mudanca de outra natureza —
    //    fica como item proprio, nao como efeito colateral deste.
    empresas: [
      {
        razaoSocial: 'FPMED DISTRIBUIDORA DE PRODUTOS HOSPITALARES LTDA',
        cnpj: '47.110.418/0001-15',
        ie: '10.947.387-9',
        cidade: 'APARECIDA DE GOIANIA',
        uf: 'GO',
        principal: true,
      },
    ],

    // ── LICENCA ──────────────────────────────────────────────────────────────────────────────
    // Decisao do Lemuel (04/08): avisar a partir de 10 dias antes; vencida = MODO LEITURA
    // (consulta funciona, gerar documento bloqueado). NUNCA apagar nada, NUNCA travar o acesso
    // do cliente ao dado dele. Licenca vencida e cobranca, nao castigo.
    // >>> A DATA ABAIXO E PROVISORIA — quem define e o Lemuel. Trocar aqui, so aqui.
    licenca: {
      validade: '2027-12-31',       // AAAA-MM-DD. Vazio ou ausente = sem prazo (nunca bloqueia).
      avisarDias: 10,
      suporte: 'Fale com o suporte para renovar.',
    },

    // ── MARCA ────────────────────────────────────────────────────────────────────────────────
    // TEMA CLARO DA FPMED — sao as cores que ja estao nas telas desde o rebrand de 21/07:
    // azul #2CA9E0, azul-escuro #173A5E, verde #8DC63F. NUNCA as escuras da instalacao de origem:
    // este produto e white-label e o tema do cliente e o tema DELE.
    // (Excecao conhecida e proposital: a tela de Licitacoes e escura por decisao do Lemuel. Isso
    //  e CSS dela, nao vem daqui — o aplicaTema so escreve variaveis, nao manda no layout.)
    marca: {
      produto: 'LIMEDTEC',          // o titulo da janela e "LIMEDTEC — {nome}"
      cores: { bg: '#F5F9FC', painel: '#FFFFFF', painel2: '#EEF5FA', destaque: '#2CA9E0',
               destaque2: '#8DC63F', texto: '#173A5E', borda: 'rgba(23,58,94,.16)' },
      icones: 'icones/',
    },
  };

  raiz.LIMEDTEC_CLIENTE = CFG;
  if (typeof module !== 'undefined' && module.exports) module.exports = CFG;
})(typeof window !== 'undefined' ? window : globalThis);
