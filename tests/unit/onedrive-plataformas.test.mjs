// Matriz de plataformas do OneDrive: o MESMO codigo exercitado como Windows, macOS e Linux,
// em qualquer SO onde o teste rode. Tudo o que depende de plataforma no Connect e injetavel
// (`plataforma`, `localAppData`, `home`, `host`), entao a simulacao nao exige o SO real —
// exige fixture fiel ao que cada cliente grava em disco.
//
// O que isto NAO prova: que o cliente OneDrive real do Mac grava o que a fixture grava
// (parte do formato do Mac ainda e hipotese, P175). Prova que, dado esse formato, o
// Connect le, traduz e degrada como declarado.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  raizesCatalogo, lerCatalogoOneDrive, PLATAFORMAS_SYNC,
} from '../../plugins/connect/lib/onedrive.mjs';
import { sincronizarSubvault } from '../../plugins/connect/lib/sincronizar.mjs';
import { garantirRetencaoMatriz } from '../../plugins/connect/lib/session.mjs';

const G = {
  site: '11111111-1111-4111-8111-111111111111',
  web: '22222222-2222-4222-8222-222222222222',
  lista: '33333333-3333-4333-8333-333333333333',
  mkt: '44444444-4444-4444-8444-444444444444',
  conta: '77777777-7777-4777-8777-777777777777',
};
const hex = (g) => g.replace(/-/g, '');
const SITE = 'https://contoso.sharepoint.com/teams/acervo';

let base;
beforeAll(() => { base = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-plataformas-')); });
afterAll(() => { fs.rmSync(base, { recursive: true, force: true }); });

const iniTexto = (mountPoint) => [
  'library = 1',
  `libraryScope = 4 ${hex(G.conta)}+4 5 "Acervo" "Documentos" 4 "${SITE}" "tenant" ${hex(G.site)} ${hex(G.web)} ${hex(G.lista)} 0 "" 1 x`,
  `libraryFolder = 3 4 ${hex(G.mkt)}+4 1786985745 "${mountPoint}" 1 "Marketing" ${G.conta} 1 2 x`,
].join('\n');

// Windows grava o .ini em UTF-16LE com BOM; o macOS grava UTF-8 sem BOM.
const utf16leBom = (s) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(s, 'utf16le')]);

