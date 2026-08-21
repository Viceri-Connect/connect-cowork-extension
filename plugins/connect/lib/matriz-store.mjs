import fs from 'node:fs';
import path from 'node:path';
import { defaultConnectHome } from './config-local.mjs';

const clean = (v) => (typeof v === 'string' && v.trim() && !v.includes('${') ? v.trim() : null);

function resolveHome(home) {
  const base = clean(home) || clean(process.env.CONNECT_HOME) || defaultConnectHome();
  return path.resolve(base);
}

function registryPath(home) {
  const base = resolveHome(home);
  return path.join(base, 'matrizes-registry.json');
}

function ensureHome(home) {
  const base = resolveHome(home);
  fs.mkdirSync(base, { recursive: true });
  return base;
}

function appendAuditLog({ home, operation, origin = 'copilot', details = {} } = {}) {
  const base = ensureHome(home);
  const file = path.join(base, 'audit.log');
  const op = {
    ts: new Date().toISOString(),
    operation,
    origin,
    operator: process.env.USER || process.env.USERNAME || 'unknown',
    ...details,
  };
  fs.appendFileSync(file, `${JSON.stringify(op)}\n`, 'utf8');
  return file;
}

function readRegistry(home) {
  const file = registryPath(home);
  if (!fs.existsSync(file)) return {};
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeRegistry(home, value) {
  const base = ensureHome(home);
  const file = path.join(base, 'matrizes-registry.json');
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
  return file;
}

function safeSnapshotPath(home, id) {
  const base = ensureHome(home);
  return path.join(base, 'matrizes', String(id).trim() || 'matrix');
}

function copyDirectory(src, dest) {
  if (!src || !fs.existsSync(src) || !fs.statSync(src).isDirectory()) {
    throw new Error(`origem invalida para snapshot: ${src}`);
  }
  const resolvedDest = path.resolve(dest);
  const resolvedSrc = path.resolve(src);
  if (resolvedDest === resolvedSrc || resolvedDest.startsWith(resolvedSrc + path.sep)) {
    throw new Error('snapshot nao pode ficar dentro da origem da matriz');
  }
  fs.rmSync(resolvedDest, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(resolvedDest), { recursive: true });
  fs.cpSync(resolvedSrc, resolvedDest, { recursive: true, force: true });
  return resolvedDest;
}

export function persistMatrix({ id, sourcePath, metadata = {}, consent = false, home, origin = 'copilot' } = {}) {
  if (!id || !String(id).trim()) {
    throw new Error('matriz.persist requer um id');
  }

  const registry = readRegistry(home);
  const base = ensureHome(home);
  const safeId = String(id).trim();
  const src = sourcePath ? path.resolve(sourcePath) : null;
  const record = { ...registry[safeId] };

  const snapshotPath = consent && src && fs.existsSync(src) && fs.statSync(src).isDirectory()
    ? copyDirectory(src, safeSnapshotPath(base, safeId))
    : null;

  const nextRecord = {
    id: safeId,
    sourcePath: src || record.sourcePath || null,
    snapshotPath,
    metadata: { ...(record.metadata || {}), ...(metadata || {}) },
    consent: !!consent,
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    origin,
  };

  registry[safeId] = nextRecord;
  writeRegistry(base, registry);
  appendAuditLog({
    home: base,
    operation: 'matriz.persist',
    origin,
    details: {
      id: safeId,
      consent: !!consent,
      snapshotPath,
      sourcePath: src,
    },
  });

  return {
    id: safeId,
    status: 'persisted',
    consent: !!consent,
    sourcePath: src,
    snapshotPath,
    home: base,
    metadata: nextRecord.metadata,
  };
}

export function loadMatrix({ id, home, origin = 'copilot' } = {}) {
  const base = ensureHome(home);
  const registry = readRegistry(base);
  const matrix = registry[id] || registry[String(id).trim()];
  if (!matrix) {
    throw new Error(`matriz nao encontrada: ${id}`);
  }

  const mountInstructions = {
    mode: matrix.snapshotPath ? 'connect-home-snapshot' : 'reference-only',
    sourcePath: matrix.snapshotPath || matrix.sourcePath || null,
    workspaceAlias: 'matriz',
    steps: [
      'Verifique o consentimento do operador antes de montar o snapshot.',
      'Use a origem salva em CONNECT_HOME para reconstruir a montagem segura.',
      'Valide que o caminho permanece dentro do escopo do workspace.',
    ],
  };

  appendAuditLog({
    home: base,
    operation: 'matriz.load',
    origin,
    details: { id: matrix.id, snapshotPath: matrix.snapshotPath || null },
  });

  return {
    status: 'loaded',
    id: matrix.id,
    home: base,
    matrix,
    mountInstructions,
  };
}

export function listMatrices({ home, origin = 'copilot' } = {}) {
  const base = ensureHome(home);
  const registry = readRegistry(base);
  const items = Object.values(registry).map((matrix) => ({
    id: matrix.id,
    sourcePath: matrix.sourcePath || null,
    snapshotPath: matrix.snapshotPath || null,
    consent: !!matrix.consent,
    updatedAt: matrix.updatedAt || null,
  }));

  appendAuditLog({
    home: base,
    operation: 'matriz.list',
    origin,
    details: { count: items.length },
  });

  return { status: 'listed', items, home: base };
}

export function removeMatrix({ id, home, origin = 'copilot' } = {}) {
  if (!id || !String(id).trim()) {
    throw new Error('matriz.remove requer um id');
  }

  const base = ensureHome(home);
  const registry = readRegistry(base);
  const safeId = String(id).trim();
  const record = registry[safeId];
  if (!record) {
    return { status: 'absent', id: safeId, home: base };
  }

  if (record.snapshotPath && fs.existsSync(record.snapshotPath)) {
    fs.rmSync(record.snapshotPath, { recursive: true, force: true });
  }

  delete registry[safeId];
  writeRegistry(base, registry);

  appendAuditLog({
    home: base,
    operation: 'matriz.remove',
    origin,
    details: { id: safeId },
  });

  return { status: 'removed', id: safeId, home: base };
}

export default {
  persistMatrix,
  loadMatrix,
  listMatrices,
  removeMatrix,
};
