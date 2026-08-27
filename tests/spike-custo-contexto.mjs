// tests/spike-custo-contexto.mjs
// Cobre os tres cortes da 0.20.0, todos nascidos de MEDICAO em sessao real
// (dogfooding de 26/08, 8a sessao) e nao de hipotese:
//
//   1. bloco acionavel duplicado entre o canal injetado e o arquivo   (-1.230 B)
//   2. `vaultConfigInline` atravessando o payload sem nenhum leitor   (-1.259 B)
//   3. carta de navegacao paga nos DOIS canais do `resolver`          (-6.742 B)
//
// Por que este spike existe, e a razao vale mais que os asserts: a duplicacao (3)
// sobreviveu tres sessoes de dogfooding porque o COMENTARIO no servidor MCP afirmava
// que ela nao existia. Ninguem mediu — leram o comentario e confiaram. Teste que
// afirma o comportamento e o unico registro que nao mente por desatualizacao.
//
// Invariante que este arquivo protege: NENHUM dos cortes pode reintroduzir ausencia
// de aviso. Economia que apaga governanca nao e economia, e regressao silenciosa.
//
//   node tests/spike-custo-contexto.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { iniciarSessao } from '../plugins/connect/lib/session.mjs';
import { renderContexto, renderContextoCurto, renderResolucao } from '../plugins/connect/lib/render.mjs';
import { criarEntrega } from '../plugins/connect/lib/entrega.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const bytes = (s) => Buffer.byteLength(s, 'utf8');

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-custo-'));
const matriz = path.join(base, 'matriz');
fs.mkdirSync(path.join(matriz, '_cerebro'), { recursive: true });
fs.writeFileSync(path.join(matriz, '_cerebro', 'vault-config.md'), '---\nempresa: "Viceri Seidor"\n---');
fs.writeFileSync(path.join(matriz, '_cerebro', 'camada-1.md'), [
  '---', 'tipo-artefato: camada-1', '---', '# Camada 1 — teste',
  '## O que e este vault', 'Matriz de teste.',
  '## Estrutura', '- `_cerebro/`',
  '## Ordem de entrada', '1. Esta carta.',
  '## Quando carregar', '| Gatilho | Arquivo |', '|---|---|', '| teste | `x.md` |',
  '## Fronteiras', '- nada',
].join('\n'));
// Raiz ocupada por conteudo NAO governado — e o que faz o bloco de governanca disparar.
fs.writeFileSync(path.join(matriz, 'CLAUDE.md'), '# Arquivo de terceiro\nSem marcador do Connect.');

const home = path.join(base, 'home');
const report = iniciarSessao({ sessionId: 'custo', home, vaultMatriz: matriz });

// ---------------------------------------------------------------------------
// 1. Bloco acionavel: inteiro onde o canal e UNICO, recap onde ja foi injetado
// ---------------------------------------------------------------------------
const completo = renderContexto(report);                          // tool + degradacao
const paraArquivo = renderContexto(report, { acionavel: false }); // arquivo do workspace
const curto = renderContextoCurto(report, { status: 'materializado', caminhoRelativo: './contexto-sessao.md', bytes: 1234 });

ok(report.l1?.governanca?.estado === 'nao-governado', 'pre-condicao: a matriz de teste tem CLAUDE.md nao governado na raiz');
ok(/conteudo nao governado/.test(completo), 'variante padrao (tool/degradacao) leva o bloco de governanca INTEIRO — la o canal e unico');
ok(/conteudo nao governado/.test(curto), 'o bloco INJETADO leva a governanca inteira — e ele que precisa interromper');
ok(!/alguem com escrita neste vault/.test(paraArquivo), 'a variante de ARQUIVO nao repete o texto de governanca ja injetado');
ok(/Ja entregue no bloco injetado/.test(paraArquivo), 'a variante de arquivo entrega o RECAP no lugar');
ok(/NAO governado/.test(paraArquivo), 'o recap NOMEIA o achado — arquivo relido meses depois nao pode perder o rastro');
ok(bytes(paraArquivo) < bytes(completo), 'a variante de arquivo e menor que a completa (se empatar, a duplicacao voltou)');

// A degradacao e o ponto frágil do desenho: quando a escrita do arquivo falha, o
// stdout volta a ser canal unico e NAO pode sair sem aviso.
ok(/acesso de pasta|configuracao necessaria|conteudo nao governado/.test(completo),
  'DEGRADACAO: a variante que vai para o stdout quando o arquivo falha mantem o bloco acionavel');

