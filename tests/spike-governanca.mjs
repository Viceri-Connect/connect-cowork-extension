#!/usr/bin/env node
// tests/spike-governanca.mjs
// Spike do ARQUIVO DE GOVERNANCA na raiz do vault — ADR-18.
//
// Premissas que este spike mata:
//   1. O arquivo gerado NAO carrega o conteudo da carta — ele aponta. Se um dia
//      alguem espelhar conteudo aqui, este teste quebra (e e para quebrar: era o
//      desenho da ADR-17, derrubado pela P144).
//   2. O marcador e de IDENTIDADE, nao de versao: nao ha hash da fonte.
//   3. Raiz sem arquivo => 'ausente', e ausencia NUNCA e lacuna.
//   4. Raiz com arquivo alheio (sem marcador) => 'nao-governado' e a publicacao se
//      RECUSA a sobrescrever. E o caso da Camada 0 do operador e das sondas.
//   5. Write-once na pratica: republicar sem mudanca devolve 'inalterado' e NAO
//      toca o arquivo. E o que impede o conflito de sync que derrubou a ADR-17.
//   6. As regras duras vem da fonte unica (`lib/regras.mjs`) — o texto do arquivo
//      e o texto do bloco injetado nao podem divergir.
//   7. Arquivo com marcador de OUTRO vault e sinalizado (copia manual/conflito).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  gerarArquivoGovernanca,
  lerMarcador,
  verificarRaiz,
  publicarGovernanca,
  precisaAtualizar,
  slugVault,
  NOME_ARQUIVO_GOVERNANCA,
} from '../plugins/connect/lib/governanca.mjs';
import { REGRAS_DURAS } from '../plugins/connect/lib/regras.mjs';

