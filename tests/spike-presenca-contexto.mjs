#!/usr/bin/env node
// spike-presenca-contexto.mjs — canal injetado (M1/M2 de 24/08, refeito na 0.38.0).
//
// Historia: o bloco unico de 16 KB foi truncado pelo cliente (24/08) e o peso foi
// para `contexto-sessao.md`. Medido em 13/10: dos 22 KB do arquivo, so a camada 0
// era exclusiva, e o arquivo morava num caminho que pede concessao a cada sessao —
// o agente nao abria. A 0.38.0 tira o arquivo e poe a camada 0 no stdout, sob o
// teto DOCUMENTADO do cliente: stdout de hook acima de 10.000 caracteres vira
// arquivo + previa de 2.000 (https://code.claude.com/docs/en/hooks).
//
// O que este spike trava:
//   - o bloco injetado fica abaixo de TETO_INJETADO (margem sob os 10.000);
//   - carta e protocolo NAO entram nele (nao cresce com o tamanho do vault);
//   - a camada 0 entra inteira quando cabe, e vira ponteiro DECLARADO quando nao;
//   - o acionavel e as regras duras ficam nos primeiros 2.000 caracteres (a previa
//     que sobrevive se o teto um dia for estourado).
//
// Rodar: node tests/spike-presenca-contexto.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderContexto, renderContextoCurto, TETO_INJETADO } from '../plugins/connect/lib/render.mjs';

const TETO_CLIENTE = 10000;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-presenca-'));
let falhas = 0;
const ok = (nome) => console.log(`  ok   ${nome}`);
const teste = (nome, fn) => {
  try { fn(); ok(nome); } catch (e) { falhas++; console.error(`  FALHA ${nome}\n         ${e.message}`); }
};

// Report sintetico com um vault GRANDE — o caso real, nao o feliz.
const cartaGorda = '# Camada 1\n' + 'linha de carta declarada pelo vault.\n'.repeat(400);
const protocoloGordo = '# Protocolo do mecanismo\n' + 'linha de protocolo.\n'.repeat(300);

const report = {
  sessionId: 'spike',
  workspace: path.join(tmp, 'sessions', 'spike'),
  home: tmp,
  matrizConfigurada: true,
  operadorProvisionado: true,
  identidade: { nome: 'Operador Teste', email: 'op@teste', papeis: ['Tech Lead'] },
  protocoloMecanismo: protocoloGordo,
  mounts: [
    { status: 'mounted', alias: 'matriz', source: 'C:\\OneDrive\\Matriz', kind: 'junction' },
    { status: 'mounted', alias: 'operador', source: path.join(tmp, 'operador'), kind: 'junction' },
  ],
  l1: {
    identidadeVault: { empresa: 'Empresa X' },
    carta: { presente: true, origem: 'canonica', caminhoRelativo: './matriz/_cerebro/camada-1.md', inline: cartaGorda, validacao: { ok: true, faltando: [] } },
  },
  l1Pessoal: { alias: 'operador', hotCacheInline: '# Memory\n' + 'delta pessoal.\n'.repeat(80), ponteiros: [] },
  concessao: {
    necessaria: true,
    caminho: tmp,
    motivo: 'motivo de teste',
    alcanca: ['./matriz', './operador'],
    origens: [
      { alias: './matriz', caminho: 'C:\\OneDrive\\Matriz' },
      { alias: './operador', caminho: path.join(tmp, 'operador') },
    ],
  },
  avisos: [],
};

console.log('spike-presenca-contexto');

const curto = renderContextoCurto(report);

teste(`TETO_INJETADO (${TETO_INJETADO}) fica abaixo do teto do cliente (${TETO_CLIENTE})`, () => {
  assert.ok(TETO_INJETADO < TETO_CLIENTE);
});

teste('bloco injetado fica abaixo do teto, com vault grande e camada 0 real', () => {
  assert.ok(curto.length <= TETO_INJETADO, `bloco tem ${curto.length} caracteres`);
});

