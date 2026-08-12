# MANUAL DE DESIGN VISUAL — leis permanentes

**Status: PERMANENTE.** Irmão do `manual_excelencia.md`. Vale pra **toda tela**
daqui pra frente. Ordem do Lemuel em 11/08/2026.

Destilado de Refactoring UI (Wathan/Schoger), das Leis de UX, e do estudo sobre
por que layout feito por IA parece genérico. A resposta é **falta de direção** —
e este manual é a direção.

**Compliance inalterado:** referência serve pra **aprender o padrão**, nunca pra
copiar asset, código, texto, ícone ou identidade de ninguém — Licitante Prime
incluso. Identidade FPMED (azul/verde) em tudo.

---

## REGRA ZERO — pesquisar antes de construir

**Antes de cada fatia visual:** buscar 2 a 3 referências profissionais do tipo de
tela em questão (painel SaaS, lista de resultados, kanban, calendário — padrão
Stripe/Linear/dashboards premiados) e **anotar no relatório quais decisões
concretas saíram de cada uma**: espaçamento, hierarquia, disposição.

O mesmo vale pro código: dúvida de API, padrão ou técnica → **documentação oficial
primeiro, nunca chute.**

> Anotar a decisão, não a referência. "Vi o painel X" não vale nada; "o filtro fica
> em linha acima da lista, não em coluna lateral, porque a coluna rouba largura da
> informação" é uma decisão que dá pra defender ou contestar.

---

## AS LEIS DO VISUAL

### D1. Hierarquia antes de tudo
Cada tela tem **UMA** coisa mais importante — ela domina; o resto apoia. Se tudo
grita, nada é ouvido (a crítica exata do cliente). Guiar o olho por **tamanho,
peso e cor**, e projetar a ordem de chegada: o que ele precisa ver em 1s, em 5s,
em 30s.

### D2. Espaço em branco é generoso, nunca sobra
Começar com espaço **demais** e tirar até ficar certo. Tela apertada = amadora.
Mas espaço vazio sem propósito — o "Encontrar" antigo — também é defeito:
**espaço serve pra agrupar e respirar, não pra encher.**

### D3. Tudo na grade
Grade de 8px, alinhamento vertical e horizontal perfeito. **"Quase alinhado" é
pior que desalinhado** — o olho percebe e desconfia.

### D4. Tipografia com avareza
Uma família só, escala fixa, hierarquia por **peso e cor antes de tamanho**.
- nunca preto puro sobre branco puro — cinza-escuro `#1a202c` sobre `#f7fafc`;
- nunca texto cinza-claro sobre fundo colorido — usar a **própria cor do fundo,
  mais clara**;
- altura de linha **1.5 em texto, 1.2 em título**.

### D5. Cor é tempero, não prato
~90% da tela em neutros. Azul FPMED **só** em ação principal e links; verde **só**
em positivo/sucesso; vermelho **só** em perigo; âmbar **só** em atenção.
**Se a cor está em tudo, não destaca nada.**

### D6. Profundidade discreta
Sombra suave em 2 níveis (repouso / flutuando) pra dizer o que está "em cima".
**Sombra pesada e borda grossa juntas = cara de template.**

### D7. O que é junto, fica junto — Lei da Proximidade
Espaço **entre** grupos sempre maior que espaço **dentro** do grupo. Rótulo cola no
seu campo, não no vizinho. Agrupamento certo dispensa linha divisória na maioria
dos casos.

### D8. Menos opções, decisão mais rápida — Lei de Hick
2 a 3 ações visíveis por contexto; o resto atrás de "⋯". Já é regra na ficha —
agora vale em toda tela. Formulário só com os campos que a etapa exige.

### D9. Dado com rótulo desenfatizado
Em cartões e fichas: **rótulo pequeno e cinza em cima, valor forte embaixo.**

```
ABERTURA
14/08 às 09h
```

Nunca `Abertura: 14/08/2026 09:00:00` tudo do mesmo peso — isso é cara de sistema
antigo.

### D10. Padrão familiar — Lei de Jakob
Busca parece busca, cartão parece cartão, kanban parece kanban. **Inovar no
acabamento, nunca na convenção** — o usuário não pode ter que aprender o nosso
jeito de fazer um botão.

### D11. Ícone só com significado
Conjunto único, tamanho e traço iguais, e **só onde comunica algo**. Ícone de
decoração sai. **Emoji como ícone: proibido** (já era lei; aqui é reforço).

> **DECIDIDO em 11/08 — o conjunto é o NOSSO.** A regra dizia "Lucide (MIT)".
> Passa a ser o **conjunto autoral FPMED**, nascido no protótipo: 24×24, traço 1.8,
> pontas arredondadas. O nome "Lucide" era o meio; o fim era a consistência — e um
> conjunto autoral entrega o fim sem a pergunta de licença de terceiro.
>
> **Ícone novo se DESENHA no conjunto. Não se baixa de biblioteca nenhuma.**
> Meio conjunto de um lugar e meio de outro é o que faz um sistema parecer
> *montado* em vez de *desenhado* — e é a coisa que o olho percebe sem saber nomear.
> Mora em `limedtec-menu.js`; cobrado por `testa_menu_lateral.js`.

### D12. Desenhar com o pior dado real
Testar toda tela com:
- o objeto de licitação de **400 caracteres**;
- o valor de **R$ 63.034.332,63**;
- a lista de **2.558** itens;
- **a lista vazia.**

**Layout que só funciona com dado bonito é layout quebrado.**

### D13. Anti-cara-de-IA — lista negra explícita
Proibido: gradiente roxo/rosa genérico · três cards de recursos lado a lado como
enfeite · sombra colorida · emoji espalhado · texto placeholder genérico
("Bem-vindo à sua plataforma!") · border-radius gigante em tudo · glassmorphism.

No lugar: **personalidade FPMED** — azul/verde hospitalar, micro-textos **úteis e
específicos do ramo** (`busque por item — ex.: albumina, dipirona…` é o padrão
certo), densidade de ferramenta profissional.

### D14. Rápido parece profissional
Skeleton imediato, resposta em menos de 100ms nas interações, **sem pulos de
layout**. Lento parece quebrado, e quebrado parece amador.

---

## PROCESSO POR TELA — ordem obrigatória

1. **Pesquisar** referências na web (Regra Zero) e anotar as decisões concretas.
2. **Esqueleto em blocos cinza**, sem cor nem texto final — acertar hierarquia e
   grade primeiro. *Se o esqueleto não guia o olho, cor nenhuma salva.*
3. **Aplicar os tokens** do `fpmed_tema.css` — nada fora deles.
4. **Encher com o pior dado real** (D12).
5. **Andar pela loja** — jornada completa, diário de fricção.
6. **Prints em 3 larguras** (1366 / 1920 / 390) + checklist visual de 20 pontos.
7. **TESTE DO BATER O OLHO** — pôr o nosso print ao lado do Prime e de uma
   referência padrão Stripe/Linear e perguntar: *"parece da mesma prateleira
   profissional? alguém diria que foi IA?"*
   **Se hesitar → mais uma rodada de polimento.** Só publica quando a resposta for
   sim sem hesitar.