// Sem nada acionavel, o recap nao inventa secao vazia.
const limpo = { ...report, concessao: null, matrizConfigurada: true, operadorProvisionado: true, l1: { ...report.l1, governanca: { estado: 'governado', marcador: { vault: 'x' } } } };
ok(!/Ja entregue no bloco injetado/.test(renderContexto(limpo, { acionavel: false })), 'sem item acionavel, o recap nao emite cabecalho vazio');

// ---------------------------------------------------------------------------
// 2. `vaultConfigInline` nunca atravessa — nem na primeira entrega
// ---------------------------------------------------------------------------
const entrega = criarEntrega();
const rel = { l1: { carta: { inline: 'CARTA INTEIRA' }, vaultConfigInline: 'ARQUIVO DE CONFIG COMPLETO' } };

const e1 = entrega.dedup(rel);
ok(e1.l1.carta.inline === 'CARTA INTEIRA', '1a entrega da CARTA vai inteira (o canal de texto nao chega ao Cowork)');
ok(!/ARQUIVO DE CONFIG COMPLETO/.test(JSON.stringify(e1)), 'vault-config NAO vai inteiro nem na 1a entrega — nenhum renderizador o consome');
ok(/vault-config nao inline/.test(e1.l1.vaultConfigInline), 'no lugar do inline vai um PONTEIRO, nao um marcador de dedup');
ok(/identidadeVault/.test(e1.l1.vaultConfigInline), 'o ponteiro diz onde a identidade ja esta — norma nao pode so proibir');
ok(rel.l1.vaultConfigInline === 'ARQUIVO DE CONFIG COMPLETO', 'objeto do chamador nunca e mutilado');

// ---------------------------------------------------------------------------
// 3. Carta do sub-vault: um canal so, e o que provadamente chega
// ---------------------------------------------------------------------------
const res = {
  status: 'resolvido', conceito: 'impulsa', tipo: 'programa', papel: 'tribo',
  caminhoRelativo: './impulsa', entrada: '_cerebro/camada-1.md',
  entradaResolvida: { status: 'resolvida', caminhoRelativo: './impulsa/_cerebro/camada-1.md' },
  concessao: { necessaria: true, caminho: 'D:\\acervo' },
  l1: { carta: { presente: true, caminhoRelativo: './impulsa/_cerebro/camada-1.md', inline: 'CARTA DO SUBVAULT '.repeat(200), validacao: { ok: true, faltando: [] } } },
  avisos: [],
};

const tComCarta = renderResolucao(res);
const tSemCarta = renderResolucao(res, { cartaInline: false });

ok(/CARTA DO SUBVAULT/.test(tComCarta), 'padrao continua levando a carta verbatim (clientes que entregam o texto nao perdem nada)');
ok(!/CARTA DO SUBVAULT/.test(tSemCarta), 'com cartaInline:false a carta NAO e repetida no texto');
ok(/structuredContent/.test(tSemCarta), 'o texto aponta o canal onde a carta viaja — falha vira lacuna nomeada, nao silencio');
ok(/lacuna de CANAL/.test(tSemCarta), 'o texto ensina a distinguir lacuna de canal de ausencia de carta');
ok(/ponto de pouso|Ponto de pouso/.test(tSemCarta), 'o ponto de pouso continua no texto — e o que o agente abre primeiro');
ok(bytes(tSemCarta) < bytes(tComCarta), 'o bloco sem a carta e menor (se empatar, a duplicacao de canal voltou)');

// A carta tem de continuar INTEIRA no canal que chega.
const eSub = criarEntrega().dedup(res);
ok(/CARTA DO SUBVAULT/.test(JSON.stringify(eSub)), 'a carta segue INTEIRA no structuredContent — cortar os dois canais deixaria o agente sem camada 1');

// Lacuna de carta e curta e acionavel: vai inteira mesmo com o inline desligado.
const semCarta = { ...res, l1: { carta: { presente: false } } };
ok(/Lacuna de navegacao/.test(renderResolucao(semCarta, { cartaInline: false })),
  'vault SEM carta anuncia a lacuna mesmo com cartaInline:false — economia nunca apaga aviso');
ok(/cnct-fabrica-navegacao/.test(renderResolucao(semCarta, { cartaInline: false })), 'e oferece a fabrica (D97: ausencia e gatilho de nascimento)');

// Carta incompleta continua sendo denunciada pelos dois caminhos.
const incompleta = { ...res, l1: { carta: { ...res.l1.carta, validacao: { ok: false, faltando: ['fronteiras'] } } } };
ok(/Carta incompleta/.test(renderResolucao(incompleta, { cartaInline: false })), 'carta incompleta e reportada mesmo sem o inline');

try { fs.rmSync(base, { recursive: true, force: true }); } catch {}
console.log(`\nspike-custo-contexto: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
