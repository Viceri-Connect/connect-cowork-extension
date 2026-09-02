// tests/spike-heranca.mjs
// Herança de processo (contrato-navegacao.md §9) e as métricas M1..M7 (§9.4).
//
// Por que este arquivo existe: as sete métricas passaram da v0.4.0 à v0.5.0 de
// "norma escrita" a mecanismo, e o defeito que elas fecham é justamente o de
// verificação que depende de disciplina. Deixar o mecanismo que substitui a
// disciplina sem teste seria repetir a classe do defeito num andar acima.
//
// Zero dependências. Roda: node tests/spike-heranca.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lerCarta } from '../plugins/connect/lib/navegacao.mjs';
import { resolverHeranca, lerCartaProcesso, caminhoCartaProcesso } from '../plugins/connect/lib/heranca.mjs';
import { parseTabelaAlcance, lerDeclaracoes, corpoSemAlcance, resolverCorrente } from '../plugins/connect/lib/alcance.mjs';
import { medirVault } from '../plugins/connect/lib/metricas.mjs';
import { parseFrontmatter, estimarTokens } from '../plugins/connect/lib/frontmatter.mjs';
import { blocoHeranca } from '../plugins/connect/lib/render.mjs';

let okCount = 0;
let failCount = 0;
const ok = (cond, msg) => {
  if (cond) { okCount += 1; console.log(`  ok   ${msg}`); }
  else { failCount += 1; console.log(`  FALHA ${msg}`); }
};

const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-heranca-'));
const escrever = (base, rel, txt) => {
  const p = path.join(base, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, txt, 'utf8');
  return p;
};

// --- parser de frontmatter ------------------------------------------------
const fmTexto = `---
processo: sdd
titulo: "com espaco"
lista: [a, b]
bloco:
  - x
  - y
alcance:
  - casa: projetos/{projeto}/adr
    padrao: "ADR-{N}-{slug}.md"
    grau: derivavel
    filtros: [status, data]
  - casa: projetos/{projeto}/backlog
    grau: listavel
---

# corpo
`;
const fm = parseFrontmatter(fmTexto);
ok(fm.processo === 'sdd', 'frontmatter: escalar');
ok(fm.titulo === 'com espaco', 'frontmatter: aspas removidas');
ok(Array.isArray(fm.lista) && fm.lista.length === 2, 'frontmatter: lista inline');
ok(Array.isArray(fm.bloco) && fm.bloco[1] === 'y', 'frontmatter: lista de bloco');
ok(fm.alcance.length === 2 && fm.alcance[0].grau === 'derivavel', 'frontmatter: LISTA DE OBJETOS (o que `alcance:` exige)');
ok(Array.isArray(fm.alcance[0].filtros) && fm.alcance[0].filtros.includes('status'), 'frontmatter: lista dentro de objeto');
ok(fm.alcance[1].padrao === undefined, 'frontmatter: chave ausente fica ausente, nunca inventada');
ok(Object.keys(parseFrontmatter('# sem frontmatter')).length === 0, 'frontmatter: ausente devolve vazio');
ok(Object.keys(parseFrontmatter('---\nprocesso: x\nsem fechamento')).length === 0,
  'frontmatter: abertura sem fechamento NAO consome o documento');
ok(estimarTokens('') === 0 && estimarTokens('abcd') === 1, 'estimarTokens: ~4 bytes por token');

// --- montagem dos vaults de teste ----------------------------------------
const matriz = path.join(raiz, 'matriz');
const vaultA = path.join(raiz, 'tribo-a');
const vaultB = path.join(raiz, 'tribo-b');
const vaultSem = path.join(raiz, 'sem-processo');

const CARTA_PROCESSO = `---
tipo-artefato: carta-processo
processo: sdd
topologia:
  - projetos/{projeto}
  - projetos/{ciclo}/{projeto}
---

# Carta de processo — sdd

## Alcance

| Casa | Padrão | Grau | Filtros | Hub |
|---|---|---|---|---|
| \`projetos/{projeto}\` | — | — | — | \`projetos/{projeto}/{projeto}.md\` |
| \`projetos/{ciclo}/{projeto}\` | — | — | — | \`projetos/{ciclo}/{projeto}/{projeto}.md\` |

## Estrutura
- o projeto e o hub do proprio conteudo
`;
escrever(matriz, caminhoCartaProcesso('sdd'), CARTA_PROCESSO);