teste('a camada 0 do operador chega INTEIRA pelo canal injetado quando cabe', () => {
  assert.ok(curto.includes('delta pessoal.'), 'camada 0 ausente do canal injetado');
  assert.ok(/Perfil do operador — camada 0/.test(curto));
});

teste('carta e protocolo NAO entram no canal injetado (nao cresce com o vault)', () => {
  assert.ok(!curto.includes('linha de carta declarada pelo vault.'), 'carta vazou para o canal injetado');
  assert.ok(!curto.includes('linha de protocolo.'), 'protocolo vazou para o canal injetado');
  const gordo = { ...report, l1: { ...report.l1, carta: { ...report.l1.carta, inline: cartaGorda.repeat(5) } }, protocoloMecanismo: protocoloGordo.repeat(5) };
  assert.equal(renderContextoCurto(gordo).length, curto.length, 'bloco variou com o tamanho do vault');
});

teste('o canal injetado aponta a carta e a releitura pela tool — sem arquivo de sessao', () => {
  assert.ok(/_cerebro\/camada-1\.md/.test(curto), 'ponteiro da carta ausente');
  assert.ok(/iniciar_sessao/.test(curto), 'releitura pela tool ausente');
  assert.ok(!/contexto-sessao/.test(curto), 'ainda manda ler o contexto-sessao.md');
});

teste('a tool continua entregando o completo: protocolo, carta e camada 0', () => {
  const completo = renderContexto(report);
  assert.ok(completo.includes('linha de protocolo.') && completo.includes('linha de carta declarada pelo vault.') && completo.includes('delta pessoal.'));
});

teste('camada 0 acima do orcamento vira ponteiro DECLARADO, nunca corte no meio', () => {
  const enorme = { ...report, l1Pessoal: { alias: 'operador', hotCacheInline: '# Memory\n' + 'delta pessoal enorme.\n'.repeat(900), ponteiros: [] } };
  const c = renderContextoCurto(enorme);
  assert.ok(c.length <= TETO_INJETADO, `degradado ainda tem ${c.length}`);
  assert.ok(!c.includes('delta pessoal enorme.'), 'cortou a camada 0 no meio em vez de apontar');
  assert.ok(/nao cabe no canal injetado/.test(c) && c.includes('./operador/CLAUDE.md'), 'degradacao sem aviso ou sem ponteiro');
});

teste('comentario HTML da camada 0 nao gasta orcamento', () => {
  const comComentario = { ...report, l1Pessoal: { alias: 'operador', hotCacheInline: '<!-- nota interna longa ' + 'x'.repeat(3000) + ' -->\n# Memory\ndelta pessoal.', ponteiros: [] } };
  assert.ok(!renderContextoCurto(comComentario).includes('nota interna longa'));
});

teste('acionavel e regras duras ficam nos primeiros 2.000 caracteres (a previa que sobrevive)', () => {
  const previa = curto.slice(0, 2000);
  assert.ok(/acesso de pasta/.test(previa), 'concessao fora da previa');
  const semConcessao = renderContextoCurto({ ...report, concessao: null }).slice(0, 2000);
  assert.ok(/Regras duras/.test(semConcessao), 'regras duras fora da previa');
});

teste('regras duras ficam no canal injetado', () => {
  assert.ok(/`resolver` e para conceito com casa FORA da matriz/.test(curto));
  assert.ok(/cnct-nucleo-escrita/.test(curto));
  assert.ok(/DEIXA MARCA/.test(curto));
});

teste('M2 — o bloco declara CADA origem a conceder, nao so o home', () => {
  assert.ok(curto.includes('C:\\OneDrive\\Matriz'), 'origem da matriz nao declarada');
  assert.ok(/Uma concessao pode nao bastar/.test(curto));
});

teste('estado zero da matriz avisa sobre pasta trocada (D157)', () => {
  const c = renderContextoCurto({ ...report, matrizConfigurada: false });
  assert.ok(/tipo-vault: matriz/.test(c));
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(falhas ? `\n${falhas} falha(s)` : '\ntodos verdes');
process.exit(falhas ? 1 : 0);
