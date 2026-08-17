// connect/lib/resolver.mjs
// resolver(conceito) — entrega um SUB-VAULT por CONCEITO como atalho no workspace.
//
// Realinhado ao modelo de grafo de manifestos (D97/D102/P61): o registro NAO e
// mais um arquivo autorado (`_cerebro/sub-vaults.json`, removido — reintroduzia a
// duplicacao que D97 recusa). Ele e DERIVADO EM RUNTIME (P60) da varredura dos
// manifestos — o frontmatter das notas que declaram uma entidade com `fonte`. Uma
// sessao que precisa atuar num conceito (ex.: um cliente, uma tribo, um projeto)
// chama `resolver(conceito)`; ele casa o conceito no registro derivado, resolve a
// `fonte` (relativa ao OneDrive) para caminho absoluto usando a matriz como
// ancora, monta a junction/symlink da origem e carrega a camada 1 do sub-vault.
//
// Contrato do manifesto: config/contrato-manifesto.md (plugin). Campos lidos aqui:
// `tipo` (sinaliza que a nota e uma entidade), `fonte[].url` (acervo), `tags`
// (gatilhos), `alias`/`conceito` (opcionais). Zero dependencias externas.
//
// Principios (SPEC): caminho relativo, mount != acesso, lazy antes de tudo,
// governanca desce da matriz. Registro autorado = proibido (contrato §3).

import fs from 'node:fs';
import path from 'node:path';
import { mount } from './mount.mjs';
import { resolveConfig } from './session.mjs';
import { montarL1 } from './matriz.mjs';

// ---------------------------------------------------------------------------
// Helpers de leitura / parse (zero-dep).
// ---------------------------------------------------------------------------
function readHead(p, bytes = 4096) {
  try {
    if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return null;
    const fd = fs.openSync(p, 'r');
    const buf = Buffer.alloc(bytes);
    const n = fs.readSync(fd, buf, 0, bytes, 0);
    fs.closeSync(fd);
    return buf.slice(0, n).toString('utf8').replace(/^﻿/, '');
  } catch { return null; }
}

// Extrai o bloco de frontmatter (entre o primeiro par de linhas "---").
function extrairFrontmatter(text) {
  if (!text) return null;
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : null;
}

