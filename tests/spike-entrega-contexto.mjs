// tests/spike-entrega-contexto.mjs
// Cobre as quatro correcoes da 0.13.0, todas nascidas de medicao em sessao real
// (dogfooding de 23/08) e nao de hipotese:
//
//   1. CONNECT_HOME fora de pasta de aplicativo + migracao do home legado  (P93/P62/P90)
//   2. entrega de contexto: 1a vez inteira, repeticao vira marcador         (P74 lado B)
//   3. Camada 0 do operador na casa canonica + fallback alcancavel          (P75/P76)
//   4. concessao de acesso e estado zero do operador como secao estrutural  (P90/D105)
//
//   node tests/spike-entrega-contexto.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { iniciarSessao } from '../plugins/connect/lib/session.mjs';
import { defaultConnectHome, homeLegado, migrarHomeLegado } from '../plugins/connect/lib/config-local.mjs';
import { montarL1Pessoal } from '../plugins/connect/lib/matriz.mjs';
import { criarEntrega } from '../plugins/connect/lib/entrega.mjs';
import { renderContexto } from '../plugins/connect/lib/render.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-entrega-'));
const matriz = path.join(base, 'matriz');
fs.mkdirSync(path.join(matriz, '_cerebro'), { recursive: true });
fs.writeFileSync(path.join(matriz, '_cerebro', 'vault-config.md'), '---\nempresa: "Viceri Seidor"\n---');

const perfilMinimo = (raiz, { camada0 = 'canonica' } = {}) => {
  fs.mkdirSync(path.join(raiz, '_cerebro'), { recursive: true });
  fs.writeFileSync(path.join(raiz, '_cerebro', 'meu-config.md'), [
    '---', 'plugin: dois-cerebros', '---', '# Minha Config',
    '- nome: "Operador de Teste"', '- emails: "op@exemplo.com"', '- papeis-estaveis: [Tech Lead]',
  ].join('\n'));
  if (camada0 === 'canonica') fs.writeFileSync(path.join(raiz, 'CLAUDE.md'), '# Delta do operador\nGosto de decisao registrada.');
  if (camada0 === 'legada') fs.writeFileSync(path.join(raiz, '_cerebro', 'CLAUDE.md'), '# Delta legado\nCamada 0 na casa antiga.');
};

// ---------------------------------------------------------------------------
// 1. CONNECT_HOME nunca em pasta de aplicativo
// ---------------------------------------------------------------------------
const home = defaultConnectHome();
ok(!/AppData/i.test(home), 'home padrao nao cai em AppData (destino de junction que o harness recusa)');
ok(!/[\\/]\.local[\\/]state/.test(home), 'home padrao nao cai em XDG_STATE');
ok(home.startsWith(os.homedir()), 'home padrao fica sob o perfil do usuario');
ok(homeLegado() !== home, 'home legado e distinto do novo (senao a migracao seria no-op silenciosa)');

// migracao: legado com config -> destino vazio
const legado = path.join(base, 'legado');
const novo = path.join(base, 'novo');
fs.mkdirSync(legado, { recursive: true });
fs.writeFileSync(path.join(legado, 'connect.config.json'), JSON.stringify({ vaultMatriz: matriz }, null, 2));
perfilMinimo(path.join(legado, 'operador'));

const m1 = migrarHomeLegado(novo, legado);
ok(m1.status === 'migrado', 'migra config do home legado para o novo');
ok(m1.migrados.includes('operador/'), 'migra tambem o perfil do operador (o artefato que a migracao existe para destravar)');
ok(fs.existsSync(path.join(novo, 'operador', 'CLAUDE.md')), 'Camada 0 do operador chega no home novo');
ok(fs.existsSync(path.join(legado, 'MIGRADO.md')), 'home legado marcado, nunca apagado');
ok(fs.existsSync(path.join(legado, 'connect.config.json')), 'nada removido do legado');

const m2 = migrarHomeLegado(novo, legado);
ok(m2.status === 'nao-necessario', 'migracao e idempotente (rodar 2x nao duplica nem sobrescreve)');

// a sessao seguinte no home novo enxerga a config migrada — o ponto da migracao:
// se ela rodasse depois de resolveConfig, quem ja estava configurado seria tratado
// como 1o uso e teria de informar tudo de novo.
const rMig = iniciarSessao({ sessionId: 'migrado', home: novo });
ok(rMig.matrizConfigurada === true, 'sessao no home novo ja nasce configurada (nao volta ao 1o uso)');

// ---------------------------------------------------------------------------
// 2. Entrega de contexto — 1a inteira, repeticao marcada
// ---------------------------------------------------------------------------
const entrega = criarEntrega();
const rel = { protocoloMecanismo: 'ESPINHA COMPLETA DO MECANISMO', l1: { carta: { inline: 'CARTA DA MATRIZ' }, vaultConfigInline: 'CONFIG' } };

const p1 = entrega.dedup(rel);
ok(p1.protocoloMecanismo === 'ESPINHA COMPLETA DO MECANISMO', '1a entrega leva o protocolo INTEIRO (o canal de texto nao chega ao cliente)');
ok(p1.l1.carta.inline === 'CARTA DA MATRIZ', '1a entrega leva a carta INTEIRA');

const p2 = entrega.dedup(rel);
ok(/ja entregue nesta sessao/.test(p2.protocoloMecanismo), '2a entrega do mesmo bloco vira marcador (economia da ADR-6 preservada)');
ok(/ja entregue nesta sessao/.test(p2.l1.carta.inline), '2a entrega da carta vira marcador');
ok(rel.protocoloMecanismo === 'ESPINHA COMPLETA DO MECANISMO', 'objeto do chamador nunca e mutilado');

