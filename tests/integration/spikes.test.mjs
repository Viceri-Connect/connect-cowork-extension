// tests/integration/spikes.test.mjs
// Roda cada `tests/integration/<dominio>/*.spike.mjs` como subprocesso, em um perfil de
// usuario descartavel (ver ../helpers/isolamento.mjs), e exige exit code 0.
//
// Os spikes sao scripts autonomos com contador proprio de ok/falha e `process.exit(1)`
// em falha. Em vez de reescrever todos de uma vez, o Vitest e o orquestrador: um grupo
// por dominio, um caso por spike, em paralelo, com a saida do spike anexada quando falha.
//
// Migrar um spike para teste nativo = mover a logica para tests/unit/<modulo>.test.mjs e
// apagar o `.spike.mjs`. A lista e derivada da pasta, entao nada mais muda aqui.

import { describe, it, expect, afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promisify } from 'node:util';
import { criarSandbox, semearRuntime } from '../helpers/isolamento.mjs';

const execFileP = promisify(execFile);
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
// Fora de AppData (ver helpers/isolamento.mjs); ignorado pelo git.
const BASE_SANDBOX = path.join(RAIZ, '.test-tmp');

// dominio -> [arquivos]
const dominios = new Map();
for (const dirent of readdirSync(AQUI, { withFileTypes: true })) {
  if (!dirent.isDirectory()) continue;
  const arquivos = readdirSync(path.join(AQUI, dirent.name)).filter((f) => f.endsWith('.spike.mjs')).sort();
  if (arquivos.length) dominios.set(dirent.name, arquivos);
}

// Spikes que sobem o MCP pelo launcher real: recebem o runtime semeado (ver semearRuntime).
const SOBEM_O_LAUNCHER = new Set(['multiplataforma.spike.mjs']);

const sandboxes = [];
afterAll(() => { for (const s of sandboxes) s.limpar(); });

it('encontra spikes de integracao', () => {
  expect(dominios.size).toBeGreaterThan(0);
});

for (const [dominio, arquivos] of dominios) {
  describe(`integracao: ${dominio}`, () => {
    it.concurrent.each(arquivos)('%s', async (arquivo) => {
      const sandbox = criarSandbox(`connect-${dominio}-${arquivo.replace(/\.spike\.mjs$/, '')}-`, BASE_SANDBOX);
      sandboxes.push(sandbox);
      if (SOBEM_O_LAUNCHER.has(arquivo)) semearRuntime(sandbox);

      let saida = '';
      let codigo = 0;
      try {
        const r = await execFileP(process.execPath, [path.join('tests', 'integration', dominio, arquivo)], {
          cwd: RAIZ,
          env: sandbox.env,
          timeout: 55_000,
          maxBuffer: 16 * 1024 * 1024,
          windowsHide: true,
        });
        saida = `${r.stdout}\n${r.stderr}`;
      } catch (e) {
        codigo = typeof e.code === 'number' ? e.code : 1;
        saida = `${e.stdout ?? ''}\n${e.stderr ?? ''}\n${e.message}`;
      }

      expect(codigo, `saida do spike:\n${saida.split('\n').slice(-60).join('\n')}`).toBe(0);
    });
  });
}