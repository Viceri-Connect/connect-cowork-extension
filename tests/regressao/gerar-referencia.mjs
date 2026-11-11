#!/usr/bin/env node
// Gera a referencia de regressao do Cowork a partir do pacote de uma versao ANTERIOR.
//
//   git worktree add --detach ../connect-ref <commit-da-versao>
//   node tests/regressao/gerar-referencia.mjs ../connect-ref/plugins/connect
//
// A referencia atual veio da main em 1b1b9a0 (0.40.0), a ultima antes do multi-harness.
// Regenerar contra o pacote ATUAL apagaria a protecao: so faca isso quando a mudanca de
// comportamento no Cowork for decidida, e registre no CHANGELOG.

import fs from 'node:fs';
import path from 'node:path';
import { REFERENCIA, contextosDoCowork, toolsDoMcp, hashesDaSuperficie } from './cowork.mjs';

const pacote = path.resolve(process.argv[2] || '');
if (!fs.existsSync(path.join(pacote, 'hooks', 'session-start.mjs'))) {
  process.stderr.write('uso: node tests/regressao/gerar-referencia.mjs <pasta plugins/connect de outra versao>\n');
  process.exit(2);
}

fs.mkdirSync(REFERENCIA, { recursive: true });
const { sessao, nuvem } = await contextosDoCowork(pacote);
fs.writeFileSync(path.join(REFERENCIA, 'contexto-sessao.md'), `${sessao}\n`);
fs.writeFileSync(path.join(REFERENCIA, 'contexto-nuvem.md'), `${nuvem}\n`);
const tools = await toolsDoMcp(pacote);
fs.writeFileSync(path.join(REFERENCIA, 'mcp-tools.json'), `${JSON.stringify(tools, null, 2)}\n`);
fs.writeFileSync(path.join(REFERENCIA, 'superficie-cowork.json'), `${JSON.stringify(hashesDaSuperficie(pacote), null, 2)}\n`);
process.stdout.write(`Referencia gerada em ${REFERENCIA}: ${tools.length} tools\n`);
