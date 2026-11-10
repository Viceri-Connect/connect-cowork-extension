# Paridade entre harnesses

<!-- Gerado de tests/architecture/paridade.mjs por scripts/gerar-paridade.mjs. Nao edite aqui. -->

Claude/Cowork, Codex, Copilot e Antigravity sao pares. O Connect nasceu no Cowork e, na
migracao, o Cowork e a referencia do que ja funcionava, mas nao e dependencia: cada
capacidade e descrita pelo resultado que o operador recebe, e cada host entrega **igual**
ou declara o **limiar** (o quanto fica aquem, por que, e a mitigacao), inclusive o Cowork.

O teste de arquitetura prova duas coisas:
- **funcionalidade**: decisao para toda capacidade em todo host, com a prova citada, e todo
  evento de hook de qualquer host coberto por uma capacidade;
- **funcionamento**: os quatro hooks, no mesmo estado de maquina, entregam o mesmo contexto,
  salvo os blocos declarados como especificos de host.

## Resumo

| Capacidade | Origem | Claude/Cowork | Codex | Copilot | Antigravity |
|---|---|---|---|---|---|
| bootstrap-sessao | cowork | LIMIAR | igual | igual | LIMIAR |
| mesmo-contexto | migracao | igual | igual | igual | igual |
| tools-mcp | cowork | igual | igual | igual | igual |
| runtime-node | cowork | igual | igual | igual | LIMIAR |
| skills | cowork | igual | igual | igual | igual |
| onboarding-1o-uso | cowork | igual | igual | igual | igual |
| perfil-operador | cowork | igual | igual | igual | igual |
| acesso-pastas | cowork | igual | igual | igual | igual |
| governanca-matriz | cowork | igual | LIMIAR | LIMIAR | LIMIAR |
| regras-duras | cowork | igual | igual | igual | igual |
| guarda-varredura | nova | LIMIAR | LIMIAR | LIMIAR | igual |
| sessao-nuvem | cowork | igual | LIMIAR | LIMIAR | LIMIAR |
| briefing-agendado | cowork | igual | LIMIAR | LIMIAR | LIMIAR |
| variante-http | migracao | igual | igual | igual | igual |
| instalacao-atualizacao | cowork | igual | LIMIAR | igual | igual |

Origem: `cowork` = nasceu no Cowork; `nova` = nasceu fora dele; `migracao` = garantia criada para a migracao.

## Detalhe e limiares

### bootstrap-sessao

**Resultado:** No inicio (e na retomada) da sessao o agente recebe identidade do operador, camada 0, regras duras, atalhos e o ponteiro da carta.

- **Claude/Cowork — LIMIAR.** startup, resume e fork; nao reinjeta depois de compactacao nem de clear (o matcher do hooks.json nao os inclui). Mitigacao: a tool iniciar_sessao devolve tudo de novo.
- **Codex — igual.** startup, resume, clear, compact e fork.
- **Copilot — igual.** startup, resume e sessao nova.
- **Antigravity — LIMIAR.** So em conversa nova (o SessionStart do Antigravity nao tem resume nem compact). Mitigacao: regras duras como regra sempre ativa e a tool iniciar_sessao.

Provado por: feature "hook declarado", feature "bootstrap", feature "hook pelo runtime", `tests/e2e/host-session-start.test.mjs`.

### mesmo-contexto

**Resultado:** Mesmo estado de maquina, mesmo contexto injetado — so os blocos declarados em BLOCOS_POR_HOST mudam.

- **Claude/Cowork — igual.**
- **Codex — igual.**
- **Copilot — igual.**
- **Antigravity — igual.**

Provado por: `tests/architecture/harnesses.test.mjs`.

### tools-mcp

**Resultado:** O agente tem todas as tools do Connect (sessao, resolver, repos, OneDrive, governanca, instancia), com anotacoes de leitura/escrita.

- **Claude/Cowork — igual.** Launcher poliglota (mcp/launcher.bat).
- **Codex — igual.** scripts/connect-mcp pelo mcp.json portavel.
- **Copilot — igual.** scripts/connect-mcp pelo mcp.json portavel.
- **Antigravity — igual.** scripts/connect-mcp pelo mcp_config.json.

Provado por: feature "mcp", feature "referencias", feature "isolamento", `tests/e2e/copilot-install.test.mjs`, `tests/unit/mcp-anotacoes.test.mjs`.

### runtime-node

**Resultado:** Funciona sem Node no PATH: o runtime portatil e baixado para CONNECT_HOME/bin (ou a pasta de dados do host, em sandbox).

