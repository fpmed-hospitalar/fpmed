/* ==============================================================================================
   LIMEDTEC - CONFIG DO CLIENTE.  MODELO COMENTADO CAMPO A CAMPO.
   Preenchido ate onde da pra preencher DAQUI: cliente 002, FPMED.

   COMO USAR: copie este arquivo pra pasta do cliente com o nome  cliente.config.js  e preencha
   tudo que estiver marcado com  >>> PREENCHER. Nada mais precisa ser tocado no codigo.

   A REGRA QUE ESTE ARQUIVO EXISTE PRA SUSTENTAR: nada de marca, cor, nome, e-mail, telefone,
   URL de banco ou validade de licenca vive no codigo do produto. Tudo mora aqui. O molde
   (motor, telas, service worker, licenca, papeis) e igual pra todo mundo; o que difere e este
   arquivo. A catraca que mede o quanto ainda escapa e o tests/testa_produtizacao.js.

   >>> O QUE NUNCA ENTRA AQUI: a service_role do Supabase. A chave anon e publica POR DESENHO
       (ela vai no JavaScript de uma pagina publica, e quem manda no acesso e a RLS); a
       service_role da controle total do banco, ignora a RLS e vive em segredos.local.txt, que
       e gitignore.

   >>> POR QUE NAO HA VALOR-PADRAO PRA banco.url E banco.anonKey: uma instalacao sem banco
       configurado TEM QUE EXPLODIR. Se houvesse padrao, o cliente novo apontaria pro banco de
       outro cliente e leria dado que nao e dele - em silencio, com aparencia de funcionar. O
       limedtec-config.js explode de proposito, com o nome do campo que falta. Ha 4 asserts
       (7a-7d) na suite so pra garantir que esse comportamento nao se perca.
   ============================================================================================== */
