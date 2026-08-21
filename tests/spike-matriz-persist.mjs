#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-matriz-'));
const home = path.join(tmp, 'connect-home');
const source = path.join(tmp, 'matriz-source');
fs.mkdirSync(home, { recursive: true });
fs.mkdirSync(source, { recursive: true });
fs.writeFileSync(path.join(source, 'note.md'), '# matrix snapshot\n', 'utf8');

const server = path.resolve(process.cwd(), 'plugins', 'connect', 'mcp', 'connect-mcp.mjs');
const child = spawn(process.execPath, [server], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: { ...process.env, CONNECT_HOME: home },
});

const pending = new Map();
let buf = '';
child.stdout.on('data', (d) => {
  buf += d.toString();
  let idx;
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id !== undefined && pending.has(msg.id)) {
      const fn = pending.get(msg.id);
      pending.delete(msg.id);
      fn(msg);
    }
  }
});

const call = (id, method, params) => new Promise((resolve) => {
  pending.set(id, resolve);
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
});

const check = (nome, cond) => { console.log(`  ${cond ? 'ok' : 'XX'}  ${nome}`); if (!cond) process.exitCode = 1; };

const run = async () => {
  await call(1, 'initialize', { protocolVersion: '2025-06-18' });
  const list = await call(2, 'tools/list', {});
  const names = (list.result?.tools || []).map((t) => t.name);
  check('MCP expõe matriz.persist, .load, .list e .remove',
    names.includes('matriz.persist') && names.includes('matriz.load') && names.includes('matriz.list') && names.includes('matriz.remove'));

  const persist = await call(3, 'tools/call', {
    name: 'matriz.persist',
    arguments: {
      id: 'demo-matriz',
      sourcePath: source,
      metadata: { owner: 'copilot-test' },
      consent: true,
      home,
    },
  });
  check('persist grava registro com consentimento', !persist.result?.isError && !!persist.result?.structuredContent?.id);

  const load = await call(4, 'tools/call', { name: 'matriz.load', arguments: { id: 'demo-matriz', home } });
  check('load recupera o estado persistido', !load.result?.isError && load.result?.structuredContent?.status === 'loaded');

  const listRes = await call(5, 'tools/call', { name: 'matriz.list', arguments: { home } });
  check('list inclui a matriz persistida', !listRes.result?.isError && Array.isArray(listRes.result?.structuredContent?.items) && listRes.result.structuredContent.items.some((x) => x.id === 'demo-matriz'));

  const remove = await call(6, 'tools/call', { name: 'matriz.remove', arguments: { id: 'demo-matriz', home } });
  check('remove limpa a matriz registrada', !remove.result?.isError && remove.result?.structuredContent?.status === 'removed');

  const auditLog = path.join(home, 'audit.log');
  check('audit.log foi criado', fs.existsSync(auditLog));
  child.kill();
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
