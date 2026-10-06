#!/usr/bin/env node
// tests/spike-onedrive.mjs
// Spike da ADR-23: origem na nuvem no manifesto -> sync -> caminho LIDO no catalogo.
//
//   node tests/spike-onedrive.mjs
//
// Premissas que este spike mata:
//   1. `origem` malformada nunca vira link: provedor desconhecido, GUID errado e
//      caminho de disco em `pasta` sao recusados com motivo.
//   2. O catalogo do OneDrive (UTF-16LE, campos com aspas) e lido, e a pasta e
//      casada por ID — dois `_Delivery Hub` com o mesmo nome nao se confundem.
//   3. Pasta ja sincronizada: so registra, NAO dispara link.
//   4. `classe: vault` e fixado no dispositivo; `diretorio` nao.
//   5. Pasta que nunca aparece no catalogo NUNCA e registrada (`aguardando`, com
//      a governanca de quem pedir acesso).
//   6. Sem `origem`: `sem-origem`, e o `resolver` segue mandando perguntar.
//   7. Fora do Windows: devolve o link, nao finge.
//   8. O `resolver` passa a apontar `sincronizar_subvault` quando ha origem.
//
// IDs FICTICIOS de proposito: este repositorio e publico, e os IDs reais da
// instancia moram so nos manifestos da matriz.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  lerOrigem, montarLinkSync, parseCatalogoIni, localizarNoCatalogo, normalizarGuid, tokenizar,
} from '../plugins/connect/lib/onedrive.mjs';
import { sincronizarSubvault, catalogoSync } from '../plugins/connect/lib/sincronizar.mjs';
import { resolver } from '../plugins/connect/lib/resolver.mjs';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error('  ✗', msg); } };

const G = {
  site: '11111111-1111-4111-8111-111111111111',
  web: '22222222-2222-4222-8222-222222222222',
  lista: '33333333-3333-4333-8333-333333333333',
  mkt: '44444444-4444-4444-8444-444444444444',
  hubA: '55555555-5555-4555-8555-555555555555',
  hubB: '66666666-6666-4666-8666-666666666666',
  outra: '77777777-7777-4777-8777-777777777777',
};
const hex = (g) => g.replace(/-/g, '');
const SITE = 'https://contoso.sharepoint.com/teams/acervo';

// --- 1. lerOrigem ----------------------------------------------------------
const boa = { provedor: 'sharepoint', site: SITE, pasta: 'Documentos Partilhados/Connect/Marketing', 'site-id': G.site, 'web-id': `{${G.web}}`, 'lista-id': hex(G.lista), 'pasta-id': G.mkt };
const r1 = lerOrigem([boa]);
ok(r1.itens.length === 1 && !r1.erros.length, 'origem valida e aceita');
ok(r1.itens[0].webId === G.web && r1.itens[0].listaId === G.lista, 'GUID com chaves e sem hifens normaliza');
ok(lerOrigem([{ ...boa, provedor: 'gdrive' }]).erros.some((e) => /provedor desconhecido/.test(e)), 'provedor desconhecido recusado');
ok(lerOrigem([{ ...boa, 'pasta-id': 'xyz' }]).erros.some((e) => /pasta-id/.test(e)), 'GUID invalido recusado');
ok(lerOrigem([{ ...boa, pasta: 'C:\\Users\\x\\Marketing' }]).erros.some((e) => /caminho de disco/.test(e)), 'caminho local em `pasta` recusado (ADR-23)');
ok(lerOrigem([{ ...boa, site: 'http://x' }]).erros.length > 0, 'site sem https recusado');

// --- link ------------------------------------------------------------------
const link = montarLinkSync(r1.itens[0], { email: 'op@contoso.com' });
ok(link.startsWith('odopen://sync/?userEmail=op%40contoso.com&'), 'link odopen com email primeiro');
ok(link.includes(`folderId=${G.mkt}`) && link.includes(`listId=%7B${G.lista}%7D`), 'folderId sem chaves, listId com chaves');
ok(link.includes('folderName=Marketing') && link.includes(encodeURIComponent(`${SITE}/Documentos Partilhados/Connect/Marketing`)), 'folderName e folderUrl derivados de site+pasta');

