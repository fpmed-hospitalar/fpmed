// SUITE testa_fechamento_mes — as duas planilhas do fim do mes, e o que NAO pode sair na fatura.
//
// ══ A DECISAO QUE CARREGA ESTE ARQUIVO ══════════════════════════════════════════════════════
// Sao DUAS planilhas e elas nao podem ser a mesma:
//   · fechamento_interno — custo real, custos fixos, repasse e LUCRO. Responde "esta dando
//     dinheiro?".
//   · fatura_fpmed — SO os valores de repasse. E o que o cliente paga.
// Uma linha de "custo real" esquecida na aba errada e uma renegociacao de contrato. Por isso as
// duas sao MONTADAS SEPARADAMENTE, e nao uma copia da outra com colunas escondidas — coluna
// escondida em .xlsx nao esta escondida, esta a um clique.
//
// ══ E A CONFERENCIA LE O ARQUIVO GRAVADO ════════════════════════════════════════════════════
// Nao as variaveis do script. O que se quer provar e sobre o ARQUIVO que vai pro cliente, e o
// codigo que acabou de escreve-lo e justamente aquilo em que nao se pode confiar pra conferir a
// si mesmo.
//
// ══ MEDIDO COM OS DADOS REAIS DE AGOSTO (11/08) ═════════════════════════════════════════════
//   8 leituras · custo real R$ 3,24 · repasse R$ 4,90 · custos fixos R$ 180,82
//   LUCRO (INCOMPLETO) −R$ 179,16 — negativo
//   >>> E A 1a VERSAO DIZIA "+R$ 1,66", porque os dois custos fixos em dolar, sem cambio
//       gravado, viraram R$ 0,00. Tratar "nao sei o cambio" como "custo zero" e o erro que este
//       projeto passa o tempo desfazendo, e ele estava dentro da minha propria ferramenta.
//
//   node tests/testa_fechamento_mes.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const T = R('tools', 'fechamento_mes.js');
const uc = s => s.replace(/\s*\n\s*(?:\/\/|--|\*)?\s*/g, ' ');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_fechamento_mes — duas planilhas, e o que nao pode sair na fatura\n');

// ══════════ 1. DUAS PLANILHAS, MONTADAS SEPARADAMENTE ══════════
ok('1. *** gera as duas: interno e fatura ***',
  /fechamento_interno_\$\{MES\}\.xlsx/.test(T) && /fatura_fpmed_\$\{MES\}\.xlsx/.test(T));
ok('2. *** a fatura e MONTADA DO ZERO, e nao copiada da interna ***',
  /MONTADA DO ZERO, e nao a partir da interna/.test(T));
ok('3. ...com o motivo (coluna escondida em .xlsx esta a um clique)',
  /coluna escondida em \.xlsx nao esta escondida, esta a um clique/.test(uc(T))
  || /Coluna escondida em \.xlsx nao esta escondida: esta a um clique/.test(uc(T)));
ok('4. *** e o que nao e escrito nao existe no arquivo ***',
  /nao por esconder, por nao colocar/.test(uc(T)));
ok('5. o interno tem as tres abas (resumo, uso de IA, custos fixos)',
  /'Resumo'\)/.test(T) && /'Uso de IA'\)/.test(T) && /'Custos fixos'\)/.test(T));

// ══════════ 2. A CONFERENCIA DO ARQUIVO GRAVADO ══════════
ok('6. *** ela LE o .xlsx do disco, e nao as variaveis ***',
  /const lido = XLSX\.readFile\(arqFatura\);/.test(T));
ok('7. ...com o motivo (o codigo que escreveu nao pode conferir a si mesmo)',
  /o codigo que acabei de escrever e justamente a coisa em\s*que nao se pode confiar pra conferir a si mesmo/.test(uc(T)));
ok('8. *** e recusa palavra de custo, margem, lucro, cambio e token ***',
  /const PROIBIDAS = \['custo', 'margem', 'lucro', 'us\$', 'usd', 'cambio', 'câmbio', 'token', 'anthropic', 'haiku'\];/.test(T));
ok('9. *** achando alguma, RENOMEIA o arquivo pra NAO_ENVIAR ***',
  /_NAO_ENVIAR\.xlsx/.test(T) && /process\.exitCode = 1/.test(T));
ok('10. *** e a soma da fatura tem que bater com o repasse cobravel ***',
  /Math\.abs\(totalFatura - repasseCobravel\) < 0\.005/.test(T));

// ══════════ 3. O QUE NAO ENTRA NA FATURA ══════════
ok('11. *** leitura que FALHOU nao entra ***', /u\.ok && !u\.teste/.test(T));
ok('12. ...e cobrar por ela e decisao comercial que nao e do script',
  /e uma DECISAO COMERCIAL,\s*que nao e minha/.test(uc(T)));
ok('13. *** leitura de TESTE nao entra ***', /!u\.teste/.test(T));
ok('14. ...e o defeito que motivou esta registrado (a fatura saiu com "LINHA DE TESTE DA RLS")',
  /produziu uma fatura com "LINHA DE TESTE DA RLS" e "PROVA DO CONSERTO" dentro/.test(uc(T)));
ok('15. *** mas o custo delas CONTINUA no fechamento interno (a Anthropic cobrou) ***',
  /O custo delas foi REAL \(a Anthropic\s*cobrou\), entao elas continuam no fechamento interno/.test(uc(T)));
ok('16. *** a marca de teste e A MAO, nunca adivinhada pelo titulo ***',
  /Adivinhar pelo titulo seria pior/.test(T));