const cartaLocal = (processo, linhasAlcance = null) => `---
tipo-artefato: camada-1
${processo ? `processo: ${processo}\ntopologia: projetos/{projeto}\n` : ''}---

# Camada 1

## O que e este vault
Um vault de teste. Corte: so o que e do teste.

## Estrutura
- \`projetos/\` — projetos

## Ordem de entrada
1. Esta carta.

## Quando carregar
| Gatilho | Arquivo |
|---|---|
| projeto | \`projetos/p1/p1.md\` |

## Fronteiras
- Governanca da empresa -> conceito \`matriz\`

## Alcance

| Casa | Padrão | Grau | Filtros | Hub |
|---|---|---|---|---|
${linhasAlcance || '| `.` | `hub.md` | derivavel | — | — |'}
`;

const HUB_PROJETO = `---
tipo: projeto
---

# p1

## Alcance

| Casa | Padrão | Grau | Filtros | Hub |
|---|---|---|---|---|
| \`projetos/p1\` | \`p1.md\` | derivavel | tipo | — |
| \`projetos/p1/adr\` | \`ADR-{N}-{slug}.md\` | derivavel | status | — |
`;

for (const v of [vaultA, vaultB]) {
  escrever(v, '_cerebro/camada-1.md', cartaLocal('sdd'));
  escrever(v, 'hub.md', '# hub');
  escrever(v, 'projetos/p1/p1.md', HUB_PROJETO);
  escrever(v, 'projetos/p1/adr/ADR-1-primeira.md', '---\nstatus: aceita\n---\n# ADR-1');
}
escrever(vaultSem, '_cerebro/camada-1.md', cartaLocal(null));
escrever(vaultSem, 'hub.md', '# hub');

// --- leitura da declaracao de heranca ------------------------------------
const cA = lerCarta(vaultA, 'a');
ok(cA.processo === 'sdd', 'lerCarta expoe `processo:` do frontmatter');
ok(cA.frontmatter.topologia === 'projetos/{projeto}', 'lerCarta expoe `topologia:` do frontmatter');
ok(cA.alcance.length === 1 && cA.formaAlcance === 'tabela', 'lerCarta le a tabela `## Alcance` do corpo');
ok(!cA.corpo.includes('## Alcance'), 'a secao `## Alcance` NAO e injetada — declaracao e para o mecanismo');
ok(!cA.corpo.includes('processo: sdd'), 'lerCarta separa corpo do frontmatter');
ok(cA.inline.includes('processo: sdd'), 'inline preserva o arquivo inteiro');
ok(lerCarta(vaultSem, 's').processo === null, 'vault sem `processo:` devolve null (nao e erro)');

// --- injecao UMA VEZ POR SESSAO ------------------------------------------
const ws = path.join(raiz, 'workspace');
fs.mkdirSync(ws, { recursive: true });

const h1 = resolverHeranca({ carta: cA, governanteRoot: matriz, workspaceDir: ws });
ok(h1.status === 'injetada', 'primeiro vault do processo: carta injetada');
ok(h1.cartaProcesso.topologias.length === 2, 'topologias lidas da carta de processo (insumo da M7)');

const h2 = resolverHeranca({ carta: lerCarta(vaultB, 'b'), governanteRoot: matriz, workspaceDir: ws });
ok(h2.status === 'ja-injetada', 'segundo vault do MESMO processo: nao repete — e o fim da escala linear do piso');
ok(fs.existsSync(path.join(ws, '.connect', 'heranca.json')), 'registro de injecao gravado no workspace da sessao');

const wsOutra = path.join(raiz, 'workspace-2');
fs.mkdirSync(wsOutra, { recursive: true });
ok(resolverHeranca({ carta: cA, governanteRoot: matriz, workspaceDir: wsOutra }).status === 'injetada',
  'sessao NOVA injeta de novo (o registro e por sessao, nunca do processo MCP)');

