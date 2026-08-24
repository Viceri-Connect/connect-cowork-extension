// connect/lib/contexto-arquivo.mjs
// PRESENCA de contexto — materializa o bloco completo da sessao como arquivo no
// workspace, para o harness reler quando precisar, em vez de depender de uma
// injecao unica no stdout do hook.
//
// Historia curta, porque ela e a decisao:
//   O D150 (0.13.0) corrigiu a elisao do bloco verbatim: a primeira entrega passou
//   a ir inteira. O efeito colateral, medido em 24/08 na propria sessao de
//   dogfooding: o bloco cresceu para ~16 KB e o cliente NAO o injetou — truncou,
//   salvou num arquivo de log do hook e entregou ao agente um preview de 2 KB. O
//   agente teve de abrir o arquivo a mao para ter camada 0 e camada 1.
//
//   Ou seja: a correcao do D150 produziu o defeito seguinte, e o resultado pratico
//   foi a REVERSAO do D104 — a garantia voltou a depender de o agente escolher ler
//   um arquivo, que e exatamente o que o D104 existe para impedir.
//
//   A troca (emenda ao D104, nao violacao): o stdout carrega so o MINIMO ACIONAVEL
//   (concessao, estado zero, identidade, atalhos, regras duras, ponteiro) e o resto
//   e materializado aqui, num arquivo declarado, curto de alcancar e no workspace —
//   que o harness rele. Presenca sobrevive a sessao longa; injecao unica nao.
//
//   Por que isso so e possivel agora: o D149 tirou o CONNECT_HOME da pasta de
//   aplicativo. Antes da 0.13.0 o workspace era inalcancavel pelas file tools (P93),
//   e materializar contexto la seria escrever num lugar que o agente nao abre.
//
// Zero dependencias externas.

import fs from 'node:fs';
import path from 'node:path';
import { ensureDir } from './mount.mjs';

export const NOME_ARQUIVO_CONTEXTO = 'contexto-sessao.md';

// ---------------------------------------------------------------------------
// materializarContexto — grava o bloco completo no workspace da sessao.
//
// Nunca derruba a sessao: falha de escrita vira `{ status: 'falhou' }` e o
// chamador decide (o hook degrada para emitir o bloco inteiro no stdout, que e
// o comportamento <= 0.13.0 — pior, mas nunca ausencia de contexto).
// ---------------------------------------------------------------------------
export function materializarContexto({ workspace, bloco } = {}) {
  if (!workspace || typeof bloco !== 'string' || !bloco.trim()) {
    return { status: 'nao-aplicavel' };
  }

  const destino = path.join(workspace, NOME_ARQUIVO_CONTEXTO);
  try {
    ensureDir(workspace);
    // Escrita atomica (tmp + rename, mesmo volume): bloco truncado no meio da
    // escrita seria contexto pela metade — pior que contexto ausente, porque o
    // agente nao tem como saber que falta pedaco.
    const tmp = `${destino}.tmp`;
    fs.writeFileSync(tmp, bloco, 'utf8');
    fs.renameSync(tmp, destino);
  } catch (e) {
    return { status: 'falhou', caminho: destino, motivo: e.message };
  }

  return {
    status: 'materializado',
    caminho: destino,
    caminhoRelativo: `./${NOME_ARQUIVO_CONTEXTO}`,
    bytes: Buffer.byteLength(bloco, 'utf8'),
  };
}
