#!/usr/bin/env node
// spike-runtime-fora-do-pacote.mjs - 0.15.0 (24/08).
//
// O QUE ESTE SPIKE COBRE, E O QUE ELE NAO COBRE - leia antes de confiar nele.
//
//   Cobre: o CONTRATO textual do run-node.bat. Que o destino do runtime e o
//   CONNECT_HOME e nao o diretorio do pacote; que ha migracao do legado; que o
//   download e atomico e verificado; que o .bat e ASCII+CRLF (requisito do cmd.exe);
//   e que launcher e hook continuam passando pela fonte unica.
//
//   NAO cobre: a EXECUCAO em Windows. Isto roda em Linux e .bat nao executa aqui.
//   A validacao real e o operador atualizando o plugin com sessao aberta e a
//   instalacao sobrevivendo - o teste que nenhum spike faz.
//
//   Esta distincao esta escrita porque a norma D163 exige: conclusao tirada de spike
//   vale so no caminho que o spike percorreu.
//
//   node tests/spike-runtime-fora-do-pacote.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';

let falhas = 0;
const teste = (nome, fn) => {
  try { fn(); console.log(`  ok   ${nome}`); }
  catch (e) { falhas++; console.error(`  FALHA ${nome}\n         ${e.message}`); }
};

const P = 'plugins/connect/scripts/run-node.bat';
const bruto = fs.readFileSync(P);
const bat = bruto.toString('utf8');
// Linhas de codigo = tudo que nao e comentario `::`. O contrato vale sobre o que o
// cmd.exe executa, nunca sobre a prosa que explica o porque.
const codigo = bat.split('\r\n').filter((l) => !l.trim().startsWith('::'));

console.log('spike-runtime-fora-do-pacote');

teste('o .bat e ASCII puro (code page do cmd nao corrompe)', () => {
  assert.ok(bruto.every((b) => b < 128), 'byte nao-ASCII no .bat');
});

teste('o .bat usa CRLF (requisito do cmd.exe, nao preferencia)', () => {
  assert.ok(bat.includes('\r\n'), 'sem CRLF');
  assert.ok(!/[^\r]\n/.test(bat), 'ha linha terminada em LF solto');
});

teste('@echo off e a PRIMEIRA linha (senao o cmd ecoa os comentarios)', () => {
  assert.equal(bat.split('\r\n')[0].trim(), '@echo off');
});

teste('o runtime mora no CONNECT_HOME, nunca no diretorio do pacote', () => {
  assert.ok(/set "BIN_DIR=%CONNECT_HOME%\\bin"/.test(bat), 'BIN_DIR nao aponta para o CONNECT_HOME');
  assert.ok(!/set "BIN_DIR=%PLUGIN_DIR%/.test(bat), 'BIN_DIR ainda aponta para dentro do pacote — o defeito que esta versao existe para fechar');
});

teste('CONNECT_HOME cai no perfil do usuario, nunca em pasta de aplicativo (D149)', () => {
  assert.ok(/if not defined CONNECT_HOME set "CONNECT_HOME=%USERPROFILE%\\Connect"/.test(bat));
  // So linhas de CODIGO valem: o comentario cita %LOCALAPPDATA% justamente para dizer
  // que e proibido, e o teste nao pode reprovar a documentacao da propria regra.
  assert.ok(!codigo.some((l) => /LOCALAPPDATA/.test(l)), 'codigo aponta para pasta de aplicativo — proibido desde o D149');
});

teste('migra o runtime que veio no pacote em vez de rebaixar 70 MB', () => {
  assert.ok(/NODE_LEGADO=%PLUGIN_DIR%\\bin\\node\.exe/.test(bat), 'sem caminho do runtime legado');
  assert.ok(/copy \/y "%NODE_LEGADO%" "%NODE_EXE%"/.test(bat), 'sem migracao do legado');
});

teste('download atomico: .tmp + move, nunca direto no destino', () => {
  assert.ok(/-o "%NODE_EXE%\.tmp"/.test(bat), 'curl grava direto no destino — download parcial vira binario permanente');
  assert.ok(/move \/y "%NODE_EXE%\.tmp" "%NODE_EXE%"/.test(bat), 'sem promocao atomica do .tmp');
});

teste('curl falha em erro HTTP (-f), senao grava pagina de erro como binario', () => {
  assert.ok(/curl -fsSL/.test(bat), 'curl sem -f: HTTP 404 seria gravado como node.exe com exit 0');
});

teste('valida que o binario EXECUTA, nao so que existe', () => {
  assert.ok(/"%NODE_EXE%" -v/.test(bat), 'sem verificacao de execucao');
  assert.ok(/del \/q "%NODE_EXE%"/.test(bat), 'binario invalido nao e removido — ficaria travado para sempre');
});

teste('degradacao para o node do PATH e AVISADA, nunca silenciosa (D153)', () => {
  assert.ok(/where node/.test(bat), 'sem fallback de ultimo recurso');
  assert.ok(/AVISO: usando o node do PATH/.test(bat), 'degradacao silenciosa — o modo de falha que o D153 fechou');
});

teste('launcher e hook continuam passando pela fonte unica', () => {
  const launcher = fs.readFileSync('plugins/connect/mcp/launcher.bat', 'utf8');
  const hooks = fs.readFileSync('plugins/connect/hooks/hooks.json', 'utf8');
  assert.ok(/run-node\.bat/.test(launcher), 'launcher nao usa run-node.bat');
  assert.ok(/run-node\.bat/.test(hooks), 'hook nao usa run-node.bat');
});

console.log(falhas ? `\n${falhas} falha(s)` : '\ntodos verdes (contrato textual — execucao em Windows nao coberta)');
process.exit(falhas ? 1 : 0);
