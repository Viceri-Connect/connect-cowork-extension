#!/usr/bin/env node
// tests/spike-navegacao.mjs
// Spike do CONTRATO DE NAVEGACAO (o interior do vault) — 0.12.0.
//
// Premissas que este spike mata:
//   1. A camada 1 e DECLARADA pelo vault (carta), nunca prescrita pelo produto:
//      vault sem carta devolve LACUNA, e nao um conjunto de ponteiros inventado.
//   2. Carta legada (`_cerebro/CLAUDE.md`) e lida como compatibilidade, marcada
//      como 'legado', sem alterar arquivo nenhum.
//   3. Carta incompleta e detectada por secao faltante (com sinonimos aceitos).
//   4. `entrada` do manifesto resolve a CAMINHO real; nome puro resolve por
//      convencao ou busca, e a busca DEIXA MARCA (aviso).
//   5. `entrada` inexistente nao vira tateio: devolve 'ausente'.
//   6. Ambiguidade nao e resolvida por ordem de travessia: devolve 'ambigua'.
//   7. A carta entra no bloco de sessao VERBATIM (render), e a lacuna tambem.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lerCarta, validarCarta, resolverEntrada, SECOES_OBRIGATORIAS } from '../plugins/connect/lib/navegacao.mjs';
import { montarL1 } from '../plugins/connect/lib/matriz.mjs';
import { blocoCarta } from '../plugins/connect/lib/render.mjs';

let passou = 0, falhou = 0;
const ok = (cond, nome) => {
  if (cond) { passou++; console.log(`  ok   ${nome}`); }
  else { falhou++; console.log(`  FALHA ${nome}`); }
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-nav-'));
const mk = (rel, txt) => {
  const p = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, txt, 'utf8');
  return p;
};

console.log(`\nspike-navegacao — sandbox: ${tmp}\n`);

// --- vault A: sem carta nenhuma -------------------------------------------
const vaultA = path.join(tmp, 'vault-sem-carta');
fs.mkdirSync(path.join(vaultA, '_cerebro'), { recursive: true });
mk('vault-sem-carta/_cerebro/vault-config.md', '---\nplugin: dois-cerebros\n---\n\n- empresa: Empresa X\n');

const cartaA = lerCarta(vaultA, 'a');
ok(cartaA.presente === false, 'vault sem carta: presente=false');
ok(cartaA.avisos.some((a) => a.includes('cnct-fabrica-navegacao')), 'vault sem carta: aviso oferece a fabrica');
const l1A = montarL1(vaultA, 'a');
ok(!('ponteiros' in l1A), 'montarL1 nao emite mais ponteiros prescritos pelo produto');
ok(l1A.carta && l1A.carta.presente === false, 'montarL1 devolve a lacuna da carta');
ok(l1A.identidadeVault.empresa === 'Empresa X', 'montarL1 ainda le a identidade do vault');
const blocoA = blocoCarta(l1A.carta, 'a').join('\n');
ok(/Lacuna de navegacao/.test(blocoA), 'render anuncia a lacuna no bloco de sessao');
ok(!/modelo-roteamento|organizacao/.test(blocoA), 'render nao sugere eixo de conteudo por conta propria (D98)');

// --- vault B: carta canonica completa -------------------------------------
const vaultB = path.join(tmp, 'vault-completo');
const cartaCompleta = `---
tipo-artefato: camada-1
vault: Acervo B
---

# Camada 1 — Acervo B

## O que é este vault
Acervo da tribo-b.

## Estrutura
- \`projetos/\` — uma nota por projeto

## Ordem de entrada
1. \`projetos/p1/p1.md\`

## Quando carregar
| Gatilho | Arquivo |
|---|---|
| decisao de arquitetura | \`projetos/p1/adr/adr-p1.md\` |

## Fronteiras
- governanca → conceito \`matriz\`
`;
mk('vault-completo/_cerebro/camada-1.md', cartaCompleta);
mk('vault-completo/projetos/p1/p1.md', '# P1\n');

const cartaB = lerCarta(vaultB, 'b');
ok(cartaB.presente && cartaB.origem === 'canonica', 'carta canonica lida com origem=canonica');
ok(cartaB.validacao.ok, 'carta completa passa na validacao (5 secoes)');
ok(cartaB.caminhoRelativo === './b/_cerebro/camada-1.md', 'caminho da carta e relativo ao alias');
ok(cartaB.inline.includes('## Quando carregar'), 'conteudo da carta vem inline (injecao verbatim)');
const blocoB = blocoCarta(cartaB, 'b').join('\n');
ok(blocoB.includes('## Fronteiras'), 'render injeta a carta verbatim');

// --- vault C: carta legada (CLAUDE.md), incompleta -------------------------
const vaultC = path.join(tmp, 'vault-legado');
mk('vault-legado/_cerebro/CLAUDE.md', `# Contexto Coletivo

## O que é este vault
Coletivo maduro anterior ao Connect.

## Estrutura do Vault
- \`produtos/\` — hub por sistema

## Protocolo de Carregamento em Camadas

### Processo — Quando Carregar
| Contexto | Arquivo |
|---|---|
| gate do cliente | \`cliente/normas/x.md\` |
`);
const cartaC = lerCarta(vaultC, 'c');
ok(cartaC.presente && cartaC.origem === 'legado', 'carta legada (CLAUDE.md) e lida como compatibilidade');
ok(cartaC.avisos.some((a) => a.includes('migracao pendente')), 'carta legada avisa migracao pendente');
ok(cartaC.avisos.some((a) => a.includes('nenhum arquivo foi alterado')), 'carta legada declara que nada foi alterado');
ok(cartaC.validacao.presentes.includes('quando carregar'), 'H3 e sinonimo contam como resposta (quando carregar)');
ok(cartaC.validacao.presentes.includes('estrutura'), '"Estrutura do Vault" satisfaz a exigencia estrutura');
ok(cartaC.validacao.faltando.includes('ordem de entrada') && cartaC.validacao.faltando.includes('fronteiras'),
  'carta legada acusa as duas lacunas reais (ordem de entrada, fronteiras)');
