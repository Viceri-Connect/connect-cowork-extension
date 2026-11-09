// connect/lib/varredura.mjs
// Guarda de varredura: faz valer a regra dura 4 ("varredura e ultimo recurso e DEIXA
// MARCA") nos hosts que deixam um hook olhar a ferramenta ANTES de ela rodar (0.41.0).
//
// Ate aqui a regra vivia so em texto: o agente lia, e nada impedia um `grep -r` no vault
// — a resposta saia de nota que so o grep acha (nota orfa, por definicao). A guarda nao
// proibe: a varredura as vezes e o ultimo recurso legitimo. Ela
//   1. reconhece busca recursiva (grep/rg/find/..., ou a ferramenta de busca do host);
//   2. confere se o alvo esta DENTRO de um vault do Connect (matriz, cerebro pessoal,
//      sub-vaults, workspace de sessao com os atalhos);
//   3. registra a marca em {CONNECT_HOME}/logs/varredura.jsonl;
//   4. devolve ao host o texto da decisao: o host que sabe perguntar (Antigravity) pede
//      confirmacao ao operador; o que nao sabe (Codex nao suporta "ask" no PreToolUse)
//      segue, mas o agente recebe o lembrete da regra e a ordem de reportar.
//
// Fora do vault, ou na duvida, nao decide nada: a guarda nunca bloqueia trabalho comum.

import fs from 'node:fs';
import path from 'node:path';

// Busca recursiva por shell. `ls`/`dir`/`Get-ChildItem` so contam com recursao explicita
// (listar uma pasta e navegacao, nao varredura).
const BUSCA_SHELL = /(?:^|[\s;&|(`])(?:rg|grep|egrep|fgrep|ag|ack|find|fd|findstr|select-string|sls)(?:\.exe)?(?=\s|$)/i;
const LISTAGEM_RECURSIVA = /(?:^|[\s;&|(`])(?:get-childitem|gci|dir|ls|tree)\b[^;&|]*?(?:\s-recurse\b|\s-r\b|\s-R\b|\s\/s\b|\s-a?R\b)/i;

export function ehVarreduraNoShell(comando) {
  const c = String(comando || '');
  return BUSCA_SHELL.test(c) || LISTAGEM_RECURSIVA.test(c);
}

const WIN = process.platform === 'win32';
const normalizar = (p) => {
  const s = String(p).replace(/\\/g, '/').replace(/\/+$/, '');
  return WIN ? s.toLowerCase() : s;
};

function caminhoDoSubVault(v) {
  if (typeof v === 'string') return v;
  return v?.caminho || v?.path || null;
}

// Raizes protegidas: de onde vem conhecimento do Connect nesta maquina.
export function raizesDoConnect(cfg) {
  const raizes = [
    ['matriz', cfg.vaultMatriz],
    ['cerebro pessoal', cfg.cerebroPessoal],
    // O workspace de sessao contem os atalhos (./matriz, ./{alias}) para as origens.
    ['workspace de sessao', cfg.home && path.join(cfg.home, 'sessions')],
    ...Object.entries(cfg.subVaults || {}).map(([conceito, v]) => [`sub-vault ${conceito}`, caminhoDoSubVault(v)]),
  ];
  return raizes
    .filter(([, p]) => typeof p === 'string' && p.trim())
    .map(([rotulo, p]) => ({ rotulo, caminho: path.resolve(p), chave: normalizar(path.resolve(p)) }));
}

// Atalho relativo do workspace (`./matriz`, `.\pessoal`) — o jeito como o agente do Cowork
// cita o vault. Fora do workspace de sessao o mesmo nome nao e do Connect, entao so conta
// com o prefixo `./` explicito.
const ATALHO = /(?:^|[\s"'=])\.[\\/](matriz|pessoal)(?=[\\/\s"']|$)/i;

// alvo: { comando?: string, caminhos?: string[], cwd?: string }
// Devolve a raiz atingida ({ rotulo, caminho }) ou null.
// O comando cita o caminho inteiro (nao um vizinho com o mesmo prefixo, `Matriz-backup`).
function citaCaminho(texto, chave) {
  for (let i = texto.indexOf(chave); i !== -1; i = texto.indexOf(chave, i + 1)) {
    const seguinte = texto[i + chave.length];
    if (seguinte === undefined || /[/"'\s`]/.test(seguinte)) return true;
  }
  return false;
}

export function alvoNoVault(alvo, raizes) {
  const textoComando = normalizar(alvo.comando || '');
  for (const r of raizes) {
    if (textoComando && citaCaminho(textoComando, r.chave)) return r;
    for (const c of alvo.caminhos || []) {
      if (!c) continue;
      const abs = normalizar(path.resolve(alvo.cwd || process.cwd(), String(c)));
      if (abs === r.chave || abs.startsWith(`${r.chave}/`)) return r;
    }
  }
  const atalho = String(alvo.comando || '').match(ATALHO) || (alvo.caminhos || []).map((c) => String(c).match(ATALHO)).find(Boolean);
  if (atalho) return { rotulo: atalho[1].toLowerCase(), caminho: `./${atalho[1].toLowerCase()}` };
  return null;
}

export function registrarMarca(home, marca) {
  const arquivo = path.join(home, 'logs', 'varredura.jsonl');
  try {
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    fs.appendFileSync(arquivo, `${JSON.stringify({ em: new Date().toISOString(), ...marca })}\n`);
  } catch { /* sem escrita: a decisao ainda chega ao agente */ }
  return arquivo;
}

export function textoDaRegra(raiz, arquivoMarca) {
  return `Connect: esta busca varre ${raiz.rotulo} (${raiz.caminho}). Regra dura 4: dentro de um vault, `
    + 'navegue pela carta de navegacao -> ponto de pouso declarado -> ponteiro declarado; varredura e '
    + 'ultimo recurso e deixa marca. Use a busca so se a carta e os ponteiros nao bastaram, e reporte ao '
    + `operador que usou varredura. Marca registrada em ${arquivoMarca}.`;
}
