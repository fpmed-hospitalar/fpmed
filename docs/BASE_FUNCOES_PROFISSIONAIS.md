# BASE 3 — O QUE FALTA PARA O LIMEDTEC SER SISTEMA DE GENTE GRANDE

> Pesquisa encomendada pelo dono em 15/08/2026: *"usa essas ferramentas e API que temos
> para buscar na web funções que irão nos deixar profissionais ainda mais nessa questão
> de criação de programa igual criamos a LIMEDTEC"*.
> Duas frentes varridas em paralelo: **o que plataformas de licitação do mundo fazem**
> (Brasil, EUA, União Europeia, Reino Unido) e **o que aplicações profissionais de tela
> densa fazem**. Toda linha tem fonte. Onde a fonte é fraca, está escrito que é fraca.
> Esta base entra ao lado da BASE_VISUAL (como a tela se parece) e da BASE_ENGENHARIA
> (como se constrói). Esta responde: **o que a tela precisa FAZER.**

---

## O ACHADO QUE MUDA A CONVERSA

A pesquisa devolveu 22 funcionalidades de mercado e 18 padrões de interação. Mas o
resultado que importa é um só, e ele é desconfortável:

> **Nós damos ao gestor o teto legal e não damos o teto competitivo.**

O teto CMED responde *"até onde a lei me deixa vender"*. Não responde *"até onde eu
consigo vender e ainda ganhar"*. Quem responde isso é **o preço que o governo já pagou
naquele item, naquele órgão, no ano passado** — e esse dado está na API do PNCP, no
resultado de item, com CNPJ do vencedor, marca e valor unitário. Está lá. Nós não
buscamos.

É por isso que a ficha ainda parece "consulta" e não "ferramenta de decisão". O gestor
olha o teto CMED e pensa: *"ótimo, e agora?"*

Tudo o mais neste documento é secundário a isso.

---

# PARTE 1 — AS CINCO LACUNAS DE PRODUTO

Ordenadas por valor para o Natanael, não por quantas plataformas têm.

## 1.1 — Memória de preço homologado (o teto competitivo)

**O que é:** para cada item, mostrar o que o governo efetivamente pagou em compras
anteriores — quem venceu, com que marca, por quanto, em que órgão e quando.

**Quem tem:** Painel de Preços (Compras.gov.br), Banco de Preços, Lictus.

**Por que vale dinheiro:** sem isso, o gestor ou desiste de item lucrativo por medo, ou
entra em item onde o preço praticado está abaixo do custo dele. Os dois erros custam a
margem inteira do pregão.

**Dá para fazer com o que temos: SIM.** A API do PNCP entrega resultado de item com
fornecedor, CNPJ, marca e valor unitário com 4 casas. Já ingerimos 192 resultados na
A7 — a estrutura existe, falta o volume e falta a tela.

**Como entra na ficha:** ao lado da coluna TETO CMED, uma coluna **PRATICADO** com a
mediana dos últimos 12 meses e o número de compras que sustentam aquela mediana. Se
houver menos de 3 compras, a célula diz "poucos dados" — nunca uma mediana de uma
amostra só, que é número que mente.

