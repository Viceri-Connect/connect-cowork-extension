#!/usr/bin/env node
// connect/mcp/connect-mcp.mjs
// Servidor MCP do Connect — transporte stdio, JSON-RPC 2.0 delimitado por linha.
// Zero dependencias externas (Node embarcado, sem npm install).
//
// Superficie (decisao 2026-08-14 — sem entidade "cliente"):
//   - iniciar_sessao   : bootstrap da sessao (scaffold + matriz + identidade + L1)
//   - mount_junction   : primitivo de mount (usado pelo `resolver`, em construcao)
//   - unmount_junction : remove um atalho
//   - list_mounts      : auditoria dos atalhos do workspace
//
// Roadmap: `resolver(conceito, alias?)` — entrega um sub-vault por conceito,
//   quando a tipologia de vaults (manifesto + molde da matriz) estiver definida.
//
// IMPORTANTE: stdout e reservado para o protocolo. Todo log vai para stderr.

import readline from 'node:readline';
import { mount, unmount, listMounts } from '../lib/mount.mjs';
import { iniciarSessao, gravarConfig, estadoSessao } from '../lib/session.mjs';
import { renderContexto } from '../lib/render.mjs';

const log = (...a) => process.stderr.write(`[connect-mcp] ${a.join(' ')}\n`);

const SERVER_INFO = { name: 'connect', version: '0.2.0' };
let protocolVersion = '2025-06-18';

const TOOLS = [
  {
    name: 'iniciar_sessao',
    description:
      'Inicia uma sessao do Connect: cria o scaffold da sessao fora do OneDrive, monta a matriz de ' +
      'contexto como atalho flat "./matriz", restaura a identidade do operador e carrega o contexto ' +
      'lazy da camada 1 da matriz. Chamado automaticamente pelo hook de SessionStart; pode ser ' +
      'chamado manualmente para reiniciar o contexto. Retorna um bloco markdown de contexto da sessao.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Identificador unico da sessao (nomeia o scaffold). Se ausente, um id e gerado.' },
      },
      required: [],
    },
  },
  {
    name: 'estado_sessao',
    description:
      'Checagem leve (sem montar nada): o Connect ja esta configurado (matriz definida e existente)? ' +
      'A sessao ja foi montada nesta janela? Use antes de iniciar_sessao para decidir se precisa ' +
      'configurar (1o uso), iniciar, ou apenas seguir. Nao tem efeito colateral.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Identificador da sessao (para checar se ja esta montada).' },
      },
      required: [],
    },
  },
  {
    name: 'configurar',
    description:
      'Grava os caminhos locais do Connect em connect.config.json (configuracao guiada do 1o uso). ' +
      'Atualizacao parcial: informe vault_matriz e/ou cerebro_pessoal; so grava os que existirem como ' +
      'diretorio, e reporta os invalidos para re-perguntar. Depois, chame iniciar_sessao.',
    inputSchema: {
      type: 'object',
      properties: {
        vault_matriz: { type: 'string', description: 'Caminho local da matriz (pasta que contem _cerebro/vault-config.md).' },
        cerebro_pessoal: { type: 'string', description: 'Caminho local do cerebro pessoal (identidade do operador).' },
        home: { type: 'string', description: 'Pasta fixa do Connect (fora do OneDrive). Opcional; default por SO.' },
      },
      required: [],
    },
  },
  {
    name: 'mount_junction',
    description:
      'Monta uma junction (Windows) ou symlink (POSIX) dentro do workspace da sessao, expondo um ' +
      'diretorio de origem como um alias flat. Primitivo de mount; a origem pode estar sincronizada ' +
      'com SharePoint/OneDrive. Nao concede acesso de leitura por si so.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_dir: { type: 'string', description: 'Diretorio de trabalho da sessao.' },
        alias: { type: 'string', description: 'Nome do atalho a criar (nome simples, sem separadores).' },
        source_dir: { type: 'string', description: 'Diretorio de origem a expor.' },
        replace: { type: 'boolean', description: 'Se true, substitui um alias existente que aponte para outro destino.', default: false },
      },
      required: ['workspace_dir', 'alias', 'source_dir'],
    },
  },
  {
    name: 'unmount_junction',
    description: 'Desmonta uma junction/symlink do workspace. Remove apenas o atalho — a origem nunca e apagada. Recusa remover diretorios reais.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_dir: { type: 'string', description: 'Diretorio de trabalho da sessao.' },
        alias: { type: 'string', description: 'Nome do atalho a remover.' },
      },
      required: ['workspace_dir', 'alias'],
    },
  },
  {
    name: 'list_mounts',
    description: 'Lista os aliases (junctions/symlinks) atualmente montados no workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_dir: { type: 'string', description: 'Diretorio de trabalho da sessao.' },
      },
      required: ['workspace_dir'],
    },
  },
];

function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }
function ok(id, result) { send({ jsonrpc: '2.0', id, result }); }
function fail(id, code, message) { send({ jsonrpc: '2.0', id, error: { code, message } }); }
function toolText(obj) {
  const text = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
  return { content: [{ type: 'text', text }] };
}

function handleToolCall(id, params) {
  const name = params?.name;
  const args = params?.arguments || {};
  try {
    switch (name) {
      case 'iniciar_sessao': {
        const report = iniciarSessao({ sessionId: args.session_id });
        // Devolve o bloco de contexto legivel + o relatorio estruturado.
        ok(id, { content: [{ type: 'text', text: renderContexto(report) }], structuredContent: report });
        return;
      }
      case 'estado_sessao':
        return ok(id, toolText(estadoSessao({ sessionId: args.session_id })));
      case 'configurar':
        return ok(id, toolText(gravarConfig({ vaultMatriz: args.vault_matriz, cerebroPessoal: args.cerebro_pessoal, home: args.home })));
      case 'mount_junction':
        return ok(id, toolText(mount({ workspaceDir: args.workspace_dir, alias: args.alias, source: args.source_dir, replace: !!args.replace })));
      case 'unmount_junction':
        return ok(id, toolText(unmount({ workspaceDir: args.workspace_dir, alias: args.alias })));
      case 'list_mounts':
        return ok(id, toolText(listMounts(args.workspace_dir)));
      default:
        return fail(id, -32602, `tool desconhecida: ${name}`);
    }
  } catch (e) {
    send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `ERRO: ${e.message || e}` }], isError: true } });
  }
}

function handle(msg) {
  const { id, method, params } = msg;
  if (method === undefined) return; // e uma resposta, ignorar
  switch (method) {
    case 'initialize':
      if (params?.protocolVersion) protocolVersion = params.protocolVersion;
      ok(id, { protocolVersion, capabilities: { tools: {} }, serverInfo: SERVER_INFO });
      break;
    case 'notifications/initialized':
      break;
    case 'ping':
      ok(id, {});
      break;
    case 'tools/list':
      ok(id, { tools: TOOLS });
      break;
    case 'tools/call':
      handleToolCall(id, params);
      break;
    default:
      if (id !== undefined) fail(id, -32601, `metodo nao suportado: ${method}`);
  }
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
  const s = line.trim();
  if (!s) return;
  let msg;
  try { msg = JSON.parse(s); } catch { log('JSON invalido ignorado:', s.slice(0, 120)); return; }
  try { handle(msg); } catch (e) { log('erro ao tratar mensagem:', e.message); }
});

log(`servidor pronto (stdio) — plataforma=${process.platform}`);
