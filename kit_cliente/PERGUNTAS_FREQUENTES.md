# PERGUNTAS FREQUENTES — OS TROPECOS REAIS DESTA INSTALACAO

Nao e uma lista de "possiveis problemas". **Cada item aqui aconteceu** na instalacao de origem
(GlobalMed, cliente 001) ou foi encontrado montando o kit. Estao aqui porque quase todos tem a
mesma assinatura: **erram sem dar erro**. O sistema abre, a tarefa aparece agendada, o DDL roda
sem reclamar — e a coisa nao esta funcionando.

Formato: **SINTOMA** (o que voce ve) → **CAUSA** → **CONSERTO**.
Ordem: os que mentem primeiro; os que gritam depois.

---

# PARTE 1 — OS QUE ERRAM EM SILENCIO

## 1. A policy PERMISSIVE que engole a RESTRICTIVE

**SINTOMA.** O DDL rodou, a policy de custo aparece em `pg_policies`, e mesmo assim o vendedor le
`compra_unit` por REST direto. Nada indica erro.

**CAUSA.** No Postgres, policies **PERMISSIVE se somam com OU** e **RESTRICTIVE se somam com E**.
A tabela `cotacoes` tem uma `auth_all` permissiva (`using (true)`), que existe pra o sistema
funcionar. Se a policy de custo tambem for permissiva, o resultado e `true OR limedtec_pode(...)`
= **sempre true**. Ela vira decoracao: DDL aplicado, seguranca zero, com aparencia de protecao.

**CONSERTO.**
```sql
select policyname, permissive from pg_policies
 where schemaname='public' and tablename='cotacoes';
```
As de nome `cotacoes_custo`, `cotacoes_edicao` e `cotacoes_escrita` tem que aparecer como
`RESTRICTIVE`. Se alguma vier `PERMISSIVE`, recrie a partir do `ddl/05_rls_e_policies.sql` — ele
ja traz o `as restrictive`.

**QUEM COBRA ISSO SOZINHO.** `tests/testa_kit.js` assert 11b e o item marcado `***` do
`verifica_instalacao.js`. Se algum dia alguem "simplificar" o DDL tirando o `as restrictive`, os
dois ficam vermelhos antes de chegar em cliente.

---

## 2. O backup agendado que morre calado

**SINTOMA.** A tarefa esta la no Agendador, com "Ultimo resultado: 0x0". Meses depois, na hora de
restaurar, a pasta de backup esta vazia — ou pior, tem arquivos com metade das linhas.

**CAUSA — foram tres, e as tres ja aconteceram aqui:**
1. o `.cmd` apontava pra pasta de **outra instalacao** (caminho escrito a mao). Rodava, escrevia
   log, e fazia backup do banco errado;
2. a leitura paginada usava `offset` **sem `order`**: o Postgres nao promete a mesma ordem entre
   paginas, entao a mesma linha vem duas vezes e outra nunca vem. O arquivo **parece** completo;
3. erro de rede depois da primeira pagina dava `break` silencioso, e o backup pela metade era
   salvo como se fosse inteiro — com codigo de saida 0, que e o que o Agendador mostra.

**CONSERTO.** Use o `tools/limedtec_backup.cmd` do molde, que:
- **se localiza sozinho** (`%~dp0..`), entao nao ha caminho pra errar;
- pagina por keyset e **confere a contagem com o servidor**;
- escreve um `_resumo.json` com `"completo": true/false`;
- **sai com codigo 1** quando falta tabela, pra o Agendador registrar a falha.

**COMO CONFERIR (2 minutos, e vale por todos os meses seguintes).** Rode a mao uma vez e olhe o
fim do log: tem que terminar em `>>> completo: N tabelas.` e `saida=0`. Depois abra o
`_resumo.json` do backup mais recente e confira `"completo": true` — e que o nome do banco dentro
dele e o **do cliente**.

> Backup agendado que ninguem viu disparar e um backup que nao existe.

---

## 3. O comando de instalacao que mexe no banco da OUTRA empresa