// --- 2. catalogo -----------------------------------------------------------
ok(JSON.stringify(tokenizar('1 "a b" c ""')) === JSON.stringify(['1', 'a b', 'c', '']), 'tokenizador respeita aspas e vazio');
ok(normalizarGuid(`${hex(G.mkt)}+4`) === G.mkt, 'id da pasta com sufixo +N normaliza');

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-onedrive-'));
const local = (n) => path.join(base, 'onedrive', n);
const iniTexto = [
  'library = 1',
  `libraryScope = 0 ${hex(G.outra)} 5 "MySite" "ODB" 2 "https://contoso-my.sharepoint.com/personal/op" "tenant" ${hex(G.outra)} ${hex(G.outra)} ${hex(G.outra)} 1761221874 "${local('OneDrive - Contoso')}" 1 x`,
  `libraryScope = 4 ${hex(G.outra)}+4 5 "Acervo" "Documentos" 4 "${SITE}" "tenant" ${hex(G.site)} ${hex(G.web)} ${hex(G.lista)} 0 "" 1 x`,
  `libraryFolder = 3 4 ${hex(G.mkt)}+4 1786985745 "${local('Acervo - Marketing')}" 1 "Marketing" ${G.outra} 1 2 x`,
  `libraryFolder = 4 4 ${hex(G.hubA)}+4 1786985745 "${local('Acervo - _Delivery Hub')}" 1 "_Delivery Hub" ${G.outra} 1 2 x`,
  `libraryFolder = 5 2 ${hex(G.hubB)}+2 1786985745 "${local('Outro - _Delivery Hub')}" 1 "_Delivery Hub" ${G.outra} 1 2 x`,
].join('\r\n');
const cat = parseCatalogoIni(iniTexto);
ok(cat.filter((e) => e.tipo === 'biblioteca').length === 1, 'so biblioteca com mountPoint entra como biblioteca (MySite)');
ok(cat.filter((e) => e.tipo === 'pasta').length === 3, 'tres pastas no catalogo');
const mktCat = cat.find((e) => e.pastaId === G.mkt);
ok(mktCat && mktCat.listaId === G.lista && mktCat.webUrl === SITE, 'pasta herda site/lista do escopo');

const achado = localizarNoCatalogo(cat, r1.itens[0]);
ok(achado && achado.via === 'pasta' && achado.caminho === local('Acervo - Marketing'), 'localiza por pasta-id');
const hubA = lerOrigem([{ ...boa, pasta: 'Documentos Partilhados/Connect/_Delivery Hub', 'pasta-id': G.hubA }]).itens[0];
ok(localizarNoCatalogo(cat, hubA).caminho === local('Acervo - _Delivery Hub'), 'dois `_Delivery Hub`: casa o certo por id, nunca por nome');
const catBiblioteca = [{ tipo: 'biblioteca', listaId: G.lista, mountPoint: local('Acervo - Documentos') }];
ok(localizarNoCatalogo(catBiblioteca, r1.itens[0]).caminho === path.join(local('Acervo - Documentos'), 'Connect', 'Marketing'), 'biblioteca inteira sincronizada: pasta dentro dela');

// UTF-16LE com BOM, como o cliente grava — pelo leitor de disco
import { lerCatalogoOneDrive } from '../plugins/connect/lib/onedrive.mjs';
const appdata = path.join(base, 'appdata');
const dirConta = path.join(appdata, 'Microsoft', 'OneDrive', 'settings', 'Business1');
fs.mkdirSync(dirConta, { recursive: true });
fs.writeFileSync(path.join(dirConta, `${G.outra}.ini`), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(iniTexto, 'utf16le')]));
fs.writeFileSync(path.join(dirConta, 'global.ini'), 'lixo');
const lido = lerCatalogoOneDrive({ localAppData: appdata });
ok(lido.status === 'ok' && lido.entradas.length === 4, 'le o .ini UTF-16LE do disco e ignora os outros .ini');
ok(lerCatalogoOneDrive({ localAppData: path.join(base, 'nao-existe') }).status === 'indisponivel', 'sem OneDrive: indisponivel, nunca lanca');

