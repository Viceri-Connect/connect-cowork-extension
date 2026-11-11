// tests/regressao/cowork.mjs
// O que o Cowork recebia na 0.40.0 (ultima versao antes do multi-harness), medido num
// estado de maquina fixo. Serve ao teste de regressao (cowork.test.mjs) e ao gerador da
// referencia (gerar-referencia.mjs), que roda contra o pacote de uma versao ANTERIOR.
//
// Sem dependencia de Vitest: o gerador roda com `node` puro contra um checkout da main.

import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const REFERENCIA = path.join(RAIZ, 'tests', 'regressao', 'referencia-0.40.0');
export const PACOTE_ATUAL = path.join(RAIZ, 'plugins', 'connect');
const ID_SESSAO = 'regressao-cowork';

// Perfil descartavel fora de AppData (o Connect recusa home la), com o Node semeado no
// CONNECT_HOME para o runtime portatil nao baixar nada.
function sandbox(prefixo) {
  const base = path.join(RAIZ, '.test-tmp');
  fs.mkdirSync(base, { recursive: true });
  const raiz = fs.mkdtempSync(path.join(base, prefixo));
  const home = path.join(raiz, 'home');
  const bin = path.join(home, 'Connect', 'bin');
  fs.mkdirSync(bin, { recursive: true });
  const node = path.join(bin, process.platform === 'win32' ? 'node.exe' : 'node');
  try { fs.linkSync(process.execPath, node); } catch { fs.copyFileSync(process.execPath, node); fs.chmodSync(node, 0o755); }
  const env = Object.fromEntries(Object.entries(process.env)
    .filter(([k]) => !k.startsWith('CONNECT_') && !/^(CLAUDE_CODE_REMOTE|CLAUDE_SESSION_ID|PLUGIN_DATA|COPILOT_PLUGIN_DATA|CLAUDE_PLUGIN_DATA)$/.test(k)));
  Object.assign(env, { HOME: home, USERPROFILE: home, CONNECT_HOME: path.join(home, 'Connect'), NO_COLOR: '1' });
  return { raiz, home, env, limpar: () => fs.rmSync(raiz, { recursive: true, force: true, maxRetries: 3 }) };
}

// Matriz com carta e governanca publicada + perfil do operador: o caso do operador que ja
// passou pelo 1o uso. A governanca e publicada pela lib do PROPRIO pacote medido.
async function montarMaquina(sb, pacote) {
  const { publicarGovernanca } = await import(pathToFileURL(path.join(pacote, 'lib', 'governanca.mjs')).href);
  const matriz = path.join(sb.raiz, 'Matriz');
  fs.mkdirSync(path.join(matriz, '_cerebro'), { recursive: true });
  fs.writeFileSync(path.join(matriz, '_cerebro', 'vault-config.md'), '# Config do Vault\n## Identidade\n- tipo-vault: matriz\n- contexto: "regressao"\n');
  fs.writeFileSync(path.join(matriz, '_cerebro', 'camada-1.md'), '---\ntipo-artefato: camada-1\nvault: Matriz de regressao\n---\n\n# Camada 1\n\n## O que e este vault\nMatriz de teste.\n\n## Quando carregar\n\n| Gatilho | Arquivo |\n|---|---|\n| processo | [[processo]] |\n');
  publicarGovernanca(matriz, { vault: 'matriz', agora: new Date('2026-01-01T00:00:00Z') });
  const home = sb.env.CONNECT_HOME;
  fs.mkdirSync(path.join(home, 'operador', '_cerebro'), { recursive: true });
  fs.writeFileSync(path.join(home, 'operador', '_cerebro', 'meu-config.md'), '# Minha Config\n## Identidade (cross-cliente)\n- nome: "Operadora de Regressao"\n- emails: "regressao@exemplo.com"\n- papeis-estaveis: ["Dev"]\n');
  fs.writeFileSync(path.join(home, 'operador', 'CLAUDE.md'), '# Camada 0 da operadora\n\nPreferencia pessoal de teste.\n');
  fs.writeFileSync(path.join(home, 'connect.config.json'), JSON.stringify({ vaultMatriz: matriz }));
}

