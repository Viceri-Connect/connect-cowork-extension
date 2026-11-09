// tests/architecture/harness-checks.mjs
// Verificacoes do contrato de harnesses (harness-contract.mjs).
//
// Cada funcao devolve uma LISTA DE VIOLACOES (strings legiveis) — vazia = conforme.
// Nao depende do Vitest: roda tambem com `node tests/architecture/harness-checks.mjs`,
// o que permite diagnosticar o contrato em maquina sem node_modules.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  ENTRADA_MCP, ENV_NUVEM, EVENTOS_OBRIGATORIOS, FONTE_SKILLS, FONTE_VERSAO, HARNESSES, MARCADOR_BOOTSTRAP, MARCADOR_NUVEM,
  MARKETPLACES, COPILOT_SETTINGS, NUCLEO_COMPARTILHADO, PACOTES, SERVIDOR_MCP, SESSION_ID, VARIANTES,
  ehSuperficieDeHost,
} from './harness-contract.mjs';
import { parseFrontmatter } from '../../plugins/connect/lib/frontmatter.mjs';
import { MARCA_ACESSO_COMPLETO, MARCA_ACESSO_LEMBRETE } from '../../plugins/connect/lib/render.mjs';
import { ARQUIVO_REGRAS_SEMPRE_ATIVAS, textoRegrasSempreAtivas } from '../../plugins/connect/lib/regras.mjs';

const MARCA_ACESSO_COWORK = 'acesso de pasta (faca isto primeiro)';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// ---------------------------------------------------------------------------
// utilitarios
// ---------------------------------------------------------------------------
const posix = (p) => p.replaceAll('\\', '/');

function lerJson(arquivo) {
  return JSON.parse(fs.readFileSync(arquivo, 'utf8'));
}

function tentarJson(arquivo, violacoes, rotulo) {
  if (!fs.existsSync(arquivo)) {
    violacoes.push(`${rotulo}: arquivo ausente (${posix(path.relative(RAIZ, arquivo))})`);
    return null;
  }
  try {
    return lerJson(arquivo);
  } catch (e) {
    violacoes.push(`${rotulo}: JSON invalido em ${posix(path.relative(RAIZ, arquivo))} — ${e.message}`);
    return null;
  }
}

export function listarArquivos(dir, prefixo = '') {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const rel = prefixo ? `${prefixo}/${e.name}` : e.name;
    return e.isDirectory() ? listarArquivos(path.join(dir, e.name), rel) : [rel];
  }).sort();
}

