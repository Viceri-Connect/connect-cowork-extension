#!/usr/bin/env node
// connect/mcp/connect-mcp.mjs
// Servidor MCP do Connect — transporte stdio, JSON-RPC 2.0 delimitado por linha.
// Zero dependencias externas (Node embarcado, sem npm install).
//
// Superficie (decisao 2026-08-14 — sem entidade "cliente"):
//   - iniciar_sessao           : bootstrap da sessao (scaffold + matriz + identidade + L1)
//   - resolver                 : casa um CONCEITO no registro derivado; nunca guarda path
//   - registrar_subvault_local : grava o path LOCAL de um conceito (por-maquina, D35)
//   - resolver_repo            : caminho local de um repo de codigo (P64; nunca monta junction)
//   - registrar_repo_local     : grava o path LOCAL de um repo (substitui o repos.md do vault)
//   - listar_repos             : tabela local de repos, para conferencia do operador
//   - mount_junction           : primitivo de mount (base do resolver)
//   - unmount_junction         : remove um atalho
//   - list_mounts              : auditoria dos atalhos do workspace
//
// IMPORTANTE: stdout e reservado para o protocolo. Todo log vai para stderr.

import readline from 'node:readline';
import { readFileSync } from 'node:fs';
import { mount, unmount, listMounts } from '../lib/mount.mjs';
import { iniciarSessao, gravarConfig, estadoSessao, registrarSubVaultLocal } from '../lib/session.mjs';
import { resolver } from '../lib/resolver.mjs';
import { renderContexto, renderResolucao } from '../lib/render.mjs';
import { resolverRepo, registrarRepoLocal, listarRepos } from '../lib/repos.mjs';
import { publicarGovernanca } from '../lib/governanca.mjs';

const log = (...a) => process.stderr.write(`[connect-mcp] ${a.join(' ')}\n`);

// Versao do servidor: DERIVADA do plugin.json, nunca hardcoded (fecha metade da P74).
// Estava fixa em '0.13.0' e ficou para tras no bump da 0.14.0 — exatamente o defeito que
// a P74 descreve: o servidor nao sabe a versao do disco, e o operador nao tem como saber
// que a sessao esta servindo codigo de outra versao. Se a leitura falhar, 'desconhecida'
// e resposta honesta; numero errado nao e.
function versaoDoPacote() {
  try {
    const p = new URL('../.claude-plugin/plugin.json', import.meta.url);
    return JSON.parse(readFileSync(p, 'utf8')).version || 'desconhecida';
  } catch {
    return 'desconhecida';
  }
}