ok(fs.readFileSync(path.join(vaultC, '_cerebro', 'CLAUDE.md'), 'utf8').startsWith('# Contexto Coletivo'),
  'vault legado permanece intocado depois da leitura');

// --- validacao de peso ----------------------------------------------------
const gorda = ['# x', ...Array.from({ length: 300 }, (_, i) => `linha ${i}`)].join('\n');
ok(validarCarta(gorda).avisos.some((a) => a.includes('indice virando conteudo')), 'carta acima de 250 linhas gera aviso de peso');
ok(SECOES_OBRIGATORIAS.length === 5, 'contrato exige 5 secoes');

// --- entrada: caminho declarado ------------------------------------------
const e1 = resolverEntrada(vaultB, 'projetos/p1/p1.md', 'b');
ok(e1.status === 'resolvida' && e1.origem === 'declarado', 'entrada como caminho .md resolve como declarada');
ok(e1.caminhoRelativo === './b/projetos/p1/p1.md', 'entrada devolve caminho relativo ao alias');
ok(e1.avisos.length === 0, 'entrada declarada nao gera aviso');

const e2 = resolverEntrada(vaultB, 'projetos/p1/p1', 'b');
ok(e2.status === 'resolvida', 'entrada sem extensao resolve');

// --- entrada: nome puro (legado) resolve por busca E DEIXA MARCA ----------
mk('vault-completo/projetos/p2/hub-p2.md', '# hub\n');
const e3 = resolverEntrada(vaultB, 'hub-p2', 'b');
ok(e3.status === 'resolvida' && e3.origem === 'busca', 'nome puro resolve por busca');
ok(e3.avisos.some((a) => a.includes('BUSCA')), 'busca deixa marca (aviso explicito)');

// --- entrada inexistente: nao tateia -------------------------------------
const e4 = resolverEntrada(vaultB, 'nao-existe-em-lugar-nenhum', 'b');
ok(e4.status === 'ausente', 'entrada inexistente devolve ausente (sem tateio)');

// --- entrada ambigua: nunca escolhe por ordem de travessia ---------------
mk('vault-completo/projetos/p3/dupla.md', '# a\n');
mk('vault-completo/projetos/p4/dupla.md', '# b\n');
const e5 = resolverEntrada(vaultB, 'dupla', 'b');
ok(e5.status === 'ambigua' && e5.candidatos.length === 2, 'entrada ambigua e reportada, nao escolhida');

// --- REGRESSOES DA REVISAO 0.12.0 ----------------------------------------

// traversal: `entrada` vem de frontmatter (semi-confiavel) e o resultado e "abra
// isto primeiro". Sair do acervo tem de ser RECUSA explicita, nao aviso.
mk('secret/senhas.md', '# segredo\n');
const t1 = resolverEntrada(vaultB, '../secret/senhas.md', 'b');
ok(t1.status === 'recusada', 'entrada com ".." e recusada (nao sai do acervo)');
ok(!t1.caminho, 'entrada recusada nao devolve caminho');
ok(resolverEntrada(vaultB, 'a/../../secret/senhas.md', 'b').status === 'recusada', 'traversal no meio do caminho tambem e recusado');
ok(resolverEntrada(vaultB, '/etc/passwd', 'b').status === 'recusada', 'caminho absoluto e recusado');

// busca fiel: quando a entrada DECLARA caminho, o hit precisa terminar com ele —
// senao pousa na nota homonima do lugar errado (cliente errado, projeto errado).
mk('vault-completo/clientes/acme/estado.md', '# acme\n');
mk('vault-completo/clientes/outro/estado.md', '# outro\n');
const t2 = resolverEntrada(vaultB, 'clientes/acme/estado.md', 'b');
ok(t2.status === 'resolvida' && t2.caminho === 'clientes/acme/estado.md', 'caminho declarado exato resolve nele mesmo');
const t3 = resolverEntrada(vaultB, 'clientes/fantasma/estado.md', 'b');
ok(t3.status === 'ausente', 'caminho declarado inexistente NAO cai na nota homonima de outra pasta');
const t4 = resolverEntrada(vaultB, 'Clientes/Acme/Estado.md', 'b');
ok(t4.status === 'resolvida' && t4.caminho === 'clientes/acme/estado.md', 'caixa divergente resolve igual (mesmo comportamento em Linux e Windows)');

// validacao estrita: substring solta deixava carta sem nenhuma resposta passar.
const falsoPositivo = ['## Infraestrutura', '## Gatilhos de escrita', '## Sobre o time', '## Ordem alfabetica', '## Fronteira de responsabilidade'].join('\n\n');
const v = validarCarta(falsoPositivo);
ok(!v.ok, 'carta com titulos parecidos NAO passa (sem falso positivo de substring)');
ok(v.faltando.includes('estrutura'), '"Infraestrutura" nao satisfaz a exigencia estrutura');
ok(v.faltando.includes('quando carregar'), '"Gatilhos de escrita" nao satisfaz quando carregar');

// --- entrada nao declarada ------------------------------------------------
ok(resolverEntrada(vaultB, null, 'b').status === 'nao-declarada', 'sem entrada no manifesto: nao-declarada');

console.log(`\n${passou} ok, ${falhou} falha(s)\n`);
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
process.exit(falhou ? 1 : 0);
