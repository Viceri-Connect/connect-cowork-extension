// tests/architecture/paridade.mjs
// PARIDADE ENTRE HARNESSES — Claude/Cowork, Codex, Copilot e Antigravity sao PARES.
//
// O Connect nasceu no Cowork e, durante a migracao, o Cowork e a referencia de tudo que
// ja funcionava — mas nao e dependencia: nenhuma capacidade e "do Cowork". Cada uma e
// descrita pelo RESULTADO que o operador recebe, e cada host esta "igual" (entrega o
// resultado) ou declara o LIMIAR: o quanto fica aquem, por que, e a mitigacao. Inclusive
// o proprio Cowork, quando outro host faz melhor.
//
// Duas provas, ambas no teste de arquitetura:
//   - FUNCIONALIDADE: esta tabela — toda capacidade com decisao para todo host, provada
//     por features do contrato e testes; todo evento de hook de QUALQUER host coberto por
//     uma capacidade (superficie nova sem decisao de paridade falha o build).
//   - FUNCIONAMENTO: checarParidadeDeComportamento — os quatro hooks rodam no MESMO estado
//     de maquina e o contexto que entregam e identico, salvo os blocos declarados como
//     especificos de host (BLOCOS_POR_HOST).
//
// docs/paridade-harness.md e gerado daqui (npm run gerar:paridade).

export const HOSTS_PARIDADE = ['claude', 'codex', 'copilot', 'antigravity'];
export const ROTULO_HOST = { claude: 'Claude/Cowork', codex: 'Codex', copilot: 'Copilot', antigravity: 'Antigravity' };

// Todo evento de hook declarado por qualquer host precisa cair numa capacidade.
export const EVENTOS_COBERTOS = {
  sessionstart: 'bootstrap-sessao',
  pretooluse: 'guarda-varredura',
};

