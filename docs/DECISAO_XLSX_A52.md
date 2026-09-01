# A52 — o `xlsx` 0.18.5: as duas opções, medidas

**Fatia A52, 01/09/2026, Trabalhador A.** O arquiteto pediu explicitamente: *"Não decida
sozinho. Traga as duas com número e o que se perde em cada uma. Eu decido."* Então este
documento **não decide nada**. Ele mede.

Reproduzir a medição da superfície: `node tools/mede_superficie_xlsx.js`

---

## 1. O que exatamente está aberto

`npm audit` diz, hoje:

```
xlsx  *
Severity: high
  Prototype Pollution in sheetJS ......... GHSA-4r6h-8v6p-xvw6
  SheetJS Regular Expression DoS (ReDoS) . GHSA-5pgg-2g8v-p4x9
No fix available
```

O **"No fix available" não quer dizer que não existe conserto.** Quer dizer que o conserto
**não está no npm**. A SheetJS saiu do npm em 2023 e passou a publicar só no CDN dela. O npm
congelou na 0.18.5 e ficou congelado para sempre. Quem olha só o `npm audit` conclui "não tem
jeito", e está errado.

**Os dois avisos são de PARSE.** Eles precisam de uma planilha hostil *entrando*. Quem só monta
planilha (`json_to_sheet` + `writeFile`) não encosta no parser. Isso muda o tamanho do problema,
e é por isso que a conta abaixo é por **leitura**, não por "usa xlsx".

---

## 2. A superfície exata — quem lê de FORA e quem lê da CASA

| | quantos | quais |
|---|---|---|
| telas que **carregam** o xlsx | **4** | conferidor, viabilidade, edital_ia, negocios |
| telas que **abrem planilha de fora** | **2** | `fpmed_conferidor.html:222`, `fpmed_viabilidade.html:308` |
| telas que **só geram** planilha | **2** | `fpmed_edital_ia.html`, `fpmed_negocios.html` — **não expostas** |
| ferramentas Node que **abrem de fora** | **8** | ver tabela abaixo |
| leitura de arquivo que **a casa gerou** | **1** | `tools/fechamento_mes.js:308` — relê a fatura que ele mesmo escreveu |

**Os 10 pontos de leitura de arquivo externo:**

| onde | de onde vem o arquivo |
|---|---|
| `fpmed_conferidor.html:222` | o dono escolhe no disco (lista de fornecedor, extração da CMED) |
| `fpmed_viabilidade.html:308` | o dono escolhe no disco (planilha de compra) |
| `tools/atualiza_cmed.js:57` | planilha da CMED, baixada da ANVISA |
| `tools/carrega_cmed_pf.js:74` | planilha PF da CMED, da ANVISA |
| `tools/carrega_cmed_precos.js:86` | planilha de preços da CMED, da ANVISA |
| `tools/prova_cmed_edicao.js:59` | planilhas da CMED, da ANVISA |
| `tools/prova_trava_cmed.js:39` | planilhas da CMED, da ANVISA |
| `tools/carrega_calendario.js:109` | `Calendario 2025.xlsm`, planilha do dono |
| `tools/explora_calendario.js:19` | a mesma `Calendario 2025.xlsm` |
| `tools/le_estoque_fpmed.js:63` | export de estoque que o dono tira do sistema dele |

### >>> O achado que muda o peso da decisão

**A superfície grande não é a do navegador — é a do Node.** São **8 ferramentas contra 2 telas**,
e o estrago não é do mesmo tamanho:

- No navegador, prototype pollution polui o JS **daquela aba**. Fecha a aba, acabou.
- Em Node, é **o processo**, na máquina do dono, com a `service_role` do banco lida do
  `segredos.local.txt` ao lado. Não tem aba para fechar.

É exatamente o mesmo formato do achado da A50 no pdf.js — e pelo mesmo motivo: a casa mede o
navegador com cuidado e trata `tools/` como se fosse terreno de casa. Não é: `tools/` abre
arquivo de fora tanto quanto as telas.

**Atenuante honesto, para não inflar o risco:** todos os 10 arquivos são escolhidos por uma
pessoa — não há upload de terceiro, não há fila automática engolindo `.xlsx` de origem
desconhecida. Sete dos dez vêm da ANVISA (`gov.br`). Para explorar isto, alguém precisaria
fazer o dono abrir uma planilha preparada. É **plausível** (basta um anexo de e-mail de
"fornecedor"), não é **automático**.

---

## 3. OPÇÃO (a) — migrar para a distribuição oficial do SheetJS

Medido no fio hoje (`node _mede_xlsx_a52.js`):

| versão | origem | bytes | corrige |
|---|---|---|---|
| **0.18.5** (hoje) | `cdnjs.cloudflare.com` | 881.727 | — nenhum dos dois |
| 0.19.3 | `cdn.sheetjs.com` | 923.139 | prototype pollution |
| 0.20.2 | `cdn.sheetjs.com` | 945.578 | + ReDoS |
| **0.20.3** | `cdn.sheetjs.com` | 951.904 | os dois |

O `.tgz` para o lado Node também responde: `xlsx-0.20.3.tgz`, HTTP 200, 2.409.319 bytes.

