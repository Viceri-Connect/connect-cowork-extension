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
import { raizesCatalogo, lerCatalogoOneDrive, parseEmailsDefaults, traduzirMountPoint, instrucaoFixarMac, parseAtributoPinned } from '../plugins/connect/lib/onedrive.mjs';
import { garantirRetencaoMatriz } from '../plugins/connect/lib/session.mjs';
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

// --- 6. token `$Group.Container$` (0.38.2, primeiro Mac real) ------------------------
// O catalogo do Mac grava `$Group.Container$/...`; a pasta que o operador ve mora em
// ~/Library/CloudStorage/OneDrive-*. Nunca devolver caminho dentro do store privado.
const hm = path.join(base, 'machome');
const csDir = path.join(hm, 'Library', 'CloudStorage');
const montShared = path.join(csDir, 'OneDrive-BibliotecasCompartilhadas-ViceriSeidor');
const montPessoal = path.join(csDir, 'OneDrive-ViceriSeidor');
fs.mkdirSync(path.join(montShared, 'Impulsa - Connect - Matriz', '_cerebro'), { recursive: true });
fs.mkdirSync(path.join(montShared, 'Acervo - Marketing'), { recursive: true });
fs.mkdirSync(montPessoal, { recursive: true });
const tok = (...s) => ['$Group.Container$', 'OneDrive.noindex', ...s].join('/');

let t = traduzirMountPoint(tok('Viceri Seidor', 'Impulsa - Connect - Matriz'), { home: hm });
ok(t.caminho === path.join(montShared, 'Impulsa - Connect - Matriz') && t.via === 'cloudstorage', 'token: traduz para a montagem de CloudStorage que contem o trecho');
ok(!String(t.caminho).includes('OneDrive.noindex'), 'token: nunca devolve caminho no store privado');
t = traduzirMountPoint(tok('Viceri Seidor', 'Nao Existe'), { home: hm });
ok(t.caminho === null && t.via === 'nao-traduzido' && /nao-existe|Nao Existe/i.test(t.motivo), 'token: trecho inexistente -> null com motivo, nunca adivinha');
t = traduzirMountPoint(tok('OneDrive - Viceri Seidor'), { home: hm });
ok(t.caminho === montPessoal, 'token na raiz da montagem: desempata pelo nome da raiz do store');
t = traduzirMountPoint('$Outro.Token$/x', { home: hm });
ok(t.caminho === null && t.via === 'token-desconhecido', 'token desconhecido: null declarado');
ok(traduzirMountPoint('C:\\x\\y', { home: hm }).via === 'literal', 'Windows/literal: passa direto');
// injecao: duas montagens com o mesmo trecho e nenhuma casa pelo nome -> ambiguo
t = traduzirMountPoint(tok('Outra Coisa', 'Docs'), { home: '/h', listar: () => ['OneDrive-A', 'OneDrive-B'], existe: () => true });
ok(t.caminho === null && t.via === 'ambiguo', 'duas montagens com o trecho e nome que nao desempata: ambiguo');

// leitura do catalogo com token: mountPoint traduzido, bruto preservado, diagnostico
const raizTok = path.join(hm, 'Library', 'Containers', 'com.microsoft.OneDrive-mac', 'Data', 'Library', 'Application Support', 'OneDrive', 'settings');
fs.mkdirSync(path.join(raizTok, 'Business1'), { recursive: true });
const PASTA_RUIM = '55555555-5555-4555-8555-555555555555';
fs.writeFileSync(path.join(raizTok, 'Business1', `${G.outra}.ini`), [
  `libraryScope = 4 ${hex(G.outra)}+4 5 "Acervo" "Documentos" 4 "${SITE}" "tenant" ${hex(G.site)} ${hex(G.web)} ${hex(G.lista)} 0 "" 1 x`,
  `libraryFolder = 3 4 ${hex(G.mkt)}+4 1786985745 "${tok('Viceri Seidor', 'Acervo - Marketing')}" 1 "Marketing" ${G.outra} 1 2 x`,
  `libraryFolder = 5 4 ${hex(PASTA_RUIM)}+4 1786985745 "${tok('Viceri Seidor', 'Sumiu')}" 1 "Sumiu" ${G.outra} 1 2 x`,
].join('\n'), 'utf8');
const catTok = lerCatalogoOneDrive({ plataforma: 'darwin', home: hm });
const eMkt = catTok.entradas.find((e) => e.pastaId === G.mkt);
ok(eMkt?.mountPoint === path.join(montShared, 'Acervo - Marketing') && eMkt.mountPointBruto.startsWith('$Group.Container$'), 'catalogo: mountPoint traduzido, bruto preservado');
const eRuim = catTok.entradas.find((e) => e.pastaId === PASTA_RUIM);
ok(eRuim?.mountPoint === null && eRuim.mountPointMotivo, 'catalogo: nao traduzido vira null + motivo');
ok(catTok.diagnostico.traducoes?.length === 2 && catTok.diagnostico.cloudStorage.includes('OneDrive-ViceriSeidor'), 'diagnostico: traducoes e montagens de CloudStorage (so nomes)');
ok(catTok.diagnostico.traducoes.every((x) => !String(x.bruto).includes(hm)), 'diagnostico: home abreviado');
ok(catTok.avisos.some((a) => /nao foram traduzidos/.test(a)), 'aviso de caminho nao traduzido');

