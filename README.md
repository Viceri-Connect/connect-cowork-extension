# connect-cowork-extension

Marketplace da extensão **Connect** (programa Impulsa / Viceri Seidor) para o Claude **Cowork**.

No início de cada sessão o Connect **restaura a identidade do operador**, monta a
**matriz de contexto** como atalho *flat* no workspace e carrega o **contexto lazy
da camada 1**. Sub-vaults descem **sob demanda**, resolvidos por conceito — a
governança que mora na matriz desce para todos os sub-vaults.

> Conceituação, ADRs e backlog canônicos vivem no vault matriz (`projetos/ativos/Connect/`).
> O banco de provas anterior (plugin CLI do lab) fica em `D:\Impulsa\lab\lab\connect`.

## Instalação no Cowork

> **Nota (v0.12.2+):** A extensão não exige mais que o usuário tenha o Node.js instalado. O próprio plugin fará o download de um executável portátil do Node.js (apenas para Windows) na primeira vez que a sessão for iniciada.


**Caminho primário — adicionar o marketplace pela URL do repo (recomendado):**

1. No Cowork, adicionar um marketplace de plugins apontando para a URL deste repo
   git (`https://github.com/Viceri-Connect/connect-cowork-extension`).
2. Instalar o plugin **connect** a partir do marketplace `impulsa`.
3. Apontar, uma vez, a **pasta fixa do Connect** (`CONNECT_HOME`, fora do OneDrive)
   e os caminhos da matriz e do cérebro pessoal (ver *Configuração*).

Vantagem: aponta uma vez e recebe atualizações ao atualizar o marketplace.

**Caminho secundário — bundle `.plugin` de um clique (leigo, sem git):**

```
bash scripts/build-plugin.sh      # gera ./dist/connect.plugin
```

Entregar o `connect.plugin`; no Cowork, abrir o arquivo e aceitar a instalação.

> **Claude Code (só desenvolvimento):** `claude plugin marketplace add <repo>` +
> `claude plugin install connect@impulsa`. É a CLI do Claude Code, **não** o Cowork —
> serve para desenvolver/testar o mecanismo, não é o caminho de entrega da v1.

## Paridade entre harnesses

Claude/Cowork, Codex, Copilot e Antigravity são pares. O Connect nasceu no Cowork, e na
migração o Cowork é a referência do que já funcionava, mas não é dependência: cada
capacidade é descrita pelo resultado que o operador recebe, e cada host entrega igual ou
declara um **limiar** (o quanto fica aquém, o porquê e a mitigação), inclusive o Cowork.
A tabela está em [`docs/paridade-harness.md`](docs/paridade-harness.md), gerada de
`tests/architecture/paridade.mjs` por `npm run gerar:paridade`. O teste de arquitetura prova:
- **funcionalidade:** toda capacidade tem decisão em todo host, com a prova citada, e todo
  evento de hook de qualquer host é coberto por uma capacidade;
- **funcionamento:** os quatro hooks, no mesmo estado de máquina (matriz governada e perfil
  do operador), entregam o mesmo contexto, salvo os blocos declarados como específicos de
  host.

## Runtime em todos os hosts

Nenhum host depende de `node` no PATH. MCP e hooks de Cowork, Codex, Copilot e
Antigravity sobem pelo mesmo runtime (`plugins/connect/scripts/run-node.*`), que baixa o
Node portátil para `CONNECT_HOME/bin` na primeira sessão e o reaproveita nas seguintes.
Nos hosts do formato portátil, o MCP entra por `scripts/connect-mcp` (macOS/Linux) e
`scripts/connect-mcp.cmd` (Windows, resolvido pelo PATHEXT). Em host com **sandbox**
que não deixa escrever no `CONNECT_HOME`, o runtime vai para a pasta de dados que o host
dá ao plugin (`PLUGIN_DATA`, `COPILOT_PLUGIN_DATA` ou `CLAUDE_PLUGIN_DATA`). A primeira
sessão pode levar mais tempo por causa do download; o timeout de SessionStart é de 120 s.

