-- ============================================================================================
-- FPMED — O CAMINHO DE ENTRADA DO DADO DA ATA (fatia B31, 20/08/2026)
--
-- ══ O GARGALO QUE ESTA FATIA EXISTE PARA ABRIR ══════════════════════════════════════════════
-- Três telas entregues nas três rodadas anteriores funcionam e estão VAZIAS: o cofre com um
-- documento de prova, o teto competitivo com 192 itens de um certame alheio, o saldo com zero
-- atas com item. **O código acabou; o dado não começou.** E o dado que falta não é o que o poder
-- público publica — é o que só o dono sabe: que ata é dele, qual item ele ganhou, até quando ela
-- vale. Não existe coleta para isso. Existe CAMINHO DE ENTRADA, ou não existe nada.
--
-- ══ O QUE NASCE AQUI, E POR QUÊ ═════════════════════════════════════════════════════════════
-- 1. A trigger `nig_confirmacao` CONSERTADA — e o defeito dela foi MEDIDO, não deduzido (abaixo).
-- 2. O ARQUIVAR DA ATA, com carimbo e motivo, do mesmo jeito que o cofre da B27.
-- 3. A `v_atas_vigencia` deixa de contar o que alguém arquivou; e a gaveta que diz quantas guarda.
--
-- TUDO ADITIVO: nenhuma coluna sai, nenhuma linha é tocada, nenhum `drop view`. Roda 2x.
-- ============================================================================================


-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 1. A TRIGGER DA CONFIRMAÇÃO — UM DEFEITO MEDIDO, EM DOIS RAMOS, E OS DOIS SILENCIOSOS
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- A `negocio_itens_ganhos` guarda o rastro de "o que a gente ganhou naquele pregão", e o rastro é
-- a coluna `confirmacao`: corrigir não é apagar, é uma confirmação NOVA com número maior, e a
-- `v_negocio_itens_ganhos` mostra só o `max`. Essa é a regra desde 11/08.
--
-- >>> MEDIDO EM 20/08, no negócio de ensaio 2569, INSERINDO DE VERDADE E LENDO O QUE VOLTOU —
--     não lendo o código e concluindo. Os dois ramos possíveis estavam quebrados, para lados
--     OPOSTOS, e nenhum dos dois levanta erro:
--
--     RAMO A — o cliente NÃO manda `confirmacao` (é o que a tela de hoje faz). A coluna é
--       `not null default 1`, então chega `1`; a trigger só age quando o valor é nulo ou <= 0,
--       logo ela NUNCA DISPARA. Três linhas entraram, as três com `confirmacao = 1`. Uma
--       correção futura entraria também como `1`, e a view — que mostra o `max` — devolveria a
--       lista velha E a nova MISTURADAS. **O mecanismo de rastro está morto e o sintoma é uma
--       tabela com o dobro dos itens.**
--
--     RAMO B — o cliente manda `confirmacao = 0` para a trigger decidir. Aí ela dispara LINHA A
--       LINHA, e cada linha enxerga as anteriores do MESMO comando (dado escrito na transação é
--       visível para a consulta seguinte dela). Medido: um lote de 3 saiu **2, 3 e 4**, e a view
--       devolveu **UMA linha** — a última. **Marcar 3 itens e a tela mostrar 1**, sem erro.
--
-- ══ O CONSERTO: A DECISÃO CONTINUA NO BANCO, MAS UMA VEZ POR TRANSAÇÃO ══════════════════════
-- O número não pode voltar para o cliente (duas abas abertas mandariam o mesmo, e uma correção
-- viraria a outra — é o motivo escrito na `negocio_itens_ganhos.sql` e ele continua válido). O
-- que muda é o ESCOPO: a primeira linha do lote calcula, guarda o resultado num parâmetro LOCAL
-- da transação (`set_config(..., true)`) e as demais leem de lá. Um INSERT de N linhas passa a
-- ser UMA confirmação, que é o que a palavra sempre quis dizer.
-- >>> O PARÂMETRO É POR NEGÓCIO (`fpmed.nig_<id>`) e não um só: um lote pode tocar dois negócios,
--     e um parâmetro único faria o segundo herdar o número do primeiro.
-- >>> E ELE É LOCAL. `set_config(_, _, true)` morre no fim da transação. Sem o `true`, o número
--     ficaria grudado na CONEXÃO — e o PostgREST reaproveita conexão: a próxima gravação de
--     outra pessoa, minutos depois, entraria com o número da anterior.
create or replace function public.nig_confirmacao() returns trigger
language plpgsql as $$
declare
  chave text;
  guardado text;
