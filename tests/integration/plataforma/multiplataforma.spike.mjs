#!/usr/bin/env node
// tests/integration/plataforma/multiplataforma.spike.mjs
// P175 (0.37.0): o arranque do plugin sobe com O MESMO pacote no Windows e no macOS.
//
//   node tests/integration/plataforma/multiplataforma.spike.mjs
//
// Premissas que este spike mata:
//   1. O `.mcp.json` nao depende de comando por SO: `command` e `${ComSpec:-/bin/sh}`
//      (medido em 13/10 no Cowork Windows: `${VAR:-default}` e expandido, e variavel
//      sem valor e repassada como texto literal).
//      Nada com barra antes do `/c`: o cmd le `/x` ate dentro de caminho.
//   2. Os dois .bat sao POLIGLOTAS: linha 1 `:; exec /bin/sh ... #` — rotulo para o
//      cmd, `exec` para o sh, `#` engolindo o CR do CRLF.
//   3. O servidor MCP sobe pela linha de comando EXATA que o Cowork montaria a
//      partir do `.mcp.json` desta maquina, e responde initialize + tools/list.
//   4. O hook de SessionStart e EXEC FORM (0.39.0, P176): powershell -File run-node.ps1
//      no Windows, /bin/sh run-node.sh fora — nenhum depende de Git Bash, e a entrada
//      do outro SO falha ao iniciar sem rodar nada.
//   5. Variavel nao definida que chega como "${CONNECT_HOME}" literal nao vira
//      caminho relativo (bug medido em 13/10: Node baixado no host-cwd por sessao).
//
// Roda em Windows (cmd.exe) e em Linux/macOS (/bin/sh). O ramo do outro SO e
// coberto pelas checagens estaticas.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..', '..');
const ROOT = path.join(REPO, 'plugins', 'connect');
const WIN = process.platform === 'win32';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ok ', msg); } else { fail++; console.error('  XX ', msg); } };

// Expansao como o Cowork faz (medido): ${VAR} e ${VAR:-default}; sem valor e sem
// default, o texto fica literal.
const expandir = (s, env) => String(s).replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g, (m, k, def) => {
  // Windows: nome de variavel nao diferencia caixa (ComSpec x COMSPEC).
  const chave = WIN ? Object.keys(env).find((x) => x.toLowerCase() === k.toLowerCase()) : k;
  const v = chave ? env[chave] : undefined;
  if (v !== undefined && v !== '') return v;
  return def !== undefined ? def : m;
});

// --- 1. .mcp.json -----------------------------------------------------------
console.log('\n[multiplataforma] .mcp.json');
const mcp = JSON.parse(fs.readFileSync(path.join(ROOT, '.mcp.json'), 'utf8')).mcpServers.connect;
ok(mcp.command === '${ComSpec:-/bin/sh}', 'command escolhe o interpretador pelo ambiente (ComSpec no Windows, /bin/sh fora)');
// Ordem dos args (medido em 13/10): o cmd procura o PRIMEIRO `/x` da linha, inclusive
// DENTRO de um caminho com `/` — `.../Claude_pzs.../` vira `/C` e `/Users` vira `/U`
// (saida em UTF-16). Por isso nada antes do `/c` pode ter barra. O sh recebe
// `-c 'set -f;IFS=;exec sh $1' /c <launcher>`: $0 = "/c", $1 = launcher. `IFS=` e
// `set -f` deixam o $1 sem aspas a salvo de espaco e glob (aspas o cmd nao entende).
ok(JSON.stringify(mcp.args.slice(0, 3)) === JSON.stringify(['-c', 'set -f;IFS=;exec sh $1', '/c']) && mcp.args.length === 4 && /launcher\.bat$/.test(mcp.args[3]),
  'args = [-c, "set -f;IFS=;exec sh $1", /c, launcher]');
