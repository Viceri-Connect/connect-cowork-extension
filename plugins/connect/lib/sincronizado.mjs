// connect/lib/sincronizado.mjs
// Guarda de integridade do acervo: NUNCA montar um atalho (nem gravar estado de
// sessao) dentro de uma arvore sincronizada com nuvem, nem dentro de um vault.
//
// O incidente que fecha (medido em 17/09/2026, matriz real): uma resolucao de
// heranca rodou com `workspaceDir` = raiz da matriz, que e uma biblioteca
// SharePoint sincronizada. O mecanismo montou ali duas junctions de sub-vault e
// gravou `.connect/heranca.json`. O cliente OneDrive SEGUIU as junctions e
// materializou a arvore inteira dos vaults de origem DENTRO da biblioteca da
// matriz — duplicata na nuvem, indexada pela busca, aberta a edicao na copia
// errada (o modo de falha ja catalogado em `entregas-presas-em-copia-de-conflito`).
//
// A invariante: workspace de sessao e EFEMERO e mora fora de pasta sincronizada.
// Antes disso a intencao existia so em comentario (`heranca.mjs`: "nunca em
// vault"); comentario nao e trava, e o incidente e a prova.
//
// Zero dependencias externas.

import fs from 'node:fs';
import path from 'node:path';

// Marcador de SYNC ROOT do OneDrive/SharePoint: arquivo OCULTO cujo nome e um
// ponto seguido de GUID, depositado pelo cliente na raiz de cada biblioteca
// sincronizada. Observado nas tres bibliotecas da instancia real
// (`.849C9593-D756-4E56-8D6E-42412F2A707B`). E o sinal mais confiavel porque
// independe de nome de pasta, de tenant e de variavel de ambiente.
const RE_MARCADOR_SYNC_ROOT = /^\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Marcadores de diretorio de outros provedores de sincronizacao.
const MARCADORES_DIR = [
  { nome: '.dropbox', provedor: 'Dropbox' },
  { nome: '.dropbox.cache', provedor: 'Dropbox' },
  { nome: '.icloud', provedor: 'iCloud' },
];

// Segmentos de caminho que denunciam arvore sincronizada mesmo sem marcador
// (ex.: pasta recem-criada, marcador ainda nao escrito, ou perfil de outro SO).
const SEGMENTOS = [
  { re: /^OneDrive( - .+)?$/i, provedor: 'OneDrive/SharePoint' },
  { re: /^OneDrive-.+$/i, provedor: 'OneDrive/SharePoint' },
  { re: /^CloudStorage$/i, provedor: 'nuvem (macOS CloudStorage)' },
  { re: /^com~apple~CloudDocs$/i, provedor: 'iCloud Drive' },
  { re: /^Dropbox( .+)?$/i, provedor: 'Dropbox' },
  { re: /^Google ?Drive$/i, provedor: 'Google Drive' },
  { re: /^My Drive$/i, provedor: 'Google Drive' },
  { re: /^Box( Sync)?$/i, provedor: 'Box' },
  { re: /^Nextcloud$/i, provedor: 'Nextcloud' },
  { re: /^pCloudDrive$/i, provedor: 'pCloud' },
];

// Variaveis de ambiente que o cliente OneDrive publica. Cobrem a pasta pessoal;
// bibliotecas SharePoint (que foi o caso do incidente) caem no marcador acima.
const ENVS = ['OneDrive', 'OneDriveCommercial', 'OneDriveConsumer'];

function ancestrais(dir) {
  const out = [];
  let atual = path.resolve(dir);
  // Limite defensivo: caminho patologico nao vira laco infinito.
  for (let i = 0; i < 64; i += 1) {
    out.push(atual);
    const pai = path.dirname(atual);
    if (!pai || pai === atual) break;
    atual = pai;
  }
  return out;
}

function dentroDe(alvo, base) {
  if (!base) return false;
  const a = path.resolve(alvo);
  const b = path.resolve(base);
  return a === b || a.startsWith(b + path.sep);
}

