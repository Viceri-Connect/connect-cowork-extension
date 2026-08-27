// connect/lib/entrega.mjs
// Contrato de ENTREGA DE CONTEXTO — quando um bloco verbatim (protocolo do
// mecanismo, carta de navegacao, vault-config, hot cache do operador) vai inteiro
// no payload e quando vira marcador.
//
// Historia curta, porque ela e a decisao:
//   O desenho ate a 0.12.2 elidia o bloco do `structuredContent` SEMPRE, apostando
//   que o `content.text` da mesma resposta entregaria o texto verbatim. Medido em
//   23/08, duas vezes, em sessao recem-iniciada: esse bloco de texto NAO alcanca o
//   cliente Cowork. O agente recebia o marcador e nada mais — e a carta de navegacao
//   tinha de ser aberta a mao em toda sessao, devolvendo ao agente exatamente o
//   trabalho que o D98 tirou dele e deu ao vault.
//
//   A troca: elidir deixa de ser por CHAMADA e passa a ser por SESSAO, com hash do
//   conteudo. A primeira entrega de cada bloco vai inteira; da segunda em diante vira
//   marcador. A economia da ADR-6 e preservada — o que ela nunca pediu foi economizar
//   a PRIMEIRA entrega.
//
// Zero dependencias externas.

import crypto from 'node:crypto';

const hashBloco = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);

// ---------------------------------------------------------------------------
// criarEntrega — um registro de entrega por processo (= por sessao do servidor MCP).
// Fabrica em vez de estado global de modulo para o teste conseguir isolar sessoes.
// ---------------------------------------------------------------------------
export function criarEntrega() {
  const entregues = new Set();

  const trate = (valor) => {
    if (typeof valor !== 'string' || !valor.trim()) return valor;
    const h = hashBloco(valor);
    if (entregues.has(h)) return `<ja entregue nesta sessao (bloco ${h}) — nao repetido para economizar token>`;
    entregues.add(h);
    return valor;
  };

  // Copia rasa em cada nivel tocado — nunca mutila o objeto do chamador.
  const dedup = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    const out = { ...obj };
    if (out.protocoloMecanismo) out.protocoloMecanismo = trate(out.protocoloMecanismo);
    for (const k of ['l1', 'l1Pessoal']) {
      if (out[k] && typeof out[k] === 'object') {
        out[k] = { ...out[k] };
        if (out[k].carta?.inline) out[k].carta = { ...out[k].carta, inline: trate(out[k].carta.inline) };
        // `vaultConfigInline` NUNCA vai inteiro (corte de 26/08). Diferente da carta
        // e do hot cache, nenhum renderizador o consome: o `render.mjs` monta a secao
        // de identidade a partir de `identidadeVault`, que e o mesmo frontmatter ja
        // parseado. O inline era ~400 tokens de arquivo integral atravessando para o
        // agente sem leitor — e a propria carta ja manda ler `[[vault-config]]` como
        // passo 2 da ordem de entrada, se o resto fizer falta.
        if (out[k].vaultConfigInline) out[k].vaultConfigInline = '<vault-config nao inline — identidade ja em `identidadeVault`; para o resto, ler `_cerebro/vault-config.md` do vault>';
        if (out[k].hotCacheInline) out[k].hotCacheInline = trate(out[k].hotCacheInline);
      }
    }
    return out;
  };

  return { dedup, jaEntregue: (s) => entregues.has(hashBloco(s)), tamanho: () => entregues.size };
}

// Registro default do processo — e o que o servidor MCP usa.
export const entregaDaSessao = criarEntrega();
