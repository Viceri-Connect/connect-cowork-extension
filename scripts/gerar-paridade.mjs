#!/usr/bin/env node
// Gera docs/paridade-harness.md a partir de tests/architecture/paridade.mjs — a tabela
// do que o Cowork faz e de como cada host faz igual ou com qual limiar. O teste de
// arquitetura falha se o documento versionado divergir do gerado.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gerarDocParidade } from '../tests/architecture/paridade.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destino = path.join(root, 'docs', 'paridade-harness.md');
fs.writeFileSync(destino, gerarDocParidade());
process.stdout.write(`Paridade gerada: ${destino}\n`);