// --- 3..7 sincronizarSubvault com host falso --------------------------------
const matriz = path.join(base, 'matriz');
const home = path.join(base, 'home');
fs.mkdirSync(path.join(matriz, 'organizacao'), { recursive: true });
fs.mkdirSync(home, { recursive: true });
const manifesto = (nome, extra) => fs.writeFileSync(path.join(matriz, 'organizacao', `${nome}.md`),
`---
tipo: area
papel: ${nome}
governanca: lider-de-${nome}
externo: true
criado-por: op
criado-em: 2026-10-06
${extra}
---
# ${nome}
`);
manifesto('marketing', `classe: vault
origem:
  - provedor: sharepoint
    site: ${SITE}
    pasta: Documentos Partilhados/Connect/Marketing
    site-id: ${G.site}
    web-id: ${G.web}
    lista-id: ${G.lista}
    pasta-id: ${G.mkt}`);
manifesto('delivery-hub', `classe: diretorio
origem:
  - provedor: sharepoint
    site: ${SITE}
    pasta: Documentos Partilhados/Connect/_Delivery Hub
    site-id: ${G.site}
    web-id: ${G.web}
    lista-id: ${G.lista}
    pasta-id: ${G.hubA}`);
manifesto('vendas', `classe: vault
origem:
  - provedor: sharepoint
    site: ${SITE}
    pasta: Documentos/Vendas
    site-id: ${G.site}
    web-id: ${G.web}
    lista-id: ${G.lista}
    pasta-id: ${G.outra}`);
manifesto('legado', 'classe: vault');
manifesto('quebrado', `origem:
  - provedor: dropbox
    site: ${SITE}`);

function hostFalso({ catalogos, plataforma = 'win32', contas = [{ conta: 'Business1', email: 'op@contoso.com' }] }) {
  const h = { plataforma, links: [], fixados: [], leituras: 0 };
  h.emailsDasContas = () => contas;
  h.abrirLink = (l) => h.links.push(l);
  h.fixar = (d) => { h.fixados.push(d); return { status: 'fixado' }; };
  h.esperar = async () => {};
  h.lerCatalogo = () => {
    const c = catalogos[Math.min(h.leituras, catalogos.length - 1)];
    h.leituras += 1;
    return { status: 'ok', entradas: c };
  };
  return h;
}
const cfg = { home, vaultMatriz: matriz };
fs.mkdirSync(local('Acervo - Marketing'), { recursive: true });
fs.mkdirSync(local('Acervo - _Delivery Hub'), { recursive: true });
const configJson = () => JSON.parse(fs.readFileSync(path.join(home, 'connect.config.json'), 'utf8'));

// 3+4: ja sincronizado, vault -> registra + fixa, sem link
let h = hostFalso({ catalogos: [cat] });
let s = await sincronizarSubvault({ conceito: 'marketing', host: h, ...cfg });
ok(s.status === 'sincronizado' && s.jaSincronizado === true, 'ja sincronizado: so registra');
ok(h.links.length === 0, 'ja sincronizado: nao dispara link');
ok(h.fixados[0] === local('Acervo - Marketing'), 'classe vault: fixado no dispositivo');
ok(configJson().subVaults.marketing === local('Acervo - Marketing'), 'caminho gravado na tabela local');

// 4: diretorio nao fixa
h = hostFalso({ catalogos: [cat] });
s = await sincronizarSubvault({ conceito: 'delivery-hub', host: h, ...cfg });
ok(s.status === 'sincronizado' && h.fixados.length === 0 && s.fixacao.status === 'nao-aplicavel', 'classe diretorio: sincroniza sem fixar');

