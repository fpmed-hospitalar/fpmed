/* LIMEDTEC — aplica o tema do cliente. UMA linha, num arquivo, de proposito.
 *
 * Por que nao um <script> inline no <head> de cada tela (que era o jeito obvio): o
 * fpmed_sistema_final.html gera documentos com window.open e carrega "</script>" LITERAL dentro
 * de string JS. Acrescentar mais um bloco inline desalinhou o pareamento de <script>/</script>
 * pra qualquer leitor ingenuo do HTML — e o nosso tools/valida_sintaxe.js passou a compilar
 * pedacos cortados no meio da string, acusando 2 erros que nao existiam. Medido em 05/08.
 *
 * Com src="" nao ha bloco inline nenhum pra desalinhar, e a ordem de execucao continua a mesma:
 * este arquivo entra DEPOIS do limedtec-config.js e ANTES da licenca e do gm-auth.
 */
if (typeof LIMEDTEC !== 'undefined' && LIMEDTEC.aplicaTema) LIMEDTEC.aplicaTema();