function escreverCatalogo(raiz, conteudo) {
  const dir = path.join(raiz, 'Business1');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${G.conta}.ini`), conteudo);
  fs.writeFileSync(path.join(dir, 'global.ini'), 'x');
}

describe('quais plataformas o sync automatico atende', () => {
  it('so Windows e macOS — Linux nao tem cliente OneDrive oficial', () => {
    expect(PLATAFORMAS_SYNC).toEqual(['win32', 'darwin']);
  });
});

describe('raizesCatalogo', () => {
  it('win32: a raiz medida, sob LOCALAPPDATA', () => {
    const r = raizesCatalogo({ plataforma: 'win32', localAppData: path.join(base, 'AppData', 'Local') });
    expect(r).toEqual([path.join(base, 'AppData', 'Local', 'Microsoft', 'OneDrive', 'settings')]);
  });

  it('win32 sem LOCALAPPDATA: nenhuma raiz, sem lancar', () => {
    expect(raizesCatalogo({ plataforma: 'win32', localAppData: '' })).toEqual([]);
  });

  it('darwin: candidatas sob ~/Library (cliente padrao, App Store e Group Container)', () => {
    const r = raizesCatalogo({ plataforma: 'darwin', home: '/Users/op' });
    expect(r.length).toBeGreaterThanOrEqual(3);
    expect(r.every((x) => x.startsWith(path.join('/Users/op', 'Library')))).toBe(true);
  });

  it('linux: nenhuma raiz', () => {
    expect(raizesCatalogo({ plataforma: 'linux', home: '/home/op' })).toEqual([]);
  });
});

describe('lerCatalogoOneDrive por plataforma', () => {
  it('win32: le .ini UTF-16LE com BOM no LOCALAPPDATA', () => {
    const localAppData = path.join(base, 'win', 'AppData', 'Local');
    const mount = path.join(base, 'win', 'OneDrive - Contoso', 'Acervo - Marketing');
    escreverCatalogo(path.join(localAppData, 'Microsoft', 'OneDrive', 'settings'), utf16leBom(iniTexto(mount)));

    const r = lerCatalogoOneDrive({ plataforma: 'win32', localAppData });
    expect(r.status).toBe('ok');
    const e = r.entradas.find((x) => x.pastaId === G.mkt);
    expect(e?.mountPoint).toBe(mount);
    expect(e?.conta).toBe('Business1');
  });

  it('darwin: le .ini UTF-8 na raiz do Mac e traduz o mountPoint para a pasta real', () => {
    const home = path.join(base, 'mac', 'home');
    const cloud = path.join(home, 'Library', 'CloudStorage', 'OneDrive-SharedLibraries-Contoso', 'Acervo - Marketing');
    fs.mkdirSync(cloud, { recursive: true });
    escreverCatalogo(
      path.join(home, 'Library', 'Application Support', 'OneDrive', 'settings'),
      iniTexto(cloud),
    );

    const r = lerCatalogoOneDrive({ plataforma: 'darwin', home });
    expect(r.status).toBe('ok');
    expect(r.entradas.find((x) => x.pastaId === G.mkt)?.mountPoint).toBe(cloud);
    expect(r.diagnostico.plataforma).toBe('darwin');
    expect(r.diagnostico.cloudStorage).toContain('OneDrive-SharedLibraries-Contoso');
  });

  it('linux: indisponivel, dizendo que nao ha local conhecido (nunca lanca)', () => {
    const r = lerCatalogoOneDrive({ plataforma: 'linux', home: path.join(base, 'linux', 'home') });
    expect(r.status).toBe('indisponivel');
    expect(r.entradas).toEqual([]);
    expect(r.avisos[0]).toContain('plataforma "linux"');
  });
});

// --- sincronizar_subvault com host simulado --------------------------------------------

function montarMatriz() {
  const matriz = path.join(base, 'sync', 'matriz');
  const home = path.join(base, 'sync', 'home');
  fs.mkdirSync(path.join(matriz, 'organizacao'), { recursive: true });
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(path.join(matriz, 'organizacao', 'marketing.md'), [
    '---',
    'tipo: area', 'papel: marketing', 'governanca: lider', 'externo: true',
    'criado-por: op', 'criado-em: 2026-10-13', 'classe: vault',
    'origem:',
    '  - provedor: sharepoint', `    site: ${SITE}`, '    pasta: Documentos/marketing',
    `    site-id: ${G.site}`, `    web-id: ${G.web}`, `    lista-id: ${G.lista}`, `    pasta-id: ${G.mkt}`,
    '---', '# marketing', '',
  ].join('\n'));
  return { home, vaultMatriz: matriz };
}

function hostFalso(plataforma, entradas) {
  const h = { plataforma, links: [] };
  h.emailsDasContas = () => [];
  h.abrirLink = (l) => h.links.push(l);
  h.fixar = () => (plataforma === 'darwin' ? { status: 'nao-suportado', motivo: 'macOS: manual' } : { status: 'fixado' });
  h.esperar = async () => {};
  h.lerCatalogo = () => ({ status: 'ok', entradas });
  return h;
}

describe('sincronizarSubvault por plataforma', () => {
  it('linux: plataforma-nao-suportada, com o link para o operador abrir e o caminho manual', async () => {
    const cfg = montarMatriz();
    const h = hostFalso('linux', []);
    const s = await sincronizarSubvault({ conceito: 'marketing', host: h, aguardarSegundos: 0, ...cfg });
    expect(s.status).toBe('plataforma-nao-suportada');
    expect(s.link).toMatch(/^odopen:\/\//);
    expect(s.avisos.join(' ')).toContain('linux');
    expect(h.links).toEqual([]); // nunca tenta abrir link num host sem cliente
  });

  it.each(['win32', 'darwin'])('%s: pasta ja no catalogo e registrada sem abrir link', async (plataforma) => {
    const cfg = montarMatriz();
    // Entradas vindas do parser real (nao montadas a mao), a partir da fixture da plataforma.
    const raiz = path.join(base, 'sync', plataforma);
    const mount = path.join(raiz, 'OneDrive', 'Acervo - Marketing');
    fs.mkdirSync(mount, { recursive: true });
    const settings = path.join(raiz, 'settings');
    escreverCatalogo(settings, plataforma === 'win32' ? utf16leBom(iniTexto(mount)) : iniTexto(mount));
    const catalogo = lerCatalogoOneDrive({ raizes: [settings], plataforma, home: raiz });
    expect(catalogo.status).toBe('ok');

    const h = hostFalso(plataforma, catalogo.entradas);
    // aguardarSegundos: 0 — se a pasta nao casar no catalogo, o teste FALHA rapido em vez de
    // ficar esperando o cliente OneDrive (a espera de 90 s seria um loop sem fim aqui).
    const s = await sincronizarSubvault({ conceito: 'marketing', host: h, aguardarSegundos: 0, ...cfg });
    expect(['sincronizado', 'ja-sincronizado', 'registrado']).toContain(s.status);
    expect(h.links).toEqual([]);
  });
});
// --- retencao da matriz ------------------------------------------------------------------

describe('garantirRetencaoMatriz por plataforma', () => {
  const nuvem = () => ({ sincronizado: true });

  it('fora de nuvem: nada a fazer, em qualquer plataforma', () => {
    for (const p of ['win32', 'darwin', 'linux']) {
      const r = garantirRetencaoMatriz('/qualquer', { host: { plataforma: p }, detectar: () => ({ sincronizado: false }) });
      expect(r.status).toBe('fora-de-nuvem');
    }
  });

  it('linux: nao-aplicavel', () => {
    const r = garantirRetencaoMatriz('/qualquer', { host: { plataforma: 'linux' }, detectar: nuvem });
    expect(r.status).toBe('nao-aplicavel');
  });

  it('win32: ja fixada fica em silencio; nao fixada fixa agora', () => {
    const fixada = garantirRetencaoMatriz('/m', { host: { plataforma: 'win32', retencao: () => ({ estado: 'fixado' }) }, detectar: nuvem });
    expect(fixada.status).toBe('fixado');
    const solta = garantirRetencaoMatriz('/m', {
      host: { plataforma: 'win32', retencao: () => ({ estado: 'nao-fixado' }), fixar: () => ({ status: 'fixado' }) },
      detectar: nuvem,
    });
    expect(solta.status).toBe('fixado-agora');
  });

  it('darwin: so nuvem devolve a instrucao para o operador, porque nao ha fixacao programatica', () => {
    const r = garantirRetencaoMatriz('/m', { host: { plataforma: 'darwin', retencao: () => ({ estado: 'so-nuvem' }) }, detectar: nuvem });
    expect(r.status).toBe('so-nuvem');
    expect(r.aviso).toMatch(/REPASSE/);
  });

  it('nunca lanca, mesmo se o host falhar', () => {
    const r = garantirRetencaoMatriz('/m', {
      host: { plataforma: 'win32', retencao: () => { throw new Error('attrib sumiu'); } },
      detectar: nuvem,
    });
    expect(r.status).toBe('erro');
  });
});