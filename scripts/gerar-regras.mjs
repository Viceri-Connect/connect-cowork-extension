#!/usr/bin/env node
// Gera as regras sempre ativas do pacote a partir de lib/regras.mjs — fonte unica das
// regras duras: plugins/connect/rules/AGENTS.md (Antigravity) e
// plugins/connect/com.github.copilot/rules/connect.md (Copilot). Rode depois de editar
// REGRAS_DURAS. O teste de arquitetura falha se um arquivo versionado divergir do gerado.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARQUIVOS_REGRAS_SEMPRE_ATIVAS, textoRegrasSempreAtivas } from '../plugins/connect/lib/regras.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const rel of ARQUIVOS_REGRAS_SEMPRE_ATIVAS) {
  const destino = path.join(root, 'plugins', 'connect', rel);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, textoRegrasSempreAtivas());
  process.stdout.write(`Regras sempre ativas geradas: ${destino}\n`);
}
