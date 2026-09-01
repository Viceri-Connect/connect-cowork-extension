// connect/lib/regras.mjs
// FONTE UNICA das regras duras da sessao.
//
// Por que existe como modulo proprio (ADR-18, Fase 2 do plano):
//   Ate a 0.14.x este texto era const dentro de `render.mjs`, porque so o bloco
//   injetado pelo hook precisava dele. A ADR-18 poe as MESMAS regras dentro do
//   `{vault}/CLAUDE.md` — o arquivo de governanca que o harness carrega sozinho da
//   raiz de pasta conectada, no slot de maior precedencia do contexto.
//
//   Dois consumidores, um texto. Se cada um carregar a sua copia, a primeira edicao
//   os separa em silencio — e sao regras que o agente le como nao-negociaveis, vindo
//   de dois canais que passariam a discordar. E o modo de falha do D34/D35 aplicado
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
  '3. Ao nomear um conceito (projeto, cliente, area, tribo), chame `resolver` ANTES de procurar qualquer coisa. Nunca comece por glob/grep.',
  '4. Dentro de um vault, navegue na ordem: carta de navegacao -> ponto de pouso declarado -> ponteiro declarado. Varredura e ultimo recurso e DEIXA MARCA (reporte).',
  '5. Antes de criar ou editar arquivo em qualquer vault, carregue o protocolo de escrita (`cnct-nucleo-escrita`). Nao pule, mesmo com destino obvio.',
];
