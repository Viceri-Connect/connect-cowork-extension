// connect/lib/resolver.mjs
// resolver(conceito) — entrega um SUB-VAULT por CONCEITO como atalho no workspace.
//
// Fecha a lacuna do "ponteiro declarativo": em vez de hardcodar caminhos, o
// operador declara seus sub-vaults num registro (`_cerebro/sub-vaults.json`) no
// cerebro pessoal (e/ou na matriz). Uma sessao que precisa atuar num conceito
// (ex.: "minha gestao", "financas", "pensao") chama `resolver(conceito)`; ele
// casa o conceito no registro, monta a junction/symlink da origem como um alias
// flat no workspace e carrega a camada 1 do sub-vault (se ele tiver forma de vault).
//
// Principios (SPEC): caminho relativo, mount != acesso, lazy antes de tudo,
// governanca desce da matriz. Zero dependencias externas.

import fs from 'node:fs';
import path from 'node:path';
import { mount } from './mount.mjs';
import { resolveConfig } from './session.mjs';
import { montarL1 } from './matriz.mjs';

const REGISTRO_REL = ['_cerebro', 'sub-vaults.json'];

function readJson(p) {
  try {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
    }
  } catch { /* registro invalido e ignorado */ }
  return null;
}

// ---------------------------------------------------------------------------
// lerRegistro — le e normaliza os sub-vaults declarados nas raizes informadas.
// Ordem de precedencia: a primeira raiz vence em caso de conceito repetido
// (pessoal antes de matriz — o operador sobrepoe a governanca).
// Formato aceito: array direto, ou objeto { subVaults: [...] }.
// Cada entrada: { conceito, origem, alias?, gatilhos?[], nota? }.
// ---------------------------------------------------------------------------
export function lerRegistro(roots = []) {
  const out = [];
  const seen = new Set();
  for (const root of roots) {
    if (!root) continue;
    const data = readJson(path.join(root, ...REGISTRO_REL));
    const arr = Array.isArray(data) ? data : (data && Array.isArray(data.subVaults) ? data.subVaults : []);
    for (const e of arr) {
      if (!e || !e.conceito) continue;
      const k = String(e.conceito).toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({
        conceito: e.conceito,
        origem: e.origem || null,
        alias: e.alias || e.conceito,
        gatilhos: Array.isArray(e.gatilhos) ? e.gatilhos : [],
        nota: e.nota || null,
        _fonte: root,
      });
    }
  }
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
// resolver — orquestra: config -> registro -> casa -> monta -> L1.
// Nunca lanca; devolve um relatorio com `status` para a skill decidir o proximo
// passo. Status possiveis: 'resolvido' | 'nao-encontrado' | 'origem-ausente' |
// 'sem-workspace' | 'erro-mount' | 'erro'.
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
    return { status: 'nao-encontrado', conceito, disponiveis, avisos: [`nenhum sub-vault casa com "${conceito}"`] };
  }
  if (!entry.origem || !fs.existsSync(entry.origem)) {
    return { status: 'origem-ausente', conceito: entry.conceito, origem: entry.origem, avisos: [`origem nao existe: ${entry.origem} (se for OneDrive, sincronize "manter neste dispositivo")`] };
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
    alias: aliasFinal,
    origem: entry.origem,
    caminhoRelativo: `./${aliasFinal}`,
    mount: mountReport,
    l1,
    nota: entry.nota,
    avisos: [],
  };
}
