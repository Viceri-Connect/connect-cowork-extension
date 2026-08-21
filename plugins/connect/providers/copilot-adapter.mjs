import http from 'node:http';

function postJson(url, body, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body || {});
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + (u.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = http.request(opts, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (c) => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch (e) { resolve(raw); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => { req.destroy(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

export async function iniciarSessaoViaBridge({ bridgeUrl = 'http://localhost:3000', args = {} } = {}) {
  const url = new URL('/iniciar_sessao', bridgeUrl).toString();
  return postJson(url, args);
}

export default { iniciarSessaoViaBridge };
