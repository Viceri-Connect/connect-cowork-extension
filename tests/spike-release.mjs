#!/usr/bin/env node
// spike-release.mjs - versao do manifesto x CHANGELOG.
//
// O QUE ESTE SPIKE COBRE: que a versao declarada em plugins/connect/.claude-plugin/plugin.json
// e a primeira entrada do plugins/connect/CHANGELOG.md. O CHANGELOG e o arquivo que a sessao de
// trabalho toca naturalmente; o manifesto e o que a INSTALACAO le. Sem este check, os dois ja
// divergiram uma vez (CHANGELOG 0.30.0 x plugin.json 0.29.1) e quem pegou foi o operador.
//
// NAO COBRE: se a versao foi de fato publicada/instalada, nem o conteudo da entrada.
//
//   node tests/spike-release.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';

let falhas = 0;
const teste = (nome, fn) => {
  try { fn(); console.log(`  ok   ${nome}`); }
  catch (e) { falhas++; console.error(`  FALHA ${nome}\n         ${e.message}`); }
};

const manifesto = JSON.parse(fs.readFileSync('plugins/connect/.claude-plugin/plugin.json', 'utf8'));
const changelog = fs.readFileSync('plugins/connect/CHANGELOG.md', 'utf8');
const primeira = changelog.match(/^## (\d+\.\d+\.\d+)\b/m)?.[1];

console.log('spike-release');

teste('o CHANGELOG tem ao menos uma entrada de versao', () => {
  assert.ok(primeira, 'nenhum cabecalho "## x.y.z" no CHANGELOG');
});

teste('a versao do plugin.json e a primeira entrada do CHANGELOG', () => {
  assert.equal(manifesto.version, primeira,
    `plugin.json declara ${manifesto.version}, CHANGELOG abre com ${primeira}`);
});

if (falhas) { console.error(`\n${falhas} falha(s)`); process.exit(1); }
console.log('\ntodas as checagens passaram');