// dispara e espera: aparece na 3a leitura
fs.mkdirSync(local('Acervo - Vendas'), { recursive: true });
const comVendas = [...cat, { tipo: 'pasta', pastaId: G.outra, mountPoint: local('Acervo - Vendas'), nome: 'Vendas' }];
h = hostFalso({ catalogos: [cat, cat, comVendas] });
s = await sincronizarSubvault({ conceito: 'vendas', host: h, aguardarSegundos: 5, ...cfg });
ok(h.links.length === 1 && h.links[0].startsWith('odopen://sync/?'), 'nao sincronizado: dispara o link uma vez');
ok(h.links[0].includes('userEmail=op%40contoso.com'), 'link leva o e-mail da conta logada (sem ele o cliente ignora em silencio)');
ok(s.status === 'sincronizado' && s.jaSincronizado === false && s.caminho === local('Acervo - Vendas'), 'espera ate a pasta aparecer no catalogo');

// 5: nunca aparece -> aguardando, nada gravado
fs.rmSync(path.join(home, 'connect.config.json'));
h = hostFalso({ catalogos: [cat] });
s = await sincronizarSubvault({ conceito: 'vendas', host: h, aguardarSegundos: 0, ...cfg });
ok(s.status === 'aguardando' && s.governanca === 'lider-de-vendas' && s.link, 'prazo esgotado: aguardando + governanca + link');
ok(!fs.existsSync(path.join(home, 'connect.config.json')), 'aguardando: nenhum caminho registrado');

// catalogo lista mas a pasta nao existe no disco ainda
h = hostFalso({ catalogos: [[{ tipo: 'pasta', pastaId: G.outra, mountPoint: local('ainda-nao'), nome: 'Vendas' }]] });
s = await sincronizarSubvault({ conceito: 'vendas', host: h, ...cfg });
ok(s.status === 'aguardando' && !fs.existsSync(path.join(home, 'connect.config.json')), 'catalogo lista mas disco nao tem: aguardando, nada gravado');

// e-mail: sem conta logada / duas contas / ja sincronizado nao precisa de conta
h = hostFalso({ catalogos: [cat], contas: [] });
s = await sincronizarSubvault({ conceito: 'vendas', host: h, ...cfg });
ok(s.status === 'onedrive-sem-conta' && h.links.length === 0, 'sem conta OneDrive: onedrive-sem-conta, nada disparado');
h = hostFalso({ catalogos: [cat], contas: [{ conta: 'Business1', email: 'a@x.com' }, { conta: 'Business2', email: 'b@y.com' }] });
s = await sincronizarSubvault({ conceito: 'vendas', host: h, ...cfg });
ok(s.status === 'ambigua-conta' && s.contas.length === 2 && h.links.length === 0, 'duas contas: pergunta, nunca escolhe');
h = hostFalso({ catalogos: [cat], contas: [{ conta: 'Business1', email: 'a@x.com' }, { conta: 'Business2', email: 'b@y.com' }] });
s = await sincronizarSubvault({ conceito: 'vendas', email: 'b@y.com', host: h, aguardarSegundos: 0, ...cfg });
ok(h.links[0]?.includes('userEmail=b%40y.com'), 'email por parametro desempata');
h = hostFalso({ catalogos: [cat], contas: [] });
s = await sincronizarSubvault({ conceito: 'marketing', host: h, ...cfg });
ok(s.status === 'sincronizado', 'ja sincronizado nao exige conta (catalogo vem antes do e-mail)');
import { parseEmailsReg } from '../plugins/connect/lib/onedrive.mjs';
const regOut = '\r\nHKEY_CURRENT_USER\\Software\\Microsoft\\OneDrive\\Accounts\\Business1\r\n    UserEmail    REG_SZ    op@contoso.com\r\n\r\nHKEY_CURRENT_USER\\Software\\Microsoft\\OneDrive\\Accounts\\Personal\r\n    UserEmail    REG_SZ    pessoal@live.com\r\n\r\nFim da pesquisa: 2 correspondência(s) encontrada(s).\r\n';
const em = parseEmailsReg(regOut);
ok(em.length === 1 && em[0].email === 'op@contoso.com', 'reg query: so contas Business, conta pessoal fora');