const SERVER_INFO = { name: 'connect', version: versaoDoPacote() };
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
    name: 'resolver',
    description:
      'Resolve um CONCEITO numa entidade do registro derivado (varredura de manifestos — ' +
      'frontmatter `tipo` do cerebro pessoal e da matriz; contrato em config/contrato-manifesto.md). ' +
      'O manifesto NUNCA guarda path/url (D35) — so declara `externo` (tem acervo fora da matriz?) e ' +
      '`criado-por`/`criado-em` (ja foi materializado?); o proprio `conceito` (chave de casamento) ' +
      'tambem indexa o path local. O path fica so em connect.config.json (subVaults). Nunca pergunta ' +
      'nada nem advinha path — devolve `status` pra ' +
      'skill decidir: sem-acervo-externo, pendente-criacao (aciona fabrica), local-nao-configurado ' +
      '(pergunte o diretorio e grave com registrar_subvault_local), origem-ausente, ou resolvido ' +
      '(monta, injeta a CARTA DE NAVEGACAO do sub-vault verbatim e devolve ' +
      '`entradaResolvida.caminhoRelativo` — o ponto de pouso ja resolvido a caminho real, ' +
      'nunca nome de nota a caçar).',
    inputSchema: {
      type: 'object',
      properties: {
        conceito: { type: 'string', description: 'Conceito ou gatilho a resolver (ex.: "gestao-financeira", "pensao").' },
        workspace_dir: { type: 'string', description: 'Diretorio de trabalho da sessao (estado_sessao.workspace).' },
        alias: { type: 'string', description: 'Sobrescreve o alias declarado no registro (opcional).' },
        replace: { type: 'boolean', description: 'Se true, substitui um alias existente que aponte para outro destino.', default: false },
      },
      required: ['conceito', 'workspace_dir'],
    },
  },
  {
    name: 'registrar_subvault_local',
    description:
      'Grava, em connect.config.json (subVaults), o diretorio LOCAL (nesta maquina) onde um ' +
      '`conceito` mora. Nunca vai pro vault — e por-operador, por-maquina (D35). Use depois que o ' +
      '`resolver` devolver "local-nao-configurado" (pergunte o caminho ao operador antes de chamar) ' +
      'ou quando uma fabrica acabou de materializar um sub-vault e ja sabe o path.',
    inputSchema: {
      type: 'object',
      properties: {
        conceito: { type: 'string', description: 'Conceito devolvido pelo resolver (ver status local-nao-configurado).' },
        caminho: { type: 'string', description: 'Diretorio absoluto, nesta maquina, onde o acervo mora.' },
        home: { type: 'string', description: 'Pasta fixa do Connect. Opcional; default por SO.' },
      },
      required: ['conceito', 'caminho'],
    },
  },
  {
    name: 'publicar_governanca',
    description:
      'Materializa `{vault}/CLAUDE.md` — o arquivo de GOVERNANCA na raiz de um vault de ' +
      'conhecimento (ADR-18): declara que o acervo e governado, carrega as regras duras e APONTA ' +
      'para `_cerebro/camada-1.md`. Nao copia o conteudo da carta. O harness carrega esse arquivo ' +
      'sozinho da raiz de pasta conectada e o rotula como *override* — e o slot de maior ' +
      'precedencia do contexto, e sem isto ele fica sob autoria nao governada (D222/P145). ' +
      'WRITE-ONCE: republicar sem mudanca devolve "inalterado" e NAO toca o arquivo (e o que ' +
      'impede a copia de conflito em vault sincronizado — P144). RECUSA sobrescrever CLAUDE.md ' +
      'sem marcador do Connect, sempre: pode ser Camada 0 de operador, sonda ou conteudo de ' +
      'terceiro. Use na cnct-fabrica-navegacao, depois de materializar a carta. NUNCA escrever ' +
      'esse arquivo a mao — o marcador CNCT-GOV e gerado aqui.',
    inputSchema: {
      type: 'object',
      properties: {
        vault_dir: { type: 'string', description: 'Diretorio absoluto da raiz do vault de conhecimento. Nunca o perfil do operador (la CLAUDE.md e a Camada 0).' },
        vault: { type: 'string', description: 'Nome/conceito do vault, usado no marcador (ex.: "Tribo Impulsa").' },
        nome_exibicao: { type: 'string', description: 'Titulo legivel do vault no arquivo (opcional; default = vault).' },
      },
      required: ['vault_dir', 'vault'],
    },
  },
  {
    name: 'resolver_repo',
    description:
      'Resolve o CAMINHO LOCAL de um repositorio de codigo declarado (analogo do `resolver`, para ' +
      'codigo — P64). Repo NAO e montado como junction: devolve o caminho real da maquina para o ' +
      'agente pedir acesso ao Cowork / usar como cwd. Path mora so em connect.config.json (tabela ' +
      '`repos`), nunca no vault (D35). Nunca advinha: status "local-nao-configurado" significa ' +
      'PERGUNTE ao operador (ou ofereca clonar) e grave com registrar_repo_local — jamais procurar ' +
      'o repo por varredura de disco.',
    inputSchema: {
      type: 'object',
      properties: {
        conceito: { type: 'string', description: 'Nome/conceito do repo (ex.: "connect-site", "connect").' },
      },
      required: ['conceito'],
    },
  },
  {
    name: 'registrar_repo_local',
    description:
      'Grava, em connect.config.json (tabela `repos`), o diretorio LOCAL onde um repositorio de ' +
      'codigo mora nesta maquina. Use depois de `resolver_repo` devolver "local-nao-configurado" ' +
      '(tendo perguntado ao operador) ou apos um clone conduzido na sessao. Substitui o antigo ' +
      '`repos.md` no vault pessoal — path e por-maquina, nunca conteudo de vault (D35).',
    inputSchema: {
      type: 'object',
      properties: {
        conceito: { type: 'string', description: 'Nome/conceito do repo (chave estavel).' },
        caminho: { type: 'string', description: 'Diretorio absoluto da raiz do repo nesta maquina.' },
        home: { type: 'string', description: 'Pasta fixa do Connect. Opcional; default por SO.' },
      },
      required: ['conceito', 'caminho'],
    },
  },
  {
    name: 'listar_repos',
    description: 'Lista a tabela local de repositorios (conceito, caminho, existe, tem .git) para o operador conferir ou curar.',
    inputSchema: { type: 'object', properties: {} },
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

// Contrato de entrega de contexto (0.13.0 — fecha o lado B da P74). A regra e o
// rationale vivem em lib/entrega.mjs; aqui o servidor so usa o registro do processo.
import { entregaDaSessao } from '../lib/entrega.mjs';
const dedupInline = (obj) => entregaDaSessao.dedup(obj);

function handleToolCall(id, params) {
  const name = params?.name;
  const args = params?.arguments || {};
  try {
    switch (name) {
      case 'iniciar_sessao': {
        const report = iniciarSessao({ sessionId: args.session_id });
        // Bloco legivel + relatorio estruturado com os textos longos INTEIROS na
        // primeira entrega da sessao (ver dedupInline — o canal de texto nao chega
        // ao cliente Cowork, medido em 23/08).
        ok(id, { content: [{ type: 'text', text: renderContexto(report) }], structuredContent: dedupInline(report) });
        return;
      }
      case 'estado_sessao':
        return ok(id, toolText(estadoSessao({ sessionId: args.session_id })));
      case 'resolver': {
        const r = resolver({ conceito: args.conceito, workspaceDir: args.workspace_dir, alias: args.alias, replace: !!args.replace });
        // Quando resolve, devolve TAMBEM o bloco de contexto do sub-vault (carta
        // de navegacao verbatim + ponto de pouso). Sem isso o agente ganharia um
        // mount e nenhuma orientacao — o defeito que o contrato-navegacao fecha.
        // Sem duplicar: o TEXTO leva a carta verbatim; o JSON estruturado vai em
        // structuredContent com o `inline` elidido (ele ja esta no texto). Mandar
        // os dois inteiros paga a carta duas vezes em token — contradiz a ADR-6,
        // que e a propria justificativa do desenho lazy.
        const bloco = renderResolucao(r);
        const structured = bloco ? dedupInline(r) : r;
        const text = bloco || JSON.stringify(r, null, 2);
        return ok(id, { content: [{ type: 'text', text }], structuredContent: structured });
      }
      case 'registrar_subvault_local':
        return ok(id, toolText(registrarSubVaultLocal({ conceito: args.conceito, caminho: args.caminho, home: args.home })));
      case 'configurar':
        return ok(id, toolText(gravarConfig({ vaultMatriz: args.vault_matriz, cerebroPessoal: args.cerebro_pessoal, home: args.home })));
      case 'publicar_governanca':
        return ok(id, toolText(publicarGovernanca(args.vault_dir, { vault: args.vault, nomeExibicao: args.nome_exibicao })));
      case 'resolver_repo':
        return ok(id, toolText(resolverRepo({ conceito: args.conceito })));
      case 'registrar_repo_local':
        return ok(id, toolText(registrarRepoLocal({ conceito: args.conceito, caminho: args.caminho, home: args.home })));
      case 'listar_repos':
        return ok(id, toolText(listarRepos()));
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
