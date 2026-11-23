#!/usr/bin/env node
// Hook PreToolUse — guarda de varredura do Connect (lib/varredura.mjs). Uso:
//   guarda-varredura.mjs codex        (payload do Codex: tool_name/tool_input)
//   guarda-varredura.mjs antigravity  (payload do Antigravity: toolCall.name/args)
//
// Roda antes de cada ferramenta casada pelo matcher do host, entao o caminho comum
// (nao e busca) sai sem carregar a configuracao do Connect. Qualquer falha libera a
// ferramenta: a guarda nunca derruba trabalho do operador.
import fs from 'node:fs';
import { jsonAscii } from '../lib/saida-hook.mjs';
import { ehVarreduraNoShell } from '../lib/varredura.mjs';

const host = process.argv[2];
const SEM_DECISAO = host === 'antigravity' ? { decision: 'allow' } : {};
const responder = (saida) => { process.stdout.write(jsonAscii(saida)); process.exit(0); };

// Normaliza o payload de cada host em { ferramenta, comando, caminhos, cwd }.
function lerAlvo(payload) {
  if (host === 'codex') {
    const comando = payload.tool_input?.command;
    if (payload.tool_name !== 'Bash' || typeof comando !== 'string' || !ehVarreduraNoShell(comando)) return null;
    return { ferramenta: 'Bash', comando, caminhos: [], cwd: payload.cwd };
  }
  if (host === 'antigravity') {
    const nome = payload.toolCall?.name;
    const args = payload.toolCall?.args || {};
    const cwd = (payload.workspacePaths || [])[0];
    if (nome === 'grep_search') return { ferramenta: nome, comando: args.Query ? `grep ${args.Query}` : '', caminhos: [args.SearchPath], cwd };
    if (nome === 'find_by_name') return { ferramenta: nome, comando: '', caminhos: [args.SearchDirectory], cwd };
    if (nome === 'run_command' && ehVarreduraNoShell(args.CommandLine)) return { ferramenta: nome, comando: args.CommandLine, caminhos: [args.Cwd], cwd: args.Cwd || cwd };
    return null;
  }
  return null;
}

try {
  let payload = {};
  try { payload = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { /* sem payload: nada a guardar */ }
  const alvo = lerAlvo(payload);
  if (!alvo) responder(SEM_DECISAO);

  const { resolveConfig } = await import('../lib/session.mjs');
  const { raizesDoConnect, alvoNoVault, registrarMarca, textoDaRegra } = await import('../lib/varredura.mjs');
  const cfg = resolveConfig({});
  const raiz = alvoNoVault(alvo, raizesDoConnect(cfg));
  if (!raiz) responder(SEM_DECISAO);

  const arquivo = registrarMarca(cfg.home, {
    host, ferramenta: alvo.ferramenta, vault: raiz.rotulo, alvo: raiz.caminho, comando: String(alvo.comando || alvo.caminhos.join(' ')).slice(0, 300),
  });
  const texto = textoDaRegra(raiz, arquivo);
  if (host === 'antigravity') responder({ decision: 'ask', reason: texto });
  // Codex: "ask" nao e suportado no PreToolUse — a ferramenta segue, o agente recebe a
  // regra e o operador ve o aviso.
  responder({
    systemMessage: `Connect: varredura em ${raiz.rotulo} registrada (regra dura 4).`,
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: texto },
  });
} catch (error) {
  process.stderr.write(`[connect] guarda de varredura: ${error.message}\n`);
  responder(SEM_DECISAO);
}