Fontes: [Painel de Preços](https://comprasbr.com.br/como-usar-o-painel-de-precos-para-vender-para-o-governo-guia-completo/) · [Banco de Preços](https://www.bancodeprecos.com.br/) · [Manual da API do PNCP](https://gist.github.com/Micael106/04a3e5515057ab11ea8797603682f0bd)

## 1.2 — Cofre de certidões com vencimento

**O que é:** as certidões, o contrato social, os atestados e os balanços num lugar só,
com data de validade e aviso antes de vencer.

**Quem tem:** Effecti (módulo Cadastrar), Lictus, ConLicitação, Alerta Licitação.

**Por que vale dinheiro:** inabilitação por CND vencida é a forma mais burra de perder
um pregão **já ganho na disputa**. Custa zero evitar e custa o contrato inteiro não
evitar.

**Dá para fazer com o que temos: SIM, e é a melhor relação valor/esforço do roteiro
todo.** Tabela + Supabase Storage + rotina diária + Resend, que já está conectado e
parado. O botão Anexar, que o B consertou, é exatamente a peça que faltava.

Fontes: [Effecti](https://effecti.com.br/plataforma/) · [Lictus](https://www.lictus.com.br/)

## 1.3 — Calculadora de piso e margem

**O que é:** custo + frete + tributos + margem-alvo = **até onde posso baixar o lance**.

**Quem tem:** PrecificaJá (R$ 197,90/ano), SIGA Pregão.

**Por que vale dinheiro:** na disputa, ele decide em segundos se cobre o lance. Um único
item mal precificado num contrato de 12 meses custa mais do que anos de assinatura de
qualquer ferramenta.

**Dá para fazer com o que temos: SIM.** É aritmética sobre parâmetros por empresa. O
trabalho está em modelar tributos, não em tecnologia. Fecha o ciclo com a 1.1: preço
praticado (o que o mercado cobra) + piso calculado (o que eu aguento) = decisão.

Fonte: [PrecificaJá](https://www.precificaja.com/)

## 1.4 — Análise de concorrente

**O que é:** quem ganha nos órgãos que interessam, com que marca, a que preço.

**Quem tem:** ConLicitação (vende como diferencial premium), Contracts Finder (Reino
Unido), Tendly.

**Por que vale dinheiro:** saber que a empresa X sempre fecha 12% abaixo do referência
naquele órgão muda a decisão de participar e o limite de lance. Hoje isso mora na
cabeça de um funcionário — e vai embora com ele.

**Dá para fazer com o que temos: SIM, quase de graça.** É o **mesmo ingestor** da 1.1:
o resultado de item já traz CNPJ, marca e valor. Uma view materializada por CNPJ e por
órgão resolve. **Construir junto com a 1.1, nunca separado.**

Fontes: [ConLicitação](https://conlicitacao.com.br/) · [Contracts Finder vs Find a Tender](https://psip.co.uk/blog/find-a-tender-vs-contracts-finder)

## 1.5 — Gestão de ata: saldo, empenho, entrega

**O que é:** depois da vitória, controlar quanto foi registrado, quanto foi empenhado,
quanto foi entregue, e quando a ata vence.

**Quem tem:** Lictus, WSGE/JD System (dentro do ERP).

**Por que vale dinheiro:** ata ganha só vira dinheiro quando o órgão empenha. Sem
controle, o fornecedor perde faturamento por saldo não cobrado ou toma penalidade por
entrega fora do prazo.

**Dá para fazer com o que temos: SIM.** O PNCP tem `/v1/atas` e `/v1/contratos`. Falta
a camada de dado próprio do cliente (empenho recebido, nota emitida).

**Isto responde diretamente ao seu pedido de 14/08:** *"esse q ja ta em ata tem que
aparecer os itens que ganhei com os preços, ta muito superficial"*. Está superficial
porque o produto acompanha até a vitória e **abandona o cliente exatamente onde o
dinheiro entra**.

Fontes: [Lictus](https://www.lictus.com.br/) · [WSGE — Módulo Licitações](https://jdsystem.com.br/modulo-licitacoes/)

---

## O DIFERENCIAL QUE NINGUÉM ESTÁ EXPLORANDO

Duas coisas que a pesquisa achou e que valem mais do que todo o resto junto, porque
**nenhum concorrente horizontal brasileiro faz**:

**a) Teto CMED no nível do ITEM do edital.** As plataformas grandes são horizontais —
vendem para quem fornece merenda, uniforme e remédio. Nenhuma trata a regra da CMED
item a item. Nós tratamos. Isso é a nossa verticalização de saúde e é o que justifica o
white-label.

**b) Plano de Contratações Anual (PCA).** O PNCP publica em `/v1/pca/` **o que o órgão
pretende comprar antes do edital sair**. No mercado americano esse é o dado mais caro
que existe (o GovWin vende "75% dos leads antes de aparecerem no SAM.gov"). No Brasil é
fonte pública subutilizada. Chegar no dia da publicação é chegar tarde: o preço junto ao
laboratório e a disponibilidade de lote se negociam antes. **Antecipação é o que separa
margem de 4% de margem de 15%.**

Fontes: [GovWin IQ](https://www.deltek.com/products/govwin/federal/) · [PNCP Dados Abertos](https://www.gov.br/pncp/pt-br/acesso-a-informacao/dados-abertos)

---

# PARTE 2 — O QUE FAZ A TELA PARECER FEITA POR GENTE SÉRIA

A BASE_VISUAL cuida de como a tela **se parece**. Esta parte cuida de como ela
**se comporta** — que é onde o amadorismo aparece mais rápido.

## 2.1 — Os cinco baratos que mudam a percepção na hora

| Padrão | O que é | Custo |
|---|---|---|
| **Estado na URL** | Todo filtro, ordenação e linha aberta vira parâmetro no endereço. A URL vira a fotografia da tela, colável no WhatsApp do sócio. Resolve o F5 que zera tudo e o Voltar que destrói a triagem. | meio dia |
| **Chips de filtro aplicado** | Cada filtro ativo vira uma pastilha visível com "x" para remover. Filtro escondido dentro de dropdown fechado é a maior fonte de desconfiança em tela densa: *"cadê meus editais?"* | meio dia |
| **Números tabulares** | `font-variant-numeric: tabular-nums`, alinhado à direita, mesmas casas decimais. Com fonte proporcional, `R$ 1.111,11` **parece menor** que `R$ 999,99` e o olho erra a ordem de grandeza — no trabalho que é exatamente comparar preço com teto. | 2 horas |
| **Esqueleto dimensionado** | Linhas-fantasma com as colunas certas, e a barra de filtros já clicável enquanto carrega. A rodinha central é o sinal nº 1 de amadorismo: não diz quanto vem, faz a tela pular e bloqueia quem já sabe o que quer filtrar. | meio dia |
| **Erro que ensina a saída** | Todo erro com causa, ação e código curto. "Erro ao carregar dados" no meio de uma triagem com prazo faz o gestor voltar para o portal oficial e não voltar mais. | 1 dia |

## 2.2 — Os dois que fazem virar ferramenta de trabalho diário

**Visões salvas.** O gestor trabalha em rotinas fixas: "Medicamentos GO abrindo esta
semana", "Itens acima de 80% do CMED". Sem isso ele remonta os mesmos sete filtros toda
manhã — e erra um deles. Uma visão é uma linha no banco guardando a mesma string do
estado da URL. Entregue **uma visão padrão já pronta**, senão ninguém descobre o recurso.

**Seleção em lote de verdade.** Shift seleciona intervalo; o checkbox do cabeçalho
separa "esta página" de "todos os N do filtro". E aqui mora o erro clássico do amador:
o usuário marca "todos", o filtro tem 3.000 resultados, e a ação aplica só nos 50 da
página visível — **sem avisar**. O botão tem que dizer o número exato: "Acompanhar 3.412
editais".

## 2.3 — Os caros, para depois

Navegação por teclado no padrão grid do W3C (setas, Espaço marca, Enter abre — o usuário
compara você com o Excel, é bom lembrar disso), virtualização de linha com paginação por
cursor em vez de OFFSET, e painel lateral de detalhe em vez de modal — que, aliás, é o
que o `molde_detalhe.html` já desenhou, e a fonte da NN/g confirma: modal esconde
justamente o dado de referência que o usuário precisa ao lado.

## 2.4 — Três decisões que valem virar lei da casa

1. **Desfazer no lugar de "Tem certeza?".** Ação some da tela na hora e a gravação real
   sai 7 segundos depois; "Desfazer" cancela o relógio. Diálogo de confirmação a cada
   descarte é pedágio. **Mas só para estado do usuário** (marcar, arquivar, tag) —
   **nunca para valor que outra pessoa lê como verdade** (preço, CMED).
2. **Busca sem acento e com sinônimo do setor.** "dipirona" ≈ "metamizol", "PE" ≈
   "pregão eletrônico". Zero resultado por causa de um acento faz o gestor concluir que
   o edital não existe — e perder o pregão. Uma tabela `sinonimos(termo, canonico)`
   curada por nós é o que nenhum concorrente amador vai ter.
3. **Exportar respeita o filtro.** Todo gestor termina o dia no Excel. Se ele precisa
   refazer o filtro lá, viramos etapa a mais, não economia. CSV com `;` e BOM, nome do
   arquivo com o filtro e a data.

---

# PARTE 3 — O QUE NÓS **NÃO** VAMOS FAZER, E POR QUÊ

A pesquisa achou duas funcionalidades que os concorrentes brasileiros anunciam na
primeira dobra do site. Elas ficam de fora, e é decisão de arquitetura, não preguiça:

**Robô de lances** e **monitoramento do chat da sessão** exigem automação **dentro da
sessão logada** de cada portal operador (Compras.gov.br, BLL, BNC, Licitanet), com a
credencial do cliente. Isso é a MURALHA. Não entra nem com ordem do dono — já foi
pedido em 14/08 e já foi recusado, com a razão escrita.

**A consequência estratégica, dita com todas as letras:** o LIMEDTEC é camada de
**inteligência e gestão**, não de **operação de disputa**. O cliente vai manter uma
assinatura de robô em algum concorrente, e tudo bem. Nós somos o lugar onde ele **decide
o que disputar e por quanto** — que é a parte que dá margem. Vender isso como escolha,
e não como falta, é a diferença entre parecer incompleto e parecer focado.

---

# PARTE 4 — ORDEM DE EXECUÇÃO

Ordem escolhida por dependência e por valor visível, não por facilidade:

**1ª — Cofre de certidões (1.2).** Valor visível em dias, tudo já na pilha, e cria o
hábito de login diário. Puxa junto os cinco baratos da 2.1, que são pré-requisito de
tudo.

**2ª — Ingestor de resultado de item.** Uma obra, duas entregas: memória de preço (1.1)
e análise de concorrente (1.4) saem do mesmo dado. **Construir separado é retrabalho.**

**3ª — Calculadora de piso (1.3).** Só faz sentido depois que existir preço praticado
para comparar.

**4ª — Ata com saldo e empenho (1.5).** Fecha o ciclo do produto onde o dinheiro entra.

**5ª — PCA (o diferencial b).** Quando o resto estiver de pé, é o que nos coloca meses
à frente de todo mundo.

**Antes de qualquer uma delas:** ligar Sentry e PostHog nas páginas. Não adianta medir
uso de tela que vai mudar, mas **também não adianta construir cinco funcionalidades sem
enxergar se elas quebram em produção**. Instrumentar é fatia de meio dia e é o que
transforma "achamos que funciona" em "sabemos que funciona".

---

## NOTA DE HONESTIDADE SOBRE AS FONTES

Fontes fortes: NN/g, W3C, MDN, A List Apart, Baymard, Carbon, PatternFly, Atlassian,
Material, documentação oficial do PNCP e da Anvisa/CMED.
Fontes médias ou fracas, usadas só como confirmação de prática comum: LogRocket, UXPin,
Pencil & Paper e páginas comerciais de produto.
**Não há pesquisa forte e conclusiva** sobre esqueleto versus rodinha, nem sobre
indicador de dado desatualizado — nesses dois casos o argumento defensável é
estabilidade de layout e controle do usuário, **não** "parece mais rápido". Está escrito
assim de propósito: número bonito sobre coisa não sabida é mentira educada, e essa é lei
da casa.
Duas barreiras foram encontradas e respeitadas na pesquisa: o Tenderlake bloqueia coleta
por robots.txt, e ConLicitação, BLL e Portal de Compras Públicas mantêm preço e produto
atrás de login. Nada foi acessado logado.
