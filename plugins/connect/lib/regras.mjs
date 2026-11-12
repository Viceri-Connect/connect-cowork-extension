// connect/lib/regras.mjs
// FONTE UNICA das regras duras da sessao.
//
// Por que existe como modulo proprio (`canal-injetado-governado`):
//   Ate a 0.14.x este texto era const dentro de `render.mjs`, porque so o bloco
//   injetado pelo hook precisava dele. A decisao do canal injetado poe as MESMAS regras dentro do
//   `{vault}/CLAUDE.md` — o arquivo de governanca que o harness carrega sozinho da
//   raiz de pasta conectada, no slot de maior precedencia do contexto.
//
//   Dois consumidores, um texto. Se cada um carregar a sua copia, a primeira edicao
//   os separa em silencio — e sao regras que o agente le como nao-negociaveis, vindo
//   de dois canais que passariam a discordar. E o modo de falha de `ponteiro-tipado`/`path-por-maquina` aplicado
//   ao proprio mecanismo.
//
// Estas regras ficam SEMPRE no canal injetado (nunca so em arquivo a abrir), porque
// sao o unico conteudo cuja ausencia produz DANO em vez de ignorancia: um agente sem
// a carta navega mal e sabe disso; um agente sem estas regras contorna e nao sabe.
//
// Zero dependencias externas.

// ---------------------------------------------------------------------------
// REGRAS_DURAS — as invariantes que o agente nao pode violar nem por engano.
// Numeradas no texto porque sao referenciadas por numero em skill e em prosa.
// ---------------------------------------------------------------------------
export const REGRAS_DURAS = [
  '1. Referencie conhecimento por caminho relativo ao workspace — nunca por caminho absoluto de maquina.',
  '2. Mount da junction da o caminho estavel; ele NAO concede leitura. Se um caminho declarado nao abrir, PECA a concessao ao operador — varredura, `grep` exploratorio e automacao de SO sao contorno, nao alternativa.',
  '3. `resolver` e para conceito com casa FORA da matriz — sub-vault (cliente, tribo, area com acervo) ou diretorio de entrega (Delivery Hub). Projeto, nota ou entidade que mora na matriz ou num vault ja montado: carta de navegacao + wikilink, lazy. Nunca comece por glob/grep.',
  '4. Dentro de um vault, navegue na ordem: carta de navegacao -> ponto de pouso declarado -> ponteiro declarado. Varredura e ultimo recurso e DEIXA MARCA (reporte).',
  '5. Antes de criar ou editar arquivo em qualquer vault, carregue o protocolo de escrita (`cnct-nucleo-escrita`). Nao pule, mesmo com destino obvio.',
];

// ---------------------------------------------------------------------------
// Terceiro consumidor (0.41.0): regra SEMPRE ATIVA do Antigravity (`rules/AGENTS.md`
// no pacote). O SessionStart do Antigravity roda uma vez por conversa, sem resume nem
// compact: numa conversa longa as regras injetadas no inicio ficam distantes. A regra
// sempre ativa entra em toda conversa com o plugin ligado. Gerada daqui por
// scripts/gerar-regras.mjs; o teste de arquitetura exige o arquivo em sincronia.
// ---------------------------------------------------------------------------
export const ARQUIVO_REGRAS_SEMPRE_ATIVAS = 'rules/AGENTS.md';

export function textoRegrasSempreAtivas() {
  return [
    '# Connect — regras duras (sempre ativas)',
    '',
    '<!-- Gerado de plugins/connect/lib/regras.mjs por scripts/gerar-regras.mjs. Nao edite aqui. -->',
    '',
    'Valem em toda conversa com o plugin Connect ativo, inclusive quando o contexto injetado no',
    'inicio da sessao ja ficou distante. Sao nao negociaveis.',
    '',
    ...REGRAS_DURAS,
    '',
    'Contexto distante, ou carta de navegacao inalcancavel: chame a tool `iniciar_sessao` do Connect.',
    '',
  ].join('\n');
}
