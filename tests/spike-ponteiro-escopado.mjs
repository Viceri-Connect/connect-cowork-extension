// tests/spike-ponteiro-escopado.mjs
// Gate da ADR-22 — ponteiro local escopado por coletivo, com classe de artefato.
//
// Cada bloco abaixo e uma SITUACAO da secao `## Simulacao` da ADR, contra material
// instanciado (config real do operador, `repos.md` legado da MAPFRE, registro da
// matriz). Situacao que so existe em abstrato nao entra aqui — nem la.
//
// Zero dependencias externas, mesmo padrao dos demais spikes do repo.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lerTabela, casarPonteiro, montarChave, partirChave, vizinhos } from '../plugins/connect/lib/ponteiro.mjs';
import { casarMuitos, classeDoTipo } from '../plugins/connect/lib/resolver.mjs';
import { lerVinculo, coletivosComVinculo } from '../plugins/connect/lib/vinculo.mjs';
import { criarEntrega } from '../plugins/connect/lib/entrega.mjs';

let ok = 0; const falhas = [];
const t = (nome, fn) => {
  try { fn() ? (ok++, console.log(`  ok   ${nome}`)) : falhas.push(nome); }
  catch (e) { falhas.push(`${nome} — THROW ${e.message}`); }
};

// Tabela de teste: mistura o formato legado (como esta na maquina do operador hoje)
// com o escopado, porque conviver e requisito, nao acidente.
const TABELA = {
  'connect': 'C:/Workspaces/Impulsa/connect-cowork-extension',
  'mapfre/br-business-api': 'C:/Workspaces/Mapfre/br-business-api',
  'yamaha/br-business-api': 'C:/Workspaces/Yamaha/br-business-api',
  'mapfre/novos-negocios/delivery-hub': 'C:/DH-NovosNegocios',
  'mapfre/sinistro/delivery-hub': 'C:/DH-Sinistro',
  'mapfre/self-distributor-brasil-pipeline-lib': 'C:/Workspaces/Mapfre/self-distributor-brasil-pipeline-lib',
  'mapfre/self-bra-pipeline-lib': 'C:/Workspaces/Mapfre/self-bra-pipeline-lib',
};
const E = lerTabela(TABELA);

console.log('\n[chave escopada]');
t('partir chave de tres segmentos', () => {
  const p = partirChave('mapfre/novos-negocios/delivery-hub');
  return p.coletivo === 'mapfre' && p.escopo[0] === 'novos-negocios' && p.conceito === 'delivery-hub' && !p.legado;
});
t('chave sem barra e legado, nao erro', () => partirChave('connect').legado === true);
t('montar ignora segmento vazio', () => montarChave({ coletivo: 'mapfre', escopo: [], conceito: 'x' }) === 'mapfre/x');

console.log('\n[shim de retrocompatibilidade — ADR-22 item 1]');
t('sit6: valor string (formato <= 0.27.0) e lido', () => {
  const e = E.find((x) => x.chave === 'connect');
  return e.caminho.endsWith('connect-cowork-extension') && e.legado;
});
t('valor objeto tambem e lido', () => lerTabela({ 'a/b': { caminho: 'C:/b' } })[0].caminho === 'C:/b');
t('sit6: entrada legada continua resolvendo sem coletivo', () => casarPonteiro(E, { termo: 'connect' }).status === 'unico');
t('entrada legada permanece elegivel quando ha filtro de coletivo', () =>
  casarPonteiro(E, { termo: 'connect', coletivo: 'mapfre' }).status === 'unico');

console.log('\n[colisao entre coletivos — a razao de ser da ADR]');
t('sit4: repo homonimo em dois clientes => ambigua, nunca escolha', () =>
  casarPonteiro(E, { termo: 'br-business-api' }).status === 'ambigua');
t('sit4: candidatos vem QUALIFICADOS por coletivo', () => {
  const c = casarPonteiro(E, { termo: 'br-business-api' }).candidatos.map((x) => x.chave);
  return c.includes('mapfre/br-business-api') && c.includes('yamaha/br-business-api');
});
t('sit4: com coletivo, resolve e DECLARA o desempate', () => {
  const r = casarPonteiro(E, { termo: 'br-business-api', coletivo: 'mapfre' });
  return r.status === 'unico' && r.entrada.caminho.includes('/Mapfre/') && r.desempatadoPor === 'mapfre';
});
t('coletivo e filtro DURO: nao vaza para outro coletivo com nome parecido', () => {
  const r = casarPonteiro(E, { termo: 'br-business-api', coletivo: 'yamaha' });
  return r.entrada.caminho.includes('/Yamaha/');
});

