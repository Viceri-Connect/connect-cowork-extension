// connect/lib/onedrive.mjs
// Origem na nuvem -> pasta local, sem adivinhar (ADR-23).
//
// O que este modulo faz:
//   - valida o bloco `origem` do manifesto (contrato-manifesto §2.1);
//   - monta o link `odopen://sync/` — o mesmo que o botao "Sincronizar" do
//     SharePoint abre — e o dispara no host;
//   - le o CATALOGO do cliente OneDrive (o `.ini` de cada conta Business), que e
//     onde o cliente grava o que sincroniza e onde montou cada pasta;
//   - fixa a pasta no dispositivo ("Manter sempre neste dispositivo") quando a
//     classe e `vault`.
//
// O que este modulo NUNCA faz: deduzir caminho local a partir de nome. O caminho
// e LIDO no catalogo, casado por id da pasta (UniqueId). Foi a deducao que o corte
// de 17/08 removeu (`onedrive-rel`), e e ela que nao volta.
//
// Fonte do formato do catalogo: medido em 06/10/2026 na maquina do operador, e
// conferido contra a API do SharePoint (os quatro ids batem). O formato NAO e
// documentado pela Microsoft — quem le tem de degradar quando ele mudar, nunca
// lancar: catalogo ilegivel devolve lista vazia, e o fluxo volta a perguntar.
//
// Zero dependencias externas.

import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

export const PROVEDORES = ['sharepoint'];

const RE_GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RE_HEX32 = /^[0-9a-f]{32}$/i;

// `7d9ce4d941ed49bda9d05a0f48bf2d02` ou `{7D9C...}` -> `7d9ce4d9-41ed-49bd-a9d0-5a0f48bf2d02`
export function normalizarGuid(v) {
  const s = String(v || '').trim().replace(/^\{|\}$/g, '').replace(/\+\d+$/, '').toLowerCase();
  if (RE_GUID.test(s)) return s;
  if (RE_HEX32.test(s)) return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
  return null;
}

// ---------------------------------------------------------------------------
// lerOrigem — normaliza a lista crua do frontmatter e valida cada item.
// Devolve { itens: [...], erros: [...] }. Item invalido fica de fora de `itens`
// e entra em `erros` com o motivo (e o que o audit reporta, check 3a).
// ---------------------------------------------------------------------------
export function lerOrigem(bruto) {
  const lista = Array.isArray(bruto) ? bruto : (bruto && typeof bruto === 'object' ? [bruto] : []);
  const itens = [];
  const erros = [];
  lista.forEach((it, i) => {
    if (!it || typeof it !== 'object') { erros.push(`origem[${i}]: item nao e objeto`); return; }
    const problemas = validarItemOrigem(it);
    if (problemas.length) { erros.push(...problemas.map((p) => `origem[${i}]: ${p}`)); return; }
    itens.push({
      provedor: String(it.provedor).toLowerCase().trim(),
      site: String(it.site).trim().replace(/\/+$/, ''),
      pasta: String(it.pasta).trim().replace(/^\/+|\/+$/g, ''),
      siteId: normalizarGuid(it['site-id']),
      webId: normalizarGuid(it['web-id']),
      listaId: normalizarGuid(it['lista-id']),
      pastaId: normalizarGuid(it['pasta-id']),
    });
  });
  return { itens, erros };
}

