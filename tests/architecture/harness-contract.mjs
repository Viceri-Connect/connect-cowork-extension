// tests/architecture/harness-contract.mjs
// CONTRATO DE ARQUITETURA DOS HARNESSES — fonte unica do que cada host precisa ter.
//
// O Connect e UM mecanismo (lib/ + mcp/ + skills/) distribuido para varios hosts
// (Claude/Cowork, Codex, Antigravity, Copilot), em mais de uma variante de transporte
// (stdio, http). Cada host le arquivos proprios (manifesto, config de MCP, hook de
// SessionStart) e cada um desses arquivos pode divergir em silencio: o host instala,
// mas fica sem MCP, sem bootstrap de sessao ou com versao errada.
//
// Este arquivo DECLARA a forma esperada; `harness-checks.mjs` confere; o teste
// `harnesses.test.mjs` falha o build quando qualquer pacote x harness x feature diverge.
//
// Para adicionar um harness novo: declare-o em HARNESSES (todas as chaves). Para um
// pacote novo do marketplace: declare-o em PACOTES. Arquivo de harness sem dono aqui
// (ex.: um `.foo-plugin/` novo) tambem falha — nada entra no marketplace sem contrato.

export const SERVIDOR_MCP = 'connect';
export const ENTRADA_MCP = 'mcp/connect-mcp.mjs';
export const MARCADOR_BOOTSTRAP = 'Connect — sessao iniciada';
// Sessao na nuvem sem configuracao local (0.40.0, lib/bootstrap.mjs): todo hook orienta
// em vez de diagnosticar "1o uso". CONNECT_EXECUCAO=nuvem forca o caso sem depender do
// sinal do servidor.
export const MARCADOR_NUVEM = 'Connect — sessao na nuvem';
export const ENV_NUVEM = { CONNECT_EXECUCAO: 'nuvem' };

// Versao canonica: o manifesto Claude (amarrado ao CHANGELOG por tests/unit/release.test.mjs).
export const FONTE_VERSAO = 'plugins/connect/.claude-plugin/plugin.json';
// Conjunto canonico de skills: todo pacote entrega exatamente estas.
export const FONTE_SKILLS = 'plugins/connect/skills';

// Eventos de inicio de sessao que todo hook precisa cobrir (quando o host usa matcher).
export const EVENTOS_OBRIGATORIOS = ['startup', 'resume'];

export const VARIANTES = {
  stdio: { transporte: 'stdio' },
  http: { transporte: 'http', url: 'http://127.0.0.1:3737/mcp' },
};

export const PACOTES = {
  connect: { dir: 'plugins/connect', variante: 'stdio' },
  'connect-http': { dir: 'plugins/connect-http', variante: 'http', geradoPor: 'scripts/build-connect-http.mjs' },
};

// Marketplaces que listam os pacotes. `fonte(entry)` devolve o caminho relativo a raiz.
export const MARKETPLACES = [
  { nome: 'Claude / Cowork / Copilot', arquivo: '.claude-plugin/marketplace.json', fonte: (e) => e.source },
  { nome: 'Codex / Antigravity', arquivo: '.agents/plugins/marketplace.json', fonte: (e) => e.source?.path },
];
// O Copilot (VS Code) instala pelo marketplace Claude registrado aqui.
export const COPILOT_SETTINGS = '.github/copilot/settings.json';

// Arquivos do pacote que sao de TODOS os harnesses (nucleo). Qualquer outro arquivo de
// "superficie de host" (ver ehSuperficieDeHost) precisa ter dono em HARNESSES.
export const NUCLEO_COMPARTILHADO = ['hooks/session-start.mjs'];