const outra = criarEntrega();
ok(outra.dedup(rel).protocoloMecanismo === 'ESPINHA COMPLETA DO MECANISMO', 'registro e por sessao: sessao nova recebe tudo de novo');

// conteudo diferente nao colide
const p3 = entrega.dedup({ protocoloMecanismo: 'OUTRO TEXTO' });
ok(p3.protocoloMecanismo === 'OUTRO TEXTO', 'bloco de conteudo diferente nao e confundido com o ja entregue');

// ---------------------------------------------------------------------------
// 3. Camada 0 do operador — casa canonica, legada e ausente
// ---------------------------------------------------------------------------
const pCanon = path.join(base, 'perfil-canonico');
perfilMinimo(pCanon, { camada0: 'canonica' });
const l1c = montarL1Pessoal(pCanon, 'operador');
ok(l1c.hotCacheOrigem === 'canonica', 'le a Camada 0 de CLAUDE.md na RAIZ — onde a cnct-fabrica-operador escreve (P76)');
ok(/Delta do operador/.test(l1c.hotCacheInline), 'conteudo da Camada 0 canonica entra inline');
ok(l1c.avisos.length === 0, 'casa canonica nao gera aviso');

const pLeg = path.join(base, 'perfil-legado');
perfilMinimo(pLeg, { camada0: 'legada' });
const l1l = montarL1Pessoal(pLeg, 'operador');
ok(l1l.hotCacheOrigem === 'legada', 'cai na casa legada (_cerebro/CLAUDE.md) quando so ela existe');
ok(l1l.avisos.some(a => /legada/.test(a)), 'casa legada avisa a migracao pendente');

const pVazio = path.join(base, 'perfil-vazio');
fs.mkdirSync(pVazio, { recursive: true });
ok(montarL1Pessoal(pVazio, 'operador').hotCacheOrigem === 'ausente', 'perfil sem Camada 0 reporta ausente (nao finge estar provisionado)');

// P75: com o perfil no CONNECT_HOME sem Camada 0, o fallback para o vault pessoal
// tem de ser ALCANCAVEL. Antes ele era codigo morto: ensureDir() criava a pasta do
// perfil, entao o `existsSync` do gate era sempre verdadeiro.
const homeSemC0 = path.join(base, 'home-sem-c0');
fs.mkdirSync(path.join(homeSemC0, 'operador', '_cerebro'), { recursive: true });
fs.writeFileSync(path.join(homeSemC0, 'operador', '_cerebro', 'meu-config.md'), '---\nplugin: dois-cerebros\n---\n- nome: "Op"\n- emails: "op@exemplo.com"\n');
const pessoalLegado = path.join(base, 'obsidian-pessoal');
fs.mkdirSync(path.join(pessoalLegado, '_cerebro'), { recursive: true });
fs.writeFileSync(path.join(pessoalLegado, '_cerebro', 'CLAUDE.md'), '# Camada 0 do vault legado');

const rFb = iniciarSessao({ sessionId: 'fallback', home: homeSemC0, vaultMatriz: matriz, cerebroPessoal: pessoalLegado });
ok(/Camada 0 do vault legado/.test(rFb.l1Pessoal?.hotCacheInline || ''), 'fallback para o vault pessoal e alcancavel (P75) — antes o operador perdia a Camada 0 em silencio');

// ---------------------------------------------------------------------------
// 4. Secoes estruturais do bloco de contexto
// ---------------------------------------------------------------------------
const homeZero = path.join(base, 'home-zero');
const rZero = iniciarSessao({ sessionId: 'zero-op', home: homeZero, vaultMatriz: matriz });
ok(rZero.operadorProvisionado === false, 'estado zero do operador vira FLAG, nao so aviso solto no fim do bloco');
ok(rZero.concessao?.necessaria === true, 'concessao de acesso vira contrato estrutural (P90), nao instrucao em prosa');
ok(rZero.concessao.caminho === homeZero, 'a concessao aponta UMA pasta: o proprio CONNECT_HOME');
ok(rZero.concessao.alcanca.includes('./matriz'), 'a concessao declara o que ela alcanca');

const blocoZero = renderContexto(rZero);
const posConcessao = blocoZero.indexOf('acesso de pasta');
const posMatriz = blocoZero.indexOf('configuracao necessaria');
ok(posConcessao >= 0, 'bloco abre com a secao de concessao de acesso');
ok(posConcessao < posMatriz || posMatriz === -1, 'concessao vem ANTES do estado zero da matriz (e precondicao de qualquer leitura)');
ok(/nao contorne/.test(blocoZero), 'o bloco proibe explicitamente o contorno por varredura (D108/D148)');
ok(/perfil do operador nao provisionado/.test(blocoZero), 'estado zero do operador ganha secao dedicada, simetrica a da matriz');

const homeOk = path.join(base, 'home-ok');
perfilMinimo(path.join(homeOk, 'operador'));
const rOk = iniciarSessao({ sessionId: 'op-ok', home: homeOk, vaultMatriz: matriz });
ok(rOk.operadorProvisionado === true, 'perfil completo nao dispara o bloco de provisionamento');
ok(!/perfil do operador nao provisionado/.test(renderContexto(rOk)), 'sem falso positivo de estado zero do operador');

try { fs.rmSync(base, { recursive: true, force: true }); } catch {}
console.log(`\nspike-entrega-contexto: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