console.log('\n[Delivery Hub por squad — sit1 e sit2]');
t('sit2: duas squads do mesmo cliente => ambigua', () =>
  casarPonteiro(E, { termo: 'delivery-hub', coletivo: 'mapfre' }).status === 'ambigua');
t('sit1: escopo de squad resolve o Hub certo', () => {
  const r = casarPonteiro(E, { termo: 'delivery-hub', coletivo: 'mapfre', escopo: 'novos-negocios' });
  return r.status === 'unico' && r.entrada.caminho === 'C:/DH-NovosNegocios';
});
t('escopo inexistente nao zera o universo (degrada para o coletivo)', () =>
  casarPonteiro(E, { termo: 'delivery-hub', coletivo: 'mapfre', escopo: 'inexistente' }).status === 'ambigua');

console.log('\n[assimetria leitura x escrita — emenda de 08/09 a ADR-22 item 6]');
t('ESCRITA: termo mais longo que a chave NAO casa (o defeito da 0.12.0)', () => {
  const X = lerTabela({ 'connect-web': 'C:/x' });
  return casarPonteiro(X, { termo: 'connect-web-api', bidirecional: false }).status === 'nenhum';
});
t('LEITURA: termo mais longo casa (o defeito de 08/09: tribo-impulsa)', () => {
  const X = lerTabela({ impulsa: 'C:/x' });
  return casarPonteiro(X, { termo: 'tribo-impulsa', bidirecional: true }).status === 'unico';
});
t('sit3: nomes distintos do mesmo coletivo nao se confundem entre si', () => {
  const a = casarPonteiro(E, { termo: 'self-bra-pipeline-lib', coletivo: 'mapfre', bidirecional: false });
  return a.status === 'unico' && a.entrada.chave === 'mapfre/self-bra-pipeline-lib';
});
t('sit3: termo generico intra-coletivo => ambigua, nao chute', () =>
  casarPonteiro(E, { termo: 'pipeline-lib', coletivo: 'mapfre', bidirecional: false }).status === 'ambigua');
t('piso de 3 caracteres respeitado', () =>
  casarPonteiro(E, { termo: 'br' }).status === 'nenhum');

console.log('\n[casar de sub-vault — ADR-22 item 5]');
const REG = [
  { conceito: 'tribo-grow', externo: true, gatilhos: [] },
  { conceito: 'tribo-mapfre', externo: true, gatilhos: [] },
  { conceito: 'tribo-cds-iu', externo: true, gatilhos: [] },
  { conceito: 'impulsa', externo: true, gatilhos: ['tribo-impulsa'] },
  { conceito: 'politicas', externo: false, gatilhos: ['tribo'] },
];
t('sit11: termo que casa 3 entidades => ambigua (antes: 1a da travessia)', () =>
  casarMuitos(REG, 'tribo').status === 'ambigua');
t('conceito exato vence sozinho, sem ambiguidade', () =>
  casarMuitos(REG, 'tribo-grow').entrada.conceito === 'tribo-grow');
t('gatilho exato resolve', () => casarMuitos(REG, 'tribo-impulsa').entrada.conceito === 'impulsa');
t('entidade sem acervo externo nao rouba fuzzy', () => {
  const r = casarMuitos(REG, 'politic');
  return r.status === 'nenhum';
});
t('termo desconhecido => nenhum', () => casarMuitos(REG, 'inexistente-xyz').status === 'nenhum');

// Regressao achada no teste end-to-end de 08/09, contra o registro REAL da matriz:
// `impulsa`, `tribo-grow` e `tribo-mapfre` declaram todas o gatilho generico `tribo`,
// e o lado novo do bidirecional (`termo.includes(alvo)`) fazia as tres casarem
// "tribo-impulsa" — ou seja, o fix teria apenas TROCADO a forma do defeito: de
// resolver a entidade errada em silencio para recusar uma resolucao obvia.
const REG_TAG = [
  { conceito: 'impulsa', externo: true, gatilhos: ['tribo'] },
  { conceito: 'tribo-grow', externo: true, gatilhos: ['tribo'] },
  { conceito: 'tribo-mapfre', externo: true, gatilhos: ['tribo'] },
];
t('gatilho generico compartilhado NAO cria ambiguidade quando o conceito casa', () =>
  casarMuitos(REG_TAG, 'tribo-impulsa').entrada?.conceito === 'impulsa');
