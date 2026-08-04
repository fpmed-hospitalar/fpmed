# PATCH pronto — detector de pack: frasco-ampola

> **Não aplicado ainda.** O `_qtdDoNome` vive em **4 cópias idênticas** (giovana canônica +
> sistema_final + vendas + viabilidade) e o `tests/testa_qtd.js` quebra se divergirem.
> A `fpmed_giovana.html` estava sendo editada por outra sessão às 14:58 de 04/08 — aplicar no
> meio disso colidiria. **Aplicar nas 4 de uma vez, depois rodar `node tests/testa_qtd.js`.**

## O que o detector está perdendo

Auditoria (`tools/audita_pack.js`, só leitura) sobre os 83 itens que a Competitividade joga
em "Em revisão": **39 saíram com pack 1**, e **23 deles têm a contagem escrita no nome**.

| Padrão | Ocorrências | Por que falha hoje |
|---|---|---|
| `50FRS/AMP` | 13 | a lista tem `FR`, mas exige `\b` logo depois — o `S` de `FRS` mata o limite |
| `25F/A` | 10 | `F` sozinho não está na lista; `F/A` tem barra no meio |

Restam 16 com pack 1 e **sem** contagem legível → esses são preço errado na origem e vão pro cliente.

## A prova (dividir pelo pack certo cai em cima do mercado)

| Produto | Preço | Pack | Unitário | Mercado |
|---|---|---|---|---|
| CEFALOTINA 1000MG (CEFARISTON) **100FRS/AMP** | 475,25 | 100 | **4,75** | **4,74** |
| CEFTRIAXONA 1G IV **50 F/A** S/D (GEN) | 244,84 | 50 | **4,90** | 3,81 |
| CEFAZOLINA SODICA 1G **50F/A** S/DIL | 264,80 | 50 | **5,30** | 4,15 |
| CEFEPIMA 1G **50F/A** (CLOCEF) | 347,24 | 50 | **6,94** | 7,95 |
| HIDROCORTISONA 500MG **50F/A** (ARISCORTEN) | 300,74 | 50 | **6,01** | 4,67 |
| DOTAREM 0,5MMOL/ML 20ML **25FRS/AMP** | 2.614,37 | 25 | **104,57** | 127,06 |
| PROPOFOL 10MG/ML 20ML **5F/A** (PROVIVE) | 46,31 | 5 | **9,26** | 7,66 |

A CEFALOTINA bate na terceira casa decimal. Não é coincidência — é preço de caixa.

## O patch

Em `_qtdDoNome`, **logo antes** da linha do `const mU = ...`, inserir:

```js
  // FRASCO-AMPOLA: "25F/A", "50FRS/AMP", "20FR/AMP", "50FRA/AMP", "50FRS", "50BISNAGAS".
  // O detector perdia TODOS: a lista do mU tem 'FR' mas exige \b logo depois, e "FRS"/"F/A"
  // quebram esse limite. Eram 23 dos 39 itens que caíam em "Em revisão" por pack não detectado
  // (CEFALOTINA 100FRS/AMP: 475,25 ÷ 100 = 4,75 contra 4,74 do mercado — bate na 3ª casa).
  const mFA = nome.match(/(\d{1,4})\s*(?:F\s*\/\s*A|FR[SA]?\s*\/\s*AMP|FRS|FRA|BISNAGAS?)\b/);
  if (mFA) { const n=parseInt(mFA[1]); if(n>1&&n<=5000) return n; }
```

**Por que antes do `mU`:** o `mU` já casaria `FR` isolado em alguns nomes e devolveria o número
errado. O `mFA` é mais específico e tem que ganhar. Não mexe em nenhum caminho existente —
só acrescenta uma tentativa a mais antes.

## Testes a acrescentar em `tests/testa_qtd.js`

```js
ok('F/A: 25F/A=25',            _qtdDoNome('CLARITROMICINA 500MG 25F/A (CLARILIB)')===25);
ok('F/A com espaco: 50 F/A=50',_qtdDoNome('CEFTRIAXONA 1G IV 50 F/A S/D (GEN)')===50);
ok('FRS/AMP: 100FRS/AMP=100',  _qtdDoNome('CEFALOTINA 1000MG PO IV IM 100FRS/AMP')===100);
ok('FR/AMP: 20FR/AMP=20',      _qtdDoNome('OMEPRAZOL 40MG PO 20FR/AMP+DIL')===20);
ok('FRA/AMP (grafia torta)=50',_qtdDoNome('CETOPROFENO 100MG IV 50FRA/AMP')===50);
ok('FRS solto: 50FRS 60ML=50', _qtdDoNome('CEFALEXINA 250MG/5ML PO 50FRS 60ML (G)')===50);
ok('BISNAGAS: 50BISNAGAS=50',  _qtdDoNome('LIDOCAINA 20MG/G GEL 30GR 50BISNAGAS')===50);
// CONTROLES — não podem regredir:
ok('FR sem numero segue 1',    _qtdDoNome('XPE FR C/240ML')===1);
ok('medida nao vira contagem', _qtdDoNome('ALGODAO PCT 50G')===1);
ok('5F/A pequeno=5',           _qtdDoNome('PROPOFOL 10MG/ML 20ML 5F/A (PROVIVE)')===5);
```

## Passo a passo

1. Aplicar o bloco nas **4** cópias (`fpmed_giovana.html` é a canônica).
2. `node tests/testa_qtd.js` → tem que ficar verde **e** acusar as 4 cópias idênticas.
3. `node tests/run_all.js` → 360+ asserts verdes.
4. `node tools/audita_pack.js` → os 23 devem sair da lista.
5. Regerar o Excel: `node tools/gera_xlsx_precos_conferir.js` → deve cair de 83 pra ~60.
6. Conferir a Competitividade no ar (KPIs e MKP mediano).

## ⚠️ O que NÃO fazer

**Não converter preço no banco.** A tela já divide pelo pack
(`var qtd=qtdEmbalagem(g.und,g.produto)||1; var nosso=gv1/qtd;`). Converter no banco também dá
divisão dupla — foi o erro de 04/08 (MKP saltou pra +6136%, revertido no commit `64d6d9c`).
O conserto é **só** no detector.