// 6: sem origem / origem invalida
s = await sincronizarSubvault({ conceito: 'legado', host: hostFalso({ catalogos: [cat] }), ...cfg });
ok(s.status === 'sem-origem', 'sem origem: sem-origem');
s = await sincronizarSubvault({ conceito: 'quebrado', host: hostFalso({ catalogos: [cat] }), ...cfg });
ok(s.status === 'origem-invalida' && s.erros.length > 0, 'origem malformada: origem-invalida com erros');

// 7: fora do Windows
s = await sincronizarSubvault({ conceito: 'marketing', host: hostFalso({ catalogos: [cat], plataforma: 'linux' }), ...cfg });
ok(s.status === 'plataforma-nao-suportada' && s.link?.startsWith('odopen://'), 'fora do Windows: devolve o link');

// nao-encontrado
s = await sincronizarSubvault({ conceito: 'zzz-inexistente', host: hostFalso({ catalogos: [cat] }), ...cfg });
ok(s.status === 'nao-encontrado', 'conceito desconhecido: nao-encontrado');

// --- catalogoSync ------------------------------------------------------------
fs.rmSync(path.join(home, 'connect.config.json'), { force: true });
const cs =catalogoSync({ host: hostFalso({ catalogos: [cat] }), ...cfg });
const mk = cs.entidades.find((e) => e.conceito === 'marketing');
ok(mk.temOrigem && mk.localNestaMaquina === local('Acervo - Marketing'), 'catalogo: entidade com origem achada por id');
ok(cs.entidades.find((e) => e.conceito === 'legado').temOrigem === false, 'catalogo: entidade sem origem sinalizada');
ok(cs.naoDeclaradas.some((x) => x.origemSugerida['pasta-id'] === G.hubB), 'catalogo: pasta sem manifesto vira sugestao de origem');
ok(!fs.existsSync(path.join(home, 'connect.config.json')), 'catalogo sem `registrar`: nao grava nada');
catalogoSync({ registrar: true, host: hostFalso({ catalogos: [cat] }), ...cfg });
ok(configJson().subVaults.marketing === local('Acervo - Marketing'), 'catalogo com `registrar`: grava as achadas por id');

// --- 8. resolver aponta a tool ------------------------------------------------
const r8 = resolver({ conceito: 'vendas', workspaceDir: path.join(base, 'ws'), ...cfg });
ok(r8.status === 'local-nao-configurado' && r8.sincronizavel === true && /sincronizar_subvault/.test(r8.avisos.join(' ')), 'resolver: local-nao-configurado com origem aponta sincronizar_subvault');
const r8b = resolver({ conceito: 'legado', workspaceDir: path.join(base, 'ws'), ...cfg });
ok(r8b.sincronizavel === false && /registrar_subvault_local/.test(r8b.avisos.join(' ')), 'resolver: sem origem segue mandando perguntar');

// --- 9. captura passiva (emenda de 06/10) -----------------------------------
import { capturarOrigem, origemEmYaml } from '../plugins/connect/lib/onedrive.mjs';
import { parseFrontmatter } from '../plugins/connect/lib/frontmatter.mjs';

// site-titulo nomeia a pasta local: o link usa o titulo declarado, nao o slug
const comTitulo = lerOrigem([{ ...boa, 'site-titulo': 'Acervo Contoso' }]).itens[0];
ok(montarLinkSync(comTitulo).includes('webTitle=Acervo%20Contoso'), 'link usa site-titulo quando declarado');
ok(montarLinkSync(r1.itens[0]).includes('webTitle=acervo'), 'sem site-titulo: cai no slug do site');
ok(lerOrigem([{ ...boa, pasta: 'Marketing' }]).itens.length === 1, 'pasta so com o nome e valida (quem localiza e o pasta-id)');

