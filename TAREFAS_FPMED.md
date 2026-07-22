# TAREFAS FPMED — task list do projeto (clone white-label #2)

> Padrão do projeto: TODA rodada da FPMED acompanha esta lista. Marcar concluída
> na hora que fechar cada uma. Atualizado por etapa.

Última atualização: 2026-07-21

| # | Tarefa | Status |
|---|--------|--------|
| 1 | Baixar logo do site → `C:\fpmed\logo_fpmed.png` | ✅ Concluída |
| 2 | Mover `fpmed_template.html` do Downloads → `C:\fpmed` | ✅ Concluída |
| 3 | Criar projeto Supabase da FPMED pelo Chrome (senha no `segredos.local.txt`) | ⏳ Pendente |
| 4 | Remover Prospecção embutida do `sistema_final` | ✅ Concluída |
| 5 | Renomear arquivos `globalmed_*` → `fpmed_*` | ✅ Concluída |
| 6 | Varredura GlobalMed→FPMED em todos os textos | 🔄 Nome-marca trocado (61); falta dados de registro reais da FPMED |
| 7 | Rebrand visual completo (template + logo real + cores + telefone + slogan) | ⏳ Pendente |
| 8 | Trocar URL+ANON do Supabase nos arquivos (quando o projeto existir) | ⏳ Pendente (depende de #3) |
| 9 | Criar tabelas no banco novo (DDL do CONTINUAR) | ⏳ Pendente (depende de #3) |
| 10 | Criar ORG `fpmed-hospitalar` no GitHub + repo `fpmed` na org (Free) | ⏳ Pendente |
| 11 | Apontar remote pra org + 1º push + GitHub Pages (`fpmed-hospitalar.github.io/fpmed`) | ⏳ Pendente (depende de #10) |

Legenda: ✅ Concluída · 🔄 Em andamento · ⏳ Pendente · ⛔ Bloqueada

## Pendências que precisam de dados/decisão do Lemuel
- **Dados de registro da FPMED** (p/ finalizar #6 e os PDFs/loja da #7): razão social,
  CNPJ, Inscrição Estadual, endereço e WhatsApp comercial. Hoje os documentos ainda
  mostram os dados REAIS da GlobalMed (CNPJ 54.379.172/0001-47, IE 20.131.542-4,
  "GLOBALMED DISTRIBUICAO LTDA", endereço em Aparecida de Goiânia, WhatsApp 5562996127968).
  Não troquei por dados inventados — 17 linhas de identidade jurídica ficaram sinalizadas.
- **gm-auth.js**: mantido o nome do arquivo (include interno, não tem prefixo `globalmed_`).
  Decidir se renomeia p/ `fp-auth.js`.
- **URLs do GitHub** (painel, gm-auth recover, loja): apontam pro repo antigo; trocar
  quando a org/repo da FPMED existir (#10/#11).
