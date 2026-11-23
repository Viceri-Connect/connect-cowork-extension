#!/usr/bin/env node
// tests/integration/sessao/instancia.spike.mjs
// CONNECT-E6-01 (0.39.0): primeiro uso por codigo de instancia.
//
//   node tests/integration/sessao/instancia.spike.mjs
//
// Premissas que este spike mata (criterios de aceite da US, rascunho):
//   CA1. Maquina sem a Matriz, OneDrive com a conta da empresa: o codigo resulta na
//        Matriz sincronizada, fixada e configurada, sem caminho informado.
//   CA2. Matriz ja sincronizada: o codigo e aceito e nada e sincronizado de novo.
//   CA3. Conta de outro dominio, ou nenhuma conta: recusa, sem disparar sync.
//   CA4. Sem permissao no site: `aguardando` nomeando a quem pedir acesso, sem
//        registrar caminho que nao apareceu.
//   CA5. Codigo malformado ou de versao desconhecida: recusa sem efeito colateral.
//   CA6. Nenhum dado da instancia no pacote do plugin.
//   +    Ida e volta: gerar (catalogo da maquina de quem governa) -> consumir.
//
// IDs FICTICIOS de proposito: este repositorio e publico.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  codificarCodigo, decodificarCodigo, extrairCodigo, gerarCodigoInstancia, configurarPorCodigo,
} from '../../../plugins/connect/lib/instancia.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ok ', msg); } else { fail++; console.error('  XX ', msg); } };

const G = {
  site: '11111111-1111-4111-8111-111111111111',
  web: '22222222-2222-4222-8222-222222222222',
  lista: '33333333-3333-4333-8333-333333333333',
  matriz: '44444444-4444-4444-8444-444444444444',
};
const SITE = 'https://contoso.sharepoint.com/teams/conhecimento';
const ORIGEM = {
  provedor: 'sharepoint', site: SITE, 'site-titulo': 'Conhecimento', pasta: 'Documentos/Connect/Matriz',
  'site-id': G.site, 'web-id': G.web, 'lista-id': G.lista, 'pasta-id': G.matriz,
};

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-instancia-'));
const home = path.join(base, 'home');
fs.mkdirSync(home, { recursive: true });
const pastaMatriz = path.join(base, 'OneDrive', 'Conhecimento - Matriz');
const criarMatriz = () => {
  fs.mkdirSync(path.join(pastaMatriz, '_cerebro'), { recursive: true });
  fs.writeFileSync(path.join(pastaMatriz, '_cerebro', 'vault-config.md'), '---\ntipo: vault-config\n---\n');
};
const entradaMatriz = () => ({ tipo: 'pasta', nome: 'Matriz', mountPoint: pastaMatriz, siteId: G.site, webId: G.web, listaId: G.lista, pastaId: G.matriz, webUrl: SITE, webTitle: 'Conhecimento' });

function hostFalso({ catalogos, plataforma = 'win32', contas = [{ email: 'ana@contoso.com' }], aoAbrir = null }) {
  const h = { plataforma, links: [], fixados: [], leituras: 0 };
  h.emailsDasContas = () => contas;
  h.abrirLink = (l) => { h.links.push(l); if (aoAbrir) aoAbrir(); };
  h.fixar = (d) => { h.fixados.push(d); return { status: 'fixado' }; };
  h.esperar = async () => {};
  h.lerCatalogo = () => {
    const c = typeof catalogos === 'function' ? catalogos() : catalogos[Math.min(h.leituras, catalogos.length - 1)];
    h.leituras += 1;
    return { status: 'ok', entradas: c };
  };
  return h;
}
const configJson = () => JSON.parse(fs.readFileSync(path.join(home, 'connect.config.json'), 'utf8'));
const limparConfig = () => fs.rmSync(path.join(home, 'connect.config.json'), { force: true });
// Isola do ambiente da maquina que roda o teste.
delete process.env.CONNECT_VAULT_MATRIZ;

