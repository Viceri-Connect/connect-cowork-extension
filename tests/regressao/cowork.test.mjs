// tests/regressao/cowork.test.mjs
// REGRESSAO DO COWORK: o multi-harness (0.41.0) nao pode mudar o que o Cowork recebia.
//
// A referencia (referencia-0.40.0/) foi gerada pelo pacote da main na 0.40.0, a ultima
// versao antes do multi-harness (ver gerar-referencia.mjs). Cada teste compara o pacote
// atual com ela no mesmo estado de maquina:
//   - o texto que o hook de SessionStart do Cowork injeta (sessao normal e na nuvem);
//   - o contrato das tools do MCP (as da 0.40.0 continuam iguais; tool nova pode entrar);
//   - os arquivos que so o Cowork le para subir hook e MCP;
//   - o runtime portatil (run-node.*) no caso do Cowork: Node no CONNECT_HOME/bin, mesmo
//     com a pasta de dados do plugin definida.
//
// Mudanca decidida no Cowork = regenerar a referencia e registrar no CHANGELOG.

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { REFERENCIA, PACOTE_ATUAL, RAIZ, contextosDoCowork, toolsDoMcp, hashesDaSuperficie } from './cowork.mjs';

const ler = (nome) => fs.readFileSync(path.join(REFERENCIA, nome), 'utf8').replace(/\r\n/g, '\n').trimEnd();
const WIN = process.platform === 'win32';
const NODE = WIN ? 'node.exe' : 'node';
const SCRIPTS = path.join(PACOTE_ATUAL, 'scripts');

describe('regressao do Cowork contra a 0.40.0', () => {
  it('o hook de SessionStart injeta o mesmo texto (sessao normal e na nuvem)', async () => {
    const { sessao, nuvem } = await contextosDoCowork(PACOTE_ATUAL);
    expect(sessao).toBe(ler('contexto-sessao.md'));
    expect(nuvem).toBe(ler('contexto-nuvem.md'));
  });

  it('as tools da 0.40.0 mantem nome, descricao e parametros', async () => {
    const antes = JSON.parse(ler('mcp-tools.json'));
    const agora = new Map((await toolsDoMcp(PACOTE_ATUAL)).map((t) => [t.name, t]));
    for (const t of antes) {
      expect(agora.has(t.name), `tool ${t.name} sumiu`).toBe(true);
      expect(agora.get(t.name), `tool ${t.name} mudou de contrato`).toEqual(t);
    }
  });

  it('os arquivos que o Cowork le para subir hook e MCP nao mudaram', () => {
    expect(hashesDaSuperficie(PACOTE_ATUAL)).toEqual(JSON.parse(ler('superficie-cowork.json')));
  });
});

// ---------------------------------------------------------------------------
// Runtime portatil no caso do Cowork
// ---------------------------------------------------------------------------

// Assincrono: o download pode levar minutos, e um spawnSync travaria o worker do Vitest.
function rodarRunNode(env, script) {
  const base = Object.fromEntries(Object.entries(process.env)
    .filter(([k]) => !k.startsWith('CONNECT_') && !/^(CLAUDE_CODE_REMOTE|PLUGIN_DATA|COPILOT_PLUGIN_DATA|CLAUDE_PLUGIN_DATA)$/.test(k)));
  const opcoes = { env: { ...base, ...env }, windowsHide: true };
  const filho = WIN
    ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `""${path.join(SCRIPTS, 'run-node.bat')}" "${script}""`], { ...opcoes, windowsVerbatimArguments: true })
    : spawn('/bin/sh', [path.join(SCRIPTS, 'run-node.sh'), script], opcoes);
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    filho.stdout.on('data', (d) => { stdout += d; });
    filho.stderr.on('data', (d) => { stderr += d; });
    filho.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

function cenario(prefixo) {
  fs.mkdirSync(path.join(RAIZ, '.test-tmp'), { recursive: true });
  const raiz = fs.mkdtempSync(path.join(RAIZ, '.test-tmp', prefixo));
  const script = path.join(raiz, 'qual-node.mjs');
  fs.writeFileSync(script, 'process.stdout.write(process.execPath)\n');
  const semear = (pasta) => {
    const destino = path.join(pasta, NODE);
    fs.mkdirSync(pasta, { recursive: true });
    try { fs.linkSync(process.execPath, destino); } catch { fs.copyFileSync(process.execPath, destino); fs.chmodSync(destino, 0o755); }
    return destino;
  };
  return { raiz, script, semear, limpar: () => fs.rmSync(raiz, { recursive: true, force: true, maxRetries: 3 }) };
}

const mesmo = (a, b) => path.resolve(String(a).trim()).toLowerCase() === path.resolve(b).toLowerCase();

describe('runtime portatil no Cowork', () => {
  it('com Node no CONNECT_HOME, usa ele mesmo com CLAUDE_PLUGIN_DATA definido', async () => {
    const c = cenario('runtime-cowork-');
    try {
      const home = path.join(c.raiz, 'Connect');
      const doHome = c.semear(path.join(home, 'bin'));
      c.semear(path.join(c.raiz, 'dados-do-plugin', 'bin'));
      const r = await rodarRunNode({ CONNECT_HOME: home, CLAUDE_PLUGIN_DATA: path.join(c.raiz, 'dados-do-plugin') }, c.script);
      expect(r.status, r.stderr).toBe(0);
      expect(mesmo(r.stdout, doHome), `usou ${r.stdout}`).toBe(true);
    } finally {
      c.limpar();
    }
  });

  it('CONNECT_HOME nao definido no Cowork (chega como "${CONNECT_HOME}") cai no perfil do usuario', async () => {
    const c = cenario('runtime-cowork-literal-');
    try {
      const perfil = path.join(c.raiz, 'perfil');
      const doPerfil = c.semear(path.join(perfil, 'Connect', 'bin'));
      const r = await rodarRunNode({ CONNECT_HOME: '${CONNECT_HOME}', USERPROFILE: perfil, HOME: perfil }, c.script);
      expect(r.status, r.stderr).toBe(0);
      // No POSIX o home padrao e ~/.connect; no Windows, %USERPROFILE%\Connect.
      if (WIN) expect(mesmo(r.stdout, doPerfil), `usou ${r.stdout}`).toBe(true);
      else expect(r.stdout.trim()).not.toContain('${CONNECT_HOME}');
    } finally {
      c.limpar();
    }
  });

  // Download de verdade do nodejs.org (~30-70 MB): so com CONNECT_TESTE_DOWNLOAD=1.
  it.runIf(process.env.CONNECT_TESTE_DOWNLOAD === '1')('CONNECT_HOME vazio e gravavel: baixa o Node para o CONNECT_HOME/bin, nao para a pasta do plugin', async () => {
    const c = cenario('runtime-download-');
    try {
      const home = path.join(c.raiz, 'Connect');
      const dados = path.join(c.raiz, 'dados-do-plugin');
      fs.mkdirSync(dados, { recursive: true });
      const r = await rodarRunNode({ CONNECT_HOME: home, CLAUDE_PLUGIN_DATA: dados }, c.script);
      expect(r.status, r.stderr).toBe(0);
      expect(r.stderr).not.toMatch(/node do PATH/);
      expect(mesmo(r.stdout, path.join(home, 'bin', NODE)), `usou ${r.stdout}`).toBe(true);
      expect(fs.readdirSync(dados)).toEqual([]);
    } finally {
      c.limpar();
    }
  }, 600_000);
});