- **Claude/Cowork — igual.** Exec form, uma entrada por SO (powershell -File run-node.ps1 / /bin/sh run-node.sh).
- **Codex — igual.** command + commandWindows, mesmo run-node.
- **Copilot — igual.** bash + powershell, mesmo run-node.
- **Antigravity — LIMIAR.** Uma entrada de hook por SO; a do outro SO falha ao iniciar e fica no log de hooks do Antigravity (ignorada, sem efeito).

Provado por: feature "runtime portatil", feature "hook pelo runtime", `tests/integration/runtime-sandbox.test.mjs`.

### skills

**Resultado:** As 9 skills cnct-* carregam e trazem o caminho de cada host para o que depende de host.

- **Claude/Cowork — igual.**
- **Codex — igual.** Padrao Agent Skills (nome e description validados).
- **Copilot — igual.** Padrao Agent Skills (nome e description validados).
- **Antigravity — igual.** Padrao Agent Skills (nome e description validados).

Provado por: `tests/architecture/harnesses.test.mjs`, `tests/integration/agent-harnesses.test.mjs`, `tests/unit/skills-hosts.test.mjs`.

### onboarding-1o-uso

**Resultado:** Instalado o plugin, o 1o contato conduz matriz (codigo de instancia ou catalogo do OneDrive) e o nascimento do perfil do operador.

- **Claude/Cowork — igual.** Hook + cnct-nucleo-sessao (inclusive pelo "Personalizar").
- **Codex — igual.** O setup pos-instalacao abre a cnct-nucleo-sessao (onboardingSkill), e o hook injeta o fluxo.
- **Copilot — igual.** O hook injeta o fluxo de 1o uso na 1a sessao.
- **Antigravity — igual.** O hook injeta o fluxo; prompts sugeridos no card do plugin.

Provado por: feature "bootstrap", feature "extensao OpenAI", `tests/unit/render-hosts.test.mjs`, `tests/integration/copilot-adapter.test.mjs`.

### perfil-operador

**Resultado:** A cnct-fabrica-operador nasce o perfil em CONNECT_HOME/operador (identidade, vinculos, TASKS.md), lido por todo host.

- **Claude/Cowork — igual.**
- **Codex — igual.** Escrita fora do workspace passa pela aprovacao do sandbox do Codex.
- **Copilot — igual.** Com o sandbox de sessao ligado, ~/Connect precisa estar em sandbox.userPolicy.
- **Antigravity — igual.** Acesso pedido por ask_permission.

Provado por: feature "bootstrap", `tests/unit/render-hosts.test.mjs`.

### acesso-pastas

**Resultado:** O agente sabe exatamente quais pastas pedir e pede antes de ler — nunca contorna.

- **Claude/Cowork — igual.** O Cowork concede por sessao: pedido completo em toda sessao.
- **Codex — igual.** O Codex guarda a permissao: completo na 1a sessao e quando as pastas mudam; depois, lembrete de uma linha.
- **Copilot — igual.** O Copilot guarda a permissao: completo na 1a sessao e quando as pastas mudam; depois, lembrete.
- **Antigravity — igual.** O Antigravity guarda a permissao: completo na 1a sessao e quando as pastas mudam; depois, lembrete.

Provado por: feature "acesso no ritmo do host", `tests/unit/render-hosts.test.mjs`.

### governanca-matriz

**Resultado:** A governanca da matriz (CLAUDE.md com marcador CNCT-GOV) e a carta de navegacao chegam ao contexto no inicio da sessao.

- **Claude/Cowork — igual.** Entra sozinha pela pasta conectada ao projeto; o hook confere o marcador.
- **Codex — LIMIAR.** Nao ha pasta conectada: o arquivo nao entra sozinho. O hook manda ler {workspace}/matriz/CLAUDE.md e a carta pelo caminho completo — depende de o agente seguir a instrucao.
- **Copilot — LIMIAR.** Nao ha pasta conectada: o arquivo nao entra sozinho. O hook manda ler {workspace}/matriz/CLAUDE.md e a carta pelo caminho completo.
- **Antigravity — LIMIAR.** Nao ha pasta conectada: o arquivo nao entra sozinho. O hook manda le-lo pelo caminho completo; as regras duras ja entram como regra sempre ativa.

Provado por: `tests/unit/render-hosts.test.mjs`.

### regras-duras

**Resultado:** As 5 regras duras valem a sessao inteira.

- **Claude/Cowork — igual.** Bloco injetado e CLAUDE.md de governanca.
- **Codex — igual.** Bloco injetado em todo inicio, retomada e compactacao.
- **Copilot — igual.** Bloco injetado em todo inicio e retomada.
- **Antigravity — igual.** Bloco injetado e regra sempre ativa (rules/AGENTS.md).