begin
  if new.confirmacao is null or new.confirmacao <= 0 then
    chave := 'fpmed.nig_' || new.negocio_id::text;
    guardado := current_setting(chave, true);
    if guardado is null or guardado = '' then
      select coalesce(max(x.confirmacao), 0) + 1 into new.confirmacao
        from public.negocio_itens_ganhos x where x.negocio_id = new.negocio_id;
      perform set_config(chave, new.confirmacao::text, true);
    else
      new.confirmacao := guardado::int;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists nig_confirmacao_t on public.negocio_itens_ganhos;
create trigger nig_confirmacao_t before insert on public.negocio_itens_ganhos
  for each row execute function public.nig_confirmacao();

-- >>> O `default 1` DA COLUNA FICA, e ele é o RAMO A do defeito. Tirá-lo exigiria `drop default`
--     numa tabela povoada e mudaria o contrato de quem já escreve nela — a regra da casa é
--     aditivo. O conserto verdadeiro é a TELA mandar `confirmacao: 0` ("banco, escolha"), e é o
--     que a B31 passou a fazer nos dois caminhos de gravação. Fica escrito aqui porque quem
--     inserir nesta tabela amanhã, de outro lugar, precisa saber: **omitir a coluna é entrar
--     como confirmação 1 e nunca suceder ninguém.**
comment on column public.negocio_itens_ganhos.confirmacao is
  'Qual confirmacao gravou esta linha; a view mostra so o max. MANDE 0 para o banco escolher — '
  'omitir a coluna deixa o default 1 e a linha nunca sucede a anterior (medido em 20/08/2026).';


-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 2. ARQUIVAR A ATA — CARIMBO E MOTIVO, COMO NO COFRE
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- A pendência 4 do relatório da B30: sobraram no banco três linhas de saldo e uma validade de 45
-- dias num registro de ensaio, e não havia caminho de tirá-los da frente que não fosse DELETE —
-- ou seja, o dono digitando comando destrutivo. A lei da casa é a da B27: **arquivar, não apagar.**
--
-- ══ E AQUI HÁ UMA ARMADILHA QUE O COFRE JÁ ENSINOU, MEDIDA DE NOVO ══════════════════════════
-- `negocios.arquivado` JÁ EXISTE — e, medido em 20/08, **as 108 atas desta casa estão com ele em
-- `true`**. Aquilo não é decisão de ninguém: é a importação do Calendário 2025, que entrou
-- arquivada de propósito para o kanban não virar lista de tudo que já aconteceu. Se a gaveta de
-- arquivados filtrasse por `arquivado`, ela nasceria com 108 linhas que ninguém arquivou — e o
-- número do botão ("ver 3 arquivadas") passaria a mentir no primeiro dia.
-- >>> É A MESMA DISTINÇÃO DA B27 entre SUBSTITUÍDO e ARQUIVADO, na outra ponta da casa:
--       · nasceu arquivado (importação) -> `arquivado = true`, `arquivado_em` NULO
--       · alguém DECIDIU tirar          -> `arquivado_em` preenchido, com motivo e autor
--     A gaveta filtra pelo CARIMBO, nunca pela bandeira.
alter table public.negocios add column if not exists arquivado_em     timestamptz;
alter table public.negocios add column if not exists arquivado_motivo text;
alter table public.negocios add column if not exists arquivado_por    text;
-- A VOLTA existe, e não apaga o carimbo de saída: quem desfaz um ato não desfaz o fato de ter
-- feito. É a terceira data, e a linha passa a contar a história inteira.
alter table public.negocios add column if not exists desarquivado_em  timestamptz;

create index if not exists negocios_arquivado_em_idx
  on public.negocios (arquivado_em desc) where arquivado_em is not null;