// Caminhos do sandbox e o tipo de link mudam por maquina e por SO; o texto nao.
export function normalizar(texto, raiz) {
  let t = String(texto);
  for (const r of [raiz, raiz.replaceAll('\\', '\\\\'), raiz.replaceAll('\\', '/')]) t = t.replaceAll(r, '<RAIZ>');
  return t.replaceAll('\\\\', '/').replaceAll('\\', '/')
    .replace(/\((junction|symlink)\)/g, '(link)')
    .replace(/\r\n/g, '\n')
    .trimEnd();
}

function rodarHook(pacote, env, payload) {
  const r = spawnSync(process.execPath, [path.join(pacote, 'hooks', 'session-start.mjs')], {
    cwd: pacote, env, input: JSON.stringify(payload), encoding: 'utf8', timeout: 30_000, windowsHide: true,
  });
  if (r.status !== 0) throw new Error(`hook saiu com ${r.status}: ${r.stderr}`);
  return r.stdout;
}

// Hook de SessionStart do Cowork (hooks/session-start.mjs), no caso normal e no de sessao
// na nuvem sem configuracao local (0.40.0).
export async function contextosDoCowork(pacote) {
  const sb = sandbox('regressao-cowork-');
  try {
    await montarMaquina(sb, pacote);
    // Aquecimento: a 1a sessao da maquina pode emitir avisos de uma vez so.
    rodarHook(pacote, sb.env, { session_id: 'aquecimento' });
    const sessao = normalizar(rodarHook(pacote, sb.env, { session_id: ID_SESSAO, source: 'startup' }), sb.raiz);
    const semConfig = sandbox('regressao-nuvem-');
    try {
      const nuvem = normalizar(rodarHook(pacote, { ...semConfig.env, CONNECT_EXECUCAO: 'nuvem' }, { session_id: ID_SESSAO }), semConfig.raiz);
      return { sessao, nuvem };
    } finally {
      semConfig.limpar();
    }
  } finally {
    sb.limpar();
  }
}

// Arquivos que SO o Cowork/Claude le para subir hook e MCP. Os outros hosts tem os
// proprios; mexer nestes muda o Cowork. Hash do conteudo com fim de linha normalizado.
export const SUPERFICIE_COWORK = ['hooks/hooks.json', '.mcp.json', 'mcp/launcher.bat', 'scripts/run-node.ps1'];

export function hashesDaSuperficie(pacote) {
  return Object.fromEntries(SUPERFICIE_COWORK.map((rel) => {
    const texto = fs.readFileSync(path.join(pacote, rel), 'utf8').replace(/\r\n/g, '\n');
    return [rel, createHash('sha256').update(texto).digest('hex')];
  }));
}

// tools/list do servidor MCP (stdio), so o que e contrato com o agente.
export function toolsDoMcp(pacote) {
  const sb = sandbox('regressao-mcp-');
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [path.join(pacote, 'mcp', 'connect-mcp.mjs')], { env: sb.env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let buf = '';
    const fim = (erro, valor) => { clearTimeout(t); p.kill(); sb.limpar(); return erro ? reject(erro) : resolve(valor); };
    const t = setTimeout(() => fim(new Error('tools/list sem resposta')), 20_000);
    p.stdout.on('data', (d) => {
      buf += d;
      for (const linha of buf.split('\n')) {
        let m;
        try { m = JSON.parse(linha); } catch { continue; }
        if (m.id === 2) {
          const tools = m.result.tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
          fim(null, tools.sort((a, b) => a.name.localeCompare(b.name)));
        }
      }
    });
    const enviar = (o) => p.stdin.write(`${JSON.stringify(o)}\n`);
    enviar({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'regressao', version: '1' } } });
    enviar({ jsonrpc: '2.0', method: 'notifications/initialized' });
    enviar({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  });
}