// --- as tres degradacoes declaradas --------------------------------------
ok(resolverHeranca({ carta: lerCarta(vaultSem, 's'), governanteRoot: matriz, workspaceDir: ws }).status === 'sem-processo',
  'ausencia de `processo:` devolve sem-processo');
ok(resolverHeranca({ carta: lerCarta(vaultSem, 's'), governanteRoot: matriz, workspaceDir: ws }).avisos.length === 0,
  'ausencia de `processo:` NAO gera aviso — nao e lacuna (§9.3)');
ok(blocoHeranca(resolverHeranca({ carta: lerCarta(vaultSem, 's'), governanteRoot: matriz, workspaceDir: ws })).length === 0,
  'sem processo: zero linha no contexto (nao cobrar token para dizer que nada aconteceu)');

const vaultOrfao = path.join(raiz, 'orfao');
escrever(vaultOrfao, '_cerebro/camada-1.md', cartaLocal('inexistente'));
escrever(vaultOrfao, 'hub.md', '# hub');
const hOrfao = resolverHeranca({ carta: lerCarta(vaultOrfao, 'o'), governanteRoot: matriz, workspaceDir: ws });
ok(hOrfao.status === 'ausente', '`processo:` sem carta correspondente devolve ausente');
ok(hOrfao.avisos.some((a) => a.includes('LACUNA DE HERANCA')), 'lacuna de heranca e RUIDOSA (o vault podado nao tem de onde herdar)');
ok(blocoHeranca(hOrfao).some((l) => l.includes('cnct-fabrica-navegacao')), 'lacuna oferece a fabrica, nunca supre por varredura');

ok(!lerCartaProcesso(matriz, 'sdd').avisos.length, 'carta de processo existente nao gera aviso');
ok(lerCartaProcesso(null, 'sdd').avisos.length === 1, 'governante inacessivel e reportado, nunca ignorado');

// --- metricas -------------------------------------------------------------
const mA = medirVault({ vaultRoot: vaultA, alias: 'a', governanteRoot: matriz });
ok(mA.processo === 'sdd', 'medirVault resolve o processo antes de medir');
ok(mA.heranca.declaracoesHerdadas === 1 && mA.heranca.declaracoesLocais === 1,
  'a topologia que o vault NAO usa e filtrada — senao ela casa com os diretorios internos dele');
ok(mA.heranca.declaracoesDeHub >= 2, 'a corrente percorreu o hub do projeto e trouxe as declaracoes dele');
ok(mA.heranca.delegacoes.some((d) => d.status === 'ok' && d.hub.endsWith('p1.md')),
  'delegacao resolvida: casa `projetos/{projeto}` governada pela nota-fonte');
ok(mA.metricas.M1.status === 'ok', 'M1 ok quando todo arquivo tem casa+padrao');
ok(mA.metricas.M7.status === 'ok', 'M7 ok quando a estrutura minima existe');

// M1 pega a orfa — e SO com a heranca resolvida, senao seriam 3 falsas
escrever(vaultA, 'solto.md', '# nota que nenhuma declaracao cobre');
const mOrfa = medirVault({ vaultRoot: vaultA, alias: 'a', governanteRoot: matriz });
ok(mOrfa.metricas.M1.status === 'falha' && mOrfa.metricas.M1.orfas.includes('solto.md'),
  'M1 reporta a orfa (check 6, computavel pela primeira vez)');
ok(!mOrfa.metricas.M1.orfas.includes('projetos/p1/p1.md'),
  'M1 NAO acusa o que a carta de PROCESSO cobre — sem isso, cada arquivo herdado seria orfa falsa');

const mSemHeranca = medirVault({ vaultRoot: vaultA, alias: 'a', governanteRoot: null });
ok(mSemHeranca.metricas.M1.orfas.length > mOrfa.metricas.M1.orfas.length,
  'heranca NAO resolvida infla as orfas — a precondicao da M1 e dura por medicao, nao por gosto');
fs.unlinkSync(path.join(vaultA, 'solto.md'));