**SINTOMA.** Voce roda o red test dos papeis, ele passa 15/15, voce da a instalacao por testada.
Na verdade os 3 usuarios de teste foram criados e apagados no banco da **instalacao de origem** —
e o teste passou porque **aquele** banco esta certo.

**CAUSA.** Ferramentas de verificacao com a pasta e o `ref` do projeto **escritos a mao**. Isto
valia ate 07/08 pro `red_test_papeis.js` (cria e apaga usuarios) e pro `carrega_cmed_pf.js`
(escreve 25 mil linhas).

**CONSERTO.** Os dois passaram a ler a pasta de `LIMEDTEC_RAIZ` e a derivar o projeto da URL do
`cliente.config.js` daquela pasta — e **imprimem, na primeira linha, em que banco vao mexer**:
```
set LIMEDTEC_RAIZ=C:/limedtec-002
node tools/red_test_papeis.js
   -> instalacao sob teste: C:/limedtec-002  ·  projeto: <ref do cliente>
```
**Ler essa linha e o passo.** Se ela mostrar o projeto errado, pare antes de deixar rodar.

---

## 4. O banco do cliente errado no config

**SINTOMA.** O sistema abre, faz login, a busca funciona, os cards enchem — **com o dado de outra
empresa**. Nenhuma mensagem de erro em lugar nenhum.

**CAUSA.** `cliente.config.js` copiado de outra instalacao com a URL/anon antigas. Como as duas
instalacoes rodam o mesmo codigo, nada quebra.

**CONSERTO.** `verifica_instalacao.js` tem um item so pra isso ("o banco e o DESTE cliente"). Na
mao: abra o sistema, F12, e confira que a URL das chamadas `/rest/v1/` e a do projeto do cliente.

**E O IRMAO DESSE ERRO:** colocar a **`service_role` no lugar da anon** no config. O sistema
tambem funciona — melhor ate, porque a RLS para de atrapalhar. E a chave vai inteira pro navegador
de todo mundo. O verificador decodifica o JWT e olha a claim `role`; procurar a palavra
"service_role" no texto do arquivo nao serve (a primeira versao acusava o proprio comentario que
explica a regra, e aviso falso vira barulho que a pessoa aprende a ignorar).

---

## 5. A view do vendedor marcada como `security_invoker`

**SINTOMA.** O vendedor faz login e o sistema dele nasce **vazio**: a busca nao devolve nada, e
nao ha erro na tela. O gestor ve tudo normalmente.

**CAUSA.** `cotacoes_vendedor` funciona **porque roda com os direitos do dono** e atravessa a RLS
da tabela `cotacoes`. Marcada como `security_invoker=true`, ela passa a rodar com os direitos de
quem consulta — e o vendedor, que e justamente quem a policy RESTRICTIVE barra em `cotacoes`,
recebe zero linha.

**CONSERTO.**
```sql
select c.relname, c.reloptions from pg_class c
 join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname='cotacoes_vendedor';
```
`reloptions` **nao pode** conter `security_invoker=true`. Se contiver:
`alter view cotacoes_vendedor set (security_invoker = false);`

> Foi exatamente esse o estado que obrigou a reverter os papeis em 05/08 na origem: vendedor com
> banco vazio, busca sem resultado, sistema inutil — e nenhuma mensagem dizendo por que.

---

## 6. O `manifest.webmanifest` com o nome da empresa anterior

**SINTOMA.** O cliente instala o aplicativo e o icone na area de trabalho diz o nome de **outra**
empresa. Com dois clientes na mesma maquina, ficam indistinguiveis.

**CAUSA.** O manifest e lido pelo **navegador antes de qualquer JavaScript rodar** — ele nao tem
como consultar o `cliente.config.js`. Entao ele nao "le o config": ele e **gerado** a partir dele.
Quem copia o manifest do molde e nao regenera, leva o nome antigo.

**CONSERTO.**
```
set LIMEDTEC_RAIZ=C:/limedtec-002
node tools/gera_manifest.js
```
E troque os 3 PNG de `icones/` pela logo do cliente (`tools/gera_icones.js` gera o placeholder).