const dirPacote = (nome) => path.join(RAIZ, PACOTES[nome].dir);
const resolverNoPacote = (nome, rel) => path.join(dirPacote(nome), String(rel).replace(/^\.\//, ''));

// Caminhos que um comando/arg referencia dentro do pacote: ${VAR}/x, ./x.
export function referenciasDePacote(texto) {
  const refs = [];
  // Separador `/` ou `\` (o override de Windows do Codex usa barra invertida).
  for (const m of String(texto).matchAll(/\$\{(?:CLAUDE_)?PLUGIN_ROOT\}[\\/]([^"'\s]+)/g)) refs.push(m[1].replaceAll('\\', '/'));
  for (const m of String(texto).matchAll(/(?:^|[\s"'])\.\/([^"'\s]+)/g)) refs.push(m[1]);
  return refs;
}

// Todos os valores string de um JSON (comandos, args, ponteiros), em qualquer profundidade.
export function stringsDe(valor) {
  if (typeof valor === 'string') return [valor];
  if (Array.isArray(valor)) return valor.flatMap(stringsDe);
  if (valor && typeof valor === 'object') return Object.values(valor).flatMap(stringsDe);
  return [];
}

export function variaveisDeRaizUsadas(texto) {
  return [...new Set([...String(texto).matchAll(/\$\{([A-Z_]*PLUGIN_ROOT)\}/g)].map((m) => m[1]))];
}

export function versaoCanonica() {
  return lerJson(path.join(RAIZ, FONTE_VERSAO)).version;
}

function lerManifesto(pacote, harness, violacoes) {
  const h = HARNESSES[harness];
  return tentarJson(resolverNoPacote(pacote, h.manifesto), violacoes, `${pacote}/${harness} manifesto`);
}

function lerHooksDoHarness(pacote, harness, violacoes) {
  const h = HARNESSES[harness];
  const manifesto = lerManifesto(pacote, harness, []) || {};
  const rel = h.hooks(manifesto);
  if (!rel) {
    violacoes.push(`${pacote}/${harness}: nenhum arquivo de hooks declarado`);
    return [];
  }
  const json = tentarJson(resolverNoPacote(pacote, rel), violacoes, `${pacote}/${harness} hooks`);
  if (!json) return [];
  try {
    return h.lerHooks(json);
  } catch (e) {
    violacoes.push(`${pacote}/${harness} hooks: ${e.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// FEATURE: identidade (manifesto, nome, versao, schema)
// ---------------------------------------------------------------------------
export function checarIdentidade(pacote, harness) {
  const v = [];
  const h = HARNESSES[harness];
  const m = lerManifesto(pacote, harness, v);
  if (!m) return v;
  if (m.name !== pacote) v.push(`${pacote}/${harness}: manifesto declara name="${m.name}", esperado "${pacote}"`);
  const canonica = versaoCanonica();
  if (h.exigeVersao && !m.version) v.push(`${pacote}/${harness}: manifesto sem "version"`);
  if (m.version && m.version !== canonica) {
    v.push(`${pacote}/${harness}: version ${m.version} diverge da canonica ${canonica} (${FONTE_VERSAO})`);
  }
  if (h.schema && m.$schema !== h.schema) v.push(`${pacote}/${harness}: $schema "${m.$schema}", esperado "${h.schema}"`);
  return v;
}

// ---------------------------------------------------------------------------
// FEATURE: servidor MCP "connect" no transporte da variante
// ---------------------------------------------------------------------------
export function checarMcp(pacote, harness) {
  const v = [];
  const h = HARNESSES[harness];
  const manifesto = lerManifesto(pacote, harness, []) || {};
  const rel = h.mcp(manifesto);
  if (!rel || typeof rel !== 'string') {
    v.push(`${pacote}/${harness}: nenhuma config de MCP declarada`);
    return v;
  }
  const cfg = tentarJson(resolverNoPacote(pacote, rel), v, `${pacote}/${harness} mcp`);
  if (!cfg) return v;
  const servidor = cfg.mcpServers?.[SERVIDOR_MCP];
  if (!servidor) {
    v.push(`${pacote}/${harness}: mcpServers.${SERVIDOR_MCP} ausente em ${rel}`);
    return v;
  }
  const variante = VARIANTES[PACOTES[pacote].variante];
  if (variante.transporte === 'http') {
    const esperado = h.mcpHttp(variante.url);
    if (JSON.stringify(servidor) !== JSON.stringify(esperado)) {
      v.push(`${pacote}/${harness}: MCP http deveria ser ${JSON.stringify(esperado)}, veio ${JSON.stringify(servidor)}`);
    }
    return v;
  }
  // stdio: precisa lancar o servidor, direto ou por wrapper que o referencie.
  if (servidor.url || servidor.serverUrl) v.push(`${pacote}/${harness}: variante stdio nao pode declarar url`);
  if (servidor.type && servidor.type !== 'stdio') v.push(`${pacote}/${harness}: type "${servidor.type}" em variante stdio`);
  const linha = [servidor.command, ...(servidor.args || [])].join(' ');
  const refs = referenciasDePacote(linha);
  if (!refs.length) v.push(`${pacote}/${harness}: comando do MCP nao referencia arquivo do pacote (${linha})`);
  const chegaNoServidor = refs.some((r) => {
    if (r === ENTRADA_MCP) return true;
    const alvo = resolverNoPacote(pacote, r);
    return fs.existsSync(alvo) && fs.readFileSync(alvo, 'utf8').includes(path.posix.basename(ENTRADA_MCP));
  });
  if (refs.length && !chegaNoServidor) v.push(`${pacote}/${harness}: MCP nao chega em ${ENTRADA_MCP} (refs: ${refs.join(', ')})`);
  return v;
}

// ---------------------------------------------------------------------------
// FEATURE: hook de SessionStart declarado, cobrindo startup/resume
// ---------------------------------------------------------------------------
export function checarHookDeclarado(pacote, harness) {
  const v = [];
  const hooks = lerHooksDoHarness(pacote, harness, v);
  if (!v.length && !hooks.length) v.push(`${pacote}/${harness}: nenhum hook de SessionStart declarado`);
  for (const hk of hooks) {
    if (!hk.command) { v.push(`${pacote}/${harness}: hook de SessionStart sem command`); continue; }
    if (!hk.command.match(/\.mjs\b/)) v.push(`${pacote}/${harness}: hook nao executa um entrypoint .mjs (${hk.command})`);
    if (HARNESSES[harness].exigeExecForm && !hk.execForm) {
      v.push(`${pacote}/${harness}: hook em shell form (${hk.command}) — este host exige exec form (command + args)`);
    }
    if (hk.matcher !== undefined) {
      const eventos = String(hk.matcher).split('|');
      for (const e of EVENTOS_OBRIGATORIOS) {
        if (!eventos.includes(e)) v.push(`${pacote}/${harness}: matcher "${hk.matcher}" nao cobre "${e}"`);
      }
    }
  }
  return v;
}

// ---------------------------------------------------------------------------
// FEATURE: toda referencia de caminho (manifesto, MCP, hooks) existe no pacote
// ---------------------------------------------------------------------------
export function checarReferencias(pacote, harness) {
  const v = [];
  const h = HARNESSES[harness];
  for (const rel of h.arquivos) {
    const alvo = resolverNoPacote(pacote, rel);
    if (!fs.existsSync(alvo)) { v.push(`${pacote}/${harness}: arquivo do harness ausente: ${rel}`); continue; }
    if (!rel.endsWith('.json')) continue;
    const json = JSON.parse(fs.readFileSync(alvo, 'utf8'));
    for (const ref of stringsDe(json).flatMap(referenciasDePacote)) {
      if (!fs.existsSync(resolverNoPacote(pacote, ref))) v.push(`${pacote}/${harness}: ${rel} referencia ${ref}, que nao existe no pacote`);
    }
    // ponteiros de manifesto ("./.mcp.json", "./hooks/x.json")
    for (const chave of ['mcpServers', 'hooks']) {
      const valor = json[chave];
      if (typeof valor === 'string' && !fs.existsSync(resolverNoPacote(pacote, valor))) {
        v.push(`${pacote}/${harness}: ${rel}#${chave} aponta para ${valor}, que nao existe`);
      }
    }
  }
  return v;
}

// ---------------------------------------------------------------------------
// FEATURE: isolamento — cada harness so usa a propria variavel de raiz e nao fixa
// CONNECT_HOME (o home e por maquina, compartilhado por todos os hosts).
// ---------------------------------------------------------------------------
export function checarIsolamento(pacote, harness) {
  const v = [];
  const h = HARNESSES[harness];
  for (const rel of h.arquivos.filter((r) => r.endsWith('.json'))) {
    const alvo = resolverNoPacote(pacote, rel);
    if (!fs.existsSync(alvo)) continue;
    const texto = fs.readFileSync(alvo, 'utf8');
    for (const usada of variaveisDeRaizUsadas(texto)) {
      if (!h.variaveisDeRaiz.includes(usada)) v.push(`${pacote}/${harness}: ${rel} usa \${${usada}}, que este host nao define (use ${h.variaveisDeRaiz.map((x) => `\${${x}}`).join(' ou ')})`);
    }
    if (harness !== 'claude' && /CONNECT_HOME/.test(texto)) {
      v.push(`${pacote}/${harness}: ${rel} fixa CONNECT_HOME — o home e por maquina e compartilhado com o Cowork`);
    }
  }
  return v;
}

// ---------------------------------------------------------------------------
// FEATURE: bootstrap real — o hook roda e injeta o contexto no formato do host
// ---------------------------------------------------------------------------
export function entrypointDoHook(pacote, harness) {
  const hooks = lerHooksDoHarness(pacote, harness, []);
  const refs = hooks.flatMap((hk) => referenciasDePacote(hk.command)).filter((r) => r.endsWith('.mjs'));
  if (!refs.length) {
    const outras = hooks.flatMap((hk) => Object.values(hk.linhas || {}).flatMap(referenciasDePacote)).filter((r) => r.endsWith('.mjs'));
    return outras.length ? resolverNoPacote(pacote, outras[outras.length - 1]) : null;
  }
  return refs.length ? resolverNoPacote(pacote, refs[refs.length - 1]) : null;
}

// Roda o entrypoint do hook do host num perfil descartavel e devolve o contexto injetado.
// `verificar(contexto, env)` roda antes de o perfil ser apagado e devolve violacoes.
function rodarHook(pacote, harness, { envExtra = {}, verificar, base = path.join(RAIZ, '.test-tmp') }) {
  const v = [];
  const h = HARNESSES[harness];
  const script = entrypointDoHook(pacote, harness);
  if (!script) return [`${pacote}/${harness}: hook sem entrypoint .mjs no pacote`];
  if (!fs.existsSync(script)) return [`${pacote}/${harness}: entrypoint ${posix(path.relative(RAIZ, script))} nao existe`];

  // Perfil descartavel fora de AppData (o Connect recusa home la — ver helpers/isolamento.mjs).
  fs.mkdirSync(base, { recursive: true });
  const raiz = fs.mkdtempSync(path.join(base, `arch-${pacote}-${harness}-`));
  try {
    const home = path.join(raiz, 'home');
    fs.mkdirSync(home, { recursive: true });
    // Nada do CONNECT_* nem do sinal de nuvem da maquina que roda o teste.
    const env = Object.fromEntries(Object.entries(process.env)
      .filter(([k]) => !k.startsWith('CONNECT_') && k !== 'CLAUDE_CODE_REMOTE'));
    Object.assign(env, { HOME: home, USERPROFILE: home, CONNECT_HOME: path.join(home, 'Connect'), NO_COLOR: '1' }, envExtra);

    const r = spawnSync(process.execPath, [script], {
      cwd: dirPacote(pacote),
      env,
      input: JSON.stringify(h.payload()),
      encoding: 'utf8',
      timeout: 30_000,
      windowsHide: true,
    });
    if (r.status !== 0) return [`${pacote}/${harness}: hook saiu com ${r.status} — ${r.stderr || r.error?.message}`];
    // Os hooks engolem a excecao (exit 0) para nao derrubar a sessao do host; a marca
    // da falha fica no stderr com estas mensagens (ver hooks/*.mjs e copilot/*.mjs).
    if (/falha no iniciar_sessao|bootstrap failed/i.test(r.stderr || '')) v.push(`${pacote}/${harness}: hook reportou falha no stderr — ${r.stderr.trim()}`);

    let contexto;
    try {
      contexto = h.lerSaida(r.stdout);
    } catch (e) {
      return [...v, `${pacote}/${harness}: saida do hook fora do formato do host — ${e.message}; stdout=${r.stdout.slice(0, 200)}`];
    }
    v.push(...verificar(typeof contexto === 'string' ? contexto : '', env));
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true, maxRetries: 3 });
  }
  return v;
}

export function checarBootstrap(pacote, harness) {
  return rodarHook(pacote, harness, {
    verificar: (contexto, env) => {
      const v = [];
      if (!contexto.includes(MARCADOR_BOOTSTRAP)) v.push(`${pacote}/${harness}: hook nao injetou o bootstrap ("${MARCADOR_BOOTSTRAP}" ausente)`);
      if (!fs.existsSync(path.join(env.CONNECT_HOME, 'sessions', SESSION_ID(harness)))) {
        v.push(`${pacote}/${harness}: o session id do payload do host nao chegou ao iniciar_sessao`);
      }
      return v;
    },
  });
}

// FEATURE: sessao na nuvem sem configuracao local — o hook orienta, nunca diagnostica
// "1o uso" (0.40.0). Todos os hosts passam pelo mesmo lib/bootstrap.mjs.
export function checarBootstrapNuvem(pacote, harness) {
  return rodarHook(pacote, harness, {
    envExtra: ENV_NUVEM,
    verificar: (contexto, env) => {
      const v = [];
      if (!contexto.includes(MARCADOR_NUVEM)) v.push(`${pacote}/${harness}: na nuvem sem configuracao local o hook nao orientou ("${MARCADOR_NUVEM}" ausente)`);
      if (contexto.includes(MARCADOR_BOOTSTRAP)) v.push(`${pacote}/${harness}: na nuvem o hook diagnosticou a sessao local em vez de orientar`);
      if (fs.existsSync(path.join(env.CONNECT_HOME, 'sessions'))) v.push(`${pacote}/${harness}: na nuvem o hook criou sessao no CONNECT_HOME do servidor`);
      return v;
    },
  });
}

// ---------------------------------------------------------------------------
// FEATURE: runtime portatil — nenhum host depende de `node` no PATH (0.41.0).
// Hooks e MCP passam pelo runtime do Cowork: scripts/run-node.* garante o Node portatil
// em CONNECT_HOME/bin (ou na pasta de dados do host, em sandbox).
// ---------------------------------------------------------------------------
const RUNTIME = /scripts[\\/]run-node\.(sh|ps1|bat)\b/;
const SOS = ['posix', 'windows'];

function launcherChegaNoRuntime(pacote, ref) {
  const alvo = resolverNoPacote(pacote, ref);
  if (!fs.existsSync(alvo) || !/run-node/.test(fs.readFileSync(alvo, 'utf8'))) return false;
  // Launcher sem extensao (POSIX) precisa do irmao .cmd: o host do Windows resolve pelo PATHEXT.
  if (!path.extname(alvo)) return fs.existsSync(`${alvo}.cmd`) && /run-node\.bat/.test(fs.readFileSync(`${alvo}.cmd`, 'utf8'));
  return true;
}

export function checarRuntimePortatil(pacote, harness) {
  const v = [];
  const h = HARNESSES[harness];
  const hooks = lerHooksDoHarness(pacote, harness, v);
  const cobre = Object.fromEntries(SOS.map((so) => [so, false]));
  for (const hk of hooks) {
    for (const so of SOS) {
      const l = hk.linhas?.[so];
      if (!l) continue;
      if (RUNTIME.test(l)) cobre[so] = true;
      else v.push(`${pacote}/${harness}: hook (${so}) nao passa pelo runtime portatil (scripts/run-node.*): ${l}`);
    }
  }
  if (hooks.length) for (const so of SOS) if (!cobre[so]) v.push(`${pacote}/${harness}: nenhum hook de SessionStart para ${so} pelo runtime portatil`);

  if (VARIANTES[PACOTES[pacote].variante].transporte !== 'stdio') return v;
  const rel = h.mcp(lerManifesto(pacote, harness, []) || {});
  const servidor = (typeof rel === 'string' && tentarJson(resolverNoPacote(pacote, rel), [], ''))?.mcpServers?.[SERVIDOR_MCP];
  if (!servidor) return v; // ausencia ja e violacao da feature "mcp"
  if (/^node(\.exe)?$/i.test(String(servidor.command))) {
    v.push(`${pacote}/${harness}: MCP chama "node" direto — exige Node no PATH; use o launcher do runtime portatil`);
  }
  const refs = referenciasDePacote([servidor.command, ...(servidor.args || [])].join(' '));
  if (!refs.some((r) => launcherChegaNoRuntime(pacote, r))) {
    v.push(`${pacote}/${harness}: MCP nao sobe por launcher que chegue ao runtime portatil (refs: ${refs.join(', ') || 'nenhuma'})`);
  }
  return v;
}

// Sandbox com o runtime portatil ja "instalado" (hard link do Node que roda o teste):
// prova que o caminho usado e o do CONNECT_HOME, sem baixar 70 MB a cada execucao.
function sandboxComRuntime(prefixo, base = path.join(RAIZ, '.test-tmp')) {
  fs.mkdirSync(base, { recursive: true });
  const raiz = fs.mkdtempSync(path.join(base, prefixo));
  const home = path.join(raiz, 'home');
  const bin = path.join(home, 'Connect', 'bin');
  fs.mkdirSync(bin, { recursive: true });
  const node = path.join(bin, process.platform === 'win32' ? 'node.exe' : 'node');
  try { fs.linkSync(process.execPath, node); } catch { fs.copyFileSync(process.execPath, node); fs.chmodSync(node, 0o755); }
  const env = Object.fromEntries(Object.entries(process.env)
    .filter(([k]) => !k.startsWith('CONNECT_') && !/^(CLAUDE_CODE_REMOTE|PLUGIN_DATA|COPILOT_PLUGIN_DATA|CLAUDE_PLUGIN_DATA)$/.test(k)));
  Object.assign(env, { HOME: home, USERPROFILE: home, CONNECT_HOME: path.join(home, 'Connect'), NO_COLOR: '1' });
  return { raiz, env, limpar: () => fs.rmSync(raiz, { recursive: true, force: true, maxRetries: 3 }) };
}

const SO_ATUAL = process.platform === 'win32' ? 'windows' : 'posix';
const expandirRaiz = (texto, raiz) => String(texto).replaceAll('${PLUGIN_ROOT}', raiz).replaceAll('${CLAUDE_PLUGIN_ROOT}', raiz);

// Executa a linha do SO atual do jeito que o host executa (contrato: `shell`).
function executarComoHost(harness, hk, { raizPlugin, cwd, env, input }) {
  const modo = HARNESSES[harness].shell?.[SO_ATUAL];
  const linhaSo = expandirRaiz(hk.linhas[SO_ATUAL], raizPlugin);
  const opcoes = { cwd, env: { ...env, PLUGIN_ROOT: raizPlugin, CLAUDE_PLUGIN_ROOT: raizPlugin }, input, encoding: 'utf8', timeout: 60_000, windowsHide: true };
  if (modo === 'exec') return spawnSync(expandirRaiz(hk.exec.command, raizPlugin), hk.exec.args.map((a) => expandirRaiz(a, raizPlugin)), opcoes);
  if (modo === 'sh') return spawnSync('/bin/sh', ['-c', linhaSo], opcoes);
  if (modo === 'cmd') return spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `"${linhaSo}"`], { ...opcoes, windowsVerbatimArguments: true });
  if (modo === 'powershell') return spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', linhaSo], opcoes);
  return { status: null, error: new Error(`modo de shell desconhecido: ${modo}`) };
}

// FEATURE: o hook do SO atual roda pela linha REAL do host (wrapper + runtime portatil)
// e injeta o bootstrap — nao so o .mjs chamado direto pelo teste.
export function checarHookPeloRuntime(pacote, harness) {
  const h = HARNESSES[harness];
  const hk = lerHooksDoHarness(pacote, harness, []).find((x) => x.linhas?.[SO_ATUAL] && (x.exec || h.shell?.[SO_ATUAL] !== 'exec'));
  if (!hk) return [`${pacote}/${harness}: nenhum hook de SessionStart para ${SO_ATUAL}`];
  const sb = sandboxComRuntime(`arch-rt-${pacote}-${harness}-`);
  try {
    const raizPlugin = dirPacote(pacote);
    const r = executarComoHost(harness, hk, {
      raizPlugin, cwd: h.cwdDoHook === 'plugin' ? raizPlugin : sb.raiz, env: sb.env, input: JSON.stringify(h.payload()),
    });
    if (r.status !== 0) return [`${pacote}/${harness}: hook (${SO_ATUAL}) saiu com ${r.status} — ${r.stderr || r.error?.message}`];
    const v = [];
    if (/node do PATH|runtime indisponivel/i.test(r.stderr || '')) v.push(`${pacote}/${harness}: hook nao usou o runtime portatil — ${r.stderr.trim()}`);
    let contexto = '';
    try { contexto = h.lerSaida(r.stdout) || ''; } catch (e) { return [...v, `${pacote}/${harness}: saida fora do formato do host pelo runtime — ${e.message}; stdout=${String(r.stdout).slice(0, 200)}`]; }
    if (!contexto.includes(MARCADOR_BOOTSTRAP)) v.push(`${pacote}/${harness}: pelo runtime portatil o hook nao injetou o bootstrap`);
    return v;
  } finally {
    sb.limpar();
  }
}

// FEATURE: pedido de acesso no ritmo do host (0.41.0). Cowork concede por sessao: o bloco
// vai inteiro sempre. Os outros guardam a permissao: inteiro na 1a sessao do host,
// lembrete de uma linha depois — nunca sumir (a regra "pede, nao contorna" fica).
export function checarAcessoPorHost(pacote, harness) {
  const h = HARNESSES[harness];
  const script = entrypointDoHook(pacote, harness);
  if (!script || !fs.existsSync(script)) return [`${pacote}/${harness}: hook sem entrypoint`];
  const sb = sandboxComRuntime(`arch-acesso-${pacote}-${harness}-`);
  try {
    const rodar = () => {
      const r = spawnSync(process.execPath, [script], { cwd: dirPacote(pacote), env: sb.env, input: JSON.stringify(h.payload()), encoding: 'utf8', timeout: 30_000, windowsHide: true });
      try { return h.lerSaida(r.stdout) || ''; } catch { return ''; }
    };
    const [primeira, segunda] = [rodar(), rodar()];
    const v = [];
    if (h.acesso === 'por-sessao') {
      if (!primeira.includes(MARCA_ACESSO_COWORK) || !segunda.includes(MARCA_ACESSO_COWORK)) v.push(`${pacote}/${harness}: o pedido de acesso tem de ir inteiro em toda sessao`);
      return v;
    }
    if (!primeira.includes(MARCA_ACESSO_COMPLETO)) v.push(`${pacote}/${harness}: 1a sessao no host sem o pedido de acesso completo`);
    if (!segunda.includes(MARCA_ACESSO_LEMBRETE)) v.push(`${pacote}/${harness}: 2a sessao sem o lembrete de acesso (o pedido nao pode sumir)`);
    if (segunda.includes(MARCA_ACESSO_COMPLETO)) v.push(`${pacote}/${harness}: 2a sessao repetiu o pedido completo — o operador ja liberou`);
    if (primeira.includes(MARCA_ACESSO_COWORK)) v.push(`${pacote}/${harness}: instrucao de concessao do Cowork vazou para outro host`);
    return v;
  } finally {
    sb.limpar();
  }
}

// FEATURE (Codex): configuracao da OpenAI no plugin.json portavel (extensions.com.openai),
// como recomenda a doc atual; o overlay .codex-plugin/ so espelha, para Codex antigo.
// Sem `hooks` explicito, o Codex carrega hooks/hooks.json — que e o do Claude.
export function checarExtensaoOpenAI(pacote, harness) {
  if (!HARNESSES[harness].extensaoOpenAI) return [];
  const v = [];
  const raiz = tentarJson(resolverNoPacote(pacote, 'plugin.json'), v, `${pacote}/${harness} plugin.json`);
  const ext = raiz?.extensions?.['com.openai'];
  if (!ext) return [...v, `${pacote}/${harness}: plugin.json sem extensions.com.openai`];
  if (!ext.hooks) v.push(`${pacote}/${harness}: extensions.com.openai sem "hooks" explicito — o Codex cairia no hooks/hooks.json do Claude`);
  for (const chave of ['hooks', 'onboardingSkill']) {
    if (ext[chave] && !fs.existsSync(resolverNoPacote(pacote, ext[chave]))) v.push(`${pacote}/${harness}: extensions.com.openai.${chave} aponta para ${ext[chave]}, que nao existe`);
  }
  if (!ext.onboardingSkill) v.push(`${pacote}/${harness}: sem onboardingSkill — o setup pos-instalacao do Codex nao conduz o 1o uso`);
  if (!ext.interface?.displayName) v.push(`${pacote}/${harness}: extensions.com.openai.interface.displayName ausente`);
  const overlay = lerManifesto(pacote, harness, []) || {};
  for (const chave of ['hooks', 'onboardingSkill', 'interface']) {
    if (JSON.stringify(overlay[chave]) !== JSON.stringify(ext[chave])) v.push(`${pacote}/${harness}: .codex-plugin/plugin.json diverge de extensions.com.openai em "${chave}"`);
  }
  return v;
}

// FEATURE (Antigravity): regras duras como regra sempre ativa, em sincronia com lib/regras.mjs.
export function checarRegrasSempreAtivas(pacote, harness) {
  if (!HARNESSES[harness].regrasSempreAtivas) return [];
  const alvo = resolverNoPacote(pacote, ARQUIVO_REGRAS_SEMPRE_ATIVAS);
  if (!fs.existsSync(alvo)) return [`${pacote}/${harness}: ${ARQUIVO_REGRAS_SEMPRE_ATIVAS} ausente (npm run gerar:regras)`];
  const norm = (t) => t.replace(/\r\n/g, '\n');
  return norm(fs.readFileSync(alvo, 'utf8')) === norm(textoRegrasSempreAtivas())
    ? []
    : [`${pacote}/${harness}: ${ARQUIVO_REGRAS_SEMPRE_ATIVAS} diverge de lib/regras.mjs (npm run gerar:regras)`];
}

// FEATURE: guarda de varredura (regra dura 4) nos hosts que tem PreToolUse. Busca dentro
// de um vault do Connect deixa marca em {CONNECT_HOME}/logs/varredura.jsonl e devolve a
// decisao do host; fora do vault, nada muda.
export function checarGuardaVarredura(pacote, harness) {
  const h = HARNESSES[harness];
  if (!h.guarda) return [];
  const v = [];
  const g = h.guarda;
  const rel = h.hooks(lerManifesto(pacote, harness, []) || {});
  const json = tentarJson(resolverNoPacote(pacote, rel), v, `${pacote}/${harness} hooks`);
  if (!json) return v;
  const handlers = g.lerHooks(json);
  if (!handlers.length) return [`${pacote}/${harness}: sem hook PreToolUse da guarda de varredura`];
  for (const ferramenta of g.ferramentas) {
    if (!handlers.some((hk) => new RegExp(hk.matcher || '.*').test(ferramenta))) v.push(`${pacote}/${harness}: matcher da guarda nao cobre "${ferramenta}"`);
  }
  for (const so of SOS) {
    const linhas = handlers.map((hk) => hk.linhas?.[so]).filter(Boolean);
    if (!linhas.some((l) => RUNTIME.test(l) && l.includes('guarda-varredura.mjs') && l.trim().endsWith(g.argumento))) {
      v.push(`${pacote}/${harness}: guarda sem entrada ${so} pelo runtime portatil (guarda-varredura.mjs ${g.argumento})`);
    }
  }
  if (v.length) return v;

  const sb = sandboxComRuntime(`arch-guarda-${pacote}-${harness}-`);
  try {
    const matriz = path.join(sb.raiz, 'matriz');
    const fora = path.join(sb.raiz, 'projeto');
    fs.mkdirSync(matriz, { recursive: true });
    fs.mkdirSync(fora, { recursive: true });
    fs.writeFileSync(path.join(sb.env.CONNECT_HOME, 'connect.config.json'), JSON.stringify({ vaultMatriz: matriz }));
    const log = path.join(sb.env.CONNECT_HOME, 'logs', 'varredura.jsonl');
    const linhasDoLog = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).length : 0);
    const hk = handlers.find((x) => x.linhas?.[SO_ATUAL]);
    const raizPlugin = dirPacote(pacote);
    const rodar = (payload) => executarComoHost(harness, hk, {
      raizPlugin, cwd: h.cwdDoHook === 'plugin' ? raizPlugin : fora, env: sb.env, input: JSON.stringify(payload),
    });

    const comum = rodar(g.payloadComum(fora));
    try { if (!g.semDecisao(comum.stdout)) v.push(`${pacote}/${harness}: guarda decidiu algo fora do vault — ${comum.stdout}`); } catch { v.push(`${pacote}/${harness}: guarda respondeu fora do formato do host — ${comum.stdout} ${comum.stderr}`); }
    if (linhasDoLog() !== 0) v.push(`${pacote}/${harness}: guarda marcou varredura fora do vault`);

    const busca = rodar(g.payload(matriz));
    try { if (!g.marcou(busca.stdout)) v.push(`${pacote}/${harness}: busca no vault sem a decisao da regra 4 — ${busca.stdout} ${busca.stderr}`); } catch { v.push(`${pacote}/${harness}: guarda respondeu fora do formato do host — ${busca.stdout} ${busca.stderr}`); }
    if (linhasDoLog() !== 1) v.push(`${pacote}/${harness}: busca no vault nao deixou marca em logs/varredura.jsonl`);
  } finally {
    sb.limpar();
  }
  return v;
}

// PACOTE: o launcher do MCP sobe o servidor pelo runtime portatil e responde ao handshake.
export function checarLauncherMcp(pacote) {
  const base = path.join(dirPacote(pacote), 'scripts', 'connect-mcp');
  const v = [];
  if (!fs.existsSync(base) || !fs.existsSync(`${base}.cmd`)) return [`${pacote}: scripts/connect-mcp e scripts/connect-mcp.cmd sao obrigatorios`];
  // O host executa o arquivo POSIX direto: sem modo 755 no git, nao sobe no macOS/Linux.
  const rel = posix(path.relative(RAIZ, base));
  const modo = spawnSync('git', ['ls-files', '-s', rel], { cwd: RAIZ, encoding: 'utf8' });
  if (modo.status === 0 && modo.stdout.trim() && !modo.stdout.startsWith('100755')) v.push(`${pacote}: ${rel} precisa de modo 755 no git (git update-index --chmod=+x)`);

  const sb = sandboxComRuntime(`arch-mcp-${pacote}-`);
  try {
    const input = [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
      { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
    ].map((m) => JSON.stringify(m)).join('\n') + '\n';
    const opcoes = { cwd: sb.raiz, env: sb.env, input, encoding: 'utf8', timeout: 60_000, windowsHide: true };
    const r = process.platform === 'win32'
      ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `""${base}.cmd""`], { ...opcoes, windowsVerbatimArguments: true })
      : spawnSync('/bin/sh', [base], opcoes);
    if (/node do PATH|runtime indisponivel/i.test(r.stderr || '')) v.push(`${pacote}: o launcher nao usou o runtime portatil — ${r.stderr.trim()}`);
    const respostas = String(r.stdout || '').trim().split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return { invalida: l }; } });
    if (respostas.some((x) => x.invalida)) v.push(`${pacote}: o launcher escreveu fora do protocolo no stdout: ${respostas.find((x) => x.invalida).invalida.slice(0, 120)}`);
    if (respostas.find((x) => x.id === 1)?.result?.serverInfo?.name !== SERVIDOR_MCP) v.push(`${pacote}: o launcher nao respondeu ao initialize — status ${r.status}, stderr ${String(r.stderr).slice(0, 300)}`);
    if (!respostas.find((x) => x.id === 2)?.result?.tools?.length) v.push(`${pacote}: o launcher nao listou tools`);
  } finally {
    sb.limpar();
  }
  return v;
}

