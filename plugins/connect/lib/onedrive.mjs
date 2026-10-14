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
import os from 'node:os';
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
      siteTitulo: it['site-titulo'] ? String(it['site-titulo']).trim() : null,
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
//
// Medido em 06/10 (sync real de uma pasta nao sincronizada, com `folderUrl`
// propositalmente errado): quem LOCALIZA a pasta e o `folderId`; a URL e so
// informativa. E o `webTitle` NOMEIA a pasta local (`{webTitle} - {folderName}`):
// derivado do slug do site, o Marketing nasceria `impulsa.connect - Marketing`.
// Por isso `site-titulo` existe — opcional, e capturado do catalogo.
// ---------------------------------------------------------------------------
export function montarLinkSync(o, { email = null } = {}) {
  const segs = o.pasta.split('/').filter(Boolean);
  const params = [
    ['siteId', `{${o.siteId}}`],
    ['webId', `{${o.webId}}`],
    ['webUrl', o.site],
    ['webTitle', o.siteTitulo || decodeURIComponent(o.site.split('/').pop() || '')],
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

// ---------------------------------------------------------------------------
// raizesCatalogo — onde o cliente OneDrive guarda `settings/`, por sistema.
//
// Windows: medido (06/10). macOS: NAO medido — candidatas do cliente fora da App
// Store (Application Support) e do cliente da App Store (sandbox em Containers),
// P175, 0.37.0. A leitura testa todas e devolve `diagnostico` dizendo o que achou
// em cada uma: e esse diagnostico que calibra a lista no primeiro Mac real.
// ---------------------------------------------------------------------------
export function raizesCatalogo({ plataforma = process.platform, localAppData = process.env.LOCALAPPDATA, home = os.homedir() } = {}) {
  if (plataforma === 'win32') {
    return localAppData ? [path.join(localAppData, 'Microsoft', 'OneDrive', 'settings')] : [];
  }
  if (plataforma === 'darwin') {
    return [
      path.join(home, 'Library', 'Application Support', 'OneDrive', 'settings'),
      path.join(home, 'Library', 'Containers', 'com.microsoft.OneDrive-mac', 'Data', 'Library', 'Application Support', 'OneDrive', 'settings'),
      path.join(home, 'Library', 'Group Containers', 'UBF8T346G9.OneDriveStandaloneSuite', 'Library', 'Application Support', 'OneDrive', 'settings'),
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// traduzirMountPoint — o `mountPoint` do catalogo do Mac nao e caminho de disco.
//
// Medido em 14/10 no primeiro Mac real (P175, retorno do Advisor): o cliente grava
// `$Group.Container$/...` — um TOKEN. Hipotese (nao documentada pela Microsoft):
// e o Group Container do OneDrive
// (`~/Library/Group Containers/UBF8T346G9.OneDriveSyncClientSuite`). Sob ele fica o
// `OneDrive.noindex/`, que e o STORE PRIVADO do cliente (File Provider): a arvore
// que o operador ve e edita e o espelho em `~/Library/CloudStorage/OneDrive-*`.
// Fonte do layout dos dois lugares: investigacao publica do cliente File Provider
// (gist lijunle/onedrive-cache-report, macOS 26 / OneDrive 26.x), conferida contra
// o caminho real que o Advisor viu no Finder.
//
// Regras (e o porque):
//   - NUNCA devolver caminho dentro de `OneDrive.noindex`: e o store do cliente,
//     ler ali da placeholder e escrever ali corrompe o sync.
//   - O trecho DEPOIS da raiz do store e lido do catalogo e reaproveitado inteiro;
//     so a RAIZ e traduzida, para uma montagem de `CloudStorage` que EXISTA com
//     aquele trecho dentro. Nao e deducao por nome: o nome so desempata quando
//     duas montagens tem o mesmo trecho.
//   - Nao traduziu = `caminho: null` + `motivo`. Quem chama declara, nunca adivinha.
// Injecao (`existe`, `listar`) e para o teste rodar em qualquer SO.
// ---------------------------------------------------------------------------
export const GRUPOS_ONEDRIVE_MAC = ['UBF8T346G9.OneDriveSyncClientSuite', 'UBF8T346G9.OneDriveStandaloneSuite'];
const RE_TOKEN = /^\$([^$]+)\$(?:[\\/]+(.*))?$/;
const chaveNome = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

function listarSeguro(dir) {
  try { return fs.readdirSync(dir); } catch { return []; }
}

export function traduzirMountPoint(bruto, { home = os.homedir(), existe = fs.existsSync, listar = listarSeguro } = {}) {
  if (!bruto) return { caminho: null, via: 'vazio' };
  const m = String(bruto).match(RE_TOKEN);
  if (!m) return { caminho: bruto, via: 'literal' };
  const token = m[1];
  if (token.toLowerCase() !== 'group.container') {
    return { caminho: null, via: 'token-desconhecido', motivo: `token "$${token}$" sem traducao conhecida` };
  }
  const segs = String(m[2] || '').split(/[\\/]+/).filter(Boolean);
  const iStore = segs.findIndex((s) => s.toLowerCase() === 'onedrive.noindex');

  if (iStore >= 0) {
    if (segs.length <= iStore + 1) return { caminho: null, via: 'nao-traduzido', motivo: 'o catalogo aponta a raiz do store privado, sem montagem' };
    const raiz = segs[iStore + 1];
    const rel = segs.slice(iStore + 2);
    const cs = path.join(home, 'Library', 'CloudStorage');
    const montagens = listar(cs).filter((n) => /^OneDrive/i.test(n));
    let cands = montagens.filter((n) => existe(path.join(cs, n, ...rel)));
    if (cands.length > 1) {
      // Desempate pelo nome da raiz do store ("OneDrive - Viceri Seidor" ~ "OneDrive-ViceriSeidor").
      const k = chaveNome(raiz);
      const kSem = k.replace(/^onedrive/, '');
      const exatos = cands.filter((n) => chaveNome(n) === k);
      const contem = kSem ? cands.filter((n) => chaveNome(n).endsWith(kSem)) : [];
      cands = exatos.length ? exatos : (contem.length ? contem : cands);
    }
    if (cands.length === 1) return { caminho: path.join(cs, cands[0], ...rel), via: 'cloudstorage', raizStore: raiz };
    if (!montagens.length) return { caminho: null, via: 'nao-traduzido', raizStore: raiz, motivo: 'nenhuma montagem OneDrive-* em ~/Library/CloudStorage' };
    if (!cands.length) return { caminho: null, via: 'nao-traduzido', raizStore: raiz, motivo: `nenhuma montagem de CloudStorage contem "${rel.join('/')}" (montagens: ${montagens.join(', ')})` };
    return { caminho: null, via: 'ambiguo', raizStore: raiz, motivo: `mais de uma montagem contem o trecho: ${cands.join(', ')}` };
  }

  // Fora do store: o token e so a raiz do Group Container. Aceita se existir.
  for (const g of GRUPOS_ONEDRIVE_MAC) {
    const p = path.join(home, 'Library', 'Group Containers', g, ...segs);
    if (existe(p)) return { caminho: p, via: 'group-container' };
  }
  return { caminho: null, via: 'nao-traduzido', motivo: 'o caminho expandido nao existe em nenhum Group Container conhecido' };
}

// Para o diagnostico devolvido ao time: o home vira `~` (o operador repassa sem expor usuario).
const abreviarHome = (p, home) => (p && home ? String(p).split(home).join('~') : p);

// lerCatalogoOneDrive — todas as contas Business desta maquina. Nunca lanca.
// `raizes` explicito vence; sem ele, as do sistema (`raizesCatalogo`). O parametro
// `localAppData` segue valendo para o Windows (e o que os testes usam).
// `mountPoint` sai sempre TRADUZIDO (caminho de disco ou null); o bruto fica em
// `mountPointBruto` quando difere, e a traducao vai para o `diagnostico`.
export function lerCatalogoOneDrive({ localAppData = null, raizes = null, plataforma = process.platform, home = os.homedir(), existe = fs.existsSync, listar = listarSeguro } = {}) {
  const candidatas = raizes
    || (localAppData ? raizesCatalogo({ plataforma: 'win32', localAppData }) : raizesCatalogo({ plataforma, home }));
  const out = { status: 'ok', entradas: [], avisos: [], diagnostico: { plataforma, raizes: [] } };
  if (plataforma === 'darwin') {
    // So nomes de pasta, nunca conteudo: e o que calibra a traducao sem terminal.
    out.diagnostico.cloudStorage = listar(path.join(home, 'Library', 'CloudStorage')).filter((n) => /^OneDrive/i.test(n));
    out.diagnostico.groupContainers = listar(path.join(home, 'Library', 'Group Containers')).filter((n) => /onedrive/i.test(n));
  }
  const existentes = candidatas.filter((r) => {
    const existe = fs.existsSync(r);
    out.diagnostico.raizes.push({ raiz: r, existe });
    return existe;
  });
  if (!existentes.length) {
    const onde = candidatas.length ? `procurado em: ${candidatas.join(' | ')}` : `sem local conhecido para a plataforma "${plataforma}"`;
    return { ...out, status: 'indisponivel', avisos: [`catalogo do OneDrive nao encontrado nesta maquina (${onde})`] };
  }
  for (const base of existentes) {
    const diag = out.diagnostico.raizes.find((d) => d.raiz === base);
    let contas = [];
    try { contas = fs.readdirSync(base).filter((n) => /^Business\d+$/i.test(n)); } catch { /* segue vazio */ }
    diag.contas = [];
    for (const conta of contas) {
      const dir = path.join(base, conta);
      let todos = [];
      try { todos = fs.readdirSync(dir); } catch { continue; }
      const arquivos = todos.filter((n) => /^[0-9a-f-]{36}\.ini$/i.test(n));
      // So nomes de .ini (nunca conteudo): e o que diz se o formato do nome mudou.
      diag.contas.push({ conta, ini: todos.filter((n) => /\.ini$/i.test(n)).length, casados: arquivos.length });
      for (const a of arquivos) {
        try {
          const entradas = parseCatalogoIni(decodificarIni(fs.readFileSync(path.join(dir, a))));
          out.entradas.push(...entradas.map((e) => ({ ...e, conta })));
        } catch (e) {
          out.avisos.push(`catalogo ${conta}/${a} ilegivel: ${e.message}`);
        }
      }
    }
  }
  // Traducao do mountPoint (no-op no Windows: caminho literal passa direto).
  const traducoes = [];
  for (const e of out.entradas) {
    if (!e.mountPoint) continue;
    const t = traduzirMountPoint(e.mountPoint, { home, existe, listar });
    if (t.via === 'literal') continue;
    e.mountPointBruto = e.mountPoint;
    e.mountPoint = t.caminho;
    if (!t.caminho) e.mountPointMotivo = t.motivo;
    traducoes.push({ pasta: e.nome, bruto: abreviarHome(e.mountPointBruto, home), caminho: abreviarHome(t.caminho, home), via: t.via, ...(t.motivo ? { motivo: abreviarHome(t.motivo, home) } : {}) });
  }
  if (traducoes.length) {
    out.diagnostico.traducoes = traducoes.slice(0, 30);
    const falhas = traducoes.filter((t) => !t.caminho).length;
    if (falhas) out.avisos.push(`${falhas} de ${traducoes.length} caminho(s) do catalogo nao foram traduzidos para pasta de disco — ver \`diagnostico.traducoes\``);
  }
  if (!out.entradas.length) {
    out.status = 'vazio';
    out.avisos.push('o catalogo do OneDrive foi lido e nao lista nenhuma biblioteca sincronizada (o formato pode ter mudado) — ver `diagnostico`');
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
  if (porPasta) return { via: 'pasta', caminho: porPasta.mountPoint || null, entrada: porPasta };
  // `mountPointBruto` presente = biblioteca sincronizada cujo caminho nao traduziu:
  // continua sendo "achada" (o operador sincronizou), so sem caminho de disco.
  const porLista = entradas.find((e) => e.tipo === 'biblioteca' && e.listaId === o.listaId && (e.mountPoint || e.mountPointBruto));
  if (porLista) {
    const resto = o.pasta.split('/').filter(Boolean).slice(1);
    return { via: 'biblioteca', caminho: porLista.mountPoint ? path.join(porLista.mountPoint, ...resto) : null, entrada: porLista };
  }
  return null;
}

// ---------------------------------------------------------------------------
// capturarOrigem — o caminho inverso, a partir de um caminho LOCAL ja conhecido
// (ADR-23, emenda de 06/10). Quem chama ja sabe onde o acervo mora nesta maquina;
// aqui so se le, no catalogo, de onde na nuvem aquela pasta vem.
//
//   exata: true  — o caminho E uma pasta sincronizada: a `origem` e completa.
//   exata: false — o caminho fica DENTRO de uma pasta sincronizada maior; a
//                  `origem` descreve a raiz de sync, e quem curar decide se serve
//                  (sincronizaria tambem o que esta ao lado).
//   null         — o caminho nao esta no catalogo (nao e OneDrive, ou e a
//                  biblioteca inteira, que o schema de pasta nao descreve).
//
// `pasta` sai so com o nome: o catalogo nao guarda o caminho dentro da biblioteca,
// e o `pasta-id` e quem localiza (medido em 06/10).
// ---------------------------------------------------------------------------
const normCaminho = (p) => path.resolve(String(p || '')).replace(/[\\/]+$/, '').toLowerCase();

export function capturarOrigem(entradas, caminhoLocal) {
  if (!caminhoLocal) return null;
  const alvo = normCaminho(caminhoLocal);
  const pastas = (entradas || []).filter((e) => e.tipo === 'pasta' && e.mountPoint && e.pastaId && e.siteId && e.webId && e.listaId);
  const montar = (e) => ({
    provedor: 'sharepoint',
    site: e.webUrl,
    'site-titulo': e.webTitle || undefined,
    pasta: e.nome,
    'site-id': e.siteId,
    'web-id': e.webId,
    'lista-id': e.listaId,
    'pasta-id': e.pastaId,
  });
  const exata = pastas.find((e) => normCaminho(e.mountPoint) === alvo);
  if (exata) return { exata: true, origem: montar(exata), yaml: origemEmYaml(montar(exata)) };
  const acima = pastas
    .filter((e) => alvo.startsWith(normCaminho(e.mountPoint) + path.sep))
    .sort((a, b) => b.mountPoint.length - a.mountPoint.length)[0];
  if (acima) {
    const sub = path.relative(acima.mountPoint, caminhoLocal);
    return { exata: false, subcaminho: sub, origem: montar(acima), yaml: origemEmYaml(montar(acima)) };
  }
  return null;
}

// O bloco pronto para colar no frontmatter (lista de objetos, como o parser le).
export function origemEmYaml(o) {
  const linhas = ['origem:'];
  const chaves = ['provedor', 'site', 'site-titulo', 'pasta', 'site-id', 'web-id', 'lista-id', 'pasta-id'];
  chaves.filter((k) => o[k]).forEach((k, i) => linhas.push(`${i === 0 ? '  - ' : '    '}${k}: ${o[k]}`));
  return linhas.join('\n');
}

// ---------------------------------------------------------------------------
// Efeitos no host. Isolados para o teste poder substitui-los.
// Windows: medido. macOS (P175, 0.37.0): NAO medido — cada efeito degrada
// declarado (status + motivo), nunca em silencio.
// ---------------------------------------------------------------------------
export const PLATAFORMAS_SYNC = ['win32', 'darwin'];
const IS_MAC = process.platform === 'darwin';

export const host = {
  plataforma: process.platform,
  // Windows: rundll32 + FileProtocolHandler abre o protocolo sem passar pelo parser
  // do cmd, que trataria os `&` da query como separador de comando.
  // macOS: `open` recebe a URL como um argumento so (sem shell).
  abrirLink(link) {
    const p = IS_MAC
      ? spawn('/usr/bin/open', [link], { detached: true, stdio: 'ignore' })
      : spawn('rundll32.exe', ['url.dll,FileProtocolHandler', link], { detached: true, stdio: 'ignore', windowsHide: true });
    p.unref();
  },
  // "Manter sempre neste dispositivo" = atributo Pinned (+P) e nao Unpinned (-U).
  // macOS: NAO EXISTE caminho programatico. O OneDrive nao usa o pin padrao do File
  // Provider (`contentPolicy`, que e somente-leitura para terceiros); implementa o
  // seu por acao propria de Finder, e ignora o xattr `com.apple.fileprovider.pinned`
  // (investigacao publica citada em `traduzirMountPoint`). Por isso devolve
  // `nao-suportado` com a instrucao que o agente REPASSA ao operador.
  // `arvoreEmSegundoPlano`: a passada recursiva roda destacada (matriz no inicio de
  // sessao nao pode segurar o hook); o status diz que ela foi disparada, nao concluida.
  fixar(dir, { arvoreEmSegundoPlano = false } = {}) {
    if (IS_MAC) return { status: 'nao-suportado', motivo: 'macOS: o OneDrive nao oferece fixacao programatica', instrucao: instrucaoFixarMac(dir) };
    const raiz = spawnSync('attrib', ['+P', '-U', dir], { windowsHide: true, encoding: 'utf8' });
    if (raiz.status !== 0 || raiz.error) {
      return { status: 'erro', motivo: String(raiz.error?.message || raiz.stderr || raiz.stdout || 'attrib falhou').trim() };
    }
    const args = ['+P', '-U', '/S', '/D', path.join(dir, '*')];
    if (arvoreEmSegundoPlano) {
      try {
        const p = spawn('attrib', args, { detached: true, stdio: 'ignore', windowsHide: true });
        p.on('error', () => {});
        p.unref();
        return { status: 'fixado', arvore: 'em-segundo-plano' };
      } catch (e) {
        return { status: 'erro', motivo: `raiz fixada, arvore nao: ${e.message}` };
      }
    }
    const arvore = spawnSync('attrib', args, { windowsHide: true, encoding: 'utf8' });
    return arvore.status !== 0 || arvore.error
      ? { status: 'erro', motivo: String(arvore.error?.message || arvore.stderr || arvore.stdout || 'attrib falhou').trim() }
      : { status: 'fixado' };
  },
  // Estado de retencao da pasta, sem efeito colateral. Nunca lanca.
  //   win32: atributo P na raiz -> `fixado` | `nao-fixado`.
  //   darwin: so da para saber se esta BAIXADO (o pin do OneDrive nao deixa marca
  //     consultavel): arquivo-amostra com `blocks === 0` e tamanho > 0 e placeholder
  //     (SF_DATALESS) -> `so-nuvem`; com blocos -> `baixado` (fixado ou em cache).
  retencao(dir, { amostras = [] } = {}) {
    try {
      if (IS_MAC) {
        const arqs = amostras.map((a) => path.join(dir, a)).filter((p) => fs.existsSync(p));
        if (!arqs.length) return { estado: 'desconhecido', motivo: 'nenhum arquivo-amostra encontrado' };
        const placeholders = arqs.filter((p) => { const s = fs.statSync(p); return s.size > 0 && s.blocks === 0; });
        return placeholders.length ? { estado: 'so-nuvem', amostras: arqs.length, placeholders: placeholders.length } : { estado: 'baixado', amostras: arqs.length };
      }
      if (process.platform !== 'win32') return { estado: 'desconhecido', motivo: `plataforma ${process.platform}` };
      const r = spawnSync('attrib', [dir], { windowsHide: true, encoding: 'utf8' });
      if (r.status !== 0 || !r.stdout) return { estado: 'desconhecido', motivo: 'attrib nao respondeu' };
      return { estado: parseAtributoPinned(r.stdout, dir) ? 'fixado' : 'nao-fixado' };
    } catch (e) {
      return { estado: 'desconhecido', motivo: e.message };
    }
  },
  esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
  lerCatalogo: () => lerCatalogoOneDrive(),
  // E-mail das contas OneDrive Business logadas. OBRIGATORIO no link: sem
  // `userEmail` o cliente IGNORA o odopen em silencio — nem janela, nem erro
  // (medido em 06/10: tres disparos sem e-mail, nada; o mesmo link com e-mail
  // abriu a pasta). Lista vazia = OneDrive nao logado.
  emailsDasContas() {
    if (IS_MAC) return emailsDasContasMac();
    const r = spawnSync('reg', ['query', 'HKCU\\Software\\Microsoft\\OneDrive\\Accounts', '/s', '/v', 'UserEmail'], { windowsHide: true, encoding: 'utf8' });
    if (r.status !== 0 || !r.stdout) return [];
    return parseEmailsReg(r.stdout);
  },
};

// Instrucao que o agente repassa ao operador leigo, com o nome da pasta que ele ve.
export function instrucaoFixarMac(dir) {
  const nome = dir ? path.basename(dir) : 'a pasta';
  return `No Finder, abra a barra lateral em "Locais" > OneDrive, clique com o botao direito em "${nome}" e escolha "Manter sempre neste dispositivo" (Always Keep on This Device). O icone de nuvem vira um visto verde quando terminar.`;
}

// Saida do `attrib <dir>` -> a raiz tem o atributo P (Pinned)?
// Formato: colunas de letras de atributo, depois o caminho.
export function parseAtributoPinned(saida, dir) {
  const linhas = String(saida || '').split(/\r?\n/).filter((l) => l.trim());
  const alvo = String(dir || '').toLowerCase().replace(/[\\/]+$/, '');
  const linha = linhas.find((l) => l.toLowerCase().includes(alvo)) || linhas[0] || '';
  const i = alvo ? linha.toLowerCase().indexOf(alvo) : -1;
  const prefixo = i > 0 ? linha.slice(0, i) : linha.replace(/[a-z]:\\.*$/i, '');
  return /(^|\s)P(\s|$)/.test(prefixo);
}

// macOS: as preferencias do cliente (dominio varia entre o cliente da App Store e o
// avulso) guardam um dicionario por conta (`Business1 = { ... UserEmail = ...; }`).
// NAO medido — a lista de dominios e o formato sao hipotese ate o primeiro Mac real.
export const DOMINIOS_PREFS_MAC = ['com.microsoft.OneDrive-mac', 'com.microsoft.OneDrive', 'UBF8T346G9.OneDriveStandaloneSuite'];

function emailsDasContasMac() {
  for (const dominio of DOMINIOS_PREFS_MAC) {
    const r = spawnSync('/usr/bin/defaults', ['read', dominio], { encoding: 'utf8' });
    if (r.status !== 0 || !r.stdout) continue;
    const achados = parseEmailsDefaults(r.stdout);
    if (achados.length) return achados;
  }
  return [];
}

// Saida do `defaults read` (formato plist "old-style") -> e-mails das contas
// Business{N}. Personal fica fora, como no Windows.
export function parseEmailsDefaults(saida) {
  const out = [];
  let conta = null;
  let nivel = 0;
  for (const linha of String(saida || '').split(/\r?\n/)) {
    const k = linha.match(/^\s*"?([A-Za-z]+\d*)"?\s*=\s*\{\s*$/);
    if (k) {
      nivel += 1;
      if (/^Business\d+$/i.test(k[1])) conta = { nome: k[1], nivel };
      continue;
    }
    if (/^\s*\};?\s*$/.test(linha)) {
      if (conta && conta.nivel === nivel) conta = null;
      nivel = Math.max(0, nivel - 1);
      continue;
    }
    const v = linha.match(/^\s*"?UserEmail"?\s*=\s*"?([^";\s]+@[^";\s]+)"?\s*;\s*$/i);
    if (v && conta) out.push({ conta: conta.nome, email: v[1] });
  }
  return out;
}

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