function listarSeguro(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// detectarSincronizacao — o diretorio esta dentro de arvore sincronizada?
// Sobe a arvore ate a raiz. Devolve sempre objeto; nunca lanca.
// ---------------------------------------------------------------------------
export function detectarSincronizacao(dir) {
  const negativo = { sincronizado: false, provedor: null, motivo: null, raiz: null, evidencia: null };
  if (!dir) return negativo;

  const alvo = path.resolve(dir);

  for (const env of ENVS) {
    const base = process.env[env];
    if (base && dentroDe(alvo, base)) {
      return {
        sincronizado: true,
        provedor: 'OneDrive/SharePoint',
        motivo: `esta sob a pasta declarada em %${env}%`,
        raiz: path.resolve(base),
        evidencia: `${env}=${base}`,
      };
    }
  }

  for (const anc of ancestrais(alvo)) {
    const itens = listarSeguro(anc);

    const guid = itens.find((n) => RE_MARCADOR_SYNC_ROOT.test(n));
    if (guid) {
      return {
        sincronizado: true,
        provedor: 'OneDrive/SharePoint',
        motivo: 'ancestral e um sync root (marcador de biblioteca sincronizada)',
        raiz: anc,
        evidencia: path.join(anc, guid),
      };
    }

    for (const m of MARCADORES_DIR) {
      if (itens.includes(m.nome)) {
        return {
          sincronizado: true,
          provedor: m.provedor,
          motivo: 'ancestral carrega marcador de pasta sincronizada',
          raiz: anc,
          evidencia: path.join(anc, m.nome),
        };
      }
    }

    const base = path.basename(anc);
    const seg = SEGMENTOS.find((s) => s.re.test(base));
    if (seg) {
      return {
        sincronizado: true,
        provedor: seg.provedor,
        motivo: 'o caminho atravessa uma pasta de sincronizacao conhecida',
        raiz: anc,
        evidencia: anc,
      };
    }
  }

  return negativo;
}

// ---------------------------------------------------------------------------
// ehRaizDeVault — segunda rede, independente de nuvem: vault fora do OneDrive
// tambem nao e lugar de montar atalho nem de gravar estado de sessao.
// O sinal canonico e `_cerebro/` (casa da carta de navegacao, camada 1).
// ---------------------------------------------------------------------------
export function ehRaizDeVault(dir) {
  if (!dir) return false;
  try {
    const c = path.join(path.resolve(dir), '_cerebro');
    return fs.existsSync(c) && fs.statSync(c).isDirectory();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// assertDestinoDeMountSeguro — a trava. Lanca com mensagem que diz o que fazer.
// Chamada por `mount()` e pela gravacao do registro de heranca.
// ---------------------------------------------------------------------------
export function assertDestinoDeMountSeguro(workspaceDir, operacao = 'montar atalho') {
  const ws = path.resolve(workspaceDir);

  const sync = detectarSincronizacao(ws);
  if (sync.sincronizado) {
    throw new Error(
      `RECUSADO ${operacao} em "${ws}": o caminho esta dentro de uma arvore sincronizada ` +
      `(${sync.provedor}) — ${sync.motivo} (${sync.evidencia}). O cliente de sincronizacao segue ` +
      'o atalho e materializa a arvore de origem DENTRO da biblioteca de destino, duplicando o ' +
      'acervo na nuvem (incidente medido em 17/09/2026). ' +
      'Workspace de sessao e efemero e mora fora de pasta sincronizada — use o scaffold da ' +
      'sessao (CONNECT_HOME/sessions/<id>).'
    );
  }

  if (ehRaizDeVault(ws)) {
    throw new Error(
      `RECUSADO ${operacao} em "${ws}": o caminho e a raiz de um vault (tem "_cerebro/"). ` +
      'Vault e acervo, nao workspace: atalho e estado de sessao nunca moram dentro dele. ' +
      'Use o scaffold da sessao (CONNECT_HOME/sessions/<id>).'
    );
  }

  return ws;
}
