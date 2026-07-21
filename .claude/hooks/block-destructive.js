#!/usr/bin/env node
// Hook PreToolUse: barra comandos com padrao DESTRUTIVO antes de executar.
// Recebe JSON do Claude Code no stdin: { tool_name, tool_input:{command|script}, ... }
// Bloqueia: exit code 2 + motivo no stderr (Claude ve e NAO executa).
// LIMITACAO: inspeciona a STRING do comando. Operacoes escondidas dentro de um .js
// (ex.: fetch DELETE em node script.js) NAO sao vistas aqui — a REGRA DE OURO
// (preview->OK) continua sendo a trava para essas. Ver CONTINUAR.

let data = '';
process.stdin.on('data', c => data += c);
process.stdin.on('end', () => {
  let cmd = '';
  try {
    const j = JSON.parse(data || '{}');
    const ti = j.tool_input || j.toolInput || {};
    cmd = ti.command || ti.script || (typeof ti === 'string' ? ti : JSON.stringify(ti));
  } catch (e) { cmd = data; }
  cmd = String(cmd || '');

  const regras = [
    { re: /\bDROP\s+(TABLE|DATABASE|SCHEMA|INDEX|VIEW|FUNCTION|TRIGGER)\b/i, nome: 'DROP' },
    { re: /\bTRUNCATE\b/i, nome: 'TRUNCATE' },
    { re: /method\s*:\s*['"`]DELETE['"`]/i, nome: 'fetch method DELETE' },
    { re: /-X\s*['"]?DELETE\b/i, nome: 'curl -X DELETE' },
    { re: /\bDELETE\s+FROM\b/i, nome: 'DELETE FROM (SQL)' },
    { re: /\/rest\/v1\/[^\s'"`]+.*DELETE/i, nome: 'REST DELETE' },
    { re: /\bRemove-Item\b/i, nome: 'Remove-Item' },
    { re: /\brmdir\b/i, nome: 'rmdir' },
    { re: /(^|[;&|]\s*)rm\s+-?[rf]/i, nome: 'rm -rf' },
    { re: /(^|[;&|]\s*)rm\s+\S/i, nome: 'rm' },
    { re: /(^|[;&|]\s*)del\s+\S/i, nome: 'del' },
    { re: /git\s+push\s+[^\n]*(--force\b|(?:^|\s)-f\b)/i, nome: 'git push --force' },
    { re: /\bUPDATE\s+\w+\s+SET\b(?![\s\S]*\bid\b)/i, nome: 'UPDATE sem filtro por id' },
  ];

  for (const r of regras) {
    if (r.re.test(cmd)) {
      process.stderr.write(
        `\n[GUARD-RAIL] BLOQUEADO — padrao destrutivo detectado: ${r.nome}.\n` +
        `Comando: ${cmd.slice(0, 200)}\n` +
        `Regra de ouro FPMED: NUNCA apagar/sobrescrever dados sem OK explicito do Lemuel na conversa.\n` +
        `Se for legitimo, pare, mostre o preview e peca o OK antes de rodar.\n`
      );
      process.exit(2);   // 2 = bloqueia a tool call no Claude Code
    }
  }
  process.exit(0);       // 0 = libera
});