// ---------------------------------------------------------------------------
// PACOTE: skills, inventario de superficie, artefatos gerados
// ---------------------------------------------------------------------------
export function checarSkills(pacote) {
  const v = [];
  const canon = fs.readdirSync(path.join(RAIZ, FONTE_SKILLS)).sort();
  const dir = path.join(dirPacote(pacote), 'skills');
  const tem = fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
  for (const s of canon) if (!tem.includes(s)) v.push(`${pacote}: skill ausente: ${s}`);
  for (const s of tem) if (!canon.includes(s)) v.push(`${pacote}: skill fora do conjunto canonico: ${s}`);
  for (const s of tem) {
    const arq = path.join(dir, s, 'SKILL.md');
    if (!fs.existsSync(arq)) { v.push(`${pacote}: ${s}/SKILL.md ausente`); continue; }
    const texto = fs.readFileSync(arq, 'utf8');
    const meta = parseFrontmatter(texto);
    if (meta.name !== s) v.push(`${pacote}: ${s}/SKILL.md declara name="${meta.name}"`);
    if (!meta.description) v.push(`${pacote}: ${s}/SKILL.md sem description`);
    // Agent Skills (Codex, Copilot, Antigravity): name kebab-case ate 64, description de 1 a
    // 1.024 caracteres. Fora disso o host descarta a skill — o Cowork aceita, e por isso a
    // cnct-nucleo-sessao (1.297) carregava so nele, sem sinal nenhum nos outros.
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) || s.length > 64) v.push(`${pacote}: ${s} fora do padrao de nome do Agent Skills`);
    const descricao = descricaoDoFrontmatter(texto);
    if (descricao.length < 1 || descricao.length > LIMITE_DESCRICAO_SKILL) {
      v.push(`${pacote}: ${s}/SKILL.md com description de ${descricao.length} caracteres (Agent Skills aceita 1 a ${LIMITE_DESCRICAO_SKILL}) — os hosts fora do Cowork descartam a skill`);
    }
  }
  return v;
}

