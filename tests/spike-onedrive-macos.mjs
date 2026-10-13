#!/usr/bin/env node
// tests/spike-onedrive-macos.mjs
// P175 (0.37.0): o ramo macOS do sync (ADR-23) — host simulado como `darwin`.
//
//   node tests/spike-onedrive-macos.mjs
//
// O que este spike garante (o que ele NAO garante: o layout real do OneDrive no
// Mac — isso so a maquina do Advisor responde, e o `diagnostico` existe para isso):
//   1. raizes candidatas do catalogo no macOS ficam sob ~/Library, e o Windows segue
//      com a unica raiz medida (%LOCALAPPDATA%).
//   2. catalogo .ini em UTF-8 (sem BOM) e lido pelo mesmo parser; `diagnostico`
//      diz o que achou em cada raiz, sem conteudo.
//   3. darwin sincroniza: ja sincronizado registra; fixacao `nao-suportado` vira
//      aviso; sem e-mail localizado o link sai sem `userEmail` e declara.
//   4. Windows nao muda: sem conta continua `onedrive-sem-conta`; linux continua
//      `plataforma-nao-suportada`.
//   5. `defaults read` (plist old-style) -> e-mails so das contas Business.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { raizesCatalogo, lerCatalogoOneDrive, parseEmailsDefaults } from '../plugins/connect/lib/onedrive.mjs';
import { sincronizarSubvault, catalogoSync } from '../plugins/connect/lib/sincronizar.mjs';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error('  ✗', msg); } };

const G = {
  site: '11111111-1111-4111-8111-111111111111',
  web: '22222222-2222-4222-8222-222222222222',
  lista: '33333333-3333-4333-8333-333333333333',
  mkt: '44444444-4444-4444-8444-444444444444',
  outra: '77777777-7777-4777-8777-777777777777',
};
const hex = (g) => g.replace(/-/g, '');
const SITE = 'https://contoso.sharepoint.com/teams/acervo';

// --- 1. raizes ----------------------------------------------------------------
const rMac = raizesCatalogo({ plataforma: 'darwin', home: '/Users/op' });
ok(rMac.length >= 2 && rMac.every((r) => r.startsWith(path.join('/Users/op', 'Library'))), 'macOS: raizes candidatas sob ~/Library');
ok(rMac.some((r) => r.includes('com.microsoft.OneDrive-mac')), 'macOS: inclui o sandbox do cliente da App Store');
const rWin = raizesCatalogo({ plataforma: 'win32', localAppData: 'C:\\AppData\\Local' });
ok(rWin.length === 1 && rWin[0] === path.join('C:\\AppData\\Local', 'Microsoft', 'OneDrive', 'settings'), 'Windows: so a raiz medida, inalterada');
ok(raizesCatalogo({ plataforma: 'linux' }).length === 0, 'linux: nenhuma raiz');

// --- 2. leitura em UTF-8 + diagnostico -------------------------------------------
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-onedrive-mac-'));
const cloud = (n) => path.join(base, 'Library', 'CloudStorage', 'OneDrive-SharedLibraries-Contoso', n);
const iniTexto = [
  'library = 1',
  `libraryScope = 4 ${hex(G.outra)}+4 5 "Acervo" "Documentos" 4 "${SITE}" "tenant" ${hex(G.site)} ${hex(G.web)} ${hex(G.lista)} 0 "" 1 x`,
  `libraryFolder = 3 4 ${hex(G.mkt)}+4 1786985745 "${cloud('Acervo - Marketing')}" 1 "Marketing" ${G.outra} 1 2 x`,
].join('\n');
const raizBoa = path.join(base, 'Library', 'Containers', 'com.microsoft.OneDrive-mac', 'Data', 'Library', 'Application Support', 'OneDrive', 'settings');
fs.mkdirSync(path.join(raizBoa, 'Business1'), { recursive: true });
fs.writeFileSync(path.join(raizBoa, 'Business1', `${G.outra}.ini`), iniTexto, 'utf8');
fs.writeFileSync(path.join(raizBoa, 'Business1', 'global.ini'), 'x');
const raizAusente = path.join(base, 'nao-existe', 'settings');
const lido = lerCatalogoOneDrive({ raizes: [raizAusente, raizBoa], plataforma: 'darwin' });
ok(lido.status === 'ok' && lido.entradas.some((e) => e.pastaId === G.mkt && e.mountPoint === cloud('Acervo - Marketing')), 'le .ini UTF-8 sem BOM e acha a pasta por id');
ok(lido.diagnostico.plataforma === 'darwin' && lido.diagnostico.raizes.length === 2, 'diagnostico lista as raizes testadas');
const dBoa = lido.diagnostico.raizes.find((d) => d.raiz === raizBoa);
ok(dBoa.existe && dBoa.contas[0].conta === 'Business1' && dBoa.contas[0].ini === 2 && dBoa.contas[0].casados === 1, 'diagnostico: conta, quantos .ini e quantos casaram o padrao');
ok(lido.diagnostico.raizes.find((d) => d.raiz === raizAusente).existe === false, 'diagnostico: raiz ausente marcada');
const nenhum = lerCatalogoOneDrive({ raizes: [raizAusente], plataforma: 'darwin' });
ok(nenhum.status === 'indisponivel' && nenhum.avisos[0].includes(raizAusente), 'nada encontrado: indisponivel, dizendo onde procurou');

