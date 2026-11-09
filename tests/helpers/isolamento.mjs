// tests/helpers/isolamento.mjs
// Ambiente isolado para rodar codigo do Connect sem tocar a maquina de quem testa.
//
// O Connect le e escreve em CONNECT_HOME (default: ~/Connect), monta vaults e resolve
// caminhos a partir do perfil do usuario. Rodar teste contra o perfil real mistura
// estado de operador com estado de teste. Aqui o perfil inteiro e um diretorio
// temporario descartavel: HOME/USERPROFILE/CONNECT_HOME apontam para ele, e as
// variaveis CONNECT_* que apontariam para vaults reais sao removidas.
//
// `base`: onde nasce o sandbox. O default (tmpdir do SO) cai em AppData no Windows, e o
// Connect RECUSA home em AppData (destino de junction que o harness nega) — quem
// exercita a resolucao de home passa uma base fora de AppData.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function criarSandbox(prefixo = 'connect-test-', base = os.tmpdir()) {
  fs.mkdirSync(base, { recursive: true });
  const raiz = fs.mkdtempSync(path.join(base, prefixo));
  const home = path.join(raiz, 'home');
  fs.mkdirSync(home, { recursive: true });

  const env = { ...process.env };
  for (const k of Object.keys(env)) if (k.startsWith('CONNECT_')) delete env[k];
  env.HOME = home;
  env.USERPROFILE = home;
  env.CONNECT_HOME = path.join(home, 'Connect');
  env.NO_COLOR = '1';

  return {
    raiz,
    home,
    env,
    limpar() { fs.rmSync(raiz, { recursive: true, force: true, maxRetries: 3 }); },
  };
}

// Semeia o runtime portatil no CONNECT_HOME do sandbox com o Node que roda os testes.
// Sem isso, todo spike que sobe o MCP pelo launcher (run-node.bat/.sh) baixa ~70 MB de
// nodejs.org a cada execucao — o sandbox nasce vazio — e estoura o timeout em rede lenta
// (medido em 09/11: download parado em 47 MB, spike de multiplataforma vermelho).
// Hard link, nunca copia: se o link nao for possivel (outro volume), nao semeia e o
// launcher segue o caminho normal de download. O provisionamento em si e coberto por
// runtime-fora-do-pacote.spike.mjs, que nao usa esta semente.
export function semearRuntime(sandbox) {
  const bin = path.join(sandbox.env.CONNECT_HOME, 'bin');
  const destino = path.join(bin, process.platform === 'win32' ? 'node.exe' : 'node');
  try {
    fs.mkdirSync(bin, { recursive: true });
    if (!fs.existsSync(destino)) fs.linkSync(process.execPath, destino);
    return true;
  } catch {
    return false;
  }
}