// --- codificar / decodificar ---------------------------------------------------
console.log('\n[instancia] formato do codigo');
const cod = codificarCodigo({ origem: ORIGEM, dominio: 'contoso.com', instancia: 'Contoso', governanca: 'o ponto focal do Connect' });
ok(cod.status === 'ok' && /^CNCT1-[A-Za-z0-9_-]+$/.test(cod.codigo), 'gera CNCT1- + base64url (sem + / =)');
ok(cod.codigo.length < 600, `codigo curto o bastante para colar (${cod.codigo.length} caracteres)`);
const dec = decodificarCodigo(cod.codigo);
ok(dec.status === 'ok' && dec.origem.pastaId === G.matriz && dec.origem.siteId === G.site && dec.dominio === 'contoso.com', 'ida e volta preserva ids e dominio');
ok(dec.origem.pasta === 'Documentos/Connect/Matriz' && dec.origem.siteTitulo === 'Conhecimento' && dec.governanca === 'o ponto focal do Connect', 'ida e volta preserva pasta, titulo do site e governanca');
ok(extrairCodigo(`Ola! Sou novo. Meu codigo: ${cod.codigo}. Obrigado`) === cod.codigo, 'extrai o codigo do meio do pedido do operador');
const quebrado = cod.codigo.match(/.{1,70}/g).join('\n') + '\nObrigado pela ajuda';
ok(decodificarCodigo(quebrado).status === 'ok', 'codigo quebrado em linhas (copia de PDF) e seguido de texto: decodifica');
ok(decodificarCodigo(`meu codigo e ${cod.codigo.match(/.{1,90}/g).join(' ')} ok`).status === 'ok', 'codigo partido por espacos no meio do pedido: decodifica');
// Copia de PDF: o visualizador apaga o `-` do fim da linha (hifenizacao). Medido no guia de 27/10.
const semHifen = cod.codigo.replace('CNCT1-', 'CNCT1\n');
ok(decodificarCodigo(semHifen).status === 'ok', 'hifen do prefixo apagado na quebra de linha (copia de PDF): decodifica');
ok(decodificarCodigo(cod.codigo.replace('CNCT1-', 'CNCT1‑')).status === 'ok', 'hifen tipografico nao separavel no prefixo: decodifica');
ok(codificarCodigo({ origem: { ...ORIGEM, 'pasta-id': 'x' }, dominio: 'contoso.com' }).status === 'invalido', 'nao gera codigo com GUID invalido');
ok(codificarCodigo({ origem: ORIGEM, dominio: 'nao e dominio' }).status === 'invalido', 'nao gera codigo sem dominio valido');
ok(codificarCodigo({ origem: { ...ORIGEM, pasta: 'C:\\Users\\x\\Matriz' }, dominio: 'contoso.com' }).status === 'invalido', 'nao gera codigo com caminho de disco na pasta');

// --- CA5 -------------------------------------------------------------------------
console.log('\n[instancia] CA5 — codigo ruim nao tem efeito colateral');
for (const [ruim, rotulo] of [
  ['CNCT1-' + 'A'.repeat(40), 'base64 que nao e JSON'],
  [cod.codigo.slice(0, 40), 'codigo truncado'],
  [cod.codigo.replace('CNCT1-', 'CNCT9-'), 'versao desconhecida'],
  ['nao tem codigo aqui', 'sem codigo'],
]) {
  const h = hostFalso({ catalogos: [[]] });
  const r = await configurarPorCodigo({ codigo: ruim, host: h, home });
  ok(r.status === 'codigo-invalido' && h.links.length === 0 && h.leituras === 0 && !fs.existsSync(path.join(home, 'connect.config.json')), `${rotulo}: codigo-invalido, sem ler catalogo nem disparar`);
}
const v9 = await configurarPorCodigo({ codigo: cod.codigo.replace('CNCT1-', 'CNCT9-'), host: hostFalso({ catalogos: [[]] }), home });
ok(/atualize o plugin/.test(v9.erros.join(' ')), 'versao desconhecida orienta atualizar o plugin');

// --- CA3 -------------------------------------------------------------------------
console.log('\n[instancia] CA3 — conta errada ou ausente');
let h = hostFalso({ catalogos: [[]], contas: [{ email: 'ana@outra.com' }] });
let r = await configurarPorCodigo({ codigo: cod.codigo, host: h, home });
ok(r.status === 'conta-de-outro-dominio' && h.links.length === 0, 'conta de outro dominio: recusa sem disparar');
ok(/@contoso\.com/.test(r.avisos.join(' ')), 'e diz qual e o dominio exigido');
h = hostFalso({ catalogos: [[]], contas: [] });
r = await configurarPorCodigo({ codigo: cod.codigo, host: h, home });
ok(r.status === 'onedrive-sem-conta' && h.links.length === 0, 'nenhuma conta: recusa sem disparar');
h = hostFalso({ catalogos: [[]], contas: [{ email: 'a@contoso.com' }, { email: 'b@contoso.com' }] });
r = await configurarPorCodigo({ codigo: cod.codigo, host: h, home });
ok(r.status === 'ambigua-conta' && h.links.length === 0, 'duas contas do dominio: pergunta, nunca escolhe');
h = hostFalso({ catalogos: [[]] });
r = await configurarPorCodigo({ codigo: cod.codigo, email: 'ana@outra.com', host: h, home });
ok(r.status === 'conta-de-outro-dominio' && h.links.length === 0, '`email` informado de outro dominio: recusa');

// --- CA4 -------------------------------------------------------------------------
console.log('\n[instancia] CA4 — sem permissao (pasta nunca aparece)');
h = hostFalso({ catalogos: [[]] });
r = await configurarPorCodigo({ codigo: cod.codigo, host: h, home, aguardarSegundos: 0.001 });
ok(r.status === 'aguardando' && h.links.length === 1, 'dispara uma vez e devolve aguardando');
ok(/o ponto focal do Connect/.test(r.avisos.join(' ')), 'nomeia a quem pedir acesso (governanca do codigo)');
ok(!fs.existsSync(path.join(home, 'connect.config.json')), 'nao registra caminho que nao apareceu');
ok(/userEmail=ana%40contoso\.com/.test(h.links[0]) && h.links[0].includes(`folderId=${G.matriz}`), 'link leva userEmail da conta do dominio e o id da pasta');

// --- CA1 -------------------------------------------------------------------------
console.log('\n[instancia] CA1 — maquina sem a Matriz');
let sincronizou = false;
h = hostFalso({ catalogos: () => (sincronizou ? [entradaMatriz()] : []), aoAbrir: () => { sincronizou = true; criarMatriz(); } });
r = await configurarPorCodigo({ codigo: cod.codigo, host: h, home, aguardarSegundos: 5 });
ok(r.status === 'configurado' && r.jaSincronizado === false, 'sincroniza e configura');
ok(h.links.length === 1 && h.fixados[0] === pastaMatriz, 'um disparo; Matriz fixada no dispositivo');
ok(configJson().vaultMatriz === pastaMatriz, 'vaultMatriz gravado no connect.config.json');
ok(/iniciar_sessao/.test(r.avisos.join(' ')), 'aponta o proximo passo (iniciar_sessao)');

// --- CA2 -------------------------------------------------------------------------
console.log('\n[instancia] CA2 — Matriz ja sincronizada');
h = hostFalso({ catalogos: [[entradaMatriz()]] });
r = await configurarPorCodigo({ codigo: cod.codigo, host: h, home });
ok(r.status === 'ja-configurado' && h.links.length === 0, 'ja configurada: aceita, nada sincronizado');
limparConfig();
h = hostFalso({ catalogos: [[entradaMatriz()]], contas: [] });
r = await configurarPorCodigo({ codigo: cod.codigo, host: h, home });
ok(r.status === 'configurado' && r.jaSincronizado === true && h.links.length === 0, 'sincronizada mas nao configurada: so configura (sem conta, sem link)');