// M2: indice autorado sobre nivel derivavel e defeito, nao zelo
escrever(vaultB, '_cerebro/camada-1.md', cartaLocal('sdd',
  '| `.` | `hub.md` | derivavel | — | — |\n| `projetos/p1/adr` | `ADR-{N}-{slug}.md` | derivavel | status | `adr-indice.md` |'));
const mM2 = medirVault({ vaultRoot: vaultB, alias: 'b', governanteRoot: matriz });
ok(mM2.metricas.M2.status === 'falha' && mM2.metricas.M2.defeitos.some((d) => d.includes('DEFEITO')),
  'M2: indice autorado sobre nivel derivavel e reportado como defeito (§8.1)');

escrever(vaultB, '_cerebro/camada-1.md', cartaLocal('sdd',
  '| `.` | `hub.md` | — | — | — |'));
ok(medirVault({ vaultRoot: vaultB, alias: 'b', governanteRoot: matriz }).metricas.M2.status === 'falha',
  'M2: declaracao sem `grau` e defeito (grau ausente nao e grau valido)');

// M7 — o que ela NAO faz mais: exigir existencia de pasta.
// Vault recem-nascido (sem projeto nenhum) e o estado NORMAL de quem acabou de
// ser provisionado, e casa de ADR/RNF nasce no refinamento, nao no
// provisionamento. Reprovar isso contrariaria *ausencia e gatilho de
// nascimento, nao erro* — foi o defeito da primeira versao desta metrica.
const vaultNovo = path.join(raiz, 'recem-nascido');
escrever(vaultNovo, '_cerebro/camada-1.md', cartaLocal('sdd'));
escrever(vaultNovo, 'hub.md', '# hub');
const mNovo = medirVault({ vaultRoot: vaultNovo, alias: 'n', governanteRoot: matriz });
ok(mNovo.metricas.M7.status === 'ok', 'M7: vault SEM projeto nenhum e conformante — nascimento nao e defeito');
ok(/nenhuma instancia/.test(mNovo.metricas.M7.motivo || ''), 'M7 diz POR QUE passou, em vez de passar calada');

// Projeto existente sem casa de ADR tambem passa: a casa nasce no refinamento.
const vaultSemAdr = path.join(raiz, 'sem-adr');
escrever(vaultSemAdr, '_cerebro/camada-1.md', cartaLocal('sdd'));
escrever(vaultSemAdr, 'hub.md', '# hub');
escrever(vaultSemAdr, 'projetos/p1/p1.md', '# p1');
ok(medirVault({ vaultRoot: vaultSemAdr, alias: 'sa', governanteRoot: matriz }).metricas.M7.status === 'ok',
  'M7: projeto sem casa de ADR e conformante — ela nasce no refinamento');

// O que a M7 DE FATO pega: topologia declarada que o processo nao admite.
const vaultTopoErrada = path.join(raiz, 'topo-errada');
escrever(vaultTopoErrada, '_cerebro/camada-1.md',
  cartaLocal('sdd').replace('topologia: projetos/{projeto}', 'topologia: entregas/{projeto}'));
escrever(vaultTopoErrada, 'hub.md', '# hub');
const mTopo = medirVault({ vaultRoot: vaultTopoErrada, alias: 't', governanteRoot: matriz });
ok(mTopo.metricas.M7.status === 'falha' && /admite/.test(mTopo.metricas.M7.motivo || ''),
  'M7 pega topologia declarada que o processo nao admite — ponteiro herdado que nao resolve nunca');

// --- a corrente de alcance ------------------------------------------------
const decls = parseTabelaAlcance('| Casa | Padrao | Grau | Filtros | Hub |\n|---|---|---|---|---|\n| `projetos/{projeto}` | — | — | — | `projetos/{projeto}/{projeto}.md` |\n| `.` | `hub.md` | derivavel | — | — |');
ok(decls.length === 2, 'tabela `## Alcance`: duas linhas lidas');
ok(decls[0].hub && !decls[0].padrao, 'linha DELEGADA: hub preenchido, padrao vazio');
ok(decls[1].casa === '' && decls[1].grau === 'derivavel', 'casa `.` e a RAIZ do vault, explicita');
ok(corpoSemAlcance('# t\n\n## Alcance\n\n| a |\n|---|\n\n## Outra\n\ntexto').includes('## Outra')
  && !corpoSemAlcance('# t\n\n## Alcance\n\n| a |\n|---|\n\n## Outra\n\ntexto').includes('## Alcance'),
  'a secao `## Alcance` sai da injecao e o resto do corpo fica intacto');