export function validarItemOrigem(it) {
  const p = [];
  const prov = String(it.provedor || '').toLowerCase().trim();
  if (!prov) p.push('`provedor` ausente');
  else if (!PROVEDORES.includes(prov)) p.push(`provedor desconhecido "${it.provedor}" (conhecidos: ${PROVEDORES.join(', ')})`);
  if (!/^https:\/\//i.test(String(it.site || ''))) p.push('`site` tem de comecar com https://');
  const pasta = String(it.pasta || '');
  if (!pasta.trim()) p.push('`pasta` ausente');
  else if (/^[a-z]:/i.test(pasta) || pasta.includes('\\')) p.push('`pasta` parece caminho de disco — o manifesto nunca guarda caminho local (ADR-23)');
  for (const c of ['site-id', 'web-id', 'lista-id', 'pasta-id']) {
    if (!normalizarGuid(it[c])) p.push(`\`${c}\` ausente ou fora do formato GUID`);
  }
  return p;
}

// ---------------------------------------------------------------------------
// montarLinkSync — o `odopen://sync/` que o botao "Sincronizar" abre.
// Titulos sao so exibicao no dialogo do cliente: derivados, nunca declarados.
// ---------------------------------------------------------------------------
export function montarLinkSync(o, { email = null } = {}) {
  const segs = o.pasta.split('/').filter(Boolean);
  const params = [
    ['siteId', `{${o.siteId}}`],
    ['webId', `{${o.webId}}`],
    ['webUrl', o.site],
    ['webTitle', decodeURIComponent(o.site.split('/').pop() || '')],
    ['webTemplate', '64'],
    ['onPrem', '0'],
    ['libraryType', '4'],
    ['listId', `{${o.listaId}}`],
    ['listTitle', segs[0] || ''],
    ['folderId', o.pastaId],
    ['folderUrl', `${o.site}/${o.pasta}`],
    ['folderName', segs[segs.length - 1] || ''],
  ];
  if (email) params.unshift(['userEmail', email]);
  return 'odopen://sync/?' + params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

// ---------------------------------------------------------------------------
// Catalogo do cliente OneDrive.
//
// `%LOCALAPPDATA%\Microsoft\OneDrive\settings\Business{N}\{cid}.ini`, UTF-16LE.
// Duas linhas interessam:
//   libraryScope  = {idx} {scope}+{idx} 5 "{webTitle}" "{listTitle}" {tipo} "{webUrl}"
//                   "{tenant}" {siteId} {webId} {listId} {ts} "{mountPoint}" ...
//   libraryFolder = {idx} {scopeIdx} {pastaUniqueId}+{scopeIdx} {ts} "{mountPoint}" 1
//                   "{nomeDaPasta}" ...
// `mountPoint` vazio em libraryScope = a biblioteca nao esta sincronizada inteira
// (so pastas dela, que aparecem como libraryFolder).
// ---------------------------------------------------------------------------
export function tokenizar(linha) {
  const out = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m;
  while ((m = re.exec(linha)) !== null) out.push(m[1] !== undefined ? m[1] : m[2]);
  return out;
}

function decodificarIni(buf) {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.slice(2).toString('utf16le');
  // Sem BOM: UTF-16LE tem um byte nulo a cada dois em texto ASCII.
  let nulos = 0;
  for (let i = 1; i < Math.min(buf.length, 400); i += 2) if (buf[i] === 0) nulos += 1;
  return nulos > 50 ? buf.toString('utf16le') : buf.toString('utf8');
}

export function parseCatalogoIni(texto) {
  const escopos = new Map();
  const pastas = [];
  for (const bruta of String(texto || '').split(/\r?\n/)) {
    const m = bruta.match(/^\s*(libraryScope|libraryFolder)\s*=\s*(.*)$/);
    if (!m) continue;
    const t = tokenizar(m[2]);
    if (m[1] === 'libraryScope' && t.length >= 13) {
      escopos.set(t[0], {
        indice: t[0],
        webTitle: t[3],
        listTitle: t[4],
        webUrl: String(t[6] || '').replace(/\/+$/, ''),
        siteId: normalizarGuid(t[8]),
        webId: normalizarGuid(t[9]),
        listaId: normalizarGuid(t[10]),
        mountPoint: t[12] || null,
      });
    } else if (m[1] === 'libraryFolder' && t.length >= 7) {
      pastas.push({ escopo: t[1], pastaId: normalizarGuid(t[2]), mountPoint: t[4] || null, nome: t[6] });
    }
  }
  const entradas = [];
  for (const e of escopos.values()) {
    if (e.mountPoint) entradas.push({ tipo: 'biblioteca', ...e, pastaId: null, nome: e.listTitle });
  }
  for (const p of pastas) {
    const e = escopos.get(p.escopo) || {};
    entradas.push({
      tipo: 'pasta',
      webTitle: e.webTitle || null,
      webUrl: e.webUrl || null,
      siteId: e.siteId || null,
      webId: e.webId || null,
      listaId: e.listaId || null,
      pastaId: p.pastaId,
      nome: p.nome,
      mountPoint: p.mountPoint,
    });
  }
  return entradas;
}

// lerCatalogoOneDrive — todas as contas Business desta maquina. Nunca lanca.
export function lerCatalogoOneDrive({ localAppData = process.env.LOCALAPPDATA } = {}) {
  const base = localAppData ? path.join(localAppData, 'Microsoft', 'OneDrive', 'settings') : null;
  const out = { status: 'ok', entradas: [], avisos: [] };
  if (!base || !fs.existsSync(base)) {
    return { ...out, status: 'indisponivel', avisos: ['catalogo do OneDrive nao encontrado nesta maquina'] };
  }
  let contas = [];
  try { contas = fs.readdirSync(base).filter((n) => /^Business\d+$/i.test(n)); } catch { /* segue vazio */ }
  for (const conta of contas) {
    const dir = path.join(base, conta);
    let arquivos = [];
    try { arquivos = fs.readdirSync(dir).filter((n) => /^[0-9a-f-]{36}\.ini$/i.test(n)); } catch { continue; }
    for (const a of arquivos) {
      try {
        const entradas = parseCatalogoIni(decodificarIni(fs.readFileSync(path.join(dir, a))));
        out.entradas.push(...entradas.map((e) => ({ ...e, conta })));
      } catch (e) {
        out.avisos.push(`catalogo ${conta}/${a} ilegivel: ${e.message}`);
      }
    }
  }
  if (!out.entradas.length) {
    out.status = 'vazio';
    out.avisos.push('o catalogo do OneDrive foi lido e nao lista nenhuma biblioteca sincronizada (o formato pode ter mudado)');
  }
  return out;
}

// ---------------------------------------------------------------------------
// localizarNoCatalogo — onde esta `origem` nesta maquina? Casa por ID, nunca por nome.
//   1. a pasta sincronizada sozinha (pastaId);
//   2. a biblioteca inteira sincronizada (listaId) — a pasta mora dentro dela, no
//      trecho de `pasta` depois do nome da biblioteca. Isso e leitura do que o
//      cliente montou + o caminho que o proprio manifesto declara na nuvem, nao
//      deducao de nome local.
// ---------------------------------------------------------------------------
export function localizarNoCatalogo(entradas, o) {
  const porPasta = entradas.find((e) => e.tipo === 'pasta' && e.pastaId && e.pastaId === o.pastaId);
  if (porPasta) return { via: 'pasta', caminho: porPasta.mountPoint, entrada: porPasta };
  const porLista = entradas.find((e) => e.tipo === 'biblioteca' && e.listaId === o.listaId);
  if (porLista) {
    const resto = o.pasta.split('/').filter(Boolean).slice(1);
    return { via: 'biblioteca', caminho: path.join(porLista.mountPoint, ...resto), entrada: porLista };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Efeitos no host (so Windows). Isolados para o teste poder substitui-los.
// ---------------------------------------------------------------------------
export const host = {
  plataforma: process.platform,
  // rundll32 + FileProtocolHandler: abre o protocolo sem passar pelo parser do
  // cmd, que trataria os `&` da query como separador de comando.
  abrirLink(link) {
    const p = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', link], { detached: true, stdio: 'ignore', windowsHide: true });
    p.unref();
  },
  // "Manter sempre neste dispositivo" = atributo Pinned (+P) e nao Unpinned (-U).
  fixar(dir) {
    const raiz = spawnSync('attrib', ['+P', '-U', dir], { windowsHide: true, encoding: 'utf8' });
    const arvore = spawnSync('attrib', ['+P', '-U', '/S', '/D', path.join(dir, '*')], { windowsHide: true, encoding: 'utf8' });
    const erro = [raiz, arvore].find((r) => r.status !== 0 || r.error);
    return erro
      ? { status: 'erro', motivo: String(erro.error?.message || erro.stderr || erro.stdout || 'attrib falhou').trim() }
      : { status: 'fixado' };
  },
  esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
  lerCatalogo: () => lerCatalogoOneDrive(),
  // E-mail das contas OneDrive Business logadas. OBRIGATORIO no link: sem
  // `userEmail` o cliente IGNORA o odopen em silencio — nem janela, nem erro
  // (medido em 06/10: tres disparos sem e-mail, nada; o mesmo link com e-mail
  // abriu a pasta). Lista vazia = OneDrive nao logado.
  emailsDasContas() {
    const r = spawnSync('reg', ['query', 'HKCU\\Software\\Microsoft\\OneDrive\\Accounts', '/s', '/v', 'UserEmail'], { windowsHide: true, encoding: 'utf8' });
    if (r.status !== 0 || !r.stdout) return [];
    return parseEmailsReg(r.stdout);
  },
};

// Saida do `reg query /s /v UserEmail` -> e-mails das contas Business{N}, na ordem.
export function parseEmailsReg(saida) {
  const out = [];
  let conta = null;
  for (const linha of String(saida || '').split(/\r?\n/)) {
    const k = linha.match(/\\Accounts\\([^\\]+)\s*$/i);
    if (k) { conta = /^Business\d+$/i.test(k[1]) ? k[1] : null; continue; } // Personal fica fora
    const v = linha.match(/^\s*UserEmail\s+REG_SZ\s+(\S+@\S+)\s*$/i);
    if (v && conta) out.push({ conta, email: v[1] });
  }
  return out;
}