---

## 7. O `sw.js` servindo a versao velha depois do deploy

**SINTOMA.** Voce publica, abre o endereco, e ve a tela de ontem. Da `F5` e continua a de ontem.
Em outro computador aparece a nova. Pior: **metade nova, metade velha**.

**CAUSA.** O service worker guarda a casca do app numa cache com **nome versionado**. Se a casca
muda e a **versao nao muda**, o navegador continua servindo a copia guardada. E o oposto tambem
morde: telas do portal que **nunca entraram** na casca nao abrem offline.

**CONSERTO.**
1. mexeu na casca → **suba a versao** dentro do `sw.js` (`limedtec-AAAA-MM-DD-N`);
2. mexeu numa tela → **suba o `<meta name="gm-versao">`** dela. As telas mostram um selo no canto
   inferior esquerdo com essa versao, e ele **le o meta** — nao ha segunda copia do numero pra
   envelhecer;
3. pra o usuario: **clicar no selo** recarrega ignorando a cache. E o caminho de uma pessoa que
   nao sabe o que e service worker;
4. `tests/testa_pwa.js` cobra as duas coisas: que **toda tela oferecida no portal** esteja na
   casca, e que a versao mude quando a assinatura da casca mudar.

> Nao ha risco de preco velho aqui: a estrategia e network-first e **nenhum dado vem da cache** —
> preco, cotacao e estoque vem do banco, que nunca entra na casca.

---

## 8. Card no portal apontando pra tela que nao foi copiada

**SINTOMA.** Cliente novo clica num card do portal e leva **404**.

**CAUSA.** O molde e uma **lista explicita**. Uma tela nova entrou no portal e ninguem a
acrescentou na lista — aconteceu com a `globalmed_viabilidade.html`.

**CONSERTO.** `tests/testa_produtizacao.js` assert 15 compara o portal com a lista do molde. Se
ficar vermelho, acrescente o arquivo em `tools/cria_cliente.js` e rode
`node tools/gera_kit_molde.js` (o `MOLDE.txt` e gerado, nao escrito a mao — e `testa_kit` compara
os dois).

---

## 9. A tela de comissao dizendo "erro de JavaScript"

**SINTOMA.** No cliente novo, o menu **Comissoes** abre e mostra
`Erro ao carregar: rows.map is not a function`.

**CAUSA.** A tabela `comissoes_isadora` e da instalacao de origem e, **por decisao**, nao viaja no
molde — cliente nenhum recebe a tabela de comissao de uma funcionaria de outra empresa. O
PostgREST devolve `{code:'42P01'}` e o codigo antigo tentava `.map` nisso.

**CONSERTO.** Ja consertado no produto: a tela agora diz **"Este modulo nao esta instalado neste
cliente"**. Se voce ainda vir o erro de JavaScript, a copia esta desatualizada — recopie do molde.

---

# PARTE 2 — OS QUE GRITAM (mas a mensagem nao ajuda)

## 10. "Ligar a RLS trancou todo mundo, inclusive eu"

**SINTOMA.** Depois do `05`, ninguem le nada. Nem o gestor.

**CAUSA.** O `05` foi rodado **pela metade** — RLS ligada, policies nao criadas. Sem policy,
RLS nega tudo por padrao (que e o comportamento certo).

**CONSERTO.** Rode o `ddl/05_rls_e_policies.sql` **inteiro**, de uma vez. Ele e idempotente
(`drop policy if exists` antes de cada `create`), entao reaplicar e seguro. Se voce perdeu o
acesso ate pra isso, use a `service_role` ou o SQL Editor do painel, que **ignoram** a RLS.

> Um caso especifico ja visto: uma policy de tabela que **nao existe naquele banco** derruba o
> arquivo no meio, e o resto nao chega a ser aplicado. Parece "so um errinho" e sai com a RLS pela
> metade. O gerador do DDL agora filtra policies de tabelas que nao viajam.