// Blocos do contexto injetado que PODEM diferir entre hosts (o resto tem de ser igual).
// Cada um e a forma local de uma capacidade com limiar ou detalhe declarado na tabela.
export const BLOCOS_POR_HOST = [
  { cabecalho: /^## Connect — acesso/, capacidade: 'acesso-pastas' },
  { cabecalho: /^## Connect — (confira o canal injetado|governanca da matriz)/, capacidade: 'governanca-matriz' },
  { cabecalho: /^### Camada 1 e protocolo completo/, capacidade: 'governanca-matriz' },
  { linha: /^Neste host o diretorio de trabalho e o do projeto/, capacidade: 'acesso-pastas' },
];

const igual = (detalhe = '') => ({ status: 'igual', detalhe });
const limiar = (detalhe) => ({ status: 'limiar', detalhe });

export const CAPACIDADES = [
  {
    id: 'bootstrap-sessao',
    resultado: 'No inicio (e na retomada) da sessao o agente recebe identidade do operador, camada 0, regras duras, atalhos e o ponteiro da carta.',
    origem: 'cowork',
    features: ['hook declarado', 'bootstrap', 'hook pelo runtime'],
    testes: ['tests/e2e/host-session-start.test.mjs'],
    hosts: {
      claude: limiar('startup, resume e fork; nao reinjeta depois de compactacao nem de clear (o matcher do hooks.json nao os inclui). Mitigacao: a tool iniciar_sessao devolve tudo de novo.'),
      codex: igual('startup, resume, clear, compact e fork.'),
      copilot: igual('startup, resume e sessao nova.'),
      antigravity: limiar('So em conversa nova (o SessionStart do Antigravity nao tem resume nem compact). Mitigacao: regras duras como regra sempre ativa e a tool iniciar_sessao.'),
    },
  },
  {
    id: 'mesmo-contexto',
    resultado: 'Mesmo estado de maquina, mesmo contexto injetado — so os blocos declarados em BLOCOS_POR_HOST mudam.',
    origem: 'migracao',
    features: [],
    testes: ['tests/architecture/harnesses.test.mjs'],
    hosts: {
      claude: igual(), codex: igual(), copilot: igual(), antigravity: igual(),
    },
  },
  {
    id: 'tools-mcp',
    resultado: 'O agente tem todas as tools do Connect (sessao, resolver, repos, OneDrive, governanca, instancia), com anotacoes de leitura/escrita.',
    origem: 'cowork',
    features: ['mcp', 'referencias', 'isolamento'],
    testes: ['tests/e2e/copilot-install.test.mjs', 'tests/unit/mcp-anotacoes.test.mjs'],
    hosts: {
      claude: igual('Launcher poliglota (mcp/launcher.bat).'),
      codex: igual('scripts/connect-mcp pelo mcp.json portavel.'),
      copilot: igual('scripts/connect-mcp pelo mcp.json portavel.'),
      antigravity: igual('scripts/connect-mcp pelo mcp_config.json.'),
    },
  },
  {
    id: 'runtime-node',
    resultado: 'Funciona sem Node no PATH: o runtime portatil e baixado para CONNECT_HOME/bin (ou a pasta de dados do host, em sandbox).',
    origem: 'cowork',
    features: ['runtime portatil', 'hook pelo runtime'],
    testes: ['tests/integration/runtime-sandbox.test.mjs'],
    hosts: {
      claude: igual('Exec form, uma entrada por SO (powershell -File run-node.ps1 / /bin/sh run-node.sh).'),
      codex: igual('command + commandWindows, mesmo run-node.'),
      copilot: igual('bash + powershell, mesmo run-node.'),
      antigravity: limiar('Uma entrada de hook por SO; a do outro SO falha ao iniciar e fica no log de hooks do Antigravity (ignorada, sem efeito).'),
    },
  },
  {
    id: 'skills',
    resultado: 'As 9 skills cnct-* carregam e trazem o caminho de cada host para o que depende de host.',
    origem: 'cowork',
    features: [],
    testes: ['tests/architecture/harnesses.test.mjs', 'tests/integration/agent-harnesses.test.mjs', 'tests/unit/skills-hosts.test.mjs'],
    hosts: {
      claude: igual(), codex: igual('Padrao Agent Skills (nome e description validados).'),
      copilot: igual('Padrao Agent Skills (nome e description validados).'), antigravity: igual('Padrao Agent Skills (nome e description validados).'),
    },
  },
  {
    id: 'onboarding-1o-uso',
    resultado: 'Instalado o plugin, o 1o contato conduz matriz (codigo de instancia ou catalogo do OneDrive) e o nascimento do perfil do operador.',
    origem: 'cowork',
    features: ['bootstrap', 'extensao OpenAI'],
    testes: ['tests/unit/render-hosts.test.mjs', 'tests/integration/copilot-adapter.test.mjs'],
    hosts: {
      claude: igual('Hook + cnct-nucleo-sessao (inclusive pelo "Personalizar").'),
      codex: igual('O setup pos-instalacao abre a cnct-nucleo-sessao (onboardingSkill), e o hook injeta o fluxo.'),
      copilot: igual('O hook injeta o fluxo de 1o uso na 1a sessao.'),
      antigravity: igual('O hook injeta o fluxo; prompts sugeridos no card do plugin.'),
    },
  },
  {
    id: 'perfil-operador',
    resultado: 'A cnct-fabrica-operador nasce o perfil em CONNECT_HOME/operador (identidade, vinculos, TASKS.md), lido por todo host.',
    origem: 'cowork',
    features: ['bootstrap'],
    testes: ['tests/unit/render-hosts.test.mjs'],
    hosts: {
      claude: igual(),
      codex: igual('Escrita fora do workspace passa pela aprovacao do sandbox do Codex.'),
      copilot: igual('Com o sandbox de sessao ligado, ~/Connect precisa estar em sandbox.userPolicy.'),
      antigravity: igual('Acesso pedido por ask_permission.'),
    },
  },
  {
    id: 'acesso-pastas',
    resultado: 'O agente sabe exatamente quais pastas pedir e pede antes de ler — nunca contorna.',
    origem: 'cowork',
    features: ['acesso no ritmo do host'],
    testes: ['tests/unit/render-hosts.test.mjs'],
    hosts: {
      claude: igual('O Cowork concede por sessao: pedido completo em toda sessao.'),
      codex: igual('O Codex guarda a permissao: completo na 1a sessao e quando as pastas mudam; depois, lembrete de uma linha.'),
      copilot: igual('O Copilot guarda a permissao: completo na 1a sessao e quando as pastas mudam; depois, lembrete.'),
      antigravity: igual('O Antigravity guarda a permissao: completo na 1a sessao e quando as pastas mudam; depois, lembrete.'),
    },
  },
  {
    id: 'governanca-matriz',
    resultado: 'A governanca da matriz (CLAUDE.md com marcador CNCT-GOV) e a carta de navegacao chegam ao contexto no inicio da sessao.',
    origem: 'cowork',
    features: [],
    testes: ['tests/unit/render-hosts.test.mjs'],
    hosts: {
      claude: igual('Entra sozinha pela pasta conectada ao projeto; o hook confere o marcador.'),
      codex: limiar('Nao ha pasta conectada: o arquivo nao entra sozinho. O hook manda ler {workspace}/matriz/CLAUDE.md e a carta pelo caminho completo — depende de o agente seguir a instrucao.'),
      copilot: limiar('Nao ha pasta conectada: o arquivo nao entra sozinho. O hook manda ler {workspace}/matriz/CLAUDE.md e a carta pelo caminho completo.'),
      antigravity: limiar('Nao ha pasta conectada: o arquivo nao entra sozinho. O hook manda le-lo pelo caminho completo; as regras duras ja entram como regra sempre ativa.'),
    },
  },
  {
    id: 'regras-duras',
    resultado: 'As 5 regras duras valem a sessao inteira.',
    origem: 'cowork',
    features: ['bootstrap', 'regras sempre ativas'],
    testes: [],
    hosts: {
      claude: igual('Bloco injetado e CLAUDE.md de governanca.'),
      codex: igual('Bloco injetado em todo inicio, retomada e compactacao.'),
      copilot: igual('Bloco injetado em todo inicio e retomada.'),
      antigravity: igual('Bloco injetado e regra sempre ativa (rules/AGENTS.md).'),
    },
  },
  {
    id: 'guarda-varredura',
    resultado: 'Busca recursiva dentro de um vault deixa marca (CONNECT_HOME/logs/varredura.jsonl) e passa pela regra dura 4 antes de rodar.',
    origem: 'nova',
    features: ['guarda de varredura'],
    testes: ['tests/unit/varredura.test.mjs'],
    hosts: {
      claude: limiar('Ainda nao instalada: o Cowork aceita PreToolUse com "ask", mas cada busca pagaria a subida do runtime (~300 ms). A regra 4 vale so pelo texto.'),
      codex: limiar('O PreToolUse do Codex nao suporta "ask": a busca segue, o agente recebe a regra com a ordem de reportar e o operador ve o aviso.'),
      copilot: limiar('Ainda nao instalada: o preToolUse do Copilot aceita "ask" e e o proximo a receber. A regra 4 vale so pelo texto.'),
      antigravity: igual('Pede confirmacao ao operador (grep_search, find_by_name); run_command fica de fora pelo custo em todo comando.'),
    },
  },
  {
    id: 'sessao-nuvem',
    resultado: 'Em sessao na nuvem, o agente e orientado (nunca diagnostica 1o uso) e alcanca o Connect da maquina do operador.',
    origem: 'cowork',
    features: ['bootstrap na nuvem'],
    testes: ['tests/integration/sessao/sessao-nuvem.spike.mjs'],
    hosts: {
      claude: igual('CLAUDE_CODE_REMOTE + ponte do app desktop para o MCP.'),
      codex: limiar('So execucao local: o ChatGPT Work orquestrado na nuvem nao roda hooks de plugin nem alcanca o MCP da maquina (exigiria MCP remoto HTTPS). A orientacao existe via CONNECT_EXECUCAO=nuvem.'),
      copilot: limiar('So execucao local: o cloud agent roda apenas hooks do repositorio (.github/hooks), nao de plugin, e nao alcanca o MCP da maquina.'),
      antigravity: limiar('So execucao local: agentes remotos nao alcancam o MCP da maquina.'),
    },
  },
  {
    id: 'briefing-agendado',
    resultado: 'O briefing diario fica agendado com o prompt verbatim do template da matriz.',
    origem: 'cowork',
    features: [],
    testes: ['tests/unit/skills-hosts.test.mjs'],
    hosts: {
      claude: igual('Ferramenta de tarefa agendada do Cowork, no projeto com a matriz conectada.'),
      codex: limiar('O agente nao agenda: entrega o prompt e o horario para o operador criar a automacao pela interface.'),
      copilot: limiar('No Agents window do VS Code o agente cria a automacao local (desabilitada para revisao) ou gera um .automation.md para Import Automation; so roda com a maquina e o VS Code/Agent Host abertos. No Copilot CLI nao ha agendador.'),
      antigravity: limiar('Ferramenta schedule do Antigravity; a persistencia fora da conversa nao foi verificada.'),
    },
  },
  {
    id: 'instalacao-atualizacao',
    resultado: 'Instala pelo marketplace (ou pacote) e atualiza sem passo manual do operador.',
    origem: 'cowork',
    features: ['identidade'],
    testes: ['tests/unit/release.test.mjs'],
    hosts: {
      claude: igual('Marketplace pela URL do git ou bundle .plugin.'),
      codex: limiar('Hooks de plugin precisam de revisao e aprovacao (/hooks ou Review hooks) e de nova aprovacao a cada versao que muda hook ou script.'),
      copilot: igual('Marketplace do repositorio (.github/copilot/settings.json) ou bundle dist/copilot.'),
      antigravity: igual('agy plugin install a partir do diretorio ou .agents/plugins/.'),
    },
  },
];

// Ainda nao conferido em host real (o teste prova formato e execucao, nao o host).
export const PENDENTE_EM_HOST_REAL = [
  'Windows: cada host resolver `./scripts/connect-mcp` para `connect-mcp.cmd` pelo PATHEXT (Codex, VS Code, Antigravity).',
  'Antigravity no Windows: shell usado para os hooks (o teste usa cmd).',
  'Primeiro uso de ponta a ponta no Codex e no Antigravity (matriz, perfil do operador, briefing).',
];

export function gerarDocParidade() {
  const marca = (s) => (!s ? 'SEM DECISAO' : s.status === 'igual' ? 'igual' : 'LIMIAR');
  const L = [
    '# Paridade entre harnesses',
    '',
    '<!-- Gerado de tests/architecture/paridade.mjs por scripts/gerar-paridade.mjs. Nao edite aqui. -->',
    '',
    'Claude/Cowork, Codex, Copilot e Antigravity sao pares. O Connect nasceu no Cowork e, na',
    'migracao, o Cowork e a referencia do que ja funcionava, mas nao e dependencia: cada',
    'capacidade e descrita pelo resultado que o operador recebe, e cada host entrega **igual**',
    'ou declara o **limiar** (o quanto fica aquem, por que, e a mitigacao), inclusive o Cowork.',
    '',
    'O teste de arquitetura prova duas coisas:',
    '- **funcionalidade**: decisao para toda capacidade em todo host, com a prova citada, e todo',
    '  evento de hook de qualquer host coberto por uma capacidade;',
    '- **funcionamento**: os quatro hooks, no mesmo estado de maquina, entregam o mesmo contexto,',
    '  salvo os blocos declarados como especificos de host.',
    '',
    '## Resumo',
    '',
    `| Capacidade | Origem | ${HOSTS_PARIDADE.map((h) => ROTULO_HOST[h]).join(' | ')} |`,
    `|---|---|${HOSTS_PARIDADE.map(() => '---').join('|')}|`,
    ...CAPACIDADES.map((c) => `| ${c.id} | ${c.origem} | ${HOSTS_PARIDADE.map((h) => marca(c.hosts[h])).join(' | ')} |`),
    '',
    'Origem: `cowork` = nasceu no Cowork; `nova` = nasceu fora dele; `migracao` = garantia criada para a migracao.',
    '',
    '## Detalhe e limiares',
    '',
  ];
  for (const c of CAPACIDADES) {
    L.push(`### ${c.id}`, '', `**Resultado:** ${c.resultado}`, '');
    for (const h of HOSTS_PARIDADE) {
      const s = c.hosts[h];
      L.push(`- **${ROTULO_HOST[h]} — ${marca(s)}.**${s?.detalhe ? ` ${s.detalhe}` : ''}`);
    }
    const prova = [...c.features.map((f) => `feature "${f}"`), ...c.testes.map((t) => `\`${t}\``)];
    if (prova.length) L.push('', `Provado por: ${prova.join(', ')}.`);
    L.push('');
  }
  L.push('## Blocos que podem diferir entre hosts', '');
  for (const b of BLOCOS_POR_HOST) L.push(`- \`${(b.cabecalho || b.linha).source}\` — capacidade ${b.capacidade}`);
  L.push('', '## Pendente de conferencia em host real', '', ...PENDENTE_EM_HOST_REAL.map((x) => `- ${x}`), '');
  return L.join('\n');
}