const LIMITE_DESCRICAO_SKILL = 1024;

// `description` do frontmatter como o host le: escalar simples, aspeado ou bloco `>`/`|`
// dobrado em uma linha. (lib/frontmatter.mjs nao interpreta bloco dobrado, de proposito.)
export function descricaoDoFrontmatter(texto) {
  const fm = String(texto).replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/)?.[1] || '';
  const m = fm.match(/^description:([^\n]*)\n?((?:[ \t]+[^\n]*\n?|\n)*)/m);
  if (!m) return '';
  const cabeca = m[1].trim();
  const corpo = /^[>|][-+]?$/.test(cabeca) ? m[2] : `${cabeca}\n${m[2]}`;
  return corpo.split('\n').map((l) => l.trim()).filter(Boolean).join(' ').replace(/^["'](.*)["']$/, '$1');
}

export function checarInventario(pacote) {
  const donos = new Set([...NUCLEO_COMPARTILHADO, ...Object.values(HARNESSES).flatMap((h) => h.arquivos)]);
  return listarArquivos(dirPacote(pacote))
    .filter(ehSuperficieDeHost)
    .filter((rel) => !donos.has(rel))
    .map((rel) => `${pacote}: ${rel} e superficie de host sem dono no contrato (declare-o em tests/architecture/harness-contract.mjs)`);
}

export function checarArtefatoGerado(pacote, harness) {
  const g = HARNESSES[harness].geradoPor;
  if (!g) return [];
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), `arch-gen-${harness}-`));
  const saida = path.join(temp, 'out');
  try {
    const r = spawnSync(process.execPath, [path.join(RAIZ, g.script), saida], { cwd: RAIZ, encoding: 'utf8', windowsHide: true });
    if (r.status !== 0) return [`${g.script} falhou: ${r.stderr}`];
    const gerado = path.join(saida, g.arquivo);
    const versionado = resolverNoPacote(pacote, g.arquivo);
    if (!fs.existsSync(versionado)) return [`${pacote}/${harness}: ${g.arquivo} nao versionado (o ${g.script} gera)`];
    // A comparacao ignora CRLF: o checkout no Windows pode converter fim de linha.
    const norm = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
    return norm(gerado) === norm(versionado) ? [] : [`${pacote}/${harness}: ${g.arquivo} diverge do gerado por ${g.script}`];
  } finally {
    fs.rmSync(temp, { recursive: true, force: true, maxRetries: 3 });
  }
}