**Travando a origem** — como o arquiteto disse, *"origem é coisa séria num repo público"*.
Então não basta trocar a URL; a troca vem com **Subresource Integrity**, e os hashes estão
medidos (SHA-384 do arquivo que baixei hoje):

```
0.20.3  sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT
0.20.2  sha384-gx12pQMMYnabkTgbCHqqrT65RwDnXI/f/dU2H9JUmT0KUeiMF5bf+yroQBmX0Nuk
0.19.3  sha384-QOLV4jDrHYFU/0mHkVIR8QkZgRISiTcaqHqMGcW7LZ5/DGKTJWGwVFCh5knANMvj
```

Com `integrity=` + `crossorigin="anonymous"`, o navegador **recusa o arquivo** se um byte
mudar. Isso é mais garantia de origem do que a casa tem HOJE: as quatro telas carregam o
cdnjs **sem integrity nenhum**.

### O que se perde na (a)

1. **Um host novo no repo público.** `cdn.sheetjs.com` é CDN de **um fornecedor só**; o cdnjs é
   mirror grande e velho. Se o SheetJS sair do ar, as duas telas de leitura param. O SRI protege
   contra troca de conteúdo, **não** contra o host sumir.
2. **O cache muda, medido:** cdnjs manda `immutable, max-age=30672000` (um ano). O SheetJS manda
   `max-age=0, must-revalidate` — revalida a cada carga. São ~950 KB revalidados toda vez.
   *(Offline não piora: o `sw.js:208` já não cacheia o CDN de propósito.)*
3. **No lado Node a origem vira URL no `package.json`.** Não dá `npm i xlsx@0.20.3` — teria de
   ser a URL do `.tgz`, que fica escrita no `package.json` e no `package-lock.json` de um **repo
   público**. Quem clonar passa a baixar dependência de fora do npm. É legítimo e é o caminho
   que a própria SheetJS documenta, mas é uma mudança visível e permanente.
4. **Trabalho e risco de regressão:** 4 telas + 5 ferramentas Node. A API de 0.18 → 0.20 é
   compatível para o que a casa usa (`read`, `readFile`, `utils.*`, `writeFile`), mas isso
   **não foi provado ainda** — provar exige reler as planilhas da CMED e comparar linha a linha,
   como a A50 fez com o PDF. **Não fiz essa prova**, porque a decisão vem antes.

---

## 4. OPÇÃO (b) — aceitar o risco por escrito

Aceitar significa: fica na 0.18.5, com a superfície acima documentada, e a casa passa a conviver
com dois `high` permanentes.

### O que se perde na (b)

1. **O `npm audit` nunca mais fica verde, e isso é o custo caro.** Dois `high` que ninguém pode
   consertar viram ruído fixo. Depois de algumas semanas todo mundo lê "4 vulnerabilidades" e
   passa direto — inclusive na vez em que aparecer a quinta, que era de verdade. É o mesmo modo
   de falha do backup que ficava verde pela metade: **o alarme que sempre toca deixa de ser
   alarme.** Este é o argumento mais forte contra a (b), e não é técnico.
2. **Os avisos do GitHub continuam no repo público**, à vista de qualquer um, indicando exatamente
   qual biblioteca e qual versão a casa usa.
3. **A dívida não para de pé sozinha:** aceitar hoje precisa de data de revisão, senão vira
   permanente por esquecimento.

### O que a (b) NÃO custa

Não custa exposição nova. A superfície já é a que está medida acima e não aumenta por decidir
não migrar.

---

## 5. Um terceiro caminho que apareceu ao medir (não estava na caixa)

**(c) Migrar só quem LÊ.** Os pontos expostos são 10; os que só geram são 4 arquivos. Dava para
subir a versão **apenas onde há parse** e deixar o resto na 0.18.5.

**Eu não recomendo**, e digo por quê: duas versões da mesma biblioteca na casa é a coisa que a
A50 acabou de descobrir que dói — foi exatamente "o `pdf.js` do navegador subiu e o do Node
ficou" que criou o buraco daquela fatia. Fica registrado porque foi medido, não porque é bom.

---

## 6. Resumo para decidir

| | (a) migrar para 0.20.3 | (b) aceitar por escrito |
|---|---|---|
| fecha os 2 `high` | **sim** | não |
| origem do pacote | **muda** (cdnjs → cdn.sheetjs.com), travada por SRI | não muda |
| garantia de origem hoje | nenhuma (sem integrity) | nenhuma |
| garantia de origem depois | **SHA-384 por arquivo** | nenhuma |
| arquivos a mexer | 4 telas + 5 ferramentas Node | nenhum |
| prova ainda necessária | reler planilha da CMED e comparar (não feita) | — |
| custo permanente | host de fornecedor único; ~950 KB revalidados | `npm audit` nunca verde |

**Se o arquiteto quiser a minha leitura** (e ela não é decisão): a **(a) na 0.20.3, com SRI**,
começando pelas **8 ferramentas Node** — que é onde a superfície é maior e o estrago é a máquina
e não a aba. As telas podem ir na volta seguinte, com a prova de ida e volta da CMED junto.

**PENDENTE DA DECISÃO DELE. Nada foi migrado.**
