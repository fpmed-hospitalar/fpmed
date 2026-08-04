// Cria (ou remove) um usuario TEMPORARIO de diretor pra conferencia no browser.
//   node tools/_acesso_temp.js criar
//   node tools/_acesso_temp.js remover <email>
// Nao versionado (gitignore: tools/_*). Senha impressa so no console local.
const fs = require('fs');
const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const SR = seg.match(/SERVICE_ROLE\s*[:=]\s*(eyJ[A-Za-z0-9._-]+)/i)[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };

(async () => {
  const acao = process.argv[2];
  if (acao === 'criar') {
    const tag = 'confere-' + Math.random().toString(36).slice(2, 7);
    const email = `${tag}@fpmed.com.br`;
    const senha = 'Conf!' + Math.random().toString(36).slice(2, 12) + 'B7';
    const r = await fetch(`${SB}/auth/v1/admin/users`, { method: 'POST', headers: H,
      body: JSON.stringify({ email, password: senha, email_confirm: true, app_metadata: { role: 'diretor' } }) });
    const j = await r.json();
    if (!r.ok) { console.error('ERRO: ' + JSON.stringify(j).slice(0, 300)); process.exit(1); }
    console.log(JSON.stringify({ email, senha, id: j.id }));
  } else if (acao === 'remover') {
    const email = process.argv[3];
    const r = await fetch(`${SB}/auth/v1/admin/users?page=1&per_page=200`, { headers: H });
    const { users } = await r.json();
    const u = users.find(x => x.email === email);
    if (!u) { console.log('nao encontrado: ' + email); return; }
    const d = await fetch(`${SB}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: H });
    console.log('removido: ' + email + ' HTTP ' + d.status);
  } else { console.error('uso: criar | remover <email>'); process.exit(1); }
})();