let passou = 0, falhou = 0;
const ok = (cond, nome) => {
  if (cond) { passou++; console.log(`  ok   ${nome}`); }
  else { falhou++; console.log(`  FALHA ${nome}`); }
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-gov-'));
const mkVault = (nome) => {
  const p = path.join(tmp, nome);
  fs.mkdirSync(path.join(p, '_cerebro'), { recursive: true });
  return p;
};

console.log(`\nspike-governanca — sandbox: ${tmp}\n`);

// --- 1. o texto gerado aponta, nao espelha ---------------------------------
console.log('1) o arquivo aponta para a carta, nunca a espelha');
const texto = gerarArquivoGovernanca({ vault: 'Tribo Impulsa', nomeExibicao: 'Acervo da Tribo Impulsa' });
ok(texto.includes('_cerebro/camada-1.md'), 'aponta para a carta canonica');
ok(!/^##\s+(Estrutura|Ordem de entrada|Quando carregar|Fronteiras)/m.test(texto),
  'NAO contem as secoes da carta (nao e espelho de conteudo)');
ok(texto.includes('vault governado'), 'declara que o vault e governado');

// --- 2. marcador de identidade, sem hash da fonte --------------------------
console.log('\n2) marcador e identidade, nao versao');
const marca = lerMarcador(texto);
ok(marca && marca.vault === 'tribo-impulsa', 'marcador legivel com slug do vault');
ok(marca && /^\d{4}-\d{2}-\d{2}T/.test(marca.geradoEm), 'marcador traz gerado-em ISO');
ok(!/hash|sha1|CNCT-L1/i.test(texto), 'nenhum hash de fonte no arquivo (nao e a ADR-17)');
ok(slugVault('Acervo da Tribo Impulsa!!') === 'acervo-da-tribo-impulsa', 'slug normaliza acento e simbolo');
ok(lerMarcador('# um arquivo qualquer\n') === null, 'arquivo alheio nao produz marcador');

// --- 3. ausencia nao e lacuna ---------------------------------------------
console.log('\n3) raiz sem arquivo => ausente (e ausencia nao e lacuna)');
const vazio = mkVault('vault-vazio');
const rVazio = verificarRaiz(vazio, { vault: 'vault-vazio' });
ok(rVazio.estado === 'ausente', "estado 'ausente'");
ok(rVazio.avisos.length === 0, 'ausencia NAO emite aviso de lacuna');

// --- 4. arquivo alheio: detecta e recusa sobrescrever ----------------------
console.log('\n4) CLAUDE.md alheio na raiz => nao-governado, publicacao recusada');
const alheio = mkVault('vault-com-alheio');
const alvoAlheio = path.join(alheio, NOME_ARQUIVO_GOVERNANCA);
fs.writeFileSync(alvoAlheio, '# Camada 0 de alguem\n\nInstrucoes autorais que ninguem deve apagar.\n', 'utf8');
const antes = fs.readFileSync(alvoAlheio, 'utf8');

const rAlheio = verificarRaiz(alheio, { vault: 'vault-com-alheio' });
ok(rAlheio.estado === 'nao-governado', "estado 'nao-governado'");
ok(rAlheio.avisos.length === 1 && /override/i.test(rAlheio.avisos[0]), 'aviso menciona a precedencia de override');

const pubAlheio = publicarGovernanca(alheio, { vault: 'vault-com-alheio' });
ok(pubAlheio.status === 'recusado', 'publicacao RECUSADA');
ok(fs.readFileSync(alvoAlheio, 'utf8') === antes, 'arquivo alheio intacto, byte a byte');

// --- 5. write-once na pratica ---------------------------------------------
console.log('\n5) write-once: republicar sem mudanca nao toca o arquivo');
const vaultB = mkVault('vault-b');
const pub1 = publicarGovernanca(vaultB, { vault: 'vault-b', agora: new Date('2026-08-26T12:00:00Z') });
ok(pub1.status === 'publicado', 'primeira publicacao grava');

const alvoB = path.join(vaultB, NOME_ARQUIVO_GOVERNANCA);
const mtime1 = fs.statSync(alvoB).mtimeMs;
const conteudo1 = fs.readFileSync(alvoB, 'utf8');

// mesma chamada, timestamp DIFERENTE: o corpo nao mudou, logo nada deve ser escrito.
const pub2 = publicarGovernanca(vaultB, { vault: 'vault-b', agora: new Date('2026-09-01T08:00:00Z') });
ok(pub2.status === 'inalterado', "segunda publicacao devolve 'inalterado'");
ok(fs.statSync(alvoB).mtimeMs === mtime1, 'mtime NAO mudou (OneDrive nao ve evento de escrita)');
ok(fs.readFileSync(alvoB, 'utf8') === conteudo1, 'conteudo identico');
ok(!precisaAtualizar(conteudo1, gerarArquivoGovernanca({ vault: 'vault-b' })),
  'precisaAtualizar ignora a linha do marcador (so o corpo conta)');

const rB = verificarRaiz(vaultB, { vault: 'vault-b' });
ok(rB.estado === 'governado', "vault publicado => 'governado'");
ok(rB.avisos.length === 0, 'vault governado nao emite aviso');

// --- 6. fonte unica das regras duras --------------------------------------
console.log('\n6) regras duras vem da fonte unica');
ok(REGRAS_DURAS.length === 5, 'cinco regras duras');
ok(REGRAS_DURAS.every((r) => texto.includes(r)), 'TODAS entram no arquivo, com o texto exato de lib/regras.mjs');

// --- 7. marcador de outro vault e sinalizado ------------------------------
console.log('\n7) marcador de outro vault => sinaliza copia/conflito');
const rCruzado = verificarRaiz(vaultB, { vault: 'outro-vault' });
ok(rCruzado.estado === 'governado', 'ainda e arquivo nosso');
ok(rCruzado.avisos.some((a) => /OUTRO vault/i.test(a)), 'avisa que o marcador e de outro vault');

// --- resultado -------------------------------------------------------------
console.log(`\n${passou} ok, ${falhou} falha(s)\n`);
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* sandbox descartavel */ }
process.exit(falhou === 0 ? 0 : 1);