// sincronizar: sincronizado mas sem caminho -> caminho-nao-traduzido + arquivo de diagnostico
const catSemCaminho = [{ tipo: 'pasta', pastaId: G.mkt, siteId: G.site, webId: G.web, listaId: G.lista, nome: 'Marketing', mountPoint: null, mountPointBruto: tok('X', 'Y'), mountPointMotivo: 'teste' }];
h = hostFalso({ plataforma: 'darwin', contas: [], catalogos: [catSemCaminho] });
s = await sincronizarSubvault({ conceito: 'marketing', host: h, ...cfg });
ok(s.status === 'caminho-nao-traduzido' && h.links.length === 0, 'sincronizar: ja sincronizado sem caminho nao re-dispara e declara');
ok(s.diagnosticoArquivo && fs.existsSync(s.diagnosticoArquivo) && s.avisos.some((a) => /enviar/.test(a)), 'sincronizar: grava diagnostico e pede o envio do arquivo');
ok(s.avisos.some((a) => /registrar_subvault_local/.test(a)), 'sincronizar: devolve o fluxo manual');
// fixacao no Mac: instrucao repassavel
h = hostFalso({ plataforma: 'darwin', contas: [], catalogos: [cat] });
h.fixar = () => ({ status: 'nao-suportado', motivo: 'm', instrucao: instrucaoFixarMac('/x/Acervo') });
s = await sincronizarSubvault({ conceito: 'marketing', host: h, ...cfg });
ok(s.avisos.some((a) => /REPASSE/.test(a) && /Manter sempre neste dispositivo/.test(a)), 'fixacao no Mac: aviso leva a instrucao para repassar');

// catalogo_sync: arquivo de diagnostico no Mac, entidade sincronizada sem caminho marcada
const cs2 = catalogoSync({ host: { plataforma: 'darwin', lerCatalogo: () => ({ status: 'ok', entradas: catSemCaminho, avisos: [], diagnostico: { plataforma: 'darwin' } }) }, ...cfg });
ok(cs2.diagnosticoArquivo && fs.existsSync(cs2.diagnosticoArquivo), 'catalogo_sync no Mac: grava o arquivo de diagnostico');
ok(cs2.entidades.find((e) => e.conceito === 'marketing')?.sincronizadoSemCaminho === true, 'catalogo_sync: entidade sincronizada sem caminho marcada');

// --- 7. retencao da matriz -----------------------------------------------------------
const naNuvem = () => ({ sincronizado: true });
const hr = (plataforma, estado, fixar = () => ({ status: 'fixado' })) => {
  const x = { plataforma, chamadas: [] };
  x.retencao = () => ({ estado });
  x.fixar = (d, o) => { x.chamadas.push(o); return fixar(); };
  return x;
};
let hx = hr('win32', 'nao-fixado');
let rm = garantirRetencaoMatriz('C:\\m', { host: hx, detectar: naNuvem });
ok(rm.status === 'fixado-agora' && hx.chamadas[0]?.arvoreEmSegundoPlano === true && rm.aviso, 'Windows: matriz nao fixada e fixada, arvore em segundo plano');
hx = hr('win32', 'fixado');
rm = garantirRetencaoMatriz('C:\\m', { host: hx, detectar: naNuvem });
ok(rm.status === 'fixado' && !rm.aviso && hx.chamadas.length === 0, 'Windows: ja fixada, silencio e nenhum attrib de escrita');
hx = hr('win32', 'nao-fixado', () => ({ status: 'erro', motivo: 'negado' }));
rm = garantirRetencaoMatriz('C:\\m', { host: hx, detectar: naNuvem });
ok(rm.status === 'erro' && /REPASSE/.test(rm.aviso), 'Windows: falha de fixar vira instrucao manual');
rm = garantirRetencaoMatriz('/m', { host: hr('darwin', 'so-nuvem'), detectar: naNuvem });
ok(rm.status === 'so-nuvem' && /REPASSE/.test(rm.aviso) && /Finder/.test(rm.aviso), 'macOS: so na nuvem pede ao operador, pelo Finder');
rm = garantirRetencaoMatriz('/m', { host: hr('darwin', 'baixado'), detectar: naNuvem });
ok(!rm.aviso, 'macOS: baixada, silencio');
rm = garantirRetencaoMatriz('/m', { host: hr('win32', 'nao-fixado'), detectar: () => ({ sincronizado: false }) });
ok(rm.status === 'fora-de-nuvem', 'fora de nuvem: nada a fazer');
ok(parseAtributoPinned('A    P        C:\\Users\\op\\Matriz\r\n', 'C:\\Users\\op\\Matriz') === true, 'attrib: P na raiz detectado');
ok(parseAtributoPinned('A            C:\\Users\\op\\Matriz\r\n', 'C:\\Users\\op\\Matriz') === false, 'attrib: sem P');
ok(parseAtributoPinned('     U       C:\\Users\\op\\Pasta\r\n', 'C:\\Users\\op\\Pasta') === false, 'attrib: U (sob demanda) nao e P');

fs.rmSync(base, { recursive: true, force: true });
console.log(`spike-onedrive-macos: ${pass} ok, ${fail} falha(s)`);
process.exit(fail ? 1 : 0);