// --- outra matriz / prova de matriz -------------------------------------------------
console.log('\n[instancia] guardas');
const outra = path.join(base, 'outra-matriz');
fs.mkdirSync(outra, { recursive: true });
fs.writeFileSync(path.join(home, 'connect.config.json'), JSON.stringify({ vaultMatriz: outra }));
h = hostFalso({ catalogos: [[]] });
r = await configurarPorCodigo({ codigo: cod.codigo, host: h, home });
ok(r.status === 'outra-matriz-configurada' && h.links.length === 0, 'outra Matriz configurada: pergunta antes de sincronizar');
h = hostFalso({ catalogos: [[entradaMatriz()]] });
r = await configurarPorCodigo({ codigo: cod.codigo, host: h, home, substituir: true });
ok(r.status === 'configurado' && configJson().vaultMatriz === pastaMatriz, '`substituir: true` troca');
limparConfig();
fs.rmSync(path.join(pastaMatriz, '_cerebro'), { recursive: true, force: true });
h = hostFalso({ catalogos: [[entradaMatriz()]] });
r = await configurarPorCodigo({ codigo: cod.codigo, host: h, home });
ok(r.status === 'aguardando' && !fs.existsSync(path.join(home, 'connect.config.json')), 'pasta sem _cerebro/vault-config.md: aguardando, nao configura');
criarMatriz();
h = hostFalso({ catalogos: [[]], plataforma: 'linux' });
r = await configurarPorCodigo({ codigo: cod.codigo, host: h, home });
ok(r.status === 'plataforma-nao-suportada' && /^odopen:/.test(r.link) && h.links.length === 0, 'Linux: devolve o link, nao finge');

// --- gerar -----------------------------------------------------------------------------
console.log('\n[instancia] gerar (maquina de quem governa)');
h = hostFalso({ catalogos: [[entradaMatriz()]] });
let g = gerarCodigoInstancia({ host: h, home, vaultMatriz: pastaMatriz, governanca: 'o ponto focal do Connect' });
ok(g.status === 'ok' && decodificarCodigo(g.codigo).origem.pastaId === G.matriz, 'gera a partir do catalogo da Matriz configurada');
ok(g.dominio === 'contoso.com', 'infere o dominio da unica conta logada');
g = gerarCodigoInstancia({ host: hostFalso({ catalogos: [[{ ...entradaMatriz(), mountPoint: path.dirname(pastaMatriz) }]] }), home, vaultMatriz: pastaMatriz });
ok(g.status === 'origem-maior', 'Matriz dentro de pasta maior: recusa (faria sincronizar a pasta inteira)');
g = gerarCodigoInstancia({ host: hostFalso({ catalogos: [[]] }), home, vaultMatriz: pastaMatriz });
ok(g.status === 'origem-nao-encontrada', 'Matriz copiada (fora do catalogo): recusa');
g = gerarCodigoInstancia({ host: hostFalso({ catalogos: [[entradaMatriz()]], contas: [{ email: 'a@x.com' }, { email: 'b@y.com' }] }), home, vaultMatriz: pastaMatriz });
ok(g.status === 'dominio-indefinido', 'dois dominios logados: pede `dominio`');

// --- CA6 ---------------------------------------------------------------------------------
console.log('\n[instancia] CA6 — nada da instancia no pacote');
const ROOT = path.join(__dirname, '..', '..', '..', 'plugins', 'connect');
const textos = [];
const varrer = (d) => {
  for (const n of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, n.name);
    if (n.isDirectory()) { if (n.name !== 'bin' && n.name !== 'node_modules') varrer(p); } else if (/\.(mjs|md|json|bat|sh|ps1)$/.test(n.name)) textos.push(fs.readFileSync(p, 'utf8'));
  }
};
varrer(ROOT);
ok(!textos.some((t) => /CNCT1-[A-Za-z0-9_-]{40,}/.test(t)), 'nenhum codigo de instancia embutido no pacote');
ok(!textos.some((t) => /sharepoint\.com\/(teams|sites)\/[a-z0-9.-]+/i.test(t) && !/contoso|exemplo|example|empresa/i.test(t.match(/sharepoint\.com\/(teams|sites)\/[a-z0-9.-]+/i)[0])), 'nenhum site SharePoint real no pacote');

fs.rmSync(base, { recursive: true, force: true });
console.log(`\nspike-instancia: ${pass} ok, ${fail} falha(s)`);
process.exit(fail ? 1 : 0);