const catTit = cat.map((e) => (e.tipo === 'pasta' ? { ...e, webTitle: 'Acervo' } : e));
const capEx = capturarOrigem(catTit, local('Acervo - Marketing'));
ok(capEx && capEx.exata === true && capEx.origem['pasta-id'] === G.mkt && capEx.origem['site-titulo'] === 'Acervo' && capEx.origem.pasta === 'Marketing', 'captura exata: origem completa a partir do caminho local');
const rt = lerOrigem(parseFrontmatter(`---\ntipo: x\n${capEx.yaml}\n---\n`).origem);
ok(rt.itens.length === 1 && rt.erros.length === 0 && rt.itens[0].siteTitulo === 'Acervo', 'yaml capturado volta pelo parser e passa na validacao');
const capAc = capturarOrigem(catTit, path.join(local('Acervo - Marketing'), 'sub', 'vault'));
ok(capAc && capAc.exata === false && capAc.subcaminho === path.join('sub', 'vault') && capAc.origem['pasta-id'] === G.mkt, 'caminho dentro de pasta sincronizada: exata=false, com subcaminho');
ok(capturarOrigem(catTit, path.join(base, 'fora-do-onedrive')) === null, 'caminho fora do OneDrive: nada a capturar');

// resolver propoe a captura quando o manifesto nao tem origem
fs.mkdirSync(local('Acervo - Legado'), { recursive: true });
const catLegado = [...catTit, { tipo: 'pasta', webTitle: 'Acervo', webUrl: SITE, siteId: G.site, webId: G.web, listaId: G.lista, pastaId: G.hubB, nome: 'Legado', mountPoint: local('Acervo - Legado') }];
const hostCat = { plataforma: 'win32', lerCatalogo: () => ({ status: 'ok', entradas: catLegado }) };
for (const w of ['ws9', 'ws9b', 'ws9c']) fs.mkdirSync(path.join(base, w), { recursive: true });
const r9 = resolver({ conceito: 'legado', workspaceDir: path.join(base, 'ws9'), subVaults: { legado: local('Acervo - Legado') }, hostOneDrive: hostCat, ...cfg });
ok(r9.status === 'resolvido' && r9.origemCapturavel?.exata === true, 'resolver: entidade sem origem resolvida -> origemCapturavel');
ok(r9.origemCapturavel?.manifesto === './matriz/organizacao/legado.md', 'origemCapturavel aponta o manifesto a editar');
ok(/cnct-nucleo-escrita/.test(r9.origemCapturavel?.aviso || ''), 'aviso manda gravar pelo protocolo de escrita, nunca em silencio');
const r9b = resolver({ conceito: 'marketing', workspaceDir: path.join(base, 'ws9b'), subVaults: { marketing: local('Acervo - Marketing') }, hostOneDrive: hostCat, ...cfg });
ok(r9b.status === 'resolvido' && r9b.origemCapturavel === undefined, 'entidade que ja declara origem: nada a capturar');
const r9c = resolver({ conceito: 'legado', workspaceDir: path.join(base, 'ws9c'), subVaults: { legado: local('Acervo - Legado') }, hostOneDrive: { ...hostCat, plataforma: 'linux' }, ...cfg });
ok(r9c.status === 'resolvido' && r9c.origemCapturavel === undefined, 'fora do Windows: resolver nao tenta capturar');

// catalogo_sync: sugestao completa, com yaml
const cs2 = catalogoSync({ host: hostFalso({ catalogos: [catTit] }), ...cfg });
const sug = cs2.naoDeclaradas.find((x) => x.origemSugerida['pasta-id'] === G.hubB);
ok(sug && sug.origemSugerida.pasta === '_Delivery Hub' && /pasta-id: /.test(sug.origemSugerida.yaml), 'catalogo_sync: sugestao com pasta pelo nome e yaml pronto');

fs.rmSync(base, { recursive: true, force: true });
console.log(`\nspike-onedrive: ${pass} ok, ${fail} falha(s)`);
process.exit(fail ? 1 : 0);
