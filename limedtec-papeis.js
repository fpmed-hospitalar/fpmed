/* LIMEDTEC — PAPEIS E PERMISSOES.  Molde puro: nao conhece nenhum cliente nem nenhuma pessoa.
 *
 * TRES PAPEIS (definidos pelo dono do produto):
 *   vendedor      cria cotacao/proposta, busca, gera PDF. NAO ve custo/margem.
 *   gerente       tudo do vendedor + custo/margem + paineis + cadastros. Permissoes AJUSTAVEIS.
 *   gestor_geral  tudo, mais usuarios, configuracoes, licenca e imports.
 *   dono_produto  (LIMEDTEC Central) — ve licenca/versao/saude/contagem de TODOS os clientes,
 *                 e NENHUM dado comercial de nenhum. Ver COMPLIANCE.md.
 *
 * >>> ESTE ARQUIVO NAO E A SEGURANCA. Ele decide o que a TELA mostra. Quem impede o vendedor de
 *     ler custo e a RLS do Postgres — porque esconder um botao nao impede ninguem de abrir o F12
 *     e chamar a REST na mao. Os dois existem e fazem coisas diferentes:
 *         RLS  = o vendedor NAO CONSEGUE ler o custo.
 *         aqui = o vendedor nao VE um campo vazio e um botao que daria erro.
 *     Se um dia os dois discordarem, quem manda e a RLS. Esta e a ordem certa de confiar.
 *
 * >>> SEM PAPEL = NEGADO. Nunca "acesso total por omissao". Mesmo principio do banco() sem
 *     valor-padrao em limedtec-config.js: uma instalacao incompleta tem que parar, nao liberar.
 *     O modo de falha que isso evita e o pior de todos — o que parece que funcionou.
 */
(function (raiz) {
  'use strict';

  // A LISTA DE CHAVES. Nomear a permissao pelo que ela LIBERA, nao pela tela onde ela aparece:
  // tela muda de nome, permissao nao.
  var CHAVES = [
    'cotar',            // criar/editar cotacao e proposta
    'gerar_documento',  // PDF/proposta pro cliente final
    'ver_custo',        // preco de compra e margem   <<< a linha que separa vendedor de gerente
    'ver_paineis',      // paineis e relatorios financeiros
    'cadastrar',        // produto e fornecedor
    'importar',         // imports de tabela de fornecedor
    'gerir_usuarios',   // criar, trocar papel, desativar
    'configurar',       // configuracoes do cliente e licenca
  ];

  // O PADRAO DE CADA PAPEL. O gerente e o unico ajustavel — por isso os toggles so valem pra ele.
  var PADRAO = {
    vendedor:     { cotar: true, gerar_documento: true },
    gerente:      { cotar: true, gerar_documento: true, ver_custo: true, ver_paineis: true, cadastrar: true },
    gestor_geral: { cotar: true, gerar_documento: true, ver_custo: true, ver_paineis: true,
                    cadastrar: true, importar: true, gerir_usuarios: true, configurar: true },
    // o dono do produto NAO cota e NAO ve custo de ninguem: ele opera a Central, nao a operacao
    // do cliente. Ver a tabela no COMPLIANCE.md.
    dono_produto: { ver_paineis: true },
  };

  function papeis() { return Object.keys(PADRAO); }
  function chaves() { return CHAVES.slice(); }

  // perfil: { papel, ativo, permissoes } — vem da tabela do cliente, nunca do codigo.
  function permissoes(perfil) {
    var p = perfil || {};
    if (!p.papel || !PADRAO[p.papel]) {
      return { ok: false, motivo: p.papel ? ('papel desconhecido: ' + p.papel) : 'sem papel definido',
        pode: {} };
    }
    if (p.ativo === false) {
      return { ok: false, motivo: 'usuario desativado', pode: {} };
    }
    var base = {};
    CHAVES.forEach(function (k) { base[k] = !!PADRAO[p.papel][k]; });
    // TOGGLES: so o gerente e ajustavel, e so pra DESLIGAR ou LIGAR dentro do que a lista permite.
    // Um toggle nunca pode dar ao gerente uma chave de gestor (gerir_usuarios, configurar): isso
    // seria promover alguem por configuracao, sem ninguem trocar o papel dele.
    if (p.papel === 'gerente' && p.permissoes && typeof p.permissoes === 'object') {
      var PROIBIDAS = { gerir_usuarios: 1, configurar: 1, importar: 1 };
      CHAVES.forEach(function (k) {
        if (!(k in p.permissoes)) return;
        if (PROIBIDAS[k]) return;                       // toggle nao promove
        base[k] = !!p.permissoes[k];
      });
    }
    return { ok: true, motivo: '', papel: p.papel, pode: base };
  }

  function pode(perfil, chave) {
    var r = permissoes(perfil);
    return r.ok && !!r.pode[chave];
  }

  // a mensagem que a tela mostra quando nega. Clara e sem culpar quem esta na frente dela.
  function negado(perfil, chave) {
    var r = permissoes(perfil);
    if (!r.ok) return 'Acesso não liberado: ' + r.motivo + '. Fale com quem administra o sistema.';
    return 'Seu perfil (' + r.papel + ') não tem permissão para isto. Fale com quem administra o sistema.';
  }

  raiz.LimedtecPapeis = { CHAVES: CHAVES, PADRAO: PADRAO, papeis: papeis, chaves: chaves,
    permissoes: permissoes, pode: pode, negado: negado };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.LimedtecPapeis;
})(typeof window !== 'undefined' ? window : globalThis);
