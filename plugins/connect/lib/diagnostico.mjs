// connect/lib/diagnostico.mjs
// Diagnostico DEVOLVIVEL: um arquivo que o operador leigo repassa ao time, sem terminal.
//
// Por que existe (P175, 14/10): o primeiro Mac real devolveu o defeito do catalogo por
// print de tela, e o operador nao roda comando. O `diagnostico` ja vinha na resposta
// da tool, mas resposta de tool o agente resume — e o resumo perde o dado que calibra.
// Gravar em arquivo da ao agente algo exato para apontar ("envie este arquivo").
//
// Conteudo: so o que a tool ja devolve (nomes de pasta, contagens, status). Nunca
// conteudo de arquivo, nunca credencial. O home do usuario vira `~`.
// Mora em {CONNECT_HOME}/diagnostico/ — fora do OneDrive, sobrescrito a cada gravacao
// (o ultimo e o que interessa). Nunca lanca: falha de gravacao devolve null.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function gravarDiagnostico({ home, nome, dados }) {
  if (!home || !nome) return null;
  try {
    const dir = path.join(home, 'diagnostico');
    fs.mkdirSync(dir, { recursive: true });
    const arquivo = path.join(dir, `${nome}.json`);
    const corpo = {
      gerado: new Date().toISOString(),
      plataforma: process.platform,
      versaoSO: os.release(),
      node: process.version,
      ...dados,
    };
    const h = os.homedir();
    const hJson = JSON.stringify(h).slice(1, -1); // no Windows as barras chegam escapadas
    const texto = JSON.stringify(corpo, null, 2).split(hJson).join('~').split(h).join('~');
    fs.writeFileSync(arquivo, texto, 'utf8');
    return arquivo;
  } catch {
    return null;
  }
}