Fora do Cowork, o pedido de acesso às pastas do Connect vem inteiro na primeira sessão de
cada host e quando as pastas mudam; nas demais, vira um lembrete de uma linha. As tools do
MCP declaram `annotations` de leitura e escrita, e os hosts pedem confirmação só para o que
sobrescreve ou remove.

**Guarda de varredura (regra dura 4).** No Codex e no Antigravity, um hook `PreToolUse`
confere toda busca recursiva (`grep`, `rg`, `find`, `Get-ChildItem -Recurse` e as
ferramentas `grep_search`/`find_by_name`). Se o alvo está dentro de um vault do Connect
(matriz, cérebro pessoal, sub-vaults ou o workspace de sessão), a busca deixa marca em
`CONNECT_HOME/logs/varredura.jsonl`. O Antigravity pede confirmação ao operador. O Codex
não suporta "perguntar" nesse hook: a busca segue, o agente recebe a regra com a ordem de
reportar e o operador vê o aviso. Fora do vault, nada muda. No Antigravity a guarda olha as
ferramentas de busca nativas, e não todo `run_command`, para não pagar a subida do runtime
a cada comando de shell.

## GitHub Copilot (VS Code e Copilot CLI)

O adaptador do Copilot usa o mesmo MCP e as mesmas skills, com um hook `sessionStart`
nativo (`com.github.copilot/hooks/hooks.json`, campos `bash` e `powershell`) que injeta o
bootstrap do Connect. Gere o plugin instalável:

```
npm run build:copilot
```

Instale `dist/copilot` pela tela **Chat: Open Customizations > Plugins > Install from Source**, ou adicione o repositório como marketplace no VS Code e instale **connect**. Como a raiz declara o schema do Agent Plugins, o VS Code usa `plugin.json`, `mcp.json` e o hook de `com.github.copilot/`, e não os arquivos do formato Claude. O plugin compartilha `skills/` com o Cowork e usa o mesmo `CONNECT_HOME` (padrão `~/Connect`). Se ainda não houver matriz nesta instalação, o hook injeta o fluxo de primeiro uso para o agente conduzir. Em ambientes remotos ou isolados, execute `ambiente_connect` para verificar o estado observável; o suporte a links aparece como não testado, porque testar teria efeito colateral.

Com o **sandbox de sessão** do Copilot CLI ligado, inclua `~/Connect` (e as pastas da matriz) em `sandbox.userPolicy` nas configurações do Copilot. Sem isso, o hook não grava a sessão no `CONNECT_HOME`.

O marketplace do repositório também lista **connect-http** como alternativa. `.github/copilot/settings.json` registra o marketplace `impulsa` e habilita somente `connect` por padrão; selecione `connect-http` manualmente quando necessário.

O plugin Copilot não configura nem substitui o Windows MCP. PowerShell e controle da
máquina permanecem no servidor MCP do host, separado e sujeito às aprovações dele.
Consulte `docs/host-control-boundary.md` antes de habilitar ferramentas de host.

## Codex e ChatGPT Work

O marketplace local em `.agents/plugins/marketplace.json` oferece **Connect** (STDIO,
padrão) e **Connect HTTP (Local)**. As configurações da OpenAI ficam em
`plugin.json > extensions.com.openai`: hooks, nome de exibição, prompts sugeridos e a
skill de primeiro uso (`cnct-nucleo-sessao`, que o Codex roda no setup depois da
instalação). `.codex-plugin/plugin.json` espelha o mesmo para versões antigas do Codex.
Para gerar uma cópia de distribuição em `dist/connect-http`, execute
`npm run build:connect-http -- dist/connect-http`. No ChatGPT Desktop, adicione este
repositório como marketplace e instale somente uma das variantes.

Onde roda:
- Codex CLI e Codex/ChatGPT Work no app desktop, em execução local: skills, MCP e hooks.
- A extensão do Codex para IDE **não** carrega plugins.
- ChatGPT Work orquestrado na nuvem não roda hooks de plugin nem alcança o processo e os
  caminhos da máquina. Essa modalidade exige endpoint MCP remoto HTTPS com autenticação,
  que este repositório não provisiona.