// ---------------------------------------------------------------------------
// MARKETPLACE: pacotes x marketplaces x settings do Copilot
// ---------------------------------------------------------------------------
export function checarMarketplaces() {
  const v = [];
  const nomes = Object.keys(PACOTES).sort();

  const emDisco = fs.readdirSync(path.join(RAIZ, 'plugins'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => `plugins/${e.name}`);
  const declarados = Object.values(PACOTES).map((p) => p.dir);
  for (const d of emDisco) if (!declarados.includes(d)) v.push(`${d} existe mas nao esta declarado em PACOTES do contrato`);
  for (const d of declarados) if (!emDisco.includes(d)) v.push(`${d} declarado no contrato mas ausente em disco`);

  for (const mk of MARKETPLACES) {
    const json = tentarJson(path.join(RAIZ, mk.arquivo), v, `marketplace ${mk.nome}`);
    if (!json) continue;
    const listados = (json.plugins || []).map((e) => e.name).sort();
    if (JSON.stringify(listados) !== JSON.stringify(nomes)) v.push(`${mk.arquivo} lista [${listados}], esperado [${nomes}]`);
    for (const e of json.plugins || []) {
      const esperado = PACOTES[e.name]?.dir;
      const fonte = posix(path.normalize(String(mk.fonte(e) || '')));
      if (esperado && fonte !== esperado) v.push(`${mk.arquivo}: "${e.name}" aponta para ${mk.fonte(e)}, esperado ./${esperado}`);
    }
  }

  const claudeMk = tentarJson(path.join(RAIZ, MARKETPLACES[0].arquivo), [], '') || {};
  const settings = tentarJson(path.join(RAIZ, COPILOT_SETTINGS), v, 'settings do Copilot');
  if (settings) {
    const conhecidos = (settings.extraKnownMarketplaces || []).map((m) => m.name);
    if (!conhecidos.includes(claudeMk.name)) v.push(`${COPILOT_SETTINGS} nao registra o marketplace "${claudeMk.name}"`);
    for (const id of settings.enabledPlugins || []) {
      const [plugin, market] = String(id).split('@');
      if (!PACOTES[plugin]) v.push(`${COPILOT_SETTINGS} habilita "${id}", pacote inexistente`);
      if (!conhecidos.includes(market)) v.push(`${COPILOT_SETTINGS} habilita "${id}" de marketplace nao registrado`);
    }
  }
  return v;
}

// ---------------------------------------------------------------------------
// Matriz completa (para o modo CLI)
// ---------------------------------------------------------------------------
export const FEATURES = {
  identidade: checarIdentidade,
  mcp: checarMcp,
  'hook declarado': checarHookDeclarado,
  referencias: checarReferencias,
  isolamento: checarIsolamento,
  bootstrap: checarBootstrap,
  'bootstrap na nuvem': checarBootstrapNuvem,
  'runtime portatil': checarRuntimePortatil,
  'hook pelo runtime': checarHookPeloRuntime,
  'acesso no ritmo do host': checarAcessoPorHost,
  'extensao OpenAI': checarExtensaoOpenAI,
  'regras sempre ativas': checarRegrasSempreAtivas,
  'guarda de varredura': checarGuardaVarredura,
  'artefato gerado': checarArtefatoGerado,
};

export function verificarTudo() {
  const v = [...checarMarketplaces()];
  for (const pacote of Object.keys(PACOTES)) {
    v.push(...checarSkills(pacote), ...checarInventario(pacote), ...checarLauncherMcp(pacote));
    for (const harness of Object.keys(HARNESSES)) {
      for (const fn of Object.values(FEATURES)) v.push(...fn(pacote, harness));
    }
  }
  return v;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const violacoes = verificarTudo();
  if (violacoes.length) {
    process.stderr.write(`Contrato de harnesses VIOLADO (${violacoes.length}):\n${violacoes.map((x) => `  - ${x}`).join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write(`Contrato de harnesses OK: ${Object.keys(PACOTES).length} pacotes x ${Object.keys(HARNESSES).length} harnesses x ${Object.keys(FEATURES).length} features\n`);
}
