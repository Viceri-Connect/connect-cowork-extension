#!/usr/bin/env node
// Gera plugins/connect/rules/AGENTS.md (regra sempre ativa do Antigravity) a partir de
// lib/regras.mjs — fonte unica das regras duras. Rode depois de editar REGRAS_DURAS e
// regenere o connect-http (npm run build:connect-http). O teste de arquitetura falha se
// o arquivo versionado divergir do gerado.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARQUIVO_REGRAS_SEMPRE_ATIVAS, textoRegrasSempreAtivas } from '../plugins/connect/lib/regras.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destino = path.join(root, 'plugins', 'connect', ARQUIVO_REGRAS_SEMPRE_ATIVAS);
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, textoRegrasSempreAtivas());
process.stdout.write(`Regras sempre ativas geradas: ${destino}\n`);