Os hooks do plugin precisam ser revisados e aprovados no Codex (`/hooks` na CLI ou
**Review hooks** no app) antes de rodar. A aprovação vale para o conteúdo exato: a cada
versão que mude um hook ou script, o Codex pede a revisão de novo.

Use a variante HTTP somente se o host não conseguir iniciar um MCP stdio. Inicie o
servidor e deixe-o em execução (o launcher garante o Node portátil):

```
plugins/connect-http/scripts/connect-mcp --transport=http --port=3737          # macOS/Linux
plugins\connect-http\scripts\connect-mcp.cmd --transport=http --port=3737     # Windows
```

O endpoint fica em `http://127.0.0.1:3737/mcp`; a porta pode ser alterada por
`--port` ou `CONNECT_MCP_PORT`. `--transport=http` também pode ser substituído por
`CONNECT_MCP_TRANSPORT=http`. O servidor só escuta em loopback. Não instale as duas
variantes simultaneamente no mesmo host: ambas expõem as mesmas tools.

## Antigravity App

Os pacotes `plugins/connect` e `plugins/connect-http` incluem o overlay
`.antigravity-plugin/plugin.json`, a configuração MCP e o hook `SessionStart` no
formato nativo do Antigravity: uma entrada por SO, caminho relativo à raiz do plugin.
Instale a variante desejada a partir do diretório local (`agy plugin install ./plugins/connect`
ou `agy plugin install ./plugins/connect-http`) ou coloque-a em `.agents/plugins/`.
Para validar, execute `agy plugin validate --strict` no diretório escolhido.

O SessionStart do Antigravity roda uma vez por conversa, sem resume nem compact. Por isso
as regras duras do Connect também vão como **regra sempre ativa** (`rules/AGENTS.md`),
que entra em toda conversa com o plugin ligado. O arquivo é gerado de
`lib/regras.mjs` por `npm run gerar:regras`; o teste de arquitetura falha se ele divergir.

Todos os hosts (Cowork, Copilot, Codex e Antigravity) usam o mesmo `CONNECT_HOME`,
padrão `~/Connect`: `repos`, `subVaults`, matriz e perfil do operador são por máquina
e não por host. Um `PLUGIN_DATA` separado por host deixava o config sem `repos` e sem
sub-vaults, e o agente não resolvia o que o Cowork resolve. Defina `CONNECT_HOME` só se
quiser outro local, e o mesmo em todos os hosts. A pasta de dados do host serve apenas
de abrigo para o runtime quando o sandbox não deixa escrever no `CONNECT_HOME`.

Todos os adaptadores preservam a fronteira do host: Connect não inclui execução
genérica de shell/PowerShell nem controle de desktop. O Windows MCP segue separado.

## Estrutura (marketplace + plugin)

```
.claude-plugin/marketplace.json     # marketplace "impulsa" (Claude/Cowork/Copilot): connect + connect-http
.agents/plugins/marketplace.json    # marketplace Codex/Antigravity: connect + connect-http
.github/copilot/settings.json       # registra o marketplace "impulsa" no VS Code
plugins/connect/                     # o plugin instalável (stdio)
  ├── .claude-plugin/plugin.json     # ← fonte da VERSÃO (amarrada ao CHANGELOG)
  ├── .mcp.json, hooks/hooks.json    # Claude/Cowork: MCP via launcher + SessionStart (exec form, uma entrada por SO)
  ├── plugin.json, mcp.json          # Agent Plugins (Copilot) + MCP portável (Codex); extensions.com.openai
  ├── com.github.copilot/hooks/      # Copilot: sessionStart → copilot/session-start.mjs
  ├── .codex-plugin/, hooks/codex-hooks.json          # Codex
  ├── .antigravity-plugin/, mcp_config.json, hooks.json, rules/AGENTS.md  # Antigravity
  ├── mcp/connect-mcp.mjs            # servidor MCP (stdio padrão; HTTP local opcional)
  ├── lib/                           # núcleo testável, zero-dep (compartilhado por todos os hosts)
  ├── hooks/session-start*.mjs       # envelope por host → lib/bootstrap.mjs (local ou nuvem)
  ├── hooks/guarda-varredura.mjs     # PreToolUse (Codex/Antigravity) → lib/varredura.mjs (regra dura 4)
  ├── skills/                        # skills cnct-* (compartilhadas)
  ├── scripts/run-node.*             # runtime Node portátil de TODOS os hosts: .ps1 Windows, .sh POSIX, .bat fonte única
  ├── scripts/connect-mcp(.cmd)      # entrada do MCP nos hosts do formato portável
  └── config/                        # contratos + connect.config.example.json
plugins/connect-http/                # variante HTTP local — GERADA por scripts/build-connect-http.mjs
scripts/                             # build-plugin.sh (.plugin), build-copilot.mjs, build-connect-http.mjs
docs/                                # SPEC, notas do POC, fronteira de controle do host
tests/                               # architecture/ (contrato de harnesses), unit/, integration/, e2e/
```

## Configuração (paths locais, nunca versionados)

Via env ou por `{CONNECT_HOME}/connect.config.json`
(ver `plugins/connect/config/connect.config.example.json`):

- `CONNECT_HOME` — pasta fixa do Connect, **fora do OneDrive** (scaffold das sessões).
- `CONNECT_VAULT_MATRIZ` — caminho local da matriz.
- `CONNECT_CEREBRO_PESSOAL` — caminho local do cérebro pessoal (identidade).

## Testes

Ferramental de desenvolvimento na raiz (não entra no bundle `.plugin`, que empacota só `plugins/connect/`).

```
npm ci                      # uma vez
npm test                    # tudo: arquitetura + unitários + integração + e2e
npm run test:architecture   # contrato de harnesses do marketplace
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:watch
npm run check:harnesses     # contrato de harnesses sem Vitest (diagnóstico)
npm run build:copilot
npm run build:connect-http
npm run gerar:regras        # rules/AGENTS.md do Antigravity, a partir de lib/regras.mjs
```

Ver `docs/POC-NOTES.md` para o spike das premissas 1–3 no host Windows/Cowork.

- `tests/unit/*.test.mjs` — testes nativos do Vitest, um arquivo por módulo de `plugins/connect/lib/`.
- `tests/integration/<domínio>/*.spike.mjs` — os spikes originais, agrupados por domínio (`sessao`, `vault`, `sincronizacao`, `plataforma`, `mcp`). O `tests/integration/spikes.test.mjs` roda cada um como subprocesso **em um perfil de usuário descartável** (`HOME`, `USERPROFILE` e `CONNECT_HOME` apontam para um diretório temporário em `.test-tmp/`; variáveis `CONNECT_*` do seu ambiente são removidas), então nenhum teste toca o seu `~/Connect` nem seus vaults reais. Migrar um spike para teste nativo = mover a lógica para `tests/unit/` e apagar o `.spike.mjs`.
- `tests/architecture/` — **contrato de harnesses do marketplace**. `harness-contract.mjs` declara, para cada pacote (`connect`, `connect-http`) e cada host (Claude/Cowork, Codex, Antigravity, Copilot), o que precisa existir: manifesto com nome/versão canônicos, servidor MCP `connect` no transporte da variante, hook de SessionStart cobrindo `startup|resume` que **de fato** injeta o bootstrap no formato do host, skills canônicas, variável de raiz própria do host e nenhum arquivo de host sem dono no contrato. Qualquer alteração em arquivo específico de harness que quebre isso falha o build (`npm run test:architecture`; diagnóstico sem Vitest: `npm run check:harnesses`). Harness ou pacote novo = declarar no contrato primeiro.
- CI (`.github/workflows/ci.yml`): job `architecture` roda primeiro e bloqueia os demais; Windows e Linux (Node 20.11.1 — o do runtime embarcado — e 22), macOS informativo, e checagens dos bundles Cowork e Agent Plugins.