ok(!/\//.test(mcp.args.slice(0, 2).join(' ')), 'nenhuma barra antes do /c (o cmd a leria como switch)');
ok(expandir(mcp.command, { ComSpec: 'C:\\WINDOWS\\system32\\cmd.exe' }) === 'C:\\WINDOWS\\system32\\cmd.exe', 'Windows: vira cmd.exe');
ok(expandir(mcp.command, {}) === '/bin/sh', 'macOS/Linux: vira /bin/sh');

// --- 2. poliglotas ------------------------------------------------------------
console.log('\n[multiplataforma] arquivos poliglotas');
for (const [rel, alvo] of [['mcp/launcher.bat', 'run-node.sh'], ['scripts/run-node.bat', 'run-node.sh']]) {
  const linha1 = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n')[0].replace(/\r$/, '');
  ok(linha1.startsWith(':; exec /bin/sh ') && linha1.includes(alvo) && linha1.endsWith(' #'), `${rel}: linha 1 e o desvio para o sh (e termina em " #")`);
}
const sh = fs.readFileSync(path.join(ROOT, 'scripts', 'run-node.sh'));
ok(!sh.includes(Buffer.from('\r\n')), 'run-node.sh e LF puro (CR quebraria o sh)');
ok(sh.toString().startsWith('#!/bin/sh'), 'run-node.sh tem shebang');
ok(/\*'\$\{'\*\)/.test(sh.toString()), 'run-node.sh trata "${CONNECT_HOME}" literal como ausente');
ok(/CONNECT_HOME:\$\{=/.test(fs.readFileSync(path.join(ROOT, 'scripts', 'run-node.bat'), 'utf8')), 'run-node.bat trata "${CONNECT_HOME}" literal como ausente');

const modos = spawnSync('git', ['ls-files', '-s', 'plugins/connect/mcp/launcher.bat', 'plugins/connect/scripts/run-node.bat', 'plugins/connect/scripts/run-node.sh'], { cwd: REPO, encoding: 'utf8' });
if (modos.status === 0 && modos.stdout.trim()) {
  const linhas = modos.stdout.trim().split('\n');
  ok(linhas.length === 3 && linhas.every((l) => l.startsWith('100755')), 'git: os tres scripts de arranque com modo 755 (o hook no sh executa o .bat direto)');
} else {
  console.log('  --  git indisponivel: modo 755 nao conferido');
}

// --- 3. MCP sobe pela linha de comando do .mcp.json -----------------------------
console.log(`\n[multiplataforma] MCP real (${process.platform})`);
const envFilho = { ...process.env, CLAUDE_PLUGIN_ROOT: ROOT.replace(/\\/g, '/') };
delete envFilho.CONNECT_HOME;
const cmd = expandir(mcp.command, envFilho);
const args = mcp.args.map((a) => expandir(a, envFilho));
const filhoEnv = { ...envFilho };
for (const [k, v] of Object.entries(mcp.env || {})) filhoEnv[k] = expandir(v, envFilho); // literal quando ausente, como no Cowork
const cwdTeste = fs.mkdtempSync(path.join(os.tmpdir(), 'cnct-multi-'));

const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], env: filhoEnv, cwd: cwdTeste, windowsHide: true });
let erroSpawn = null;
child.on('error', (e) => { erroSpawn = e; });
let stderr = '';
child.stderr.on('data', (d) => { stderr += d.toString(); });
const pend = new Map();
let buf = '';
child.stdout.on('data', (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!l) continue;
    try { const m = JSON.parse(l); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } } catch { /* linha nao-JSON */ }
  }
});
const chamar = (id, method, params) => new Promise((resolve) => {
  pend.set(id, resolve);
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  setTimeout(() => { if (pend.has(id)) { pend.delete(id); resolve(null); } }, 20000);
});

const init = await chamar(1, 'initialize', { protocolVersion: '2025-06-18' });
ok(!erroSpawn && init?.result?.serverInfo?.name === 'connect', `servidor sobe por "${path.basename(cmd)} ${args.map((a) => path.basename(a)).join(' ')}"${erroSpawn ? ` (${erroSpawn.message})` : ''}`);
const lista = await chamar(2, 'tools/list', {});
const nomes = (lista?.result?.tools || []).map((t) => t.name);
ok(nomes.includes('iniciar_sessao') && nomes.includes('resolver') && nomes.includes('sincronizar_subvault'), 'tools/list traz iniciar_sessao, resolver e sincronizar_subvault');
// No Windows o kill do cmd deixaria o node neto vivo, segurando os pipes.
if (WIN) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }); else child.kill();
ok(!fs.existsSync(path.join(cwdTeste, '${CONNECT_HOME}')), 'nenhuma pasta "${CONNECT_HOME}" criada no cwd (bug de 13/10)');
if (fail && stderr) console.error('  stderr do servidor:\n' + stderr.split('\n').slice(-8).join('\n'));