t('mas empate real DENTRO do degrau de gatilho segue recusado', () =>
  casarMuitos(REG_TAG, 'tribo').status === 'ambigua');
t('conceito exato ainda vence tudo', () =>
  casarMuitos(REG_TAG, 'tribo-grow').entrada.conceito === 'tribo-grow');

console.log('\n[classe de artefato — ADR-22 item 2]');
t('tipo de diretorio de entrega => classe diretorio', () => classeDoTipo('diretorio-entrega') === 'diretorio');
t('delivery-hub tambem', () => classeDoTipo('delivery-hub') === 'diretorio');
t('qualquer outro tipo => classe vault (default seguro)', () =>
  classeDoTipo('programa') === 'vault' && classeDoTipo(null) === 'vault');

console.log('\n[disponiveis nao e catalogo — D-C]');
t('vizinhos limita a 12 de 155', () =>
  vizinhos(Array.from({ length: 155 }, (_, i) => `conceito-${i}`), 'conceito-1').length === 12);
t('vizinhos prioriza quem contem o termo', () =>
  vizinhos(['zzz', 'delivery-hub', 'aaa'], 'delivery')[0] === 'delivery-hub');

console.log('\n[poda de payload — D-A]');
{
  const carta = { inline: 'x'.repeat(4000), corpo: 'x'.repeat(3600) };
  const cp = { inline: 'y'.repeat(6000), corpo: 'y'.repeat(5000) };
  const rel = { l1: { carta, heranca: { cartaProcesso: cp } } };
  const e = criarEntrega();
  const p1 = e.dedup(rel);
  const p2 = e.dedup(rel);
  t('carta inline INTEIRA na 1a entrega (a economia da ADR-6 nunca pediu a 1a)', () =>
    p1.l1.carta.inline.length === 4000);
  t('corpo elidido ja na 1a — nao ha leitor do par', () =>
    p1.l1.carta.corpo.startsWith('<corpo elidido'));
  t('carta de processo tambem podada', () =>
    p1.l1.heranca.cartaProcesso.corpo.startsWith('<corpo elidido'));
  t('2a entrega do mesmo bloco vira marcador', () =>
    p2.l1.carta.inline.startsWith('<ja entregue'));
  t('2o sub-vault com mesmo processo nao repaga a carta de processo', () =>
    p2.l1.heranca.cartaProcesso.inline.startsWith('<ja entregue'));
  t('objeto do chamador nunca e mutilado', () => carta.corpo.length === 3600);
}

console.log('\n[vinculo do operador — ADR-22 item 8 / P81]');
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cnct-vinc-'));
  const casa = path.join(tmp, '_cerebro', 'vinculos', 'mapfre');
  fs.mkdirSync(casa, { recursive: true });
  fs.writeFileSync(path.join(casa, 'estado.md'), '# Estado\nchat maia em homologacao');
  fs.writeFileSync(path.join(casa, 'ambientes.md'), 'Oracle DEV CORPS6 — rodar script diario');

  t('le o que as skills ja escrevem hoje', () => {
    const v = lerVinculo(tmp, 'mapfre');
    return v.status === 'lido' && v.blocos.some((b) => b.arquivo === 'estado.md');
  });
  t('le tambem os eixos orfaos do repos.md legado (ambientes)', () =>
    lerVinculo(tmp, 'mapfre').blocos.some((b) => b.arquivo === 'ambientes.md'));
  t('coletivo sem vinculo e "ausente", nunca erro', () =>
    lerVinculo(tmp, 'yamaha').status === 'ausente');
  t('sem perfil de operador reporta sem-perfil', () =>
    lerVinculo(path.join(tmp, 'nao-existe'), 'mapfre').status === 'sem-perfil');
  t('lista os coletivos com vinculo', () => coletivosComVinculo(tmp).includes('mapfre'));
  t('registro gigante e truncado COM aviso, nunca omitido em silencio', () => {
    fs.writeFileSync(path.join(casa, 'estado.md'), 'z'.repeat(20000));
    const v = lerVinculo(tmp, 'mapfre');
    return v.avisos.length > 0 && v.blocos[0].texto.includes('truncado');
  });
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${ok} ok, ${falhas.length} falha(s)\n`);
if (falhas.length) { falhas.forEach((f) => console.log(`  FALHA  ${f}`)); process.exit(1); }