comment on column public.negocios.arquivado_em is
  'QUANDO alguem decidiu tirar este negocio da frente. Diferente de `arquivado`, que as 2.543 '
  'linhas do Calendario 2025 ja trazem da importacao. Gaveta e paineis filtram por ESTA coluna.';


-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 3. A VISÃO DAS ATAS DEIXA DE CONTAR O QUE ALGUÉM ARQUIVOU
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- >>> O FILTRO É `arquivado_em is null`, E NÃO `not arquivado` — pelo motivo do bloco 2. Medido:
--     `not arquivado` deixaria esta view com ZERO linhas hoje (as 108 têm a bandeira ligada), e a
--     aba Ata inteira ficaria em branco. O filtro certo tira só o que alguém decidiu tirar.
-- >>> E O QUE VOLTOU ESTÁ AQUI DE NOVO, sozinho: desarquivar limpa `arquivado_em`, então a linha
--     volta a esta lista e o `desarquivado_em` guarda que ela já saiu uma vez.
-- >>> AS COLUNAS NOVAS ENTRAM NO FIM, na ordem exata das antigas antes delas. É a lição da B25 e
--     da B27: `create or replace view` recusa mudança de nome ou de POSIÇÃO de coluna que já
--     existia, e quem acrescenta no meio troca uma migração aditiva por um `drop view`.
create or replace view public.v_atas_vigencia
  with (security_invoker = on) as
select n.id, n.titulo, n.orgao, n.municipio, n.uf, n.numero, n.valor_ganho,
       n.ata_vigencia_inicio, n.ata_vigencia_fim,
       (n.ata_vigencia_fim - current_date) as dias_para_vencer,
       case
         when n.ata_vigencia_fim is null                          then 'sem_vigencia'
         when n.ata_vigencia_fim <  current_date                  then 'vencida'
         when n.ata_vigencia_fim <= current_date + 60             then 'vencendo'
         else                                                          'vigente'
       end as situacao,
       (select count(*) from public.ata_saldo s where s.negocio_id = n.id) as itens_com_saldo,
       n.arquivado_em, n.arquivado_motivo, n.desarquivado_em
  from public.negocios n
 where n.estagio = 'contrato'
   and n.arquivado_em is null
 order by n.ata_vigencia_fim asc nulls last, n.id asc;

-- ── A GAVETA ────────────────────────────────────────────────────────────────────────────────
-- Só o que alguém DECIDIU tirar, e que não voltou. Ela existe para o botão poder dizer um número
-- verdadeiro — "ver 3 arquivadas" — e para o arquivamento ter volta, que é o que faz o botão ser
-- clicável de verdade. Botão sem volta é botão que ninguém clica, e aí o recurso não existe.
create or replace view public.v_atas_arquivadas
  with (security_invoker = on) as
select n.id, n.titulo, n.orgao, n.municipio, n.uf, n.numero, n.valor_ganho,
       n.ata_vigencia_inicio, n.ata_vigencia_fim,
       n.arquivado_em, n.arquivado_motivo, n.arquivado_por, n.desarquivado_em,
       (select count(*) from public.ata_saldo s where s.negocio_id = n.id) as itens_com_saldo
  from public.negocios n
 where n.estagio = 'contrato'
   and n.arquivado_em is not null
 order by n.arquivado_em desc;

comment on view public.v_atas_arquivadas is
  'As atas que ALGUEM decidiu tirar da frente, com motivo e carimbo. Nao inclui as 2.543 linhas '
  'que nasceram arquivadas na importacao do Calendario 2025 — aquilo nao foi decisao de ninguem.';


-- ── PERMISSÃO ───────────────────────────────────────────────────────────────────────────────
-- Mesma simetria de sempre: quem está logado LÊ (saldo de ata é agenda de faturamento); escrever
-- continua sendo da policy da TABELA `negocios`, que já exige `cargo_gestor()` no UPDATE. A view
-- não inventa permissão nenhuma, e `anon` não entra em lugar nenhum.
grant select on public.v_atas_vigencia   to authenticated;
grant select on public.v_atas_arquivadas to authenticated;
revoke all  on public.v_atas_vigencia   from anon;
revoke all  on public.v_atas_arquivadas from anon;

notify pgrst, 'reload schema';
