#!/usr/bin/env node
// Gera a referencia de regressao do Cowork (tests/regressao/referencia/) a partir de um
// pacote plugins/connect.
//
//   node tests/regressao/gerar-referencia.mjs plugins/connect
//
// Quando rodar: SO quando a mudanca no que o Cowork recebe foi DECIDIDA (texto do hook,
// contrato de tool, hooks.json/.mcp.json/launcher/run-node.ps1). Rode no mesmo PR da
// mudanca: o diff de referencia/ mostra ao revisor exatamente o que muda para o operador
// do Cowork. Registre no CHANGELOG. Rodar so para o teste voltar a passar, sem decisao,
// apaga a protecao que ele existe para dar.

import fs from 'node:fs';
import path from 'node:path';
import { REFERENCIA, contextosDoCowork, toolsDoMcp, hashesDaSuperficie } from './cowork.mjs';

const pacote = path.resolve(process.argv[2] || '');
if (!fs.existsSync(path.join(pacote, 'hooks', 'session-start.mjs'))) {
  process.stderr.write('uso: node tests/regressao/gerar-referencia.mjs <pasta plugins/connect>\n');
  process.exit(2);
}

fs.mkdirSync(REFERENCIA, { recursive: true });
const { sessao, nuvem } = await contextosDoCowork(pacote);
fs.writeFileSync(path.join(REFERENCIA, 'contexto-sessao.md'), `${sessao}\n`);
fs.writeFileSync(path.join(REFERENCIA, 'contexto-nuvem.md'), `${nuvem}\n`);
const tools = await toolsDoMcp(pacote);
fs.writeFileSync(path.join(REFERENCIA, 'mcp-tools.json'), `${JSON.stringify(tools, null, 2)}\n`);
fs.writeFileSync(path.join(REFERENCIA, 'superficie-cowork.json'), `${JSON.stringify(hashesDaSuperficie(pacote), null, 2)}\n`);
const versao = JSON.parse(fs.readFileSync(path.join(pacote, '.claude-plugin', 'plugin.json'), 'utf8')).version;
fs.writeFileSync(path.join(REFERENCIA, 'origem.md'), `Referencia do Cowork gerada pelo pacote ${versao} em ${new Date().toISOString().slice(0, 10)}.\nRegenerar so com mudanca decidida no Cowork (ver gerar-referencia.mjs).\n`);
process.stdout.write(`Referencia gerada em ${REFERENCIA}: ${tools.length} tools\n`);