const desaspar = (v) => v.replace(/\s+#.*$/, '').trim().replace(/^["'](.*)["']$/, '$1');
const ehAbsoluto = (p) => /^([a-zA-Z]:[\\/]|\/|\\\\)/.test(p);

// Interpreta o frontmatter de um manifesto. Retorna null se nao for entidade
// (sem `tipo`) ou se nao declarar `fonte`. Parser focado nos campos do contrato.
export function parseManifesto(fmText) {
  if (!fmText) return null;
  const linhas = fmText.split(/\r?\n/);
  const top = {};
  const fontes = [];
  let emFonte = false;

  for (const raw of linhas) {
    // fim do bloco `fonte:` quando aparece uma chave de topo (sem indentacao)
    if (emFonte && /^\S/.test(raw)) emFonte = false;

    if (/^fonte\s*:/.test(raw)) { emFonte = true; continue; }

    if (emFonte) {
      const u = raw.match(/^\s*(?:-\s*)?url\s*:\s*(.+)$/);
      if (u) { const v = desaspar(u[1]); if (v && v !== 'null') fontes.push(v); }
      continue;
    }

    const kv = raw.match(/^([a-zA-Z0-9_.\-]+)\s*:\s*(.*)$/);
    if (kv && !(kv[1] in top)) top[kv[1]] = desaspar(kv[2]);
  }

  if (!top.tipo) return null;
  if (fontes.length === 0) return null;

  const gatilhos = (top.tags || '')
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((s) => s.replace(/["']/g, '').trim().toLowerCase())
    .filter(Boolean);

  return {
    tipo: top.tipo,
    papel: top.papel || null,
    conceito: top.conceito || top.alias || null, // default (slug) resolvido no walk
    alias: top.alias || null,
    fontes,
    gatilhos,
  };
}

// Deriva a raiz de sincronizacao (OneDrive) de um vault: seu vault-config declara
// `onedrive-rel` (ex.: "Sua Empresa/Matriz"); a raiz e o path absoluto do vault
// menos esse sufixo. Ancora estavel por-maquina (o path absoluto vem da config do
// operador, D35) sem hardcodar path no vault.
export function onedriveRoot(vaultAbs) {
  const cfg = readHead(path.join(vaultAbs, '_cerebro', 'vault-config.md'), 8192);
  const fm = extrairFrontmatter(cfg) || cfg || '';
  const m = fm.match(/^\s*-?\s*onedrive-rel\s*:\s*(.+)$/m);
  if (!m) return null;
  const rel = desaspar(m[1]).replace(/[\\/]+/g, '/').replace(/\/+$/, '');
  const absNorm = vaultAbs.replace(/[\\/]+/g, '/').replace(/\/+$/, '');
  if (!rel || !absNorm.toLowerCase().endsWith(rel.toLowerCase())) return null;
  return vaultAbs.slice(0, vaultAbs.length - rel.length).replace(/[\\/]+$/, '');
}

// Resolve a url declarada em `fonte` para caminho absoluto do acervo.
function resolverFonte(url, rootAbs, odRoot) {
  if (!url) return null;
  if (ehAbsoluto(url)) return path.normalize(url);
  if (odRoot) return path.normalize(path.join(odRoot, url));
  return null; // relativa sem ancora — nao resolve; a skill avisa
}

// ---------------------------------------------------------------------------
// lerRegistro — DERIVA os sub-vaults dos manifestos nas raizes informadas.
// Ordem de precedencia: a primeira raiz vence em conceito repetido (pessoal
// antes de matriz — o operador sobrepoe a governanca). Sem arquivo autorado.
// ---------------------------------------------------------------------------
export function lerRegistro(roots = []) {
  const out = [];
  const seen = new Set();

  for (const root of roots) {
    if (!root || !fs.existsSync(root)) continue;
    const odRoot = onedriveRoot(root);

    for (const file of walkMd(root)) {
      const fm = extrairFrontmatter(readHead(file));
      const man = parseManifesto(fm);
      if (!man) continue;

      const slug = path.basename(file, '.md').toLowerCase();
      const conceito = (man.conceito || slug).toLowerCase();
      const k = conceito;
      if (seen.has(k)) continue;

      const origem = resolverFonte(man.fontes[0], root, odRoot);
      const gatilhos = Array.from(new Set([...man.gatilhos, slug].filter((g) => g && g !== conceito)));

      seen.add(k);
      out.push({
        conceito,
        origem,
        alias: man.alias || conceito,
        gatilhos,
        tipo: man.tipo,
        papel: man.papel,
        nota: `${man.tipo}${man.papel ? '/' + man.papel : ''} — manifesto derivado`,
        _fonte: root,
        _fonteUrl: man.fontes[0],
      });
    }
  }
  return out;
}

// Varredura rasa de .md (ignora pastas ocultas e node_modules). Profundidade
// limitada: manifestos vivem perto da raiz (matriz enxuta, D103).
function walkMd(root, maxDepth = 4) {
  const out = [];
  const walk = (dir, depth) => {
    if (depth > maxDepth) return;
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (e.isFile() && e.name.endsWith('.md')) out.push(p);
    }
  };
  walk(root, 0);
  return out;
}

// ---------------------------------------------------------------------------
// casar — resolve um termo (conceito ou gatilho) para uma entrada do registro.
// Ordem: conceito exato > gatilho exato > substring (conceito/gatilhos).
// ---------------------------------------------------------------------------
export function casar(registro, termo) {
  if (!termo) return null;
  const t = String(termo).toLowerCase().trim();
  let hit = registro.find((e) => String(e.conceito).toLowerCase() === t);
  if (hit) return hit;
  hit = registro.find((e) => e.gatilhos.some((g) => String(g).toLowerCase() === t));
  if (hit) return hit;
  hit = registro.find((e) =>
    String(e.conceito).toLowerCase().includes(t) ||
    e.gatilhos.some((g) => String(g).toLowerCase().includes(t)));
  return hit || null;
}

// ---------------------------------------------------------------------------
// resolver — orquestra: config -> registro derivado -> casa -> monta -> L1.
// Nunca lanca; devolve um relatorio com `status` para a skill decidir o proximo
// passo. Status possiveis: 'resolvido' | 'nao-encontrado' | 'origem-ausente' |
// 'origem-nao-resolvida' | 'sem-workspace' | 'erro-mount' | 'erro'.
// ---------------------------------------------------------------------------
export function resolver({ conceito, workspaceDir, alias, replace = false, ...override } = {}) {
  const cfg = resolveConfig(override);
  const roots = [cfg.cerebroPessoal, cfg.vaultMatriz].filter(Boolean);
  const registro = lerRegistro(roots);
  const disponiveis = registro.map((e) => e.conceito);

  if (!conceito) {
    return { status: 'erro', motivo: 'conceito ausente', disponiveis };
  }
  const entry = casar(registro, conceito);
  if (!entry) {
    return { status: 'nao-encontrado', conceito, disponiveis, avisos: [`nenhum manifesto casa com "${conceito}"`] };
  }
  if (!entry.origem) {
    return { status: 'origem-nao-resolvida', conceito: entry.conceito, fonteUrl: entry._fonteUrl, avisos: [`fonte "${entry._fonteUrl}" nao resolveu para caminho absoluto (falta ancora onedrive-rel no vault-config, ou url relativa sem raiz)`] };
  }
  if (!fs.existsSync(entry.origem)) {
    return { status: 'origem-ausente', conceito: entry.conceito, origem: entry.origem, avisos: [`origem nao existe: ${entry.origem} (se for OneDrive, sincronize "manter neste dispositivo"; sem acesso a fonte, procure quem governa — D97)`] };
  }
  if (!workspaceDir) {
    return { status: 'sem-workspace', conceito: entry.conceito, origem: entry.origem, avisos: ['workspaceDir ausente — informe o diretorio da sessao (estado_sessao.workspace)'] };
  }

  const aliasFinal = alias || entry.alias;
  let mountReport;
  try {
    mountReport = mount({ workspaceDir, alias: aliasFinal, source: entry.origem, replace });
  } catch (e) {
    return { status: 'erro-mount', conceito: entry.conceito, alias: aliasFinal, avisos: [e.message] };
  }

  // Camada 1 do sub-vault (mesma forma da matriz), se ele tiver _cerebro/vault-config.md.
  let l1 = null;
  try {
    if (fs.existsSync(path.join(entry.origem, '_cerebro', 'vault-config.md'))) {
      l1 = montarL1(entry.origem, aliasFinal);
    }
  } catch { /* sub-vault pode ainda nao ter forma de vault; segue sem L1 */ }

  return {
    status: 'resolvido',
    conceito: entry.conceito,
    tipo: entry.tipo,
    papel: entry.papel,
    alias: aliasFinal,
    origem: entry.origem,
    caminhoRelativo: `./${aliasFinal}`,
    mount: mountReport,
    l1,
    nota: entry.nota,
    avisos: [],
  };
}