// --- 4. hook ---------------------------------------------------------------------
console.log('\n[multiplataforma] hook de SessionStart');
const hooks = JSON.parse(fs.readFileSync(path.join(ROOT, 'hooks', 'hooks.json'), 'utf8'));
// 0.39.0 (P176): EXEC FORM, uma entrada por SO. Shell form sem Git Bash cai no
// PowerShell, que imprime a linha em vez de executar — e instalar o Git pede admin.
const entradas = hooks.hooks.SessionStart[0].hooks;
const hWin = entradas.find((h) => h.command === 'powershell.exe');
const hPosix = entradas.find((h) => h.command === '/bin/sh');
ok(entradas.length === 2 && hWin && hPosix, 'duas entradas: powershell.exe (Windows) e /bin/sh (macOS/Linux)');
ok(entradas.every((h) => Array.isArray(h.args) && !('shell' in h)), 'todas em exec form (`args` presente) — nenhuma passa por shell');
ok(hWin && hWin.args.includes('-File') && /run-node\.ps1$/.test(hWin.args[hWin.args.indexOf('-File') + 1]), 'Windows: powershell -File run-node.ps1');
ok(hWin && hWin.args.includes('-NoProfile') && hWin.args.includes('Bypass'), 'Windows: -NoProfile e -ExecutionPolicy Bypass (sem elevacao, sem profile)');
ok(hPosix && /run-node\.sh$/.test(hPosix.args[0]), 'POSIX: /bin/sh run-node.sh');
ok(entradas.every((h) => /session-start\.mjs$/.test(h.args[h.args.length - 1])), 'as duas executam o session-start.mjs');
const ps1 = fs.readFileSync(path.join(ROOT, 'scripts', 'run-node.ps1'));
ok(![...ps1].some((b) => b > 0x7f), 'run-node.ps1 em ASCII puro (PowerShell 5.1 le sem BOM como ANSI)');
ok(/run-node\.bat/.test(ps1.toString()) && /NoNewWindow/.test(ps1.toString()) && /RedirectStandardInput/.test(ps1.toString()), 'run-node.ps1 delega ao .bat herdando o stdout (sem pipeline do PowerShell)');

const eco = path.join(cwdTeste, 'eco com espaco.mjs');
// O eco devolve o stdin e um acento: prova que o session_id chega e que a saida nao
// e redecodificada no caminho.
fs.writeFileSync(eco, "let d='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log('HOOK-RODOU sessão '+d.trim()));\n");
const rodarExec = (h) => {
  const args = h.args.map((a) => expandir(a, { CLAUDE_PLUGIN_ROOT: ROOT }).replace(/[^"]*session-start\.mjs$/, eco));
  return spawnSync(h.command, args, { input: JSON.stringify({ session_id: 'teste' }), encoding: 'utf8', windowsHide: true, env: { ...process.env, CONNECT_HOME: '${CONNECT_HOME}' }, cwd: cwdTeste });
};
if (!WIN) {
  const r = rodarExec(hPosix);
  ok(r.status === 0 && /HOOK-RODOU sessão .*teste/.test(r.stdout), 'exec form /bin/sh executa o hook, com stdin e UTF-8 intactos');
  const outro = rodarExec(hWin);
  ok(outro.error || outro.status !== 0 || !/HOOK-RODOU/.test(outro.stdout || ''), 'a entrada do Windows nao executa nada aqui');
} else {
  const r = rodarExec(hWin);
  ok(r.status === 0 && /HOOK-RODOU sessão .*teste/.test(r.stdout), 'exec form powershell executa o hook, com stdin e UTF-8 intactos, caminho com espaco');
  const outro = rodarExec(hPosix);
  ok(!!outro.error, 'a entrada /bin/sh falha ao iniciar no Windows (ENOENT) — nao roda em dobro');
  ok(!fs.existsSync(path.join(cwdTeste, '${CONNECT_HOME}')), 'e nao cria "${CONNECT_HOME}" no cwd');
}

fs.rmSync(cwdTeste, { recursive: true, force: true });
console.log(`\nspike-multiplataforma: ${pass} ok, ${fail} falha(s)`);
process.exit(fail ? 1 : 0);