// --- 3/4. sincronizar com host darwin ----------------------------------------------
const matriz = path.join(base, 'matriz');
const home = path.join(base, 'home');
fs.mkdirSync(path.join(matriz, 'organizacao'), { recursive: true });
fs.mkdirSync(home, { recursive: true });
const manifesto = (nome, pastaId) => fs.writeFileSync(path.join(matriz, 'organizacao', `${nome}.md`),
`---
tipo: area
papel: ${nome}
governanca: lider-de-${nome}
externo: true
criado-por: op
criado-em: 2026-10-13
classe: vault
origem:
  - provedor: sharepoint
    site: ${SITE}
    pasta: Documentos/${nome}
    site-id: ${G.site}
    web-id: ${G.web}
    lista-id: ${G.lista}
    pasta-id: ${pastaId}
---
# ${nome}
`);
manifesto('marketing', G.mkt);
manifesto('vendas', G.outra);
fs.mkdirSync(cloud('Acervo - Marketing'), { recursive: true });

function hostFalso({ plataforma, contas, catalogos }) {
  const h = { plataforma, links: [], leituras: 0 };
  h.emailsDasContas = () => contas;
  h.abrirLink = (l) => h.links.push(l);
  h.fixar = () => (plataforma === 'darwin' ? { status: 'nao-suportado', motivo: 'macOS: manual' } : { status: 'fixado' });
  h.esperar = async () => {};
  h.lerCatalogo = () => { const c = catalogos[Math.min(h.leituras, catalogos.length - 1)]; h.leituras += 1; return { status: 'ok', entradas: c }; };
  return h;
}
const cfg = { home, vaultMatriz: matriz };
const cat = lido.entradas;

let h = hostFalso({ plataforma: 'darwin', contas: [], catalogos: [cat] });
let s = await sincronizarSubvault({ conceito: 'marketing', host: h, ...cfg });
ok(s.status === 'sincronizado' && s.caminho === cloud('Acervo - Marketing'), 'darwin: ja sincronizado registra o caminho do CloudStorage');
ok(s.avisos.some((a) => /nao foi fixada/.test(a)) && s.avisos.some((a) => /P175/.test(a)), 'darwin: fixacao nao-suportada e validacao em curso viram aviso');

h = hostFalso({ plataforma: 'darwin', contas: [], catalogos: [cat] });
s = await sincronizarSubvault({ conceito: 'vendas', host: h, aguardarSegundos: 0, ...cfg });
ok(h.links.length === 1 && !h.links[0].includes('userEmail'), 'darwin sem e-mail localizado: dispara o link sem userEmail');
ok(s.status === 'aguardando', 'darwin: pasta que nao aparece segue aguardando, nada registrado');

h = hostFalso({ plataforma: 'darwin', contas: [{ conta: 'Business1', email: 'op@contoso.com' }], catalogos: [cat] });
await sincronizarSubvault({ conceito: 'vendas', host: h, aguardarSegundos: 0, ...cfg });
ok(h.links[0]?.includes('userEmail=op%40contoso.com'), 'darwin com e-mail: link leva o userEmail');

h = hostFalso({ plataforma: 'win32', contas: [], catalogos: [cat] });
s = await sincronizarSubvault({ conceito: 'vendas', host: h, ...cfg });
ok(s.status === 'onedrive-sem-conta' && h.links.length === 0, 'Windows inalterado: sem conta bloqueia');

s = await sincronizarSubvault({ conceito: 'vendas', host: hostFalso({ plataforma: 'linux', contas: [], catalogos: [cat] }), ...cfg });
ok(s.status === 'plataforma-nao-suportada', 'linux inalterado: plataforma-nao-suportada');

const cs = catalogoSync({ host: { plataforma: 'darwin', lerCatalogo: () => nenhum }, ...cfg });
ok(cs.plataforma === 'darwin' && cs.diagnostico && cs.avisos.some((a) => /diagnostico/.test(a)), 'catalogo_sync no Mac sem catalogo: devolve diagnostico e pede o retorno');

// --- 5. defaults read --------------------------------------------------------------
const defaultsOut = `{
    Business1 =     {
        ConfiguredOnce = 1;
        UserEmail = "op@contoso.com";
        Nested =         {
            Foo = 1;
        };
    };
    Personal =     {
        UserEmail = "pessoal@live.com";
    };
    OutraChave = 1;
}`;
const em = parseEmailsDefaults(defaultsOut);
ok(em.length === 1 && em[0].conta === 'Business1' && em[0].email === 'op@contoso.com', 'defaults read: so contas Business, conta pessoal fora');
ok(parseEmailsDefaults('').length === 0, 'saida vazia: nenhuma conta');

fs.rmSync(base, { recursive: true, force: true });
console.log(`spike-onedrive-macos: ${pass} ok, ${fail} falha(s)`);
process.exit(fail ? 1 : 0);
