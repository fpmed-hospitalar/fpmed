# 🏥 PLACAR FPMED — task list permanente do projeto

> Padrão do projeto: TODA rodada da FPMED acompanha este placar. Marca ✓ na hora que
> concluir. Commit por etapa. (clone white-label #2 · pasta C:\fpmed · git próprio, sem remote)
>
> **Escopo do pacote FPMED = sistema completo SEM Prospecção e SEM Loja Pública**
> (decisões de escopo do Lemuel).

Última atualização: 2026-08-05

## 🔐 CONTROLE DE ACESSO POR CARGO (24/07) — RLS no banco, não só no front
> Decisão do Lemuel: gate de tela não basta (F12 burla a REST). O controle real é **RLS por
> cargo lido do JWT** (`app_metadata.role` — NÃO editável pelo usuário). Arquivo: `db_rls_cargos.sql`.

**Cargos** (em `app_metadata.role`): `diretor`, `gerente`, `vendedor`, `propostas`.
Legado: `admin`=diretor, `vendedora`=vendedor, `giovana_only`=propostas.
**GESTOR** = diretor|gerente (função `cargo_gestor()` no banco).

**Matriz (tela × cargo × API):**

| Recurso | Diretor | Gerente | Vendedor | Propostas |
|---|---|---|---|---|
| Entra no back-office (sistema_final, Vendas, Viabilidade, Painel) | ✅ | ✅ | ❌ (só Propostas) | ❌ (só Propostas) |
| Tela **Propostas** (giovana) | ✅ | ✅ | ✅ | ✅ |
| Ver **custo de fornecedor / margem / quem fornece** | ✅ | ✅ | ❌ | ❌ |
| **Cotações** (tabela com custo) via API | ✅ lê base | ✅ lê base | ❌ RLS bloqueia (lê view `cotacoes_vendedor` sem custo) | idem vendedor |
| Telas de inteligência (Competitividade, Compras/Cliente, Clientes&Op, Itens a Cotar) | ✅ | ✅ | ❌ | ❌ |
| **Gravar** na base (Importar Cotação/Espelho, Atualizar Estoque, Pedido Fechado) | ✅ | ✅ | ❌ 403 | ❌ 403 |
| **Apagar** cotação / desfazer | ✅ | ✅ | ❌ | ❌ |
| **IA Ler Pedido** + Importar lista (montar proposta) | ✅ | ✅ | ✅ | ❌ |
| Salvar **orçamento** / cadastrar cliente | ✅ | ✅ | ✅ | ✅ |
| Enviar proposta **para compras** (pedido) | ✅ | ✅ | ❌ | ❌ |

Obs.: diretor e gerente têm as MESMAS permissões (decisão do Lemuel: escrita/apagar = diretor+gerente).
A distinção é organizacional; `cargo_destrutivo()`=diretor fica reservada p/ dar poderes só-diretor no futuro.

**Como criar um usuário de cada cargo** (via Admin API, com `service_role` do segredos.local.txt; o
Claude NÃO digita senha — o usuário troca no 1º login). O papel VAI EM `app_metadata`, nunca em user_metadata:
```
# criar:  POST {SB}/auth/v1/admin/users
{ "email":"fulano@fpmed.com.br", "password":"<temporaria>", "email_confirm":true,
  "app_metadata": { "role":"gerente" } }        # role = diretor|gerente|vendedor|propostas
# mudar cargo de quem já existe:  PUT {SB}/auth/v1/admin/users/{id}
{ "app_metadata": { "role":"vendedor" } }
```
⚠️ Corpo JSON via ARQUIVO (`--data-binary @arq.json`): o PowerShell come as aspas em `-d '...'`.
⚠️ Depois de mudar o cargo, o usuário precisa **sair e entrar** (ou o token renova sozinho em ≤1h)
   pro JWT novo carregar o `app_metadata`. Sessão com token velho cai no default `vendedor`.

**Teste de burla executado (24/07, JWT real de vendedor via API direta):**
1. ler custo na tabela base → `[]` (RLS bloqueia) ✅
2. ler coluna `compra_unit` na view → 400 "column does not exist" ✅
3. ler `venda_unit_forn` na view → OK (preço de venda, sem custo) ✅
4. ler `compras` / `fornecedores` → `[]` ✅
5. INSERT em cotacoes → **403 "violates row-level security policy"** ✅
6. contraprova gestor (gerente): lê custo/fornecedor e faz INSERT → OK ✅
Validado também no browser real: vendedor entra só em Propostas (7.416 produtos, preço sem custo),
é barrado do sistema_final ("sem permissão"); diretor vê o menu completo.

**⚠️ LIMITAÇÃO HONESTA (markup fixo):** como o markup é 32% conhecido, o preço de venda de item de
distribuidor permite deduzir o custo (venda ÷ 1,32). O que fica realmente protegido é a IDENTIDADE do
fornecedor, o número de custo rotulado, o histórico de compras e a ESCRITA. Custo 100% opaco exigiria
markup variável/oculto (mudança de regra de negócio) — avisar o Lemuel se ele quiser isso.

## 🧪 REGRA PERMANENTE DE TESTE (22/07)
Todo teste de tela que GRAVA no banco: usar a prévia SEM clicar em gravar, OU apagar os
dados de teste imediatamente depois (e provar a limpeza com contagem antes/depois).
Auditoria de 22/07: banco confirmado limpo após teste do upload de PDF (preview-only).

## ✅ CONCLUÍDAS
- [x] Pasta base `C:\fpmed` + cópia limpa (sem segredos, sem Prospecção `vendedora.html`)
- [x] Git próprio inicializado (commit `bfe2f0d`)
- [x] Hook "modo total" anti-destrutivo testado (commit `9267c76`)
- [x] Logo oficial baixado do site → `logo_fpmed.png` + `fpmed_template.html` na pasta
- [x] Remoção da Prospecção embutida no `sistema_final` (1294 linhas · commit `6ec8180`)
- [x] Renomeação `globalmed_*` → `fpmed_*` + refs internas (commit `7ac2cda`)
- [x] Varredura de marca GlobalMed→FPMED (61 trocas / 17 protegidas · commit `af6f347`)
- [x] Exceção `!logo_fpmed.png` no `.gitignore`
- [x] **Rebrand visual completo** (tema claro do template, logo real, cores
      #2CA9E0/#173A5E/#8DC63F, Montserrat+Inter, faixa (62) 3290-4241 + slogan) — 10 arquivos
- [x] **Loja pública removida** do pacote (arquivo + agente descartado; nenhum outro arquivo referenciava)
- [x] **Placeholders jurídicos** aplicados: `[RAZÃO SOCIAL FPMED]`/`[CNPJ]`/`[ENDEREÇO]` no lugar
      do CNPJ/endereço/razão social da GlobalMed (giovana 7 + sistema_final 28 substituições)
- [x] **Supabase FPMED criado** (org nova FREE `FPMED Hospitalar`, projeto `fpmed`, região São
      Paulo, ref `xzdowrksuswekwffoluk`). URL+anon+service_role+DB pw no `segredos.local.txt`.

- [x] **ORG `fpmed-hospitalar` + repo `fpmed`** criados no GitHub (Free, repo PRIVADO por ora).
      Remote local `origin` → `https://github.com/fpmed-hospitalar/fpmed.git` (sem push ainda).

- [x] **URL + ANON trocados** em todos os arquivos → Supabase da FPMED (12 anon + 16 URL, 0 resquício
      do banco antigo, sintaxe JS validada). URL `https://xzdowrksuswekwffoluk.supabase.co`.

## 🔑 PAPÉIS DE ACESSO — padrão LIMEDTEC (05/08) — ⏸ ESPERANDO 2 COISAS DO LEMUEL

**Feito nesta sessão (só leitura, nada aplicado):**
- Puxados do molde (só código): `limedtec-papeis.js` + `ddl/papeis.sql`.
- 🔍 **MAPA DE POLICIES DESTE BANCO IMPRESSO** — era a pré-condição, e ele **confirma o alerta**:
  **48 policies · 12 tabelas · 4 por tabela (SELECT/INSERT/UPDATE/DELETE) · 100% PERMISSIVE**,
  todas para `authenticated`. Como toda policy existente é PERMISSIVE, **qualquer policy nova
  permissiva seria somada com OR** às que já estão lá — a restrição não restringiria nada e a
  segurança seria só aparência. **Portanto: as policies de custo/escrita entram `AS RESTRICTIVE`,
  sem exceção.** (É o mesmo achado da Global, agora *verificado contra o mapa daqui*.)
- ✅ **A RLS por cargo de 24/07 ESTÁ VIVA** (não foi perdida): `cot_sel`, `cot_upd` e `cot_del` da
  `cotacoes` usam `USING cargo_gestor()`, e as funções `cargo_gestor()` e `jwt_cargo()` existem no
  banco. O sistema novo de papéis **convive com isso** — não pode simplesmente derrubar as
  policies atuais, ou o gate de custo que já passou nos testes de burla some junto.

**⏸ BLOQUEIO 1 — a lista de quem é quem.** O próprio Lemuel mandou perguntar antes de rebaixar
qualquer um, e a configuração da Global **não serve** (os nomes são de lá). Hoje a FPMED tem
**2 usuários**: `lemuelempresas7@outlook.com` e `comercial@fpmed.com.br`, ambos `diretor`.
**⏸ BLOQUEIO 2 — o token `sbp_` do Supabase DA FPMED** (cada banco tem o seu), na hora de aplicar.

**Migração aprovada (executar nesta ordem, quando destravar):**
1. `--etapa 1`: estrutura, sem ligar nada.
2. `--perfis`: **todos os usuários atuais entram como `gestor_geral`** — nada muda na virada.
3. `--etapa 2`: liga a RLS com a trava "ninguém sem perfil".
4. **Red tests com 3 usuários de teste**: vendedor **não lê custo por REST direto** (barrado *pelo
   banco*, não pela tela), sem papel = negado, desativado não entra.
5. Só então aplicar a lista real do Lemuel.
📌 Registrar no molde/`cria_cliente` que **papéis fazem parte do padrão de todo cliente novo**.

## 📋 FILA ATUAL — **ORDEM CORRIGIDA 05/08/2026 (decisões do Lemuel)**
> Regra: pedido novo entra no FIM da fila. Só "URGÊNCIA" fura. Ver `CONTINUAR_AQUI.txt`.

### ⚠️ ORDEM VIGENTE — o que fazer, nesta sequência
| # | item | estado |
|---|---|---|
| **4** | Blocos 2 e 4 do sync de código | ✅ **CONCLUÍDO 06/08** |
| **8** | Calendário FASE 2 | ✅ **CONCLUÍDO 06/08** — 2.555 linhas, taxa de vitória 15,2% |
| **10** | Coleta agendada do PNCP + banco próprio | ✅ **CONCLUÍDO 06/08** — edge function no ar + Actions 3x/dia (ver 10.1). 1 passo do Lemuel: o secret no GitHub |
| **9** | **SIGA / funil de Negócios** | 🟡 **4 ETAPAS CONCLUÍDAS 06/08** — 1ª Funil+Tarefas+Agenda (9.1) · 2ª Notificações (9.3) · 3ª **Meus Jornais (9.4)** · 4ª Pesquisa avançada+Órgãos+Desertas (9.2). Faltam ANÁLISE e JURÍDICO, os dois com dependência externa |
| **11** | `ABRIR_FILA.bat` inicia o Claude com "continua a fila" | ✅ **CONCLUÍDO 06/08** — o mecanismo já existia; o defeito era o **contrato** (ver 11.1) |

### 12 — INSTALAÇÃO PELO KIT (06/08/2026) — placar **24 ✓ · 3 ✗**, de 17 ✓ · 9 ✗ · 1 ?

Kit puxado de `C:\globalmed\kit_cliente` (**só leitura**; a Global não foi tocada — `git status`
de lá segue com os arquivos da sessão *dela*, nenhum meu). Cópia local em `kit_cliente/`.

**Feito, na ordem do roteiro:**
| passo | o que foi feito | prova |
|---|---|---|
| 2 | `id` 001 → **002**; campos de documento no config | verificador: seção 1 toda verde |
| 3 | `ddl/03_perfis_e_papeis.sql` aplicado | rodou **2×** sem erro (idempotência provada rodando, não lendo) |
| 4 | os **2 gestores** inseridos | `select papel from perfis` → 2 × `gestor_geral` |
| 5 | `gera_manifest.js --aplicar` | `short_name=FPMED` |
| 6 | suíte | **1.305 asserts / 0 falhas / 40 suítes** |
| 8 | backup agendado **próprio** | tarefa `LIMEDTEC-backup-002`, disparada à mão: `saida=0` |
| 9 | verificador | **24 ✓ · 3 ✗ · 0 não conferido** |

**O `id` era 001 e isso quebrava a checagem mais importante.** O verificador usa `id === '001'`
para decidir *"esta pasta é a da origem"* — com 001 aqui, ele **exigia que o banco fosse o da
GlobalMed**. A checagem mais crítica da instalação estava invertida. Nada no código lê o campo
(zero ocorrências), então a troca é de rótulo — reversível numa linha.

**Dados da empresa**: o kit espera `empresa` (objeto); aqui a decisão dele (05/08) foi
`empresas[]` (lista, pra 2 CNPJs). Resolvido **sem criar segunda verdade**: o singular é
**derivado** da lista no fim do config. Endereço/telefone não são dados novos — estavam escritos
à mão no PDF desde 22/07; só vieram pro lugar onde o molde procura.

#### ⛔ O QUE **NÃO** RODEI, e por quê (cada um é decisão dele)
1. **`02_operacao.sql`** — cria 17 tabelas, entre elas **`prospects` e `prospeccoes`**. A regra
   master #3 da FPMED é **SEM Prospecção**. Rodar reintroduziria, no banco, escopo que ele
   excluiu. Junto vem **`comissoes_isadora`** — tabela com o nome de uma pessoa da GlobalMed (o
   próprio roteiro registra isso como pendência). *(E o verificador manda rodar o 02 pra criar
   `perfis` — mas `perfis` está no 03. É defeito da mensagem dele.)*
2. **`04_markup_e_view_vendedor.sql`** — faz `create or replace view cotacoes_vendedor`. Essa
   view **já existe aqui** e tem `security_invoker=FALSE`, que é **pré-condição documentada**:
   se virar `on`, a restritiva do 05 tira o sistema inteiro do vendedor. Substituir às cegas
   mexe justamente nesse parafuso.
3. **`05_rls_e_policies.sql`** — é a migração que já estava **parada esperando OK**. Ela
   `drop policy` em 45 policies e liga RLS restritiva. Aqui convivem **dois gates**: o
   `cargo_gestor()` de 24/07 (`cot_sel/ins/upd/del`, que o 05 **não** derruba) e o
   `limedtec_pode()` novo. O Postgres **soma permissiva E restritiva**, então ler `cotacoes`
   passaria a exigir os dois. Os 2 usuários atuais passam nos dois — mas usuário novo criado só
   com perfil ficaria trancado fora sem mensagem clara.
4. **`06_central_saude.sql`** — publica uma view agregada da FPMED **pra LIMEDTEC Central**, que
   é o painel do dono do produto. Dado da FPMED saindo pra fora é decisão dele + COMPLIANCE.
5. **`red_test_papeis.js`** (passo 7) — cria 3 usuários e **APAGA** os 3. A regra da rodada
   proíbe DELETE sem OK.

**Conferido contra os commits `903d05e` / `ed1fe96`** (06/08, fim do dia): os 10 arquivos do kit
são **byte-idênticos** aos que eu já tinha puxado enquanto ele subia — hash a hash. A instalação
acima foi feita contra a versão final; nada a refazer. (`ed1fe96` só mexeu no `CONTINUAR` de lá.)

**O verificador é ferramenta de FÁBRICA, não do cliente** — tentei instalá-lo em `tools/` daqui e
as duas coisas quebraram: (1) o `testa_compliance` ficou vermelho, porque ele carrega o `ref` do
Supabase da origem e este repo é público; (2) ele lê `tools/cria_cliente.js` do **próprio**
`__dirname` pra montar a lista do molde — sem esse arquivo (que é da fábrica), o item do molde
sai vazio e o checklist encolhe de 27 pra 26, ficando **mais verde por saber menos**. Cheguei a
escrever uma versão rebrandada com checagem por coerência interna (`ref` do config × `ref` do
`gm-auth.js`, que pega qualquer vizinho em vez de só um), mas **desfiz**: o uso correto é o que o
próprio roteiro documenta — rodar da fábrica passando a pasta do cliente como argumento.

#### 🚨 ACHADOS QUE VOLTAM PRO KIT (defeitos do produto, não da FPMED)
0. 🔴 **GRAVE — `ddl/03` deixa a tabela `perfis` aberta pro `anon`** (achado e corrigido 06/08).
   Ele cria a tabela e **não liga RLS, não cria policy e não revoga o `anon`**. No Supabase,
   tabela nova em `public` já nasce com `GRANT ALL TO anon`. **Medido pela internet, com a anon
   real: `GET /rest/v1/perfis` → HTTP 200 com os e-mails da equipe**; os GRANTs davam
   INSERT/UPDATE/DELETE também. As policies de `perfis` só chegam no `05`, que é a migração
   parada — ou seja, **todo cliente instalado por este roteiro fica com a lista de usuários
   exposta no intervalo entre o 03 e o 05**, e o 05 pode nunca ser rodado.
   *Correção sugerida ao kit: as 3 policies de `perfis` + `revoke all from anon` pertencem ao
   **03**, junto com a tabela. Fechadura e porta se instalam no mesmo dia.*
   Aqui foi resolvido com `ddl/perfis_fecha_anon.sql` (a metade segura do 05, mesmos nomes de
   policy). Ver o commit `ca50056`.
1. **O verificador e o red test carregam o `ref` do projeto Supabase da GlobalMed hardcoded.**
   Copiei os dois pra cá e o `testa_compliance` ficou **vermelho na hora** (3 falhas). O repo da
   FPMED é **público**: commitar aquilo publicaria o ref da Global. **Removi antes de commitar**
   e rodei o verificador direto da pasta da Global. Todo cliente novo receberia isso.
   *Correção sugerida: a checagem vira genérica — "o `ref` do config bate com o do resto do
   repo" — em vez de nomear o projeto de outra empresa.*
2. **A tarefa agendada dá verde com o backup de OUTRO cliente.** O verificador procura
   "limedtec" no `schtasks`; nesta máquina existe a `LIMEDTEC-backup-001`, da Global, apontando
   pra `C:\globalmed`. A FPMED não tinha backup agendado nenhum e o item saía ✓. Criei a
   **`LIMEDTEC-backup-002`** com nome próprio. *Correção sugerida: casar a tarefa pela pasta que
   ela executa, não pelo prefixo do nome.*
3. **A lista do molde compara nomes literais da origem** (`globalmed_*.html`), então toda
   instalação rebrandada nasce com esse item vermelho — 5 arquivos daqui existem, só com o nome
   do cliente.

#### 📦 E o item do molde revelou uma pendência REAL (não era só falso negativo)
Dos 20 que ele acusou: **5** existem rebrandados · **2** estão fora por decisão de escopo
(Prospecção e a calculadora da Isadora) · e **8 faltam de verdade** — a FPMED está atrás do
molde atual: `limedtec-usuarios.html` (a tela que cadastra usuário — sem ela, depois do primeiro
gestor o resto é SQL na mão), o **importador de estoque por PDF** (`limedtec-estoque.html`,
`limedtec-estoque-leitor.js`, `le_pdf_estoque.js`, `importa_estoque_erp.js`, `IMPORTAR_ESTOQUE.bat`,
`cria_atalho_estoque.ps1`, `vendor/pdfjs/*`), `motor_busca.js`, `limedtec-sessao.js` e
`icones/limedtec.ico`. **Portar isso é SYNC com rebrand** (`SYNC_GLOBAL.md`, "nunca às cegas") —
entra na fila, não sai de efeito colateral da instalação.

### 9.4 — MEUS JORNAIS ✅ (3ª das 6 etapas do item 9, 06/08/2026)

**O que é**: a pesquisa avançada **salva com nome**. Abre com um clique e mostra **o que chegou
depois da última vez que aquela pessoa olhou**. Tabela nova `jornais` (`ddl/jornais.sql`),
aditiva, rodada **2×** pra provar idempotência.

**O valor não é o atalho, é o DELTA.** Reabrir a busca sem `vistos` mostraria as mesmas 70 de
ontem e obrigaria a reler tudo pra achar as 3 que mudaram — que é o trabalho que o jornal existe
pra eliminar. Por isso cada jornal guarda **no banco** (não no `localStorage`: o mesmo usuário
abre de outra máquina) os `numeroControlePNCP` que já mostrou, com teto de 800.

**A decisão de projeto desta etapa — a JANELA DE DATA.** O padrão da tela é *o último dia útil*.
Um jornal que guardasse essa data como número reabriria amanhã pesquisando **ontem**, calado: uma
busca salva que envelhece sozinha é pior que busca salva nenhuma. Então:
- janela padrão → guarda o **tipo** (`movel`) e **recalcula** a data na abertura;
- intervalo escolhido a mão → guarda as datas e a tela **diz** que aquela janela é fixa.
Adivinhar qual dos dois ele quis seria o pior dos dois mundos.

**Três coisas que o jornal se recusa a fazer:**
1. **Inventar novidade na 1ª leitura.** No jornal recém-salvo tudo seria "novo" — verdade formal,
   mentira prática: ele acabou de ver aquilo na tela. A 1ª abertura só registra; a 2ª compara.
2. **Carimbar leitura vazia.** Se a busca voltou vazia (PNCP fora, banco sem aquela janela), NÃO
   grava "li tudo" — senão as licitações de **hoje** nasceriam **velhas amanhã**, e some
   oportunidade sem deixar rastro. É o pior defeito possível aqui.
3. **Dizer "nada novo" quando não conseguiu perguntar.** Com o banco fora o jornal diz
   **"não sei dizer agora"**. E o link do topo só ganha número quando há número — "Meus Jornais
   (0)" ensina o olho a ignorar justamente o lugar onde o número importa.

**A leitura sai do NOSSO banco** (`licitacoes`, que a coleta agendada abastece 3×/dia), nunca do
PNCP ao vivo — um contador de novidade pendurado numa fonte que caiu ~6× em 3 dias mostraria
"nada novo" o tempo todo.

**RLS de DONO, sem `cargo_gestor()`** — e isso é deliberado: quem entra na tela de Licitações já é
filtrado pelo gm-auth uma camada acima. Amarrar o jornal ao cargo faria os jornais de alguém
**sumirem** no dia em que o cargo dele mudasse: perda silenciosa de trabalho salvo.

**Refatoração que veio junto (e evita a divergência clássica)**: `filtrosDaTela()` passou a ser o
**único** lugar que lê o formulário, e `refinoDe(filtros)` a ser puro. O refino da tela e o filtro
do jornal são hoje o mesmo objeto — sem isso, o primeiro filtro novo entraria só num dos dois.

⬜ **O que NÃO entrou, e por quê**: envio automático por **e-mail/WhatsApp**. Exige provedor
contratado (Resend/SES) = **custo**, decisão do Lemuel (6.1 do `LICITACOES_SPEC.md`). Quando ele
liberar, o delta já está pronto — é este `vistos`. A tela **diz isso na cara**, em vez de fingir
que o jornal avisa sozinho.

Suíte nova `testa_meus_jornais` (**74 asserts**), com rede e DOM de mentira. Provada por mutação
nas duas garantias centrais: gravar leitura vazia → cai o 46; janela sempre fixa → caem 4.
Total: **1.379 asserts / 0 falhas / 41 suítes**.

### 11.1 — ABRIR_FILA.bat ✅ (06/08/2026) — o mecanismo estava certo, o **contrato** não

**O mecanismo já existia** e está correto: `claude --dangerously-skip-permissions "<prompt>"`.
Confirmado no `claude --help` desta máquina — `claude [options] [prompt]` **abre sessão
interativa** com o prompt (o `-p/--print` é que seria não-interativo), e o flag
`--dangerously-skip-permissions` continua válido.

**O defeito era o texto, e era sério**: os dois `.bat` mandavam prompts **diferentes**. O
`ABRIR_FILA.bat` — justamente o dos "2 cliques" — mandava só **"continua a fila"**, sem
*"nunca DELETE/UPDATE de dados sem OK"*, sem *"commit + CONTINUAR + push a cada task"*, sem
*"relatório único"*. Dois cliques abriam uma rodada automática com **contrato mais fraco que o
da rodada manual** — e ninguém notaria até a rodada fazer algo que a regra proibia.

**Correção**: o prompt passou a viver em **`.claude/prompt_fila.txt`**, lido pelos dois. Mudar
a regra da rodada é editar **um** lugar, e os dois não têm como divergir de novo.
Entrou junto: `where claude` **antes** do backup (falhar cedo custa menos) e aborto explícito
com `pause` quando o arquivo do prompt some — em vez de abrir rodada sem contrato.

**Detalhes de batch que quebram em silêncio, travados na suíte**: `for /f "usebackq delims="`
(sem `delims=` o prompt seria cortado no 1º espaço), arquivo de **uma linha só** (o `for /f`
guarda a última — 3 linhas mandariam só a 3ª, sem erro na tela), **sem BOM** (3 bytes entrariam
no comando), **só ASCII**, sem `"` e sem `%`.

**Prova feita**: rodei um `.bat` de teste que executa só a parte da leitura e **imprime o
comando que seria disparado** — voltou a instrução inteira, com as barras e o hífen intactos.
> ⚠️ O que **não** dá pra provar daqui continua igual: lançar o `.bat` de dentro do Claude
> abriria sessão **aninhada**, que é o cenário que o teste não quer provar. A prova final é o
> próximo boot dele. *(A suíte registra essa limitação em vez de fingir cobertura.)*

Suíte nova `testa_abrir_fila` (**31 asserts**). Total: **1.270 asserts / 0 falhas / 39 suítes**.

### 9.3 — NOTIFICAÇÕES (o sininho) ✅ (2ª das 6 etapas do item 9, 06/08/2026)

O 2º pedaço da ordem da 6.7 era *Agenda + Notificações*. A **Agenda** entrou na 1ª etapa; aqui
entra o **sino**, no header do funil — a Agenda mostra o mês, o sino mostra o que não pode passar.

**Sem tabela, e isso é decisão.** A notificação é **derivada do fato** (a `abertura` do
negócio), igual à Agenda. Fila de mensagens guardada exigiria um processo pra criar e outro pra
expirar; no dia em que um falhasse, o sino avisaria de **sessão que já aconteceu** — pior que
não avisar. Pelo mesmo motivo **não existe "marcar como lida"**: o aviso some quando o fato some
(o dia passa, o negócio é arquivado). Um botão de dispensar deixaria alguém esconder a sessão
que abre hoje às 8h — exatamente a que o sino existe pra não deixar passar.

**Três blocos**: `abre hoje` · `abre amanhã` · `a sessão passou e o negócio continua na fase
anterior`. O terceiro só conta quem ficou em **Oportunidade/Qualificação** — quem está em
Disputa pra frente andou. É o aviso de "esqueceram de mover o cartão, ou de participar".

**O badge conta só hoje + amanhã.** Somar as atrasadas deixaria o número aceso pra sempre com
histórico velho, e badge que nunca zera é badge que ninguém mais olha.

**Duas coisas que a tela não faz:**
1. dizer *"nada abre hoje"* quando a leitura do banco **falhou** — nesse caso o sino diz
   **"não sei"**. Com a lista vazia por erro, "nenhum aviso" e "não sei" seriam a mesma tela;
2. calar sobre o que não cobre — o painel avisa que **vencimento de documento** ainda não entra,
   porque depende de **"Meus Documentos"**, que não existe no sistema (segue pendente na 6.7).

Fuso coberto pelo mesmo cuidado do funil: dia **local** derivado do `timestamptz`, nunca slice
do ISO. A suíte testa as **duas pontas do dia** (08:00 e 22:00) — sem isso, a sessão das 22h
cairia no dia seguinte e a das 8h de hoje não seria avisada.

Suíte nova `testa_notificacoes` (**30 asserts**). Total: **1.239 asserts / 0 falhas / 38 suítes**.

### 9.2 — PESQUISA AVANÇADA + ÓRGÃOS + DESERTAS ✅ (4ª das 6 etapas do item 9, 06/08/2026)

**Os filtros novos saem do que o PNCP REALMENTE entrega** — levantado dos registros já
coletados (`select jsonb_object_keys(bruto)`), não da documentação: `usuarioNome` (portal),
`modoDisputaNome`, `situacaoCompraNome`, `srp`, `valorTotalEstimado`, `orgaoEntidade`,
`unidadeOrgao`.

**O portal é o filtro que mais vale aqui.** Nos 70 registros coletados apareceram **14 portais**
(BNC, BLL, Licitanet, Compras.gov.br, Licitar Digital, SISLOG-GO, Megasoft, Prodata, CENTI…), e
o **item 8 mediu a taxa de vitória da FPMED por portal**: BNC 23,0% · LICITANET 22,9% · BLL
19,6% · GOV.BR 13,0%. Dá pra procurar oportunidade **onde a empresa historicamente ganha mais**.
A lista de opções sai do próprio resultado — fixar 19 portais na mão envelheceria sozinha.

**Decisão registrada — o refino filtra o RESULTADO, no navegador, e não vira parâmetro de
consulta.** Dois motivos, e o segundo decide: (1) o PNCP não aceita nenhum deles como filtro;
(2) empurrar só no caminho do banco criaria **dois filtros com a mesma intenção** e
implementações diferentes — é sempre esse par que diverge com o tempo. Efeito colateral bom:
trocar um filtro **não vai à rede**, numa fonte que caiu ~6× em 3 dias.

**Duas coisas que a tela não pode fazer, e não faz:**
1. **Sumir com licitação em silêncio.** Todo critério ativo vira **pill** acima da lista, e o
   resultado vazio avisa *"há refino ligado — talvez seja ele, e não a busca"*. Sem isso, lê-se
   "só tem 3 licitações hoje" quando a verdade é "3 passaram no refino de ontem".
2. **Cortar licitação SEM valor estimado** na faixa de valor — dispensa costuma vir sem
   estimado, e é justamente a oportunidade pequena que a FPMED disputa. A faixa filtra quem tem.
   *(E o portal que some do resultado volta pra "Todos" sozinho: manter a escolha zeraria a
   lista por um critério que não está mais na tela.)*

**DESERTAS — só dado declarado, nunca inferência.** Duas fontes: `situacaoCompraNome`
(Revogada/Anulada/Suspensa) e `situacaoCompraItemNome` dos itens (Deserto/Fracassado), que a
tela já lê no cruzamento. O selo **sempre** carrega o motivo no `title`.
> ⛔ **O que NÃO fiz, de propósito**: inferir deserta de *"encerrou e não tem
> `valorTotalHomologado`"*. Homologação leva **semanas** — essa regra encheria a lista de
> processo **em andamento** e mandaria alguém atrás de licitação viva achando que caducou. Um
> filtro que erra assim é pior que filtro nenhum: custa o dia de quem confiou nele.
> Consequência honesta e dita na tela: a marca por item só aparece **depois** de cruzar.

**ÓRGÃOS**: view `v_orgaos_licitantes` (`ddl/orgaos.sql`) derivada da `licitacoes` — a spec
pediu derivar "sem crawler novo". `security_invoker = on` pra herdar a RLS (senão viraria porta
lateral pra ler a tabela sem política). A tela imprime **de quantas licitações o diretório
saiu**: ele conhece o que coletamos, **não é cadastro nacional** — senão alguém conclui "esse
órgão não compra isso" quando a verdade é "ainda não coletamos". Já funciona com dado real:
ESTADO DE GOIÁS (6 licitações, R$ 10,3 mi), MUNICÍPIO DE BOM JESUS (5), ACREÚNA (4)…

Suíte nova `testa_pesquisa_avancada` (**71 asserts**). Total: **1.209 asserts / 0 falhas / 37 suítes**.

### 10.1 — COLETA AGENDADA ✅ (item 10 fechado em 06/08/2026)

**O que entrou no ar**: a edge function `coletar-licitacoes` (v2, `verify_jwt=false`, secret
`COLETA_TOKEN` configurado) + `.github/workflows/coleta-pncp.yml` (cron `0 9,15,21 * * *` UTC =
**06h, 12h e 18h em Goiás**, mais `workflow_dispatch`). Deploy sem instalar CLI nenhuma:
`tools/deploy_edge.js`, pela Management API, com o token lido do `segredos.local.txt`.

**A chave-mestra não entra no CI**: o repo é público e a `service_role` ignora toda a RLS. Ela
fica **dentro do Supabase** (a plataforma injeta no runtime) e o pipeline conhece só o
`COLETA_TOKEN` — dedicado e descartável. Se vazar, o poder dele é um: gravar licitação pública.
A porta é **fechada por padrão**: sem token configurado a função responde 500 e não coleta.

> ⚠️ **1 PASSO É DELE, e é o único** (fora do meu alcance — não há `gh` autenticado aqui):
> GitHub → `fpmed-hospitalar/fpmed` → *Settings → Secrets and variables → Actions → New
> repository secret* → **`COLETA_TOKEN`** = a linha `COLETA_TOKEN` do `segredos.local.txt`.
> Enquanto não existir, o job para na 1ª linha com mensagem clara em vez de falhar sem explicação.

**⏱️ O ACHADO DA RODADA — 429 NÃO É QUEDA.** Na **primeira coleta que de fato conversou com o
PNCP** (06/08, pela edge function), ela gravou **70 licitações** e levou **HTTP 429**. A fonte
estava **saudável**: só pediu pra desacelerar. Como o código tratava 429 como falha, **o circuit
breaker matou a rodada com a API no ar** — e a retentativa de 1s batia mais forte em quem
acabara de pedir calma.
- 429 **não passa mais pelo breaker** (ele existe pra "a fonte caiu"; aqui ela respondeu);
- o que muda é o **ritmo**: pausa entre chamadas **dobra a cada 429** (300ms → teto 8s) e **não
  volta a acelerar** na rodada — acelerar de volta só provoca o próximo 429;
- obedece `Retry-After` quando vem; sem ele, a espera começa em **5s**, não em 1s;
- teto de **20 rate limits por rodada** — cota esgotada não pode virar laço.
- **A correção não é retentar melhor, é andar mais devagar.** Corrigido nos **dois** coletores
  (edge + `tools/coleta_pncp.js`), e a suíte trava as constantes iguais nos dois: dois arquivos
  com a mesma responsabilidade que divergem viram produção se comportando diferente do teste.

**A garantia "nunca apaga" foi provada com dado real, não em teste**: a rodada seguinte pegou o
PNCP fora (timeout, breaker aberto, `coletadas: 0`) e **as 70 linhas continuaram no banco**, com
`ultima_ok` **não** avançado e `ultimo_erro` gravado. A tela mostra `📦 N do nosso banco` e
`⚠️ a última coleta falhou`, sem inventar hora de coleta.

**O CI só fica vermelho quando a falha é nossa** (HTTP ≠ 200: função fora, token errado, projeto
pausado). "O PNCP estava fora" vira **aviso amarelo** — essa fonte caiu ~6 vezes em 3 dias, e um
X vermelho diário treina qualquer um a ignorar o CI; aí o dia em que a falha for nossa passa
despercebido.

Suíte nova `testa_coleta_agendada` (**63 asserts**) + 10 novos em `testa_coleta_pncp`.
Total: **1.138 asserts / 0 falhas / 36 suítes**.

### 9.1 — FUNIL DE NEGÓCIOS ✅ (1ª das 6 etapas do item 9, concluída 06/08/2026)

**A regra de ouro que ele deu junto** (06/08): *"a planilha Calendário 2025 é COMO A FPMED
TRABALHA. O funil tem que espelhar o processo deles, não inventar um novo."* Está cumprida assim:

**MAPA OFICIAL STATUS DA PLANILHA → FASE DO FUNIL** — os 9 status foram **levantados do banco**
(2.555 linhas), não supostos. **Nenhum ficou sem destino: 2.555 de 2.555 viraram negócio.**

| status da planilha | linhas | → fase do funil | por quê |
|---|---:|---|---|
| `DESCARTADO` | 1.779 | Oportunidade *(arquivado)* | analisou e não seguiu — morreu na análise |
| `PARTICIPOU` | 693 | **Classificação** *(arquivado)* | disputou; a sessão já passou |
| `SUSPENSO` | 27 | Qualificação | parado pelo órgão, mas vivo |
| `PARTICIPAR` | 22 | **Qualificação** | decidiu entrar; preparando a disputa |
| `NAO PARTICIPOU` | 13 | Oportunidade *(arquivado)* | ia entrar e não entrou |
| `EM ANALISE` | 11 | **Oportunidade** | ainda decidindo se entra |
| `REVOGADO` | 4 | Oportunidade *(arquivado)* | o órgão revogou |
| `ADIADO` | 4 | Qualificação | remarcado, mas vivo |
| `CANCELADO` | 2 | Oportunidade *(arquivado)* | o órgão cancelou |
| **(+) qualquer linha com `VALOR GANHO` > 0** | **105** | **Contrato** | o resultado manda no estágio |

Resultado no banco: **11 ativos** no kanban · **2.544 arquivados** (histórico) · **105 em
Contrato**, dos quais 104 vieram de `PARTICIPOU` e **1 de `PARTICIPAR`** — a planilha ficou no
status de antes do resultado sair, e o dinheiro é o fato mais forte.

⚠️ **DUAS AMBIGUIDADES REGISTRADAS PRA ELE DECIDIR** (segui com um padrão documentado, não
travei a fila — e trocar depois é uma linha no `MAPA_STATUS`):
1. **`PARTICIPAR` (22 linhas) está em Qualificação. Deveria ser Disputa?** No SIGA, Disputa é a
   sessão em si; Qualificação é preparar (analisar mercado, concorrentes, definir produto).
   `PARTICIPAR` na planilha quer dizer "decidimos entrar" — antes da sessão. **Consequência
   visível: a coluna DISPUTA do kanban nasce vazia (0 de 2.555)**, porque a planilha não tem
   nenhum status que signifique "está em sessão agora" — ela é preenchida antes e depois, não
   durante. Alternativa: `PARTICIPAR` → Disputa, e o kanban abre com 3 cartões lá.
2. **`SUSPENSO`/`ADIADO` (31 linhas) estão em Qualificação** — "parado, mas vivo". A planilha
   não guarda em que fase estava quando parou, então não dá pra devolver ao estágio anterior.
   Baixo impacto: as 31 têm data passada e já entram arquivadas.

**Defeito de fuso achado e corrigido** (só aparecia com dado real): `new Date('2026-08-06') < hoje`
dá TRUE em Goiás — a string vira meia-noite **UTC** = 21h do dia anterior no fuso −03. Com isso a
licitação que abre **HOJE** — a mais urgente do funil — nascia **arquivada**. Foi o que aconteceu
com a sessão das 08:00 no BLL em 06/08. A comparação passou a ser por texto `'YYYY-MM-DD'`, que
não tem fuso, e a tela deriva o dia **local** do `timestamptz` em vez de fatiar o ISO (senão a
sessão das 22h cairia no dia seguinte da agenda).
> ⛔ **1 LINHA NO BANCO SEGUE COM O VALOR VELHO** (`negocios` id 13, arquivada por esse defeito).
> Corrigir é um `UPDATE` — **não executei, a regra da rodada pede OK**. Duas saídas: ele clica
> **"desarquivar"** no card (a tela ganhou o botão, é ação de uma linha feita por quem decide),
> ou autoriza o UPDATE. Auditoria: `node tools/semeia_negocios.js --conferir` (só leitura) —
> hoje acusa **exatamente essa 1 divergência**, e mais nenhuma.

**O que entrou na tela** (`fpmed_negocios.html`, tema escuro, `data-tema="dark"`):
- **3 visualizações do mesmo dado**: Lista · Quadros (kanban com drag-and-drop que **grava**, e
  devolve o card se o PATCH falhar) · **Agenda**.
- **AGENDA = o substituto direto do Calendário 2025**: cronológica por **DATA e HORA**, com a
  hora em coluna própria à esquerda, dia da semana no cabeçalho, **HOJE destacado em âmbar**, e
  o que já passou numa seção separada do mais recente pro mais antigo.
- **Card**: portal · modalidade · **número** · órgão · município/UF · `Abertura em DD/MM/AAAA às
  HH:MM` (com "é hoje") · badge da empresa · progresso `☑ n/15` · ações no hover.
- **Drawer de detalhe** (clique no card): seletor de estágio, ficha completa, **as 15 tarefas em
  seções por fase com progresso**, arquivar/desarquivar.
- **ANOTAÇÕES** (o que ia na coluna OBSERVAÇÃO da planilha) — campo editável que grava em
  `negocios.anotacoes`, com aviso de "copie o texto antes de sair" se o PATCH falhar.
- **A observação velha da planilha entra em bloco PRÓPRIO, só leitura**, buscada sob demanda da
  `licitacoes_acompanhadas` (954 das 2.555 linhas têm uma). **Não foi copiada pra dentro do campo
  editável de propósito**: a primeira digitação apagaria a memória que a empresa levou um ano
  pra escrever. Carregar as 954 no load da tela seria pagar por 940 que ninguém abre.
- **`valor_ganho` é de GESTOR** na tela (card, ficha e KPI), além da RLS que já restringe a
  tabela inteira. Duas camadas porque um dia a leitura pode afrouxar por uma view.

Suite nova `testa_funil_negocios` (**121 asserts**). Total: **1.075 asserts / 0 falhas / 35 suites**.

**Por que o 10 passou na frente do 9** (decisão do Lemuel, 05/08): o funil tem que nascer lendo
o banco próprio, não o PNCP ao vivo. Construir o 9 primeiro significaria construí-lo sobre uma
fonte que **caiu 3× em 2 dias** — a última confirmada por mim às ~21h de 05/08, com a tela
mostrando "não consegui falar com o PNCP". Depois seria refazer a camada de dados dele.

**Item 8 antes do 9 pelo mesmo motivo, e mais um**: as 2.578 linhas do `Calendario 2025.xlsm`
são o **histórico próprio de participação** da FPMED e **semeiam o funil** com dado real. Funil
vazio não se avalia; funil com 2.578 negócios reais, sim.

**Item 4 — o que ainda pode precisar de decisão dele**: a curadoria em 5 blocos está no
`SYNC_GLOBAL.md`. Ele liberou 2 e 4 em bloco. Se dentro deles aparecer commit que muda **regra
de negócio** (o bloco 4, "Alvos de Compra Direta", foi marcado 🟡 justamente por isso),
**listar as opções pra ele escolher** — foi o que ele pediu, não decidir sozinho.

**Item 4 — porte é com REBRAND, sempre**: checklist no `SYNC_GLOBAL.md`. Nunca portar às cegas.
`sistema_final` / `index` / `gm-auth` / `dashboard_clientes` são **porte MANUAL** (divergência
alta). ⚠️ E agora o `limedtec-config.js` também **diverge do molde de origem** (a correção do
`data-tema` de 05/08) — conferir antes de sobrescrever.

| **11** | **ABRIR_FILA.bat inicia o Claude já com "continua a fila"** | 🆕 entrou 05/08, fim da fila |

**Item 11 — o que ele pediu**: 2 cliques = fila rodando. Além do backup que já roda, o `.bat`
deve iniciar o Claude Code **já com o comando** (`claude "continua a fila"` ou equivalente que a
sintaxe do CLI aceitar), sem ele digitar nada.
⚠️ **Restrição real, registrada pra não virar teste falso**: ele pediu "fechar tudo, dar 2
cliques e confirmar que retoma sozinho". Isso **não dá pra validar de dentro de uma sessão em
andamento** — lançar o `.bat` de dentro do Claude abriria uma sessão aninhada, que é justamente
o cenário que o teste NÃO quer provar. É trabalho de fronteira: fazer a alteração, e a validação
real acontece no próximo boot dele (ou ele mesmo dá os 2 cliques e me conta).

### Histórico da ordem anterior (04/08, fim do dia)

1. 🔄 **LICITAÇÕES V1 — EM ANDAMENTO** (commit `71d313f`). Spec: `LICITACOES_SPEC.md`.
   ✅ **A API do PNCP VOLTOU** (estava 504/503 de manhã): 969 ms, 41 licitações em GO em 03/08.
   ✅ **CORS LIBERADO** direto do domínio do Pages (445 ms, HTTP 200) → **a edge function proxy
      NÃO é necessária na V1**. Menos um ponto de falha e menos custo.
   ✅ `fpmed_licitacoes.html` criado — tema claro FPMED, filtros (UF/modalidade/palavras-chave/
      data), 4 KPIs, lista ordenada por quem encerra primeiro, cache de 15 min, degradação com
      aviso, erro visível com "Tentar de novo". **A tela renderiza certa no ar.**
   ⛔ **PONTO EXATO DE RETOMADA — a busca trava em "Buscando…"**. A página carrega e os filtros
      aparecem, mas `buscar()` não retorna (o `Runtime.evaluate` estourou 45 s ao chamá-la).
      A API responde fora do browser, e o CORS está liberado — então o defeito é **meu**, no
      `buscar()`/`puxarPagina`, não no PNCP.
      **Confirmado pelo caminho real do usuário** (clique no botão, não via `javascript_tool`):
      o status muda para "consultando o PNCP…" e a lista para "Buscando…", e fica preso por
      +10 s. Ou seja, **não é artefato da ferramenta de automação** — a `fetch` dispara e a
      promise não resolve. Isso reforça a suspeita (b): alguma página do laço rejeitando e o
      `catch` não repintando a tela quando não há cache.
      **Onde olhar primeiro:** o laço `for(let p=2;p<=tp;p++)` faz até 10 páginas **em série**;
      com `tamanhoPagina=50` e 5 páginas isso deveria levar ~3 s. Suspeitas, nesta ordem:
      (a) `p1.totalPaginas` vindo alto e o teto de 10 não segurando como esperado;
      (b) alguma página respondendo 400 e a exceção caindo no `catch` que só troca a tela
          quando **não** há cache — deixando o "Buscando…" na tela;
      (c) `st.dataset.truncou` mexendo no elemento errado.
      **Como depurar:** abrir a página, `await puxarPagina({dataInicial:'20260803',
      dataFinal:'20260803',codigoModalidadeContratacao:'6',uf:'GO'},1)` no console e ver o
      retorno; depois instrumentar o laço com `console.log(p)`.
   ✅ **BUSCA DESTRAVADA** (commit `0bdf37c`) — causa raiz **medida**: a API do PNCP **não
      responde** com `tamanhoPagina=50` (fetch pendurada >45 s); com **10** responde em ~450 ms.
      O mínimo aceito pela API é 10. Junto entrou `AbortController` com timeout de 20 s em toda
      chamada (era o MESMO defeito do Dashboard que eu reintroduzi aqui — agora a guarda é
      estrutural), teto de 20 páginas com progresso na tela, e aviso quando trunca.
      ⚠️ **Não consegui o screenshot da lista populada** — o Pages ainda servia a versão antiga
      nas tentativas. **Primeira coisa da próxima sessão:** abrir a tela, clicar em Buscar
      (data 03/08/2026, GO, pregão eletrônico → esperado ~41 publicadas) e conferir.

   ⬜ **REDESIGN estilo SIGA** (spec do Lemuel, 04/08 — fazer JUNTO com a validação da busca):
      - **Topo direito**: "Período" (dropdown: data de abertura / publicação / encerramento) +
        "Intervalo" (faixa de datas).
      - **Centro-hero**: título grande **"Encontrar"** + subtítulo "Busque oportunidades de
        dispensas, pregões…" + **barra de busca grande centralizada** com lupa. Abaixo, 3 links:
        *Pesquisa avançada* (expande UF/modalidade/palavras-chave) · *Meus alertas* (o futuro
        jornal) · *Encontrar por Nº*.
      - **Cards de resultado**, um por licitação:
        · linha 1 em **azul destaque**: `MODALIDADE Nº XX/AAAA — ÓRGÃO / UF`, clicável p/ o edital
        · linha 2: o **objeto**, 2–3 linhas com reticências
        · **etiquetas verdes** com as categorias/palavras-chave que casaram
        · "Abertura em DD/MM/AAAA às HH:MM" + "Modo de disputa: …" (`modoDisputaNome` da API)
        · badges na base: "Fonte: PNCP — [órgão]" (cinza) + modalidade (azul)
        · **nosso diferencial**: badge `🎯 X itens no nosso estoque` quando o cruzamento achar
      - **KPIs discretos** acima dos resultados (os 4 que já existem).
      - **Tema claro FPMED** — não copiar o dark do SIGA: cards brancos, sombra suave, azul
        FPMED nos títulos, verde nas etiquetas.
      ✅ **Aprovação antecipada dada pelo Lemuel**: screenshot é só registro; **não parar**.
   ✅ **REDESIGN + TEMA ESCURO** no ar (`92b1a74`, `3e7a3ba`). Hero "Encontrar", régua de KPIs,
      cards com etiquetas verdes cheias, skeleton, hover, voltar-ao-topo, responsivo.
      Marca própria (cruz FPMED em CSS — o `logo_fpmed.png` é de fundo claro).

   ✅ **CRUZAMENTO POR ITEM — NO AR** (05/08, commits `36c8b53`→`a5e5580`). Validado no navegador
      real, logado como diretor, contra as 1.381 linhas do estoque: **estoque pronto 1.381 (1.266
      com preço unitário calculável)**, busca de 04/08 → 52 publicadas / 9 batem / R$ 21,4 mi,
      "Cruzar todas" leu **9 licitações** e marcou **7 com aderência**. Card de Uruaçu: **280 de
      500 itens** com equivalente nosso (o edital tem mais de 500 → aviso de teto na tela).
      - Itens sob demanda ao expandir, ou lote de 3, AbortController 20 s, cache 15 min.
      - **Paginação dos itens**: o endpoint entrega 10 por default — sem paginar, a licitação de
        65 itens devolvia 10 e o cruzamento mentiria por omissão. Vai de 100 em 100, teto 500.
      - **Unitário dos DOIS lados**: "Caixa 100 UN" a R$ 8,20 = R$ 0,082/agulha; "Frasco 1000 ML"
        é medida, não contagem; "Caixa"/"PCT" sem número → **⚠ conferir emb.** (nunca inventa).
        Orçamento sigiloso nunca vira R$ 0,00.
      - **Δ% só no match de dose conferida.** No "aproximado" mostra o nosso preço e cala.
      - 4 defeitos achados e corrigidos (3 deles só apareceram rodando com dado real):
        1. **calibre French virava pack** — "SONDA URETRAL 22FR" tinha o preço dividido por 22
           (R$ 0,03/sonda, −99,9% contra o edital). O soro "16FR" segue lendo 16 frascos.
        2. **match por 1 palavra** — "APARELHO de ar condicionado" × "APARELHO de barbear",
           "SACO de adubo" × "SACO de lixo". Ruído caiu de 411 p/ 242 pares em 789 itens reais.
        3. **volume confundido com concentração** — ACETILCISTEÍNA 40MG/ML casava com a nossa de
           20MG só porque as duas dizem 120ML. Entrou forma farmacêutica junto (comprimido não é
           injetável) e a redução "50MG/5ML = 10mg/ml".
        4. **corrida com o gm-auth** — o `gm-auth-ready` dispara ainda dentro do `<head>` quando o
           token está fresco; quem só escutava o evento perdia a carga do estoque de forma
           INTERMITENTE. Agora checa `window.gmAuth` antes de escutar.
      - Suíte nova `tests/testa_cruzamento_licitacoes.js` (63 asserts, fixtures de dado real).
        **Total do projeto: 515 asserts verdes, 0 falhas em 20 suítes.**
      ⬜ **Falta desta etapa** (entra depois da fila atual, não é bloqueio): agenda/acompanhar
        (`licitacoes_acompanhadas`, RLS gestor grava / logado lê) e os KPIs de acompanhamento.
      ⚠️ **Limite honesto do matching**: sem a CMED (item 1B) o vocabulário de princípio ativo
        tem 938 entradas e 937 linhas do estoque estão sem PA — o que casa por nome continua
        casando, mas medicamento cujo PA não existe no vocabulário depende do nome bater.

   <s>⬜ **CRUZAMENTO POR ITEM — endpoint CONFIRMADO pelo Lemuel (testado por ele):**</s>
      ```
      GET https://pncp.gov.br/api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/itens
      cnpj = orgaoEntidade.cnpj · ano = anoCompra · sequencial = sequencialCompra
      ```
      Os 3 parâmetros **já vêm em cada licitação** da busca atual — não precisa de consulta extra.
      Resposta: `numeroItem, descricao, materialOuServico, quantidade, unidadeMedida,`
      `valorUnitarioEstimado, valorTotal, situacaoCompraItemNome, dataInclusao`.

      **Regras de execução (do Lemuel):**
      1. **NÃO** buscar os itens das 41 licitações de uma vez — **sob demanda** (ao expandir o
         card) ou em lotes de **no máx. 3 simultâneos**, com o mesmo `AbortController` de 20 s
         e **cache de 15 min por licitação**.
      2. Match contra o estoque: normalizar `descricao` (maiúscula, sem acento) e casar por
         princípio ativo / nome. O badge 🎯 mostra "X itens no nosso estoque" **e lista quais**.
      3. Comparação de preço **SEMPRE unitário**: `valorUnitarioEstimado` do edital × nosso
         preço unitário (**dividido pelo pack na TELA, nunca no banco** — regra de 04/08).
      4. Normalizar o `numeroCompra` no título: `"(6128) | 32-0/2026"` → `"32/2026"`.
      5. **Rodar a suíte inteira antes do commit.**
      (As 5 regras acima foram cumpridas — ver o bloco ✅ logo acima.)
1B. ✅ **CONCLUÍDO 05/08 — TELA "TABELA CMED" NO AR** (commits `5c6a52f` → `9176688`).
   **O que ficou pronto e foi conferido no navegador real, logado como diretor:**
   - `cmed_precos` (tabela NOVA, aditiva, `ggrem` PK) com **25.702 linhas**: PMVG 19% GO em
     **100%**, PF 100%, PMC 21.824, CAP=Sim 2.722, isentos de ICMS 1.120, restrição
     hospitalar 3.884, sob análise recursal 147. Grade das **26 alíquotas** de cada régua
     (PF/PMC/PMVG) em JSONB. **Zero DELETE/UPDATE** — tabela nova + INSERT em tabela vazia.
   - **Decisão registrada**: PMVG numa tabela SEPARADA em vez de colunas na `cmed_pf`, porque
     (a) vem de outra publicação da ANVISA, com cadência própria; (b) a carga da `cmed_pf`
     **apaga a edição anterior por desenho** — PMVG morando lá seria zerado em silêncio a cada
     recarga de PF; (c) `ggrem` é 100% preenchido e único, chave de junção 1:1 confiável.
   - **Duas conferências independentes do parse**: o PF aparece nas duas listas e bate nas
     25.702 linhas; e o desconto médio PMVG/PF deu **21,53% EXATO** — o CAP da Resolução
     CMED 5/2020. Se a coluna lida fosse a vizinha da grade, esse número não fecharia.
   - View `cmed_regua` (identificação × preços) já entrega o **unitário** e o `teto_gov_unit`,
     que aplica a regra da própria lista: **com CAP o teto é o PMVG, sem CAP é o PF**. CAP não
     sabido cai no PF — teto conservador, nunca desconto inventado.
   - **Tela** (menu Ferramentas, tema claro): busca no servidor por substância/marca/
     laboratório/GGREM/EAN/registro; filtros só-com-PMVG, só-CAP, só-restrição-hospitalar e
     por tipo; card com PF/PMVG/PMC de GO + unitário, badges regulatórios, e "ver todas as
     alíquotas" com a coluna de 19% destacada.
   - **O cruzamento com o nosso estoque** (é o que faz a tela valer): **179** chaves nossas
     têm equivalente na CMED e **28 estão ACIMA do teto legal** — METILPREDNISOLONA 40MG/ML
     R$ 23,33 contra teto R$ 22,25 (+4,9%), ALTEPLASE 50MG R$ 3.668,45 contra R$ 3.538,25.
     Isso não aparecia em lugar nenhum do sistema. Sem pack no nome → "⚠ conferir emb." e a
     tela **não compara** (regra de 04/08).
   - `cmed_dicionario`: **6.283 pares marca→PA** derivados da própria `cmed_pf` (5.879 marcas,
     **2.243 substâncias** contra as 938 do vocabulário tirado das cotações). A tabela estava
     VAZIA desde sempre — era por isso que o `resolvePA` das 3 telas devolvia vazio em 100%
     das chamadas. Não era bug de código, era tabela nunca carregada.
   - **Defeito corrigido na giovana**: `carregarCmed` paginava de 2000 em 2000 e o PostgREST
     daqui corta em 1000 — teria lido 1.000 das 6.283 linhas achando que leu tudo.
   - Suíte nova `testa_cmed_precos` (34 asserts) tranca as 4 armadilhas de parse, incluindo a
     silenciosa: célula já numérica passando pelo replace de milhar viraria 653327 no lugar de
     6533,27 — cem vezes o teto, sem sinal de erro. **Total: 549 asserts / 0 falhas / 21 suítes.**
   - View `cmed_teto` criada (`ddl/cmed_teto.sql`): teto legal agregado por PA+dose, 4.875
     chaves — é o que a integração com Licitações vai consumir sem baixar 25.702 linhas.
   ⬜ **FICOU PARA O ITEM 6** (decisão registrada, não é pendência esquecida): as integrações
     "teto legal R$ X · nosso R$ Y" no Licitações e "ver na CMED" na Competitividade exigem
     casar o NOSSO estoque com a CMED pelo `doseKey`, que só existe no `sistema_final`.
     Duplicar essa função numa terceira tela seria o começo de três versões divergentes da
     mesma regra. O item 6 (Pack via CMED) precisa exatamente do mesmo casamento — então ele
     faz o cruzamento UMA vez, gravado, e Licitações e Competitividade passam a ler dali.
   ⬜ **Recarga mensal**: `tools/carrega_cmed_precos.js` (baixar as DUAS listas da ANVISA →
     rodar). Regravar por cima exige `--merge`, que é UPDATE e **espera OK do Lemuel**.

1B-old. (histórico da auditoria, mantido) — menu FERRAMENTAS, gestor+vendedor, tema claro.
   - ✅ **AUDITORIA FEITA (05/08)** — primeira etapa do item, medida contra o banco e contra a
     planilha oficial `xls_conformidade_site_20260721.xlsx` (12,4 MB, já em `C:\fpmed`):
     · **Banco**: `cmed_pf` tem **25.702 linhas** e **25 colunas** (não 23). Preenchimento numa
       amostra de 1.000: `pf_0` e `pf_go19` 100%, `pmc` 837/1000, **`pmvg` 0/1000 (sempre NULL)**.
       `cmed_dicionario` está **VAZIA (0 linhas)** — é a causa do `resolvePA` não resolver nada.
     · **Planilha oficial**: **74 colunas**, o loader usa **19**. Tudo o que a spec pediu ESTÁ lá
       e é só mapear: `CNPJ` (col 1), `REGIME DE PREÇO` (12), `PF Sem Impostos` (13), **PF e PMC
       em TODAS as alíquotas** (0/12/17/17,5/18/19/19,5/20/20,5/21/22/22,5/23, cada uma com a
       variante `ALC`), `ICMS 0%` (68), `ANÁLISE RECURSAL` (69), `LISTA DE CONCESSÃO DE CRÉDITO
       TRIBUTÁRIO (PIS/COFINS)` (70), `DESTINAÇÃO COMERCIAL` (73).
     · ✅ **PMVG CHEGOU (05/08)** — a pendência foi fechada no mesmo dia. Arquivo
       `xls_conformidade_gov_20260721_164341114 (2).xlsx` (13,2 MB) em `C:\fpmed`. **O 1B está
       DESTRAVADO.** Estrutura confirmada pelo Lemuel:
       - aba única `Planilha1`, **cabeçalho na LINHA 54**, dados a partir da 55
       - **25.702 linhas — a MESMA base da `cmed_pf`** (edição 21/07/2026), casa **1:1 pelo
         `CÓDIGO GGREM` (col 3)**
       - 74 colunas: 0=SUBSTÂNCIA · 1=CNPJ · 2=LABORATÓRIO · 3=GGREM · 4=REGISTRO · 5-7=EAN ·
         8=PRODUTO · 9=APRESENTAÇÃO · 10=CLASSE TERAPÊUTICA · 11=TIPO · 12=REGIME DE PREÇO ·
         **13-38=PF por alíquota** · **39-64=PMVG por alíquota** (39=sem imposto, 40=0%,
         **49=19% ← GOIÁS**) · 65=RESTRIÇÃO HOSPITALAR · 66=CAP · 67=CONFAZ 87 · 68=ICMS 0% ·
         69=ANÁLISE RECURSAL · 70=LISTA PIS/COFINS · 71=COMERCIALIZAÇÃO 2025 · 72=TARJA ·
         73=DESTINAÇÃO
       ⚠️ **Armadilhas de parse (ditadas pelo Lemuel, não descobrir do zero):**
       1. valores vêm com **ASTERISCO no fim** (`"6533,27*"`) — marcador de nota da CMED,
          **tirar o `*` antes de converter**;
       2. decimal com **vírgula** (`"21,53"`);
       3. **PMVG 19% preenchido nas 25.702 linhas** (ele conferiu) → popular `cmed_pf.pmvg` com a
          alíquota **19% (GO)** e guardar também **`pmvg_0` e `pmvg_sem_imposto`** se a DDL deixar;
       4. **`CAP = "Sim"`** = medicamento com **desconto obrigatório pro governo** → merece
          **badge próprio** na tela CMED **e no cruzamento do Licitações**.
       5. fila em ordem e **suíte inteira antes do commit**, como sempre.
     · 💡 **Achado de valor colateral**: a `cmed_pf` tem 25.702 pares `subst_norm` (princípio
       ativo) × `marca_norm`. Isso é um vocabulário de PA **muito maior que os 938** tirados das
       cotações, e dá pra **preencher a `cmed_dicionario` (marca→PA) derivando dela**. Resolve os
       **302 medicamentos sem PA** do estoque (limite honesto registrado em 04/08) e melhora de
       tabela o matching do Licitações. Vale fazer junto com o loader.
   - ⬜ **Estender o loader** (`tools/carrega_cmed_pf.js`) com as colunas acima + DDL da `cmed_pf`.
   - **Tela**: busca por substância/produto/marca/laboratório/GGREM/EAN; resultado com
     apresentação, laboratório, tipo, PF/PMC/PMVG por alíquota (destaque no ICMS de GO),
     restrição hospitalar, CAP. Filtros: só com PMVG · só restrição hospitalar ·
     genérico/similar/referência.
   - **Destacar o PMVG** — é o teto legal de venda ao governo nas licitações.
   - **Integrações** (é o que faz valer): no Licitações, mostrar "teto legal R$ X · nosso R$ Y"
     junto do cruzamento por item; link "ver na CMED" na Competitividade e nas Propostas;
     **alerta se preço nosso > PMC** (risco regulatório).
   - **Atualização mensal**: documentar `baixar xls da ANVISA → node tools/carrega_cmed_pf.js`
     e exibir a edição vigente na tela ("dados CMED de julho/2026").

2. ✅ ~~Investigação do "Carregando…"~~ — **JÁ FEITO** (commit `aa6177d`): eram 2 cargas
   concorrentes de `cotacoes` (18 requests p/ 9 páginas) + `recarregarCotacoes` que não
   re-renderizava. Promise em voo compartilhada + erro visível + timeout de 25s.
   Sobrou 1 ponto: `autoRefreshEstoque` manda `force=true` e ignora o cache de 60s — cortar
   isso elimina as 9 requests extras, mas é decisão de negócio (a Competitividade quer fresco).
3. ✅ **CONCLUÍDO 05/08 — Comparativo SIMPLIFICADO** (commits `e64335d` → `611b002`, no ar).
   - As 5 colunas de análise (média de mercado, seu preço, melhor fonte, Δ vs melhor, vale
     comprar) saem por padrão; voltam no botão **"ver análise"**. Nada removido do código.
   - Célula do estoque FPMED **com saldo** ganhou fundo azul forte + faixa lateral.
   - **Teste que o Lemuel mandou fazer: PASSA.** CEFALOTINA 1000MG (CEFARISTON) 100FRS/AMP,
     und "CX", R$ 475,25 → **R$ 4,75 · un · cx100**. Conferido no navegador.
   - **O defeito de fundo**: `precoUnitario()` dividia por `qtdEmbalagem` sempre, e quando o
     pack não era detectado o divisor valia 1 — mas esse 1 significava "não achei o pack", não
     "a caixa tem uma unidade". O preço da CAIXA ia pra célula do unitário sem sinal nenhum.
     **112 linhas** estavam assim. `precoUnitario` foi REMOVIDA (com lápide explicando por que
     não voltar); quem substitui é `cmpUnitario()`, que sabe responder "não sei".
   - **Dois avisos distintos**, porque a ação é diferente: **"⚠ conferir emb."** (82 linhas —
     unidade agregadora sem contagem no nome: olhar a embalagem) e **"⚠ parece caixa"**
     (55 linhas — o cadastro tem preço de caixa no campo unitário: corrigir o cadastro).
     Os dois saem de mínimo, média, win rate, PDF e análise.
   - A regra do "parece caixa" **SINALIZA, não corrige**. Num falso positivo, corrigir em
     silêncio faria um preço legítimo parecer 100x mais barato, virar "o menor da linha" e
     mandar comprar no fornecedor errado. Exige **evidência dupla**: o nome declara o pack E o
     preço dividido por ele cai em cima da **mediana** do grupo.
   - **3 defeitos meus corrigidos antes de fechar, os 3 só visíveis com dado real:**
     1. cascata — eu lia o preço dos vizinhos depois de já ter corrigido alguns, e a correção
        virava a nova "referência de mercado" (uma ampola de dipirona de R$ 0,56 → R$ 0,0056);
     2. **mínimo** como referência — uma linha já errada pra baixo entregava o grupo todo;
        virou **mediana**;
     3. `_qtdDoNome` lia o "3" de "3,5ML" como pack de 3 (CEFTRIAXONA R$ 13,26 → R$ 4,42):
        faltava no `m2` o lookahead de decimal que o `mC` já tinha. **Isso afetava o pack em
        todas as telas**, não só aqui.
   - Porte do **calibre French** do Licitações: "SONDA URETRAL 22FR" tinha o preço dividido
     por 22 no Comparativo. O soro "500ML S/F 16FR" segue lendo 16 frascos.
   - Suíte nova `testa_comparativo_unitario` (49 asserts, 8 deles do que a regra **não** pode
     fazer). **Total: 598 asserts / 0 falhas / 22 suítes.**

3-old. (spec original, mantida como referência) — spec do Lemuel (04/08):
   - **A tela vira só comparativo de preço**: `PRODUTO/PA | NOSSO (estoque FPMED) | preço de
     cada FORNECEDOR | menor preço em verde`. Recolher para uma expansão opcional
     **"ver análise"**: "Seu preço sugerido", "Melhor fonte", "Δ vs melhor", "Vale comprar"
     e o scorecard. (Não apagar — o bug da Melhor Fonte acabou de ser corrigido em `091ece8`
     e a lógica continua valendo dentro da expansão.)
   - **TUDO SEMPRE UNITÁRIO**, nunca preço de caixa em célula nenhuma. Badge discreto do pack
     quando dividir: `un · cx100`. Valor com cara de caixa **sem pack identificável** →
     `⚠ conferir emb.` no lugar do número cru.
   - **Destaque do estoque**: célula do estoque FPMED com fundo azul-claro forte quando há
     saldo, + selos "Em estoque"/"PROMO" no nome.
     ✅ **JÁ EXISTE NA FPMED, nada a portar** — conferido 04/08: os selos PROMO e "Em estoque"
     são idênticos aos da Global (FPMED L1733/1734 e L2645 × Global L3612/3613 e L4885).
     **Falta só o fundo azul-claro da célula**, que é coisa nova, não porte.
   - Manter busca, filtro "Só Estoque FPMED" e seleção/exportação.
   - **Teste obrigatório**: CEFALOTINA 475,25 → **4,75 un · cx100**. Screenshot antes/depois.
4. 🟢 **LIBERADO 05/08 — Blocos 2 e 4** do sync de código, **com verificador de rebrand**.
   **É O PRÓXIMO DA FILA.** Bloco 2 peça 1/N já entrou (`091ece8`, bug da Melhor Fonte).
   Faltam: filtro "Só Estoque GLOBAL", `estoque_em` (tem DDL), dropdown/filtro de fornecedor em
   Cotações, Comparativo por família, Itens a Cotar, vacina de cache. **Bloco 4** = Alvos de
   Compra Direta (~6 commits, 🟡 marcado como decisão de negócio).
   📌 **Regra que ele deu junto**: se aparecer escolha específica dentro dos blocos,
   **listar as opções pra ele decidir** — não decidir sozinho.
   ⚠️ Ao portar, conferir que `limedtec-config.js` **diverge do molde de origem** desde 05/08
   (guarda `data-tema`, ver seção da regressão no `CONTINUAR_AQUI.txt`) — não sobrescrever.
5. ✅ **CONCLUÍDO 05/08 — Estoque 0 → 1 no FLUXO**. A regra valia no DADO desde 04/08 (781
   linhas no seed) mas não no FLUXO — o próximo relatório de estoque desfazia tudo em silêncio,
   e as 781 voltavam a 0 no primeiro import. Regressão que ninguém vê acontecer.
   - **Tela Atualizar Estoque**: aplicada num ponto só, DEPOIS dos dois parsers (formato novo e
     antigo). Dentro de cada parser, o dia em que entrar um terceiro formato ela escapa.
   - **Visível no preview**: "1️⃣ N vieram com 0 e entram com 1". Regra silenciosa é regra que
     ninguém confere.
   - `tools/le_estoque_fpmed.js`: helper `estoqueGravar()` exportado; `estoqueBruto` fica
     intacto ao lado, pra auditoria responder "o relatório dizia 0 ou dizia 1?".
   - **NEGATIVO também vira 1** (saldo negativo é erro de inventário, não "menos que zero de
     item"). **`null`/vazio NÃO vira 1**: "não informado" ≠ "informou zero" — devolve null e o
     campo fica intacto no banco em vez de virar 1 por otimismo.
   - **NÃO se aplica à zeragem de ausentes**: lá o operador marca item por item e confirma num
     diálogo que diz "vai ZERAR". Transformar aquilo em 1 faria a tela mentir sobre o que fez.
   - **Defeito pego pelo próprio teste**: `0,4` truncava para 0 e escapava da regra pela porta
     dos fundos — a ordem estava invertida (testava `<= 0` antes de truncar).
   - Suíte nova `testa_estoque_zero_um` (17 asserts, 4 deles lendo o HTML pra provar que a
     regra está na TELA e no lugar certo do fluxo). **Total: 615 asserts / 0 falhas / 23 suítes.**
6. 🟡 **PARCIAL 05/08 — Pack via CMED**. Entregou a parte sólida e **parou onde o dado não
   sustenta**; a parte que falta virou decisão do Lemuel, não pendência técnica.
   - ✅ **"1 + recipiente" declarado no nome vale como pack 1** — `_CMP_UM_DECLARADO` no
     `sistema_final`. "OMNISCAN 287MG/ML **1FR/AP** 10ML" diz com todas as letras que vem UM
     frasco-ampola, mas o `_qtdDoNome` só devolve contagem quando é > 1 (senão "1AMP" e "não
     achei" ficariam indistinguíveis) — então esses itens caíam em "não sei". O 1 escrito no
     nome é INFORMAÇÃO, e é mais específico que a `und` "CX", que ali é o default do ERP.
     **Medido: 112 → 85 linhas sem pack. ZERO falso positivo** entre as 8.720 que já tinham
     pack (o `[^\d]` antes do 1 é o que impede "51FR" de virar "1 FR"). 12 asserts novos.
   - ✅ Tabela `pack_confirmado` criada (`ddl/pack_confirmado.sql`) com `fonte`
     (cmed/web/manual), `evidencia` e `confianca` — sem `evidencia`, daqui a três meses
     ninguém sabe se o pack veio de dado oficial ou de chute. **Vazia por ora.**
   - ⛔ **O casamento por PA+dose contra a CMED foi DESCARTADO, e o preview com dado real é a
     razão**: "OMNISCAN 1FR/AP 10ML" recebeu pack **10**, vindo da apresentação "CT 10 FA X
     10 ML". Essa apresentação é a **caixa do fabricante**; o nosso item é UM frasco. PA+dose
     descreve o MEDICAMENTO, não a EMBALAGEM que o distribuidor nos vendeu. Aplicar aquilo
     teria dividido o preço por 10 — exatamente o erro que a tabela existe pra evitar.
     Determinar pack pela CMED só é seguro por **GGREM ou EAN**, e o nosso cadastro não tem
     nenhum dos dois. `tools/resolve_pack_cmed.js` fica como ferramenta de CONFERÊNCIA: roda
     em preview, lista candidatos, e **recusa gravar** sem `--confirmado-pelo-lemuel`.
   - ⬜ **Camada 2 (busca web)**: não construída.
   - 📋 **PRO CHECKPOINT**: as 85 restantes são material cirúrgico (pinça, tesoura, porta-agulha,
     bobina, papel lençol) e itens de dose única. Duas saídas, e as duas são decisão dele:
     (a) capturar EAN/GGREM no cadastro, que resolve de vez e serve pra outras coisas; ou
     (b) conferir as 85 na mão uma vez e gravar em `pack_confirmado` com `fonte='manual'`.

6-old. (spec original) — resolver o pack dos itens sem contagem no nome casando com a
   apresentação oficial da `cmed_pf` (camada 1) e busca web (camada 2). Tabela
   `pack_confirmado` (produto → pack, fonte, data). **Não alterar preço no banco** — a tela
   usa o pack e divide só na exibição. Preview antes de ativar.
7. ✅ **CONCLUÍDO 05/08 — PDF de proposta**.
   - **Bug da coluna PREÇO UNIT corrigido**: saía cru (`0.2556`) porque era `precoUnit.toFixed(4)`.
     ⚠️ **A Global tem o MESMO bug** — não havia o que portar, a formatação foi decidida aqui.
   - **`fmtBRLUnit()` existe separado do `fmtBRL` por conferência, não estética**: item que vem em
     caixa grande tem unitário de centavos (agulha a R$ 0,0056). Arredondado pra 2 casas vira
     "R$ 0,01" e **a linha para de fechar na frente do cliente** — 0,01 × 100 = R$ 1,00, mas o
     Preço CAIXA impresso na mesma linha diz R$ 0,56. Quem vê a inconsistência é ele.
     Regra: 2 casas a partir de R$ 0,10 (o caso normal, e o que o Lemuel pediu: 0,2556 → R$ 0,26);
     abaixo disso até 4 casas cortando zero à direita ("R$ 0,082", não "R$ 0,0820").
   - **Quadro "⚠ OBSERVAÇÕES" portado da Global**: IA + estoque rotativo, entre a nota "* Preço
     Unit" e o "Prazo para entrega a combinar". O aviso vive no CÓDIGO, não no banco — se
     dependesse de um registro, uma proposta nova sairia sem ele, que é o caso em que mais importa.
   - Campo de **observação adicional** do vendedor na tela, com o aviso padrão visível ao lado
     (ele precisa saber o que vai sair). O texto entra por `textContent`, nunca `innerHTML`.
   - Suíte nova `testa_pdf_proposta` (32 asserts, 2 deles guardando a REGRA DE OURO: o PDF do
     cliente não mostra fornecedor nem custo). **Total: 647 asserts / 0 falhas / 24 suítes.**

7-old. (spec original) — portar da Global: caixa "⚠ OBSERVAÇÕES" (IA + estoque rotativo)
   antes do "Prazo para entrega a combinar", conferir rodapés e a nota "* Preço Unit".
   **Bug conhecido**: a coluna PREÇO UNIT sai crua (`0.2556`) em vez de `R$ 0,26` — formatar
   em pt-BR como na Global. Testar com 1 item e com vários.
8. ⬜ **`Calendario 2025.xlsm`** (entrou no FIM da fila em 05/08, a pedido do Lemuel).
   Arquivo em `C:\fpmed`, planilha COM MACROS. Regra combinada, em duas fases:
   - **FASE 1 — SÓ EXPLORAR, não grava nada.** Leitura em modo somente-leitura, sem calcular
     fórmula e sem executar macro. Entregar: **mapa de abas** (incluindo as **ocultas** e as
     "muito ocultas"), colunas de cada uma, contagem de linhas, **amostra de linhas** e uma
     **proposta de destino** (qual tabela/tela isso vira, ou se não vira nada). Nada de banco,
     nada de UPDATE, nada de tela — só o relatório.
     ✅ **FASE 1 EXECUTADA (05/08)** com `tools/explora_calendario.js` — nada gravado.
     ⚙️ O explorador **não abria o arquivo**: ler o workbook inteiro (49,7 MB) passava de **15
        minutos** sem terminar. O custo é o parse de CÉLULA, não o unzip. Passou a ler com
        `sheetRows:25` e a tirar a dimensão real do `!fullref` → **abre em 3,9 s** sem perder a
        contagem de linhas. Sem macro de verdade no arquivo (`vbaraw` ausente).
     **3 abas:**
     | aba | estado | tamanho | o que é |
     |---|---|---|---|
     | `AGENDA` | visível | **2.578 linhas × 16 col.** | **o achado** — a agenda de licitações da FPMED |
     | `CADASTRO` | visível | 25 linhas (vazia) | o formulário de entrada que alimenta a AGENDA |
     | `Planilha1` | **OCULTA** | 10 linhas | rascunho de UM pregão (EBSERH Florianópolis, contraste) |

     **Colunas da AGENDA**: `STATUS` (EM ANALISE / PARTICIPAR / …) · `ABERTURA` (serial do Excel,
     ex. 46240) · `HORA` (fração do dia) · `MOD.` (P.E. / D.L.) · `Nº COMPRA` · `NUMERO` (nn/aaaa)
     · `PORTAL` (BLL / COMPRAS PUBLICAS / PROPRIO …) · `CIDADE` · `UF` · `ORGAO` · `OBJETO`
     · **`VALOR GANHO`** · `OBSERVAÇÃO` · `DIA` · `MÊS` · `ANO`.

     💡 **PROPOSTA DE DESTINO** — isto é exatamente a tabela que faltava no módulo Licitações:
     as 2.578 linhas são o **histórico próprio de participação** da FPMED (o que acompanhou, o
     que disputou, em que portal, por qual órgão e **quanto ganhou**). Proposta:
     1. Vira a **`licitacoes_acompanhadas`** (tabela que já estava prevista no item 1, RLS gestor
        grava / logado lê), com `origem='calendario_2025'` pra separar do que a tela gravar.
     2. Alimenta um KPI real na tela de Licitações: **taxa de participação e de vitória por
        órgão/portal/modalidade** — o embrião do "Análise de Empresas" do SIGA (item 9), só que
        com o nosso próprio histórico, que é dado que o SIGA não tem.
     3. Converter na carga: `ABERTURA` serial → data ISO; `HORA` fração → HH:MM; `VALOR GANHO`
        pt-BR → numérico; `NUMERO` pelo mesmo `numCompra()` já testado no Licitações.
     ⛔ **Espera OK do Lemuel** — a FASE 2 (gravar) não começou.
     🔒 `*.xlsm` **entrou no `.gitignore`** (a regra cobria `.xlsx`/`.xls` mas não `.xlsm`: o
        arquivo com `VALOR GANHO` estava a um `git add -A` de ir pro repo **público**).
   - 🟢 **FASE 2 — LIBERADA em 05/08 pelo Lemuel.** Pode gravar as **2.578 linhas**.
     Condições que ele deu junto: **backup antes** e **relatório do que entrou**.
     Preview antes da escrita, como em toda carga do projeto.
     Destino: `licitacoes_acompanhadas` com `origem='calendario_2025'` (separa do que a tela
     gravar depois). Conversões na carga: `ABERTURA` serial Excel → data ISO · `HORA` fração →
     HH:MM · `VALOR GANHO` pt-BR → numérico · `NUMERO` pelo `numCompra()` já testado.
     📌 **Semeia o funil (item 9)** — é por isso que vem antes dele na fila.
     🔒 O `.xlsm` continua no `.gitignore`: tem `VALOR GANHO` dentro e o repo é público.
   - ✅ **Guarda cumprida**: `*.xlsm`/`*.xlsb` no `.gitignore`; o relatório acima descreve
     estrutura, não reproduz valor nem cliente.

9. 🟡 **SIGA COMPLETO — 5 abas** (entrou no fim da fila em 05/08). **1ª etapa (Funil) CONCLUÍDA
   06/08 — detalhes na seção 9.1 acima.** Estudo do Lemuel registrado no
   `LICITACOES_SPEC.md`: **seção 5** (módulo Análise em detalhe) + **seção 6** (produto inteiro,
   aba por aba: Oportunidades · Negócios · Análise · Disputa · Jurídico + telas transversais).
   **Ler a seção 6.0 antes de estimar** — boa parte da aba 1 JÁ ESTÁ NO AR e não deve ser
   reconstruída. Ordem recomendada na 6.7:
   - **1º NEGÓCIOS / Funil + Tarefas** ✅ **FEITO 06/08** — kanban de 5 estágios, 15 tarefas-modelo
     automáticas, drawer de detalhe, semeado com as 2.555 linhas do item 8. Ver seção 9.1.
   - **2º Agenda + Notificações** 🟡 **a AGENDA foi junto no 06/08** (eventos DERIVADOS da
     abertura dos negócios, sem tabela de evento manual). **Falta**: os eventos de validade de
     documento (dependem de "Meus Documentos", que não existe) e as NOTIFICAÇÕES.
   - **3º Meus Jornais** 🟡 busca salva + cron; o e-mail exige provedor (**custo, decisão do Lemuel**).
   - **4º Pesquisa avançada completa + Órgãos + Desertas** 🟡 incremento na tela atual.
   - **5º ANÁLISE** 🔴 **bloqueado** até achar o endpoint de **resultados/atas do PNCP**.
   - **6º JURÍDICO** 🔴 é projeto de coleta de acervo, não tela.
   - **DISPUTA (robô de lances)** ⛔ fora do escopo web (app desktop Windows) — o próprio Lemuel
     concluiu o mesmo. Antes de qualquer investimento, checar os **termos de uso do Comprasnet**
     sobre automação de lances: se for vedada, invalida o esforço inteiro.

10. ⬜ **LICITAÇÕES: COLETA AGENDADA + BANCO PRÓPRIO** (decisão do Lemuel, 05/08 — o PNCP caiu de
    novo, confirmado por fora, timeout até de outro servidor). Resolver como o SIGA resolve.
    1. ~~Tabela `licitacoes_pncp`~~ → **tabela `licitacoes` com coluna `portal`/`origem`**
       (campos da busca atual + itens quando já cruzados). **RLS: logado lê, `service_role` grava.**
       📡 **Mudou por causa do achado do Lemuel (05/08, interceptação de rede no SIGA)**: o SIGA
       atende TODOS os portais com **um endpoint só** (`POST /app/api/oportunidades`), com o
       portal virando **filtro**, não rota — ou seja, a base deles é uma tabela normalizada com
       coluna de origem. Nascer `licitacoes_pncp` nos obrigaria a migrar no dia em que entrar
       Comprasnet Goiás ou Licitanet (V2). Custa nada acertar agora.
       O coletor precisa **gravar o portal de origem em cada linha**, senão o filtro equivalente
       não existe do nosso lado. Detalhes na **seção 2.0 do `LICITACOES_SPEC.md`**.
    2. Coletor `tools/coleta_pncp.js`: busca GO (e UFs vizinhas), modalidades que usamos,
       **upsert por (cnpj, anoCompra, sequencial)**. Tolerante a queda: retry e, se o PNCP estiver
       fora, **mantém o que já tem** (nunca apaga).
       📡 **Requisitos que o achado de 05/08 acrescenta** (bundles `useSuperCrawlRotinas` /
       `useSuperCrawlRealtime` no SIGA — é serviço de coleta agendada, seção 2.0B do SPEC):
       · **backoff exponencial** no retry — insistir de imediato numa API que caiu só piora;
       · **circuit breaker**: PNCP fora → o worker PARA e volta depois, em vez de ficar batendo.
         Sem isso uma queda longa vira loop e conta de execução;
       · **sync incremental** pelos filtros de data da própria API — reprocessar tudo toda vez é
         o jeito garantido de bater em rate limit e ficar mais lento a cada mês.
       · o `useSuperCrawlRealtime` é a tela de **Disputa** (sessão ao vivo no Comprasnet) —
         **fora do nosso escopo**, decisão já tomada. Dos dois serviços, só o de rotinas serve.
    3. Agendar via **GitHub Actions** (cron 3×/dia) ou no `ABRIR_FILA.bat` como fallback.
       ✅ **DECIDIDO PELO LEMUEL (05/08)**: a gravação é feita por uma **EDGE FUNCTION**, chamada
       pelo Actions com um **segredo dedicado e descartável**. **A `service_role` NUNCA vai pro
       CI.** Se o segredo do Actions vazar, o estrago é só o que a função sabe fazer (gravar
       licitação pública) — não o banco inteiro. Precedente pronto: a `ler-pedido` já está no ar
       com trava de origem desde 22/07.
    4. A tela passa a **LER DO SUPABASE** (instantâneo, nunca cai) com aviso "dados coletados às
       HH:MM". Botão **"Atualizar agora"** tenta o PNCP ao vivo e, se falhar, avisa sem travar.
       ⚠️ **A linha que compra a estabilidade inteira**: a API que a tela consome lê SÓ do banco
       próprio e **nunca** chama o PNCP de forma síncrona durante a busca do usuário. É isso que
       isola o usuário da instabilidade da fonte — não o cache, não o timeout.
       🔎 Busca textual: **full-text do Postgres** resolve na nossa escala. Elasticsearch/Meilisearch
       são a resposta certa pro volume do SIGA (~20 fontes, Brasil inteiro) e seriam infra a mais
       pra manter aqui. Se a busca ficar lenta, o **índice GIN** é o primeiro degrau, não a troca
       de motor.
    5. Cruzamento continua igual, rodando sobre os dados do banco.
    6. Suíte inteira antes do commit. **Compliance: dado do PNCP é público** — pode ficar no banco
       FPMED sem restrição (não é dado comercial de ninguém, não cruza Global↔FPMED).
    📡 **A urgência SUBIU com o achado de 05/08**: o SIGA nunca chama portal nenhum do
    navegador — quem fala com os portais é o backend deles. Somado ao histórico que o produto
    entrega (desertas, análise de empresas, histórico de compras), é base coletada, não consulta
    ao vivo. **Ou seja: a fragilidade que a gente sente hoje — tela inútil quando o PNCP cai —
    é exatamente a que eles já eliminaram, e o item 10 é o que nos tira dela.** Isso não é
    novidade de rumo: é a confirmação de que a decisão que já estava tomada é a certa.
    ⚖️ O endpoint deles serve como **referência de arquitetura**, não como fonte: é backend de
    produto pago de terceiro. A nossa fonte é e continua sendo a API pública do PNCP.

    📌 **Estado atual, pra calibrar a urgência**: a tela **não trava** hoje. O `AbortController` de
    20 s + o cache de 15 min já fazem ela mostrar "⚠️ Não consegui falar com o PNCP" com botão
    "Tentar de novo", e ela reaproveita a última busca em cache quando existe. O que o item 10
    muda é ela deixar de ficar **inútil** quando o PNCP cai — passa a ter dado sempre.
    ✅ *(A dúvida de segurança que estava aberta aqui foi resolvida — ver o passo 3.)*

## ⬜ PENDENTES (na ordem)
- [x] **Sync de dados EXECUTADO (04/08, com OK do Lemuel)**: **13.406 novos + 149 atualizados +
      7.267 pulados**. Backup completo antes (`backups/backup_2026-08-04_1528`). Filtros master
      íntegros: **0 linhas GLOBAL no lote**, só a tabela `cotacoes`, zero cliente/prospect.
      Banco: 8.832 → **22.238 cotações** (1.381 estoque próprio + 20.857 distribuidor, 50
      fornecedores). Auditoria pós-sync: `tipo='global'` indevido em linha de distribuidor = **0**.
      Suíte 371 verde. Novos por fornecedor: SANTA CRUZ 8.743 · MCW 2.501 · EB 1.885 · SUPERMEDICA
      161 · resto ~116.
- [ ] ⏸ **Sync de CÓDIGO — 169 commits pendentes da Global** (base `e7501e0` → head `5547d61`,
      22/07→03/08). Preview + **curadoria em 5 blocos FEITA 04/08** (`SYNC_GLOBAL.md`), esperando
      o Lemuel escolher os blocos. Resumo: 🟢1 motor/Propostas (~55 commits, tem bug de faturamento)
      · 🟢2 telas de análise (~25) · 🟡3 CMED (~10, decisão) · 🟡4 Alvos de Compra Direta (~6,
      decisão de negócio) · 🔴5 não portar (rebrand DARK da Global + dado do banco deles).
      Divergência medida: giovana +2.007 linhas, sistema_final +3.580.
- [x] **Porte manual da Competitividade + Comparativo** (24/07, commit `7af9021`): upgrades da
      Global (005cb75/7cc5b87/e7501e0) portados com tema claro reaplicado — giro/impacto R$/mês,
      botão "fila de cotação", curadoria+regra revisar; Comparativo com heatmap/scorecard win-rate/
      Δ vs melhor/drill-down; rolagem 70vh + sticky + barra espelho. Drill-down blindado (histórico
      não capturado ainda → "sem histórico"). Testado no ar (console limpo). Competitividade fica
      VAZIA até carregarem o estoque próprio FPMED (é a base da tela).
- [ ] **Vendedoras** (`role: vendedora`/`giovana_only`): criar quando o Lemuel definir a equipe.
- [ ] **Domínio próprio** `sistema.fpmed.com.br` (CNAME no Pages) — pós-venda.
- [x] **Clientes & Oportunidades — bug + tema** (22/07): forEach corrigido na raiz (cdArr()
      valida Array.isArray + erro amigável + estado vazio), tema claro aplicado. Console limpo.
- [x] **1º SYNC de código da Global** (22/07, commits `3473800`+`8381ca9`): 11 commits na giovana
      (score de confiança FASE 3 com "Confirmar match", datas UTC, fuzzy, qtd/PA), FORMA na vendas,
      `_cmpQuando` no sistema_final, **MKP 32%** (exceção: custo-ref GLOBAL segue ÷1,25),
      suíte tests/ portada (6 suítes, 110 asserts verdes). Marcador `ultimo_sync: e7501e0`.
      Fora em definitivo: portal de cards (entrada direta) e importador PDF CLI (upload no browser).
- [x] **Varredura de marca** (22/07, commit `3fb4782`): favicon FPMED (cruz SVG data-URI) nas
      10 páginas; coração da Global substituído pela cruz oficial na Competitividade (tela + PDF);
      zero referência ao Supabase/GitHub da GlobalMed em *.html/*.js.
- [x] **Atualizar Estoque FPMED — segurança** (22/07): modal "digite ATUALIZAR", backup
      automático + desfazer (5 snapshots, tabela `estoque_backup`), trava de relatório parcial
      (<30%), upload de PDF direto (pdf.js local + fallback IA). Testado ponta a ponta, banco limpo.
- [x] **Menu limpo** (22/07): sem Comissões Isa / Vendas Externas / Cotação p/ Cliente /
      Oportunidades antiga; "Giovana"→"Propostas"; Global→FPMED em todo texto visível.
- [x] **dashboard_clientes**: demo 100% fictício + HISTÓRICO DO GIT REESCRITO (filter-branch +
      force push, 22/07) — clone limpo verificado, zero CNPJ real em qualquer commit.
- [x] **SEED de cotações** (22/07, autorizado): 7.451 cotações de distribuidor do GlobalMed →
      `cotacoes` FPMED. Zero GLOBAL (517 excluídas), zero cliente/prospect, `venda_loja` zerada,
      45 fornecedores, `fornecedor_nome` backfilled + normalização no app. Dashboard/Competitividade
      populados.
- [x] **Edge function `ler-pedido` — ✅ 100% NO AR** (22/07): deployada (Verify JWT OFF), trava de
      origem ativa (só `fpmed-hospitalar.github.io` / `sistema.fpmed.com.br`; resto 403 sem gastar
      crédito), secret `ANTHROPIC_API_KEY` colado pelo Lemuel, **teste ponta a ponta OK** (Claude
      respondeu). v4 (22/07, decisão de custo): modelo padrão e chamadas dos HTML em
      `claude-haiku-4-5` (fallback `claude-haiku-4-5-20251001`) — o sonnet-4 antigo foi
      APOSENTADO 15/06/26. ⚠️ curl de teste precisa de header Origin; `file://` não funciona (usar Pages).
- [x] **Usuários de login criados** (22/07, via Admin API): `lemuelempresas7@outlook.com` e
      `comercial@fpmed.com.br`, ambos `role: admin`, e-mail confirmado, senha inicial definida
      pelo Lemuel (NÃO gravada no repo) com `user_metadata.senha_temporaria: true` (marcador —
      o Supabase não tem flag nativa de troca obrigatória; trocar no 1º login via "trocar senha"
      do app). Login por senha testado OK (token emitido, role admin). Vendedoras: criar depois,
      quando o Lemuel definir a equipe.
- [x] **Tabelas criadas** no banco novo (12 tabelas/views, `db_schema.sql`). Todas retornam HTTP 200
      via REST com a anon key.
- [x] **RLS LIGADA + testada** (`db_rls.sql`): RLS on + policy `authenticated` em todas as tabelas,
      views com `security_invoker`. Testado: anon INSERT→401 e SELECT→`[]` (bloqueada); `authenticated`
      insere/lê (policy ok). Pré-condição de deploy #6 ✅ SATISFEITA.
- [x] **Deploy (#11) — ✅ SISTEMA NO AR** (22/07/2026): repo PÚBLICO, GitHub Pages ativo em
      `https://fpmed-hospitalar.github.io/fpmed/`. Supabase Auth configurado: Site URL =
      URL do Pages; Redirect URL do `reset-senha.html` adicionada. **Smoke test OK**: 10 páginas
      HTTP 200, gm-auth apontando pro banco FPMED (zero banco antigo), razão social real servida,
      zero placeholder/GlobalMed no ar, login renderizando, zero erro de console, splash→painel
      redirecionando. Pendente pós-venda: domínio `sistema.fpmed.com.br` (CNAME).

- [x] **Backup próprio da FPMED** (04/08): `.claude/hooks/backup_tabelas.js` criado (era a pendência
      aberta desde 21/07 — "criar o próprio quando o Supabase existir"). Só GET, service_role lida
      do `segredos.local.txt`, pagina em **1000** (limite do PostgREST da FPMED), grava JSON em
      `backups/` (gitignored). 11 tabelas cobertas. Testado: cotacoes 7.451 + 10 tabelas vazias,
      zero erro. `ABRIR_CLAUDE_TOTAL.bat` passa a rodar o backup sozinho antes de cada rodada total.

## ✅ DESBLOQUEADA (22/07/2026)
- [x] **Dados de registro da FPMED aplicados**: FPMED DISTRIBUIDORA DE PRODUTOS HOSPITALARES
      LTDA · CNPJ 47.110.418/0001-15 · IE 10.947.387-9 · RUA 09, S/N, QUADRA 55 A, LOTE 0002,
      VILA BRASILIA, APARECIDA DE GOIANIA/GO, CEP 74.911-080 · WhatsApp comercial
      (62) 98147-9532 · fixo (62) 3290-4241 · comercial@fpmed.com.br. Placeholders trocados
      (giovana 3 blocos + sistema_final 11 pontos), URLs do GitHub antigo trocadas
      (painel raw/zip + gm-auth recover → `fpmed-hospitalar/fpmed`). Varredura final:
      **zero placeholder `[...]` / zero dado da GlobalMed** nos *.html/*.js.

## 🔒 PRÉ-CONDIÇÕES DE DEPLOY (tarefa #11 — travar o push público até resolver)
1. ✅ FEITO (22/07): dados REAIS da FPMED no lugar; **zero placeholder / zero GlobalMed**
   confirmado por varredura (globalmed, 54.379.172, 20.131.542, conde francisco, 99612).
2. ✅ FEITO (22/07): URLs do GitHub (painel raw/zip + gm-auth recover) → `fpmed-hospitalar/fpmed`.
3. ✅ FEITO: **URL + ANON do Supabase** = instância da FPMED. Reconferido 04/08: 14 ocorrências de
   `supabase.co` nos *.html/*.js, **um único host** (`xzdowrksuswekwffoluk`) e **uma única anon key**
   (JWT decodificado: `ref=xzdowrksuswekwffoluk`, `role=anon`). Zero resquício do banco do GlobalMed.
4. ✅ FEITO (22/07): `dashboard_clientes.html` ERA dado real do GlobalMed (33 clientes/CNPJs).
   Substituído por 10 clientes 100% fictícios (CNPJs prefixo 00., inválidos; marcas fictícias).
   Varredura: zero dos 33 nomes/CNPJs reais remanescente.
5. ✅ FEITO (varredura 04/08): **zero Pix / chave / agência / banco** em qualquer *.html/*.js
   (os dados de pagamento só existiam na loja, removida) e **zero** ocorrência de
   `99612`/`globalmed`/`vikewlbhkrikcalzsbeb`/CNPJ-endereço da Global. Único WhatsApp no sistema
   é o comercial da FPMED `(62) 98147-9532`.
6. **Segurança do banco (RLS)** — ✅ FEITO: RLS ligada em todas as tabelas + policy `authenticated`,
   views com `security_invoker` (`db_rls.sql`). Testado: anon bloqueada (INSERT 401 / SELECT vazio),
   `authenticated` funciona. Como o repo vai público com a anon dentro, isso era essencial.

## 📦 ESTOQUE PRÓPRIO FPMED IMPORTADO (04/08/2026) — 1.381 linhas, com 2 pendências
Origem: `Pasta1.xlsx` (CODIGO, NOME_PRODUTO, UNIDADE, MARCA, ESTOQUE, PRECO_MINIMO1).
Gravado como `fornecedor='1'` / `tipo='global'` / `global_venda1=PRECO_MINIMO1`. Total do banco
7.451 → **8.832**. Regra do Lemuel aplicada: **estoque 0 → 1** (750 zeradas + 31 que já eram 1 = 781).

**Auditoria do que ficou gravado:**
- ✅ 1.381 linhas, 0 sem preço, 0 sem marca, 0 com custo (é venda, correto).
- ✅ 474 linhas "duplicadas" **vêm da própria planilha** (469 chaves código+produto repetidas) — não
  foi insert duplo. Decidir se deduplica (a Competitividade soma saldo de linhas irmãs).
- ⚠️ `und` NULL em 1.381/1.381. **Medido: não muda o pack em nenhuma linha** (CX/UND/PCT não
  carregam número; `qtdEmbalagem` cai no nome). É perda de informação de tela, não de preço.
- ⚠️ `codigo` perdeu o zero à esquerda (`0000010` → `10`) em 1.381/1.381. Risco no PRÓXIMO import:
  se o relatório vier com 7 dígitos, a chave não casa e duplica. Corrigir = UPDATE → **espera OK**.
- ⚠️ `principio_ativo` NULL em 1.381/1.381 → **é o que deixa a Competitividade vazia** (abaixo).

**Telas conferidas no ar (04/08):**
- ✅ **Vendas Ativas popula**: 200 produtos, itens com badge FPMED e estoque 1.
- ✅ Dashboard: "1381 no estoque FPMED", 8.832 cotações.
- ✅ **Competitividade AGORA POPULA** (04/08, com OK do Lemuel). Estava zerada porque `_cpzKey` exige
  PA com ≥3 chars **e** dose, e `principio_ativo` estava vazio: **1.381 de 1.381** morriam no 1º portão.
  Não era bug de tela, era dado faltando.

### 🧬 Preenchimento do `principio_ativo` (04/08) — `tools/preenche_pa_global.js`
A FPMED **não tem a `cmed_pf`** (Bloco 3 do sync, não portado) e a `cmed_dicionario` está **vazia** —
por isso o `resolvePA` do app devolvia nada e o import deixou o campo NULL. Fonte usada: o próprio
banco, onde 4.350 linhas de distribuidor já têm PA (938 PAs distintos). **Não inventa PA** — só grava
o que casa contra esse vocabulário, em 2 camadas:
- **A)** mesmo produto já cotado por distribuidor com PA → 7
- **B)** token(s) do nome batem num PA conhecido → 437
- **não resolvido (fica NULL)** → 937

Dos 937 que ficaram vazios, **635 são material** (luva, gaze, seringa, cateter, sonda…) que não tem PA
por natureza — correto ficar vazio. Os **302 restantes são medicamento de verdade** (SORO FISIOLÓGICO,
PENICILINA, BICARBONATO, MORFINA, HEPARINA, HIDROCORTISONA, FITOMENADIONA…) cujo PA simplesmente não
existe no nosso vocabulário de 938. **Esses só resolvem com o Bloco 3 (CMED)** — é o limite honesto
desta abordagem.

Backup completo das 1.381 linhas antes de escrever (`backups/backup_pa_global_*.json`), PATCH por id,
444 gravadas, 0 erro.

**Resultado medido:** funil de 0 → **441 formam chave**, 344 com concorrente. Tela no ar: **241 itens
no pool confiável**, 98 acima da média, MKP mediano **+34%**, 14 "ganho fácil", 22 "prejuízo".

⚠️ **Achado novo pra próxima rodada:** os **59 itens "em revisão"** (fora dos KPIs, a tela já os isola
sozinha) são todos do mesmo formato `pack N vs 1` — nosso preço é da CAIXA e o do concorrente é por
UNIDADE (ex.: IPRATROPIO nosso R$ 596,41 vs R$ 1,31 · +45602%). É granularidade do lado concorrente,
não erro do nosso preço. Vale uma conferência item a item.

## 🏛️ MÓDULO LICITAÇÕES (04/08/2026) — spec pronta, construção na fila
Spec completa em **`LICITACOES_SPEC.md`** (estudo do SIGA Pregão + plano V1/V2).
- **V1**: busca no PNCP (UF default GO, palavras-chave de saúde, modalidade, período) → lista
  (órgão, objeto, valor, disputa, prazo, link) → **cruzamento dos itens do edital com o nosso
  banco** (matching PA+dose que já existe) → jornal salvo + card "Próximas disputas".
  Tabela nova `licitacoes_acompanhadas` (RLS: gestor grava, logado lê). Tema claro.
- **V2 (não fazer agora)**: portais **Comprasnet Goiás** e **Licitanet** (os mais relevantes
  pra GO), funil kanban, templates jurídicos.
- ⚠️ **API do PNCP estava FORA DO AR em 04/08 ~14h** (504 sem UF / 503 com `uf=GO`). O módulo
  precisa degradar com cache + aviso, nunca tela branca.
- **Ordem**: entra DEPOIS de normalização por unidade → sync de dados → Blocos 2/4.
  Mostrar screenshot do protótipo busca+lista ANTES de construir o cruzamento.

## 📦 REGRA PERMANENTE — ESTOQUE 0 VIRA 1 (decisão do Lemuel, 04/08/2026)
Item que vier com **estoque 0** no relatório entra/atualiza com **estoque = 1**.
**Por quê:** com estoque 0 o item some da Competitividade e das Vendas Ativas, e junto some o
**histórico de preço** dele — que é o que permite comparar depois. Com 1 ele fica visível na
comparação sem fingir que há saldo relevante.
- Aplicada no seed de 04/08: **781 linhas** (750 zeradas + 31 que já eram 1).
- ⬜ **PENDENTE gravar no FLUXO**: tela Atualizar Estoque + `tools/le_estoque_fpmed.js` + teste.
  (Item 4 da fila.)

## 🩺 SAÚDE DO SISTEMA (rodada 04/08/2026)
- Suíte: **110 asserts verdes / 0 falhas** em 6 suítes (`node tests/run_all.js`).
- Smoke test no ar: **10/10 páginas HTTP 200** em `fpmed-hospitalar.github.io/fpmed/`, todas
  limpas (zero GlobalMed, zero banco antigo, zero placeholder, zero telefone antigo).
- Banco: 11 tabelas respondendo; `cotacoes` 7.451 linhas, as outras 10 vazias (esperado — a FPMED
  ainda não carregou estoque próprio, clientes nem compras).

## 📌 Decisões/observações
- **Porta de entrada (22/07)**: link/splash abre DIRETO o `fpmed_sistema_final.html` (menu lateral
  completo). Painel virou acesso secundário via seção "Sistemas" do menu (com Giovana, Vendas,
  Viabilidade). Standalones têm pill "← Sistema" na topfaixa (à esquerda, p/ não colidir com o
  badge do gm-auth). `vendas.html` tolera ausência da tabela `prospects` (Prospecção fora do pacote).
- **gm-auth.js**: nome de arquivo mantido (include interno, sem prefixo `globalmed_`). Decidir
  se renomeia p/ `fp-auth.js`. **Recomendação (04/08): NÃO renomear** — "gm" não aparece em nada
  visível pro cliente, e o rename mexe no `<script src>` das 10 páginas + no versionamento `?v=`
  que já causou skew de cache uma vez. Risco real, ganho zero. Fechar como "fica assim".
- **competitividade_dark**: REMOVIDA em 22/07 (decisão do Lemuel) — redundante com a Competitividade
  clara do sistema_final. A Competitividade interna foi convertida pro tema claro na mesma data.
- **PDFs via `window.open` no sistema_final**: ✅ RESOLVIDO 23/07 — logo agora entra com URL
  absoluta (`new URL('logo_fpmed.png', location.href)`), resolve em qualquer janela `about:blank`.

Legenda: [x] concluída · [ ] pendente · ⛔ bloqueada
