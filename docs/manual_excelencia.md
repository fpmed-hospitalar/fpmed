# MANUAL DE EXCELÊNCIA — como trabalhamos daqui pra frente

**Status: PERMANENTE.** Vale pra todo trabalho futuro no FPMED, não só pra reforma
visual em curso. Ordem do Lemuel em 11/08/2026.

Este manual **soma** às regras que já estavam vivas e não revoga nenhuma:

- fila numerada, trabalhada em ordem — só "URGÊNCIA" fura;
- prova medida, nunca prova de fé;
- todas as suítes verdes antes de publicar;
- **compliance master: nenhum dado comercial cruza entre GlobalMed e FPMED, nas
  duas direções — só código cruza, dado nunca;**
- nada de DELETE/DROP/TRUNCATE/UPDATE de dado sem OK expresso;
- `C:\globalmed` fica intocado;
- referência de layout e comportamento apenas — nenhum código, asset, ícone,
  texto ou endpoint de terceiro.

Onde este manual e uma regra antiga discordarem, **vence a mais exigente das duas.**

---

## PARTE 1 — MENTALIDADE (como os mestres pensam)

### L1. Medir, nunca achar
Nenhuma decisão por intuição. Desempenho se mede, defeito se reproduz **antes** de
consertar, causa-raiz se prova.

> Já era cultura aqui — a cota do PNCP e o teto de 1000 linhas do PostgREST foram
> descobertos medindo, não supondo. Agora é lei escrita.

### L2. Os dados mandam no código
Antes de escrever qualquer função, desenhar a estrutura de dados: a tabela, o
objeto, o formato do retorno. Se a estrutura está certa, o código sai simples.
Se o código está torturado, quase sempre o erro está uma camada abaixo.

### L3. Bom gosto = eliminar casos especiais
`if` que existe só pra atender um "caso especial" é sinal de desenho errado.
Repensar até o caso especial desaparecer dentro do caso geral. Menos ramificação,
menos defeito.

### L4. Funcionar → ficar certo → ficar rápido, nessa ordem
Primeiro fazer funcionar **com prova**. Depois limpar e organizar. Só otimizar o
que a medição apontar. **Otimização precoce é proibida.**

### L5. Passos pequenos
Nunca uma entrega gigante. Fatias finas, cada uma no ar com prova — tela a tela,
como já vem sendo feito. **Se uma mudança assusta, ela está grande demais: dividir.**

### L6. Código é pra humano ler
Nome bom vale mais que comentário. Função diz o que faz (`conferirProposta`,
`pintaGanhos`); variável diz o que guarda. Se precisou de comentário pra explicar
**o quê**, o nome está errado.

**Comentário é só pro PORQUÊ** — a decisão de negócio, a regra da lei, o motivo de
um botão existir. Esse tipo de comentário é memória, e apagá-lo é perder informação
que o código não carrega.

> Isso já custou caro: ao trocar o rodapé da ficha eu apaguei os comentários que
> registravam por que cada botão existia. Quinze asserts ficaram vermelhos e me
> obrigaram a restaurar. As suítes não pegaram um bug — pegaram a perda da memória
> do porquê.

### L7. Sem apego
Código que ficou ruim se deleta e reescreve sem dó. O que vale é o produto, não o
esforço passado.

### L8. Nenhuma janela quebrada
Defeito pequeno tolerado convida o próximo. Aviso no console, layout torto, teste
amarelo: **conserta na hora, ou registra na fila com número.** Nunca "depois eu
vejo" sem registro.

### L9. Regra do escoteiro
Todo arquivo tocado sai um pouco melhor do que entrou — um nome melhorado, um
trecho morto removido. **Sem virar reforma paralela**: a melhoria cabe no diff da
tarefa ou vira item de fila.

### L10. DRY — cada conhecimento mora num lugar só
Regra de negócio duplicada é defeito latente. Vale pra constantes, textos,
validações e tokens visuais.

> Motor único do CMED: a trava do teto roda no mesmo lugar onde o preço é decidido.
> Se existissem duas cópias da regra, uma envelheceria calada.

### L11. Pesquisar antes de construir
**Referência visual e documentação oficial na web antes de cada construção nova.**

- tela nova → 2 a 3 referências profissionais do mesmo tipo de tela, com as
  decisões concretas anotadas no relatório (espaçamento, hierarquia, disposição);
- dúvida de API, padrão ou técnica → **documentação oficial primeiro, nunca chute.**

É a Regra Zero do `manual_design.md`, elevada a lei de trabalho porque vale
também fora do visual. Compliance inalterado: referência é pra **aprender o
padrão**, nunca copiar asset, código ou identidade de ninguém.

