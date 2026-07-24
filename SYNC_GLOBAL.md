# 🔄 SYNC GlobalMed → FPMED (código + dados)

> Comando do Lemuel: **"sincroniza as melhorias da Global"** → rodar o fluxo abaixo.
> C:\globalmed é **SÓ LEITURA** (regra master). Nunca portar às cegas: preview → OK → porta → testa → commit.

ultimo_sync: e7501e0

(`ultimo_sync` = último commit da GlobalMed já considerado. `490e856` = estado da Global
no momento do clone da FPMED, 21/07/2026 20:29 — 4 min antes do 1º commit da FPMED.)

## Fluxo de SYNC DE CÓDIGO
1. `node tools/sync_da_global.js` → relatório dos commits pendentes da Global, mapeados
   pros arquivos da FPMED, com aviso de divergência local.
2. Mostrar a lista de melhorias pro Lemuel → ele escolhe o que entra.
3. Portar cada melhoria REAPLICANDO O REBRAND (checklist abaixo) — via `git -C C:\globalmed show <hash> -- <arquivo>` (diff) aplicado no equivalente fpmed_*.
4. Testar na FPMED (abrir a tela no ar, console limpo, fluxo funciona).
5. Commit na FPMED + `node tools/sync_da_global.js --marcar <hash-da-global>` + commitar este arquivo.

## Checklist de REBRAND ao portar (obrigatório)
- [ ] Nome: GlobalMed/GLOBALMED/Global → FPMED (só TEXTO VISÍVEL; valores de dado 'GLOBAL'/tipo='global'/código '1' ficam)
- [ ] Supabase: URL/anon SEMPRE os da FPMED (xzdowrksuswekwffoluk) — NUNCA aceitar vikewlbhkrikcalzsbeb num porte
- [ ] Cores: tema claro FPMED (--azul #2CA9E0, --navy #173A5E, --verde #8DC63F) no lugar do verde GlobalMed (#00c27a)
- [ ] Telefone: (62) 3290-4241 fixo · WhatsApp comercial (62) 98147-9532 (nunca 99612-7968)
- [ ] Permissões: FPMED usa gates por ROLE (admin) — nunca portar e-mails hardcoded (isadora...)
- [ ] Arquivos: nomes fpmed_* (mapa no tools/sync_da_global.js)
- [ ] Dados jurídicos: razão social/CNPJ/IE/endereço da FPMED
- [ ] Modelo IA: FPMED usa claude-haiku-4-5 no ler-pedido (decisão de custo 22/07)

## ⚠️ LIMITAÇÃO HONESTA — arquivos que exigem PORTE MANUAL
Divergiram muito entre os projetos; diff automático NÃO aplica limpo — portar a ideia, não o patch:
- **fpmed_sistema_final.html**: FPMED removeu 4 páginas do menu (Comissões Isa, Vendas Externas,
  Cotação p/ Cliente, Oportunidades antiga), trocou Global→FPMED nos textos, adicionou upload de
  PDF próprio no estoque e seção "Sistemas" no menu. A Global escondeu páginas com display:none;
  a FPMED APAGOU o código — o mesmo diff não encaixa.
- **gm-auth.js**: constantes (URL/anon/redirects) são da FPMED; portar só lógica.
- **index.html**: entradas diferentes de propósito (Global = portal de cards; FPMED = direto no sistema).
- **dashboard_clientes.html**: FPMED usa dados fictícios — nunca sobrescrever com a lista da Global.
O `tools/sync_da_global.js` marca esses como [PORTE MANUAL] e avisa (⚠️ N commits locais) qualquer
outro arquivo que acumular divergência local.

## ⚠️ DECISÕES DE NEGÓCIO (decididas pelo Lemuel no 1º sync, 22/07/2026)
- **MKP 32%** (Global 3236d65): ✅ PORTADO — markup de fornecedor ×1,32 em giovana/vendas/sistema.
  EXCEÇÃO mantida: custo-ref do estoque GLOBAL segue **venda ÷ 1,25** (não muda com o MKP).
- **Portal de entrada** (5ff0dbf/fa973c6/71595b7): ❌ FORA em definitivo — FPMED entra direto no sistema.
- **Importador PDF CLI** (tools/importa_estoque_pdf.js + testa_pdf_estoque.js): ❌ FORA — FPMED
  tem upload de PDF direto no browser (Atualizar Estoque).

## ✅ Competitividade + Comparativo (Global 005cb75/7cc5b87/e7501e0) — PORTADO 24/07
Feito via git apply --reject (contexto casou, só 3 hunks de TEMA rejeitaram e foram reaplicados
no claro). Entrou: giro/impacto R$/mês (coluna+KPI, inerte enquanto compra_itens vazio → "sem
giro"), botão "fila de cotação", indústria destaque, curadoria VENVANSE 30/70+DIAD, regra
CONFIRMADO vence mistura; Comparativo com heatmap, scorecard win-rate, Δ vs melhor, drill-down;
rolagem 70vh + cabeçalho sticky + coluna fixa + barra espelho (scrollbar adaptada ao claro).
Drill-down blindado (FPMED não captura histórico ainda → degrada p/ "sem histórico"; tabela
historico_precos não existe, tudo tolerante a falha). Testado no ar: Comparativo 100 linhas c/
features, Competitividade renderiza vazia (0 estoque próprio GLOBAL — matéria-prima da tela),
console limpo. Commit 7af9021.

## Fluxo de SYNC DE DADOS (cotações de distribuidor) — SÓ com OK por rodada
1. `node tools/sync_cotacoes_global.js` → PREVIEW: N novos / N atualizados / N pulados (nada gravado).
2. Lemuel dá OK (tudo ou subconjunto) → `node tools/sync_cotacoes_global.js --gravar`.
Filtros fixos no script: exclui fornecedor='1'/tipo='global' (estoque próprio da Global); só a tabela
cotacoes (nunca clientes/prospects/compras); dedup por (fornecedor, produto) — lado Global vale a
linha mais recente; sanitização venda_loja/global_venda1/2 = NULL, datas ISO.
Segredos: lidos em runtime dos segredos.local.txt dos dois projetos — NUNCA commitados.