(function (raiz) {
  var CFG = {
    // ID do cliente na carteira. So numero, com 3 digitos: e ele que a LIMEDTEC Central usa pra
    // identificar o deploy. 001 = GlobalMed.
    id: '002',

    // NOME CURTO: aparece no titulo da janela ("LIMEDTEC - {nome}"), no rodape do portal e,
    // principalmente, no short_name do PWA - o texto embaixo do icone na area de trabalho.
    // Duas instalacoes na mesma maquina com o mesmo short_name ficam indistinguiveis.
    nome: 'FPMED',
    // NOME COMPLETO: o que aparece por extenso no rodape do portal.
    nomeCompleto: 'FPMED',                        // >>> PREENCHER se a razao social for outra

    // ── BANCO DESTE CLIENTE ────────────────────────────────────────────────────────────────────
    // >>> PREENCHER OS DOIS. Saem do painel do Supabase do projeto DELA:
    //     Settings > API > Project URL   e   Project API keys > anon public
    // >>> ESTES DOIS VALORES NAO PODEM SER ESCRITOS NO REPOSITORIO DA GLOBALMED. A suite
    //     tests/testa_compliance.js (asserts 2 e 3) quebra se qualquer arquivo de la citar outra
    //     base Supabase - e e essa suite que mantem a fronteira entre as duas empresas de pe.
    //     Preencha na pasta do cliente, nunca no molde.
    banco: {
      url: 'https://PREENCHER.supabase.co',       // >>> PREENCHER
      anonKey: 'PREENCHER-chave-anon',            // >>> PREENCHER
    },

    // ── LICENCA ────────────────────────────────────────────────────────────────────────────────
    // Decisao do Lemuel (04/08): avisar a partir de 10 dias antes; vencida = MODO LEITURA
    // (consulta funciona, gerar documento bloqueado). NUNCA apagar nada, NUNCA travar o acesso do
    // cliente ao dado dele. Licenca vencida e cobranca, nao castigo.
    licenca: {
      validade: '',                               // >>> PREENCHER  AAAA-MM-DD (vazio = sem prazo)
      avisarDias: 10,
      suporte: 'Fale com o suporte para renovar.',
    },

    // ── MARCA ──────────────────────────────────────────────────────────────────────────────────
    // As cores viram variaveis CSS (--lt-*) no <html> antes de qualquer folha de estilo valer.
    // Trocar a cor do sistema inteiro e trocar estas 6 linhas.
    marca: {
      produto: 'LIMEDTEC',                        // o nome do PRODUTO, igual em todo cliente
      cores: { bg: '#0A141C', painel: '#10212C', painel2: '#0d1b26',
               destaque: '#3AB6CE', destaque2: '#63D0E4',
               texto: '#E8F0F8', borda: 'rgba(58,182,206,.25)' },
      icones: 'icones/',
      // A LOGO DE TEXTO E EM DOIS PEDACOS porque a segunda metade sai na cor de destaque.
      // Cliente que nao quiser o corte deixa `destaque` vazio e o nome sai inteiro.
      logo: { antes: 'FP', destaque: 'MED' },     // >>> CONFERIR se o corte faz sentido pra ela
      descritor: '',                              // >>> PREENCHER a linha pequena sob a logo
    },

    // ── A EMPRESA (o que sai nos DOCUMENTOS) ───────────────────────────────────────────────────
    // Isto NAO e enfeite de tela: e o cabecalho e o rodape de TODO papel que sai do sistema -
    // proposta pro hospital, pedido de compra, cotacao pro fornecedor, relatorio.
    // >>> UM ENDERECO SO. Ate 05/08 a GlobalMed tinha DOIS enderecos diferentes nos dois papeis
    //     que saem pra fora, e ninguem tinha percebido. A chave `enderecoCompleto` foi APAGADA de
    //     proposito: enquanto ela existisse, alguem montaria um documento com ela sem perceber que
    //     tinha recriado o segundo endereco. Quem garante que os 4 documentos continuam iguais e o
    //     tests/testa_endereco_unico.js.
    empresa: {
      razaoSocial: '',                            // >>> PREENCHER
      cnpj: '',                                   // >>> PREENCHER  00.000.000/0000-00
      endereco: '',                               // >>> PREENCHER  logradouro, numero, quadra/lote
      cidadeUf: '',                               // >>> PREENCHER  CIDADE - UF
      telefone: '',                               // >>> PREENCHER  (00) 00000-0000
      whatsapp: '',                               // >>> PREENCHER  so digitos com DDI: 5562...
      pix: '',                                    // >>> PREENCHER  a chave que vai no pedido
    },

    // ── QUEM E QUEM (e-mail de acesso -> nome usado nas tabelas) ───────────────────────────────
    // A coluna `vendedora` de prospects/clientes guarda o NOME, nao o e-mail. Quem entra e
    // identificado pelo e-mail, entao alguem tem que fazer a ponte. Sem correspondencia o sistema
    // usa o PROPRIO E-MAIL - nunca o nome de outra pessoa. Um padrao como "cai na primeira da
    // lista" faria o prospect de um funcionario novo aparecer na carteira de outra pessoa.
    // >>> ESTE E O LUGAR CERTO POR ENQUANTO, NAO O IDEAL. O ideal e uma coluna `nome` na tabela
    //     perfis: contratar alguem viraria um cadastro na tela de usuarios em vez de um deploy.
    //     Isso e DDL e esta anotado como proposta.
    // >>> ESTA LISTA E O QUE O <select data-limedtec-equipe> DAS TELAS MOSTRA. Deixar vazia faz
    //     os campos de vendedora nascerem sem opcao nenhuma.
    equipe: {
      // '>>> PREENCHER: 'email@dominio': 'Nome',
    },
  };

  raiz.LIMEDTEC_CLIENTE = CFG;
  if (typeof module !== 'undefined' && module.exports) module.exports = CFG;
})(typeof window !== 'undefined' ? window : globalThis);