> Esta lei é a defesa direta contra o "parece feito por IA": layout genérico não
> vem de falta de capricho, vem de **falta de direção**. Quem não olhou referência
> nenhuma inventa a média de tudo que já viu — e a média de tudo é exatamente o
> que tem cara de IA.

---

## PARTE 2 — PROCESSO (como os mestres trabalham)

### P1. Sem surpresas
Teste automatizado pra todo comportamento que importa. A régua:
- funcionalidade nova → suíte nova;
- todas verdes antes de publicar;
- **defeito achado vira teste que o impede de voltar.**

### P2. Red-green-refactor quando possível
Escrever o teste que falha **antes** do código que o faz passar. No mínimo
absoluto: nunca publicar código sem teste.

### P3. Causa-raiz sempre
Consertar o sintoma sem entender a causa é proibido. Toda correção no relatório diz:
**o que era · por que acontecia · como foi provado · como não volta.**

### P4. Revisão própria impiedosa
Antes de publicar, reler o diff **inteiro** como se fosse de outra pessoa. As
perguntas obrigatórias:
- e se o dado vier vazio?
- e se vierem 10.000?
- e se o usuário clicar duas vezes?

> A terceira pergunta não é decorativa. O KPI errado do Negócios existia porque
> 2.558 registros chegavam na tela como 1.000 — a resposta a "e se vierem 10.000?"
> estava errada e ninguém tinha perguntado.

### P5. Velocidade vem da qualidade
Pressa que gera retrabalho é lentidão disfarçada. **O tempo de fazer certo está
autorizado pelo dono** — "sem pressa: qualidade manda no prazo".

### P6. Consistência religiosa
Mesmo padrão de nome, mesma estrutura de arquivo, mesmos tokens visuais em todo o
sistema. **Quem abre qualquer tela do FPMED deve sentir que UMA pessoa excelente
fez tudo.**

---

## PARTE 3 — ACABAMENTO DE PRODUTO

### A1. Qualidade mínima viável
Nada sai "funcionando mas feio". Toda entrega já sai com o refinamento que gera
confiança. **Beleza é funcional** — o desenho é parte do que o produto faz, não
enfeite aplicado depois.

### A2. Andar pela loja
Antes de declarar pronto, **usar a tela como o cliente usaria**, do início ao fim,
anotando cada atrito num diário de fricção. Cada atrito vira conserto imediato ou
item numerado na fila. Nenhum atrito some por ser pequeno.

### A3. Jornadas essenciais com nota
`docs/jornadas.md` guarda as seis jornadas-chave. A cada fatia publicada, a jornada
afetada recebe nota **vermelho / amarelo / verde**, com o porquê escrito.
Meta: tudo verde. **Nota honesta — o vermelho de hoje é o mapa do trabalho.**

### A4. Os detalhes são o produto
Alinhamento perfeito. Transições de 150ms. Todos os estados desenhados
(carregando · vazio · erro · hover · foco · desabilitado). Texto sem corte. Número
tabular. R$ com separador de milhar. O adendo de excelência da reforma **vale pra
sempre**, não só pra reforma.

### A5. Rápido é qualidade
Tela que demora parece quebrada.
- percebido: skeleton imediato, nunca tela branca;
- medível: interação responde em menos de 100ms;
- busca mostra resultado parcial antes do completo quando der.

### A6. Menos, melhor
Opinião forte: menos botão, menos opção. **Cada elemento na tela paga aluguel** —
se não ajuda a jornada, sai.

> Esta é literalmente a crítica que originou a reforma: o cliente achou o sistema
> "muito cheio de coisa".

---

## PARTE 4 — RITUAL DE ENTREGA

Checklist obrigatório antes de **todo** publish:

- [ ] Referências pesquisadas e decisões anotadas (L11 / Regra Zero)
- [ ] Estruturas de dados desenhadas antes do código (L2)
- [ ] Suítes todas verdes + suíte nova da entrega (P1)
- [ ] Diff relido inteiro como revisor externo (P4)
- [ ] "Andei pela loja" na jornada afetada e anotei os atritos (A2)
- [ ] Estados todos presentes: carregando · vazio · erro · hover · foco (A4)
- [ ] Prints em 3 larguras conferidos contra o checklist visual (1366 / 1920 / 390)
- [ ] Nenhuma janela quebrada nova; console limpo (L8)
- [ ] Tokens do `fpmed_tema.css` — zero cor ou espaçamento fora (P6)
- [ ] Jornada recebeu nota em `docs/jornadas.md` (A3)
- [ ] **Teste do bater o olho** passou sem hesitar (`manual_design.md`, passo 7)
- [ ] Relatório: fila numerada + o que foi provado + nota das jornadas

**Um item do ritual que não pôde ser cumprido não se marca como cumprido: se
declara no relatório, com o motivo.**