## 11. "O primeiro usuario nao consegue cadastrar ninguem"

**SINTOMA.** Login funciona, mas a tela de usuarios nao deixa criar ninguem.

**CAUSA.** A policy de escrita em `perfis` exige a permissao `gerir_usuarios`, e so `gestor_geral`
tem. Se ninguem for gestor ainda, ninguem pode promover ninguem — **inclusive a si mesmo**.

**CONSERTO.** O passo 4 do roteiro: `insert` do primeiro gestor direto no banco, com o `uuid` do
usuario criado no painel do Supabase. Depois disso a tela resolve o resto.

> E o oposto tambem esta travado de proposito: existe uma trava que **impede remover o ultimo
> gestor**. Sem ela, um clique deixa a instalacao sem ninguem que possa consertar.

## 12. "`fetch is not defined`" / erro estranho de sintaxe nos scripts

**CAUSA.** Node abaixo da versao 18. As ferramentas usam `fetch` nativo.

**CONSERTO.** `node -v`. Precisa ser 18 ou maior.

## 13. "O `.cmd` reclama de `'rlevel'` ou `'/b'`"

**CAUSA.** Arquivo `.bat`/`.cmd` gravado com quebra de linha **LF** em vez de **CRLF**. O
interpretador do Windows fatia a linha no lugar errado e reclama de um pedaco de palavra.

**CONSERTO.** Regrave em **CRLF sem BOM**. Teste sempre com `cmd /c arquivo.cmd`, nunca so
"parece certo no editor" — o editor mostra as duas do mesmo jeito.

## 14. "Gerei o DDL e um dos arquivos ficou vazio"

**SINTOMA.** `testa_kit` fica vermelho reclamando que o DDL nao cria a view do vendedor, e o
arquivo `04_*.sql` tem 0 byte.

**CAUSA.** O gerador foi **interrompido no meio** (por exemplo, com a saida ligada num `head` /
`Select-Object -First`, que fecha o cano e mata o processo). Ele ja tinha criado o arquivo e ainda
nao tinha escrito o conteudo.

**CONSERTO.** Rode `node tools/gera_ddl_instalacao.js` de novo, **sem cortar a saida**, e rode
`node tests/testa_kit.js` depois. A suite pega isso na hora — foi ela que pegou aqui.

---

# PARTE 3 — O QUE NAO E PROBLEMA (e parece)

| voce ve | e normal porque |
|---|---|
| a tela de comissao some / diz que nao esta instalada | ela e da instalacao de origem e nao viaja. Nao ha nada a consertar |
| o red test cria usuarios no banco | ele cria 3 e **apaga os 3 no fim**; ele confere isso e reclama se sobrar algum |
| "0 linhas" pra todo mundo logo depois de instalar | tabela vazia devolve 0 pra qualquer papel. Isso **nao prova** que a RLS separa — a prova so vem depois da primeira carga de dado |
| o `01_conhecimento_do_produto.sql` traz linhas | sao as ~20 do dicionario marca↔principio ativo. "DIPIRONA e o PA do NOVALGINA" vale em qualquer distribuidora — e conhecimento do produto, nao dado comercial de ninguem. E a **unica** excecao, e ela e cobrada por assert |
| o pdf.js pesa ~1,7 MB na pasta | vendorizado de proposito: CDN quebraria o app offline e uma Edge Function faria o relatorio de estoque do cliente trafegar por fora do banco dele |

---

# SE NADA AQUI EXPLICA

- **e do MOLDE** (o mesmo defeito apareceria em qualquer cliente) → o conserto e na **fabrica**, e
  o kit tem que ser **regenerado** depois. Nao remende na pasta do cliente: o remendo se perde na
  proxima copia e o proximo cliente tropeca igual;
- **e desta instalacao** (config, banco, hospedagem, maquina) → o conserto e local, e o que se
  aprendeu com ele **volta pra este arquivo**.

O criterio pra separar os dois: *"se eu instalasse um cliente 003 do zero agora, isso aconteceria
de novo?"* Se sim, e do molde.