ok('17. ...com o exemplo do risco (um edital chamado "teste_hospital.pdf" sairia de graca)',
  /sairia de graca, e ninguem notaria/.test(uc(T)));
ok('18. *** o script APONTA as suspeitas e da o comando, sem marcar sozinho ***',
  /const SUSPEITO = \/teste\|prova\|rls\|demo\|sandbox\/i;/.test(T)
  && /Eu NAO marco sozinho/.test(T));
ok('19. ...e diz por que nao marca (deixaria de faturar edital de verdade)',
  /deixaria de` \)/.test(T) || /faturar um edital de verdade chamado "prova_de_conceito\.pdf"/.test(T));

// ══════════ 4. "NAO SEI" NUNCA VIRA ZERO ══════════
ok('20. *** leitura sem cambio NAO entra na soma em R$ ***',
  /const semCambio = usos\.filter\(u => u\.brl == null\);/.test(T));
ok('21. ...com o motivo (cambio medio inventado produz numero que ninguem reproduz)',
  /seria produzir um numero que ninguem\s*consegue reproduzir/.test(uc(T)));
ok('22. *** custo fixo em dolar sem cambio e CONVERTIDO pela cotacao do dia, e DITO ***',
  /CONVERTIDO pela cotacao de hoje \(R\$ ' \+ cambioHoje\.toFixed\(4\)/.test(T));
ok('23. *** e o defeito que motivou isso esta registrado, com o numero ***',
  /viraram \*\*R\$ 0,00\*\* e o relatorio\s*imprimiu \*\*LUCRO R\$ 1,66\*\*/.test(uc(T)));
ok('24. ...com a regra por extenso',
  /TRATAR "NAO SEI O CAMBIO" COMO "CUSTO ZERO" E EXATAMENTE O ERRO QUE ESTE PROJETO NAO/.test(uc(T)));
ok('25. *** e a taxa usada aparece, pra conta ser reproduzivel ***',
  /Qual taxa produziu o numero — e a informacao que torna a conta reproduzivel/.test(uc(T)));

// ══════════ 5. LUCRO INCOMPLETO NAO E LUCRO ══════════
ok('26. *** com algo conhecido de fora da conta, o lucro sai como INCOMPLETO ***',
  /const incompleto = fixosPendentes\.length > 0 \|\| semCambio\.length > 0;/.test(T)
  && /LUCRO \(INCOMPLETO\)/.test(T));
ok('27. *** e a planilha interna carrega o mesmo aviso ***',
  /incompleto \? 'LUCRO \(INCOMPLETO — ver abaixo\)' : 'LUCRO'/.test(T));
ok('28. *** dizendo O QUE ficou de fora, na mesma linha ***',
  /custos fixos fora da conta/.test(T) && /leituras sem cambio do dia/.test(T));
ok('29. ...com o motivo (lucro com custo conhecido de fora e um numero bonito)',
  /NAO E LUCRO, E UM NUMERO BONITO/.test(T));
ok('30. ...e a instrucao de nao decidir com ele',
  /Resolva isso antes de usar o lucro pra decidir qualquer coisa/.test(T));

// ══════════ 6. CADA NUMERO VEM DE UM LUGAR SO ══════════
ok('31. *** o repasse vem da MESMA view que a tela mostra ***', /v_leituras_cobranca\?select=\*/.test(T));
ok('32. ...e o script diz que o calculo ja vem de la',
  /O repasse ja vem\s*calculado la/.test(uc(T)));
ok('33. *** a margem vem de cobranca_config, e o script aborta sem ela ***',
  /nao consegui ler a margem de repasse — abortando/.test(T));
ok('34. *** custo fixo com vigencia: assinatura que comecou dia 10 nao e rateada ***',
  /rateio por dia e decisao comercial que ninguem tomou/.test(uc(T)));
ok('35. ...e o relatorio DIZ desde quando cada um vale', /desde \$\{String\(f\.vigente_de\)\.slice\(0, 10\)\}/.test(T));
ok('36. *** todo gasto de IA entra, e nao so o leitor de edital ***',
  /const ROTULO_TIPO = \{[\s\S]{0,200}'pedido-proposta'/.test(T));
ok('37. as cinco tarefas tem rotulo legivel na planilha',
  ['resumo', 'itens', 'juntar', "'itens-ganhos'", "'mapa-precos'"].every(k => T.includes(k)));

// ══════════ 7. RODAR TODO FIM DE MES COM UM COMANDO ══════════
ok('38. *** um comando so, com o mes corrente por padrao ***',
  /const MES = arg\('--mes'\) \|\| /.test(T));
ok('39. ...e `--so-ver` que nao grava nada', /--so-ver: nenhuma planilha gravada/.test(T));
ok('40. *** e ele DIZ qual mes usou (rodar dia 1o querendo o anterior e o erro facil) ***',
  /=== FECHAMENTO DE \$\{MES\} ===/.test(T) && /rodar o\s*fechamento no dia 1o de setembro querendo agosto/.test(uc(T)));
ok('41. mes sem nada nao gera planilha vazia',
  /Nao ha nada a fechar neste mes — nenhuma planilha gravada/.test(T));
ok('42. as planilhas vao pra backups\/ (gitignored), e nao pro repo',
  /'backups', 'fechamento'/.test(T));
ok('43. e os numeros medidos ficam no cabecalho da suite (nao so no commit)',
  /LUCRO \(INCOMPLETO\) −R\$ 179,16 — negativo/.test(R('tests', 'testa_fechamento_mes.js')));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
