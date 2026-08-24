#!/usr/bin/env node
// spike-presenca-contexto.mjs — M1/M2 (24/08).
//
// O que este spike protege, e por que existe:
//   O bloco unico de contexto cresceu a ~16 KB (efeito colateral do D150) e o cliente
//   Cowork nao o injetou: truncou e salvou num log de hook, entregando 2 KB de preview.
//   Camada 0/1 ausente, sem sinal — reversao pratica do D104.
//
//   A regressao a evitar e de TAMANHO, e tamanho e a unica coisa que nenhuma revisao
//   de codigo pega no olho. Daqui pra frente, um teto numerico.
//
// Rodar: node tests/spike-presenca-contexto.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderContexto, renderContextoCurto } from '../plugins/connect/lib/render.mjs';
import { materializarContexto, NOME_ARQUIVO_CONTEXTO } from '../plugins/connect/lib/contexto-arquivo.mjs';

// Teto do bloco injetado. Nao e estetica: acima de ~4 KB o cliente comeca a truncar,
// e truncar significa camada 0/1 ausente. Se um dia este numero precisar subir, a
// pergunta certa e "o que entrou aqui que devia estar no arquivo?".
const TETO_CURTO_BYTES = 4096;

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
  l1Pessoal: { hotCacheInline: '# Memory\n' + 'delta pessoal.\n'.repeat(80), ponteiros: [] },
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

const completo = renderContexto(report);
const arquivo = materializarContexto({ workspace: report.workspace, bloco: completo });
const curto = renderContextoCurto(report, arquivo);

teste('contexto completo e materializado no workspace', () => {
  assert.equal(arquivo.status, 'materializado');
  assert.ok(fs.existsSync(path.join(report.workspace, NOME_ARQUIVO_CONTEXTO)));
});

teste('o arquivo contem o peso: carta verbatim, protocolo e camada 0', () => {
  const lido = fs.readFileSync(arquivo.caminho, 'utf8');
  assert.ok(lido.includes('linha de carta declarada pelo vault.'), 'carta ausente no arquivo');
  assert.ok(lido.includes('linha de protocolo.'), 'protocolo ausente no arquivo');
  assert.ok(lido.includes('delta pessoal.'), 'camada 0 do operador ausente no arquivo');
});

teste(`bloco injetado fica abaixo do teto (${TETO_CURTO_BYTES} bytes)`, () => {
  const bytes = Buffer.byteLength(curto, 'utf8');
  assert.ok(bytes < TETO_CURTO_BYTES, `bloco curto tem ${bytes} bytes — acima do teto. O que entrou aqui que devia estar no arquivo?`);
});

teste('o bloco injetado NAO cresce com o tamanho do vault', () => {
  const gordo = { ...report, l1: { ...report.l1, carta: { ...report.l1.carta, inline: cartaGorda.repeat(5) } } };
  const a2 = materializarContexto({ workspace: report.workspace, bloco: renderContexto(gordo) });
  const c2 = renderContextoCurto(gordo, a2);
  // Unica variacao legitima: o KB reportado do arquivo no ponteiro.
  assert.ok(Math.abs(Buffer.byteLength(c2, 'utf8') - Buffer.byteLength(curto, 'utf8')) < 40, 'bloco curto variou com o tamanho do vault — vazou conteudo de acervo para o canal injetado');
});

teste('o bloco injetado aponta o arquivo e manda ler antes do trabalho', () => {
  assert.ok(curto.includes(NOME_ARQUIVO_CONTEXTO), 'ponteiro para o arquivo ausente');
  assert.ok(/LEIA ANTES/.test(curto), 'instrucao de leitura obrigatoria ausente');
  assert.ok(/Releia/.test(curto), 'instrucao de re-leitura (sessao longa) ausente');
});

teste('regras duras ficam no canal injetado, nunca so no arquivo', () => {
  assert.ok(/chame `resolver` ANTES/.test(curto), 'regra do resolver ausente do bloco injetado');
  assert.ok(/cnct-nucleo-escrita/.test(curto), 'regra do protocolo de escrita ausente do bloco injetado');
  assert.ok(/DEIXA MARCA/.test(curto), 'regra de varredura ausente do bloco injetado');
});

teste('M2 — o bloco declara CADA origem a conceder, nao so o home', () => {
  assert.ok(curto.includes('C:\\OneDrive\\Matriz'), 'origem da matriz nao declarada');
  assert.ok(/Uma concessao pode nao bastar/.test(curto), 'ressalva da concessao unica ausente');
});

teste('falha de escrita degrada com aviso, nunca em silencio', () => {
  const r = materializarContexto({ workspace: '', bloco: completo });
  assert.equal(r.status, 'nao-aplicavel');
  const c = renderContextoCurto(report, r);
  assert.ok(/nao materializado/.test(c), 'ausencia de contexto nao foi anunciada');
  assert.ok(/AUSENTE/.test(c), 'o bloco nao avisa que a camada 0/1 esta ausente');
});

teste('estado zero da matriz avisa sobre pasta trocada (D157)', () => {
  const zero = { ...report, matrizConfigurada: false };
  const c = renderContextoCurto(zero, arquivo);
  assert.ok(/tipo-vault: matriz/.test(c), 'gate de identidade nao mencionado no 1o uso');
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(falhas ? `\n${falhas} falha(s)` : '\ntodos verdes');
process.exit(falhas ? 1 : 0);