const mCorrente = medirVault({ vaultRoot: vaultA, alias: 'a', governanteRoot: matriz });
ok(mCorrente.heranca.declaracoesDeHub >= 2, 'a corrente percorreu o hub e trouxe as declaracoes dele');
ok(mCorrente.heranca.delegacoes.some((d) => d.status === 'ok'), 'delegacao resolvida aparece no relatorio');

// Hub declarado que NAO existe: a corrente quebra, e isso e defeito.
const vaultHubMorto = path.join(raiz, 'hub-morto');
escrever(vaultHubMorto, '_cerebro/camada-1.md',
  cartaLocal('sdd', '| `.` | `hub.md` | derivavel | — | — |\n| `casa-x` | — | — | — | `nao-existe.md` |'));
escrever(vaultHubMorto, 'hub.md', '# hub');
escrever(vaultHubMorto, 'casa-x/nota.md', '# nota');
const mHM = medirVault({ vaultRoot: vaultHubMorto, alias: 'hm', governanteRoot: matriz });
ok(mHM.metricas.M1.status === 'falha' && mHM.metricas.M1.correnteQuebrada.some((d) => d.includes('NAO existe')),
  'hub declarado inexistente quebra a corrente e e reportado');

// Hub que existe e nao declara `## Alcance`: NAO e defeito. Exigir a secao de
// todo hub obrigaria as N notas de projeto a repetir a forma do processo.
const vaultHubSemDelta = path.join(raiz, 'hub-sem-delta');
escrever(vaultHubSemDelta, '_cerebro/camada-1.md',
  cartaLocal('sdd', '| `.` | `hub.md` | derivavel | — | — |\n| `casa-y` | — | — | — | `capa.md` |\n| `casa-y` | `*.md` | listavel | — | — |'));
escrever(vaultHubSemDelta, 'hub.md', '# hub');
escrever(vaultHubSemDelta, 'casa-y/capa.md', '# capa sem secao de alcance');
escrever(vaultHubSemDelta, 'casa-y/nota.md', '# nota');
const mHS = medirVault({ vaultRoot: vaultHubSemDelta, alias: 'hs', governanteRoot: matriz });
ok(mHS.metricas.M1.status === 'ok',
  'hub sem `## Alcance` NAO e defeito — a M1 cobra a consequencia (orfa), nunca a forma');
ok(mHS.heranca.delegacoes.some((d) => d.status === 'sem-delta'), 'hub sem delta e reportado como tal, nao como falha');

// M6: fronteira com caminho de maquina
const comPath = lerCarta(vaultA, 'a').corpo.replace('conceito `matriz`', 'C:\\Users\\x\\matriz');
escrever(vaultA, '_cerebro/camada-1.md', `---\nprocesso: sdd\nalcance:\n  - casa: ""\n    padrao: "hub.md"\n    grau: derivavel\n---\n\n${comPath}`);
ok(medirVault({ vaultRoot: vaultA, alias: 'a', governanteRoot: matriz }).metricas.M6.status === 'falha',
  'M6 pega caminho de maquina em Fronteiras (check 5)');

// M7 nao-aplicavel quando nao ha processo
ok(medirVault({ vaultRoot: vaultSem, alias: 's', governanteRoot: matriz }).metricas.M7.status === 'nao-aplicavel',
  'M7 e nao-aplicavel sem `processo:` — nunca falha por ausencia de heranca');

// nunca lanca
ok(medirVault({ vaultRoot: path.join(raiz, 'nao-existe'), alias: 'x' }).erro, 'vault inexistente devolve erro, nunca excecao');
ok(medirVault({}).erro, 'chamada sem argumento devolve erro, nunca excecao');

fs.rmSync(raiz, { recursive: true, force: true });

console.log(`\n${okCount} ok, ${failCount} falha(s)\n`);
process.exit(failCount ? 1 : 0);