Provado por: feature "bootstrap", feature "regras sempre ativas".

### guarda-varredura

**Resultado:** Busca recursiva dentro de um vault deixa marca (CONNECT_HOME/logs/varredura.jsonl) e passa pela regra dura 4 antes de rodar.

- **Claude/Cowork — LIMIAR.** Ainda nao instalada: o Cowork aceita PreToolUse com "ask", mas cada busca pagaria a subida do runtime (~300 ms). A regra 4 vale so pelo texto.
- **Codex — LIMIAR.** O PreToolUse do Codex nao suporta "ask": a busca segue, o agente recebe a regra com a ordem de reportar e o operador ve o aviso.
- **Copilot — LIMIAR.** Ainda nao instalada: o preToolUse do Copilot aceita "ask" e e o proximo a receber. A regra 4 vale so pelo texto.
- **Antigravity — igual.** Pede confirmacao ao operador (grep_search, find_by_name); run_command fica de fora pelo custo em todo comando.

Provado por: feature "guarda de varredura", `tests/unit/varredura.test.mjs`.

### sessao-nuvem

**Resultado:** Em sessao na nuvem, o agente e orientado (nunca diagnostica 1o uso) e alcanca o Connect da maquina do operador.

- **Claude/Cowork — igual.** CLAUDE_CODE_REMOTE + ponte do app desktop para o MCP.
- **Codex — LIMIAR.** So execucao local: o ChatGPT Work orquestrado na nuvem nao roda hooks de plugin nem alcanca o MCP da maquina (exigiria MCP remoto HTTPS). A orientacao existe via CONNECT_EXECUCAO=nuvem.
- **Copilot — LIMIAR.** So execucao local: o cloud agent roda apenas hooks do repositorio (.github/hooks), nao de plugin, e nao alcanca o MCP da maquina.
- **Antigravity — LIMIAR.** So execucao local: agentes remotos nao alcancam o MCP da maquina.

Provado por: feature "bootstrap na nuvem", `tests/integration/sessao/sessao-nuvem.spike.mjs`.

### briefing-agendado

**Resultado:** O briefing diario fica agendado com o prompt verbatim do template da matriz.

- **Claude/Cowork — igual.** Ferramenta de tarefa agendada do Cowork, no projeto com a matriz conectada.
- **Codex — LIMIAR.** O agente nao agenda: entrega o prompt e o horario para o operador criar a automacao pela interface.
- **Copilot — LIMIAR.** No Agents window do VS Code o agente cria a automacao local (desabilitada para revisao) ou gera um .automation.md para Import Automation; so roda com a maquina e o VS Code/Agent Host abertos. No Copilot CLI nao ha agendador.
- **Antigravity — LIMIAR.** Ferramenta schedule do Antigravity; a persistencia fora da conversa nao foi verificada.

Provado por: `tests/unit/skills-hosts.test.mjs`.

### variante-http

**Resultado:** Variante connect-http (MCP em HTTP local) para host que nao sobe stdio.

- **Claude/Cowork — igual.**
- **Codex — igual.**
- **Copilot — igual.**
- **Antigravity — igual.**

Provado por: feature "mcp", `tests/e2e/mcp-http.test.mjs`, `tests/integration/agent-harnesses.test.mjs`.

### instalacao-atualizacao

**Resultado:** Instala pelo marketplace (ou pacote) e atualiza sem passo manual do operador.

- **Claude/Cowork — igual.** Marketplace pela URL do git ou bundle .plugin.
- **Codex — LIMIAR.** Hooks de plugin precisam de revisao e aprovacao (/hooks ou Review hooks) e de nova aprovacao a cada versao que muda hook ou script.
- **Copilot — igual.** Marketplace do repositorio (.github/copilot/settings.json) ou bundle dist/copilot.
- **Antigravity — igual.** agy plugin install a partir do diretorio ou .agents/plugins/.

Provado por: feature "identidade", `tests/unit/release.test.mjs`.

## Blocos que podem diferir entre hosts

- `^## Connect — acesso` — capacidade acesso-pastas
- `^## Connect — (confira o canal injetado|governanca da matriz)` — capacidade governanca-matriz
- `^### Camada 1 e protocolo completo` — capacidade governanca-matriz
- `^Neste host o diretorio de trabalho e o do projeto` — capacidade acesso-pastas

## Pendente de conferencia em host real

- Windows: cada host resolver `./scripts/connect-mcp` para `connect-mcp.cmd` pelo PATHEXT (Codex, VS Code, Antigravity).
- Antigravity no Windows: shell usado para os hooks (o teste usa cmd).
- Primeiro uso de ponta a ponta no Codex e no Antigravity (matriz, perfil do operador, briefing).