export function ehSuperficieDeHost(relativo) {
  const r = relativo.replaceAll('\\', '/');
  if (/^\.[^/]+-plugin\//.test(r)) return true; // overlays .claude-plugin/, .codex-plugin/, ...
  if (/^[^/]+\.json$/.test(r)) return true; // manifests e configs na raiz do pacote
  if (/^hooks\/[^/]+\.(json|mjs)$/.test(r)) return true; // hooks e seus entrypoints
  if (/^com\.github\.[^/]+\//.test(r)) return true; // overlays por fornecedor
  if (/^copilot\//.test(r)) return true;
  if (/^rules\//.test(r)) return true; // regras sempre ativas (Antigravity)
  return false;
}

const SESSION_ID = (harness) => `arch-${harness}`;

// Linha de comando do hook: shell form (`command` com tudo) ou exec form (`command` +
// `args`, adotado pelo Claude na 0.39.0 — uma entrada por SO, sem depender de Git Bash).
const linha = (h) => [h.command, ...(Array.isArray(h.args) ? h.args : [])].filter(Boolean).join(' ');

// Em que SO uma entrada roda. Host sem campo por SO (Claude, Antigravity) recebe uma
// entrada por SO e a do outro SO falha ao iniciar sem rodar nada (0.39.0): o primeiro
// token diz qual e qual. Sem token reconhecido, a entrada vale para os dois.
function porPrimeiroToken(l) {
  if (/^\/bin\/sh\b/.test(l)) return { posix: l };
  if (/^powershell(\.exe)?\b/i.test(l)) return { windows: l };
  return { posix: l, windows: l };
}

// Handler normalizado: `command` (linha principal, para as checagens de texto), `linhas`
// por SO (para executar como o host executa) e `exec` (exec form, quando houver).
function handler(h, matcher, linhas) {
  const exec = Array.isArray(h.args) ? { command: h.command, args: h.args } : null;
  return { matcher, command: linhas.posix || linhas.windows, execForm: !!exec, exec, linhas };
}

export const HARNESSES = {
  claude: {
    rotulo: 'Claude (Cowork / Claude Code)',
    variaveisDeRaiz: ['CLAUDE_PLUGIN_ROOT'],
    manifesto: '.claude-plugin/plugin.json',
    exigeVersao: true,
    // Superficie propria (alem do manifesto). Caminhos sao relativos ao pacote.
    arquivos: ['.claude-plugin/plugin.json', '.mcp.json', 'hooks/hooks.json'],
    mcp: (m) => m.mcpServers,
    hooks: () => './hooks/hooks.json',
    lerHooks: (j) => (j.hooks?.SessionStart || []).flatMap((g) => (g.hooks || []).map((h) => handler(h, g.matcher, porPrimeiroToken(linha(h))))),
    // 0.39.0: shell form no Windows sem Git Bash cai no PowerShell, que imprime a linha
    // em vez de executar — o hook "passa" sem injetar nada. Todo hook Claude e exec form.
    exigeExecForm: true,
    // Como o host executa a linha de cada SO (para o teste rodar igual): exec form.
    shell: { posix: 'exec', windows: 'exec' },
    cwdDoHook: 'sessao',
    // O Cowork concede pasta por sessao: o pedido de acesso vai inteiro sempre. Os outros
    // hosts guardam a permissao (padrao 'memoriza': inteiro so na 1a sessao do host).
    acesso: 'por-sessao',
    // Forma HTTP que o Claude aceita.
    mcpHttp: (url) => ({ type: 'http', url }),
    payload: () => ({ session_id: SESSION_ID('claude') }),
    lerSaida: (stdout) => stdout,
  },
  codex: {
    rotulo: 'OpenAI Codex / ChatGPT Work',
    variaveisDeRaiz: ['PLUGIN_ROOT'],
    manifesto: '.codex-plugin/plugin.json',
    exigeVersao: false, // overlay: a versao vem do plugin.json portavel
    // Doc atual da OpenAI: configuracao em plugin.json > extensions.com.openai; o overlay
    // .codex-plugin/ e fallback de compatibilidade e tem de espelhar (checarExtensaoOpenAI).
    extensaoOpenAI: true,
    arquivos: ['.codex-plugin/plugin.json', 'hooks/codex-hooks.json', 'hooks/session-start-codex.mjs'],
    mcp: () => './mcp.json',
    hooks: (m) => m.hooks,
    // `commandWindows` e o override documentado do Codex para Windows.
    lerHooks: (j) => (j.hooks?.SessionStart || []).flatMap((g) => (g.hooks || []).map((h) => handler(h, g.matcher, { posix: h.command, windows: h.commandWindows || h.command }))),
    // codex-rs/hooks: `$SHELL -lc <linha>` fora do Windows; `%COMSPEC% /C "<linha>"` nele.
    shell: { posix: 'sh', windows: 'cmd' },
    cwdDoHook: 'sessao',
    mcpHttp: (url) => ({ type: 'streamable-http', url }),
    payload: () => ({ session_id: SESSION_ID('codex') }),
    lerSaida: (stdout) => {
      const o = JSON.parse(stdout).hookSpecificOutput;
      if (o?.hookEventName !== 'SessionStart') throw new Error(`hookEventName inesperado: ${o?.hookEventName}`);
      return o.additionalContext;
    },
  },
  antigravity: {
    rotulo: 'Google Antigravity',
    variaveisDeRaiz: ['PLUGIN_ROOT'],
    manifesto: '.antigravity-plugin/plugin.json',
    exigeVersao: true,
    schema: 'https://antigravity.google/schemas/v1/plugin.json',
    arquivos: ['.antigravity-plugin/plugin.json', 'mcp_config.json', 'hooks.json', 'hooks/session-start-antigravity.mjs', 'rules/AGENTS.md'],
    // SessionStart do Antigravity roda uma vez por conversa (sem resume/compact): as regras
    // duras tambem vao como regra sempre ativa, gerada de lib/regras.mjs.
    regrasSempreAtivas: true,
    mcp: () => './mcp_config.json',
    hooks: () => './hooks.json',
    lerHooks: (j) => Object.values(j).flatMap((grupo) => (grupo?.SessionStart || []).map((h) => handler(h, h.matcher, porPrimeiroToken(linha(h))))),
    // Doc do Antigravity: hooks de plugin rodam com cwd = raiz do plugin e caminho
    // relativo (`./scripts/...`); o shell do Windows nao e documentado — o teste usa cmd.
    shell: { posix: 'sh', windows: 'cmd' },
    cwdDoHook: 'plugin',
    mcpHttp: (url) => ({ serverUrl: url }),
    payload: () => ({ conversationId: SESSION_ID('antigravity') }),
    lerSaida: (stdout) => JSON.parse(stdout).injectSteps?.[0]?.systemMessage?.systemMessage,
  },
  copilot: {
    rotulo: 'GitHub Copilot (Agent Plugins)',
    variaveisDeRaiz: ['PLUGIN_ROOT'],
    manifesto: 'plugin.json',
    exigeVersao: true,
    schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
    arquivos: ['plugin.json', 'mcp.json', 'com.github.copilot/hooks/hooks.json', 'copilot/session-start.mjs'],
    mcp: () => './mcp.json',
    hooks: () => './com.github.copilot/hooks/hooks.json',
    lerHooks: (j) => {
      if (j.version !== 1) throw new Error(`hooks.json do Copilot exige version 1 (veio ${j.version})`);
      if (j.hooks?.SessionStart) throw new Error('Copilot usa "sessionStart" (camelCase); "SessionStart" e ignorado pelo host');
      // `bash`/`powershell` por SO; `command` e o fallback que vale para os dois.
      return (j.hooks?.sessionStart || []).map((h) => handler(h, h.matcher, { posix: h.bash || h.command, windows: h.powershell || h.command }));
    },
    shell: { posix: 'sh', windows: 'powershell' },
    cwdDoHook: 'sessao',
    mcpHttp: (url) => ({ type: 'streamable-http', url }),
    payload: () => ({ session_id: SESSION_ID('copilot'), source: 'startup' }),
    lerSaida: (stdout) => JSON.parse(stdout).additionalContext,
    // Artefato gerado tambem pelo build do bundle: o versionado nao pode divergir.
    geradoPor: { script: 'scripts/build-copilot.mjs', arquivo: 'com.github.copilot/hooks/hooks.json' },
  },
};

export { SESSION_ID };
