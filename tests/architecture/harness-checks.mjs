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
  ENTRADA_MCP, EVENTOS_OBRIGATORIOS, FONTE_SKILLS, FONTE_VERSAO, HARNESSES, MARCADOR_BOOTSTRAP,
  MARKETPLACES, COPILOT_SETTINGS, NUCLEO_COMPARTILHADO, PACOTES, SERVIDOR_MCP, SESSION_ID, VARIANTES,
  ehSuperficieDeHost,
} from './harness-contract.mjs';
import { parseFrontmatter } from '../../plugins/connect/lib/frontmatter.mjs';

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
  for (const m of String(texto).matchAll(/\$\{(?:CLAUDE_)?PLUGIN_ROOT\}\/([^"'\s]+)/g)) refs.push(m[1]);
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
  return refs.length ? resolverNoPacote(pacote, refs[refs.length - 1]) : null;
}

export function checarBootstrap(pacote, harness, { base = path.join(RAIZ, '.test-tmp') } = {}) {
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
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('CONNECT_')));
    Object.assign(env, { HOME: home, USERPROFILE: home, CONNECT_HOME: path.join(home, 'Connect'), NO_COLOR: '1' });

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
    if (/falha no iniciar_sessao|bootstrap failed/i.test(r.stderr || ''))v.push(`${pacote}/${harness}: hook reportou falha no stderr — ${r.stderr.trim()}`);

    let contexto;
    try {
      contexto = h.lerSaida(r.stdout);
    } catch (e) {
      return [...v, `${pacote}/${harness}: saida do hook fora do formato do host — ${e.message}; stdout=${r.stdout.slice(0, 200)}`];
    }
    if (typeof contexto !== 'string' || !contexto.includes(MARCADOR_BOOTSTRAP)) {
      v.push(`${pacote}/${harness}: hook nao injetou o bootstrap ("${MARCADOR_BOOTSTRAP}" ausente)`);
    }
    if (!fs.existsSync(path.join(env.CONNECT_HOME, 'sessions', SESSION_ID(harness)))) {
      v.push(`${pacote}/${harness}: o session id do payload do host nao chegou ao iniciar_sessao`);
    }
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true, maxRetries: 3 });
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
    const meta = parseFrontmatter(fs.readFileSync(arq, 'utf8'));
    if (meta.name !== s) v.push(`${pacote}: ${s}/SKILL.md declara name="${meta.name}"`);
    if (!meta.description) v.push(`${pacote}: ${s}/SKILL.md sem description`);
  }
  return v;
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
  'artefato gerado': checarArtefatoGerado,
};

export function verificarTudo() {
  const v = [...checarMarketplaces()];
  for (const pacote of Object.keys(PACOTES)) {
    v.push(...checarSkills(pacote), ...checarInventario(pacote));
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
