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

## GitHub Copilot (VS Code)

O adaptador do Copilot é gerado a partir do mesmo MCP e das mesmas skills, com um hook
`SessionStart` nativo que injeta o bootstrap do Connect no início da sessão. Gere o
plugin instalável:

```
npm run build:copilot
```

Instale `dist/copilot` pela tela **Chat: Open Customizations > Plugins > Install from Source**, ou adicione o repositório como marketplace no VS Code e instale **connect**. O Agent Plugin usa os manifests portáveis `plugin.json` e `mcp.json`, compartilha `skills/` com o Cowork e usa o mesmo `CONNECT_HOME` do Cowork (padrão `~/Connect`). O hook injeta o resultado de `iniciar_sessao`; se ainda não houver matriz nesta instalação, injeta o fluxo de primeiro uso para o agente conduzir. O servidor requer `node` no ambiente que inicia o MCP e os caminhos locais da matriz precisam estar visíveis para esse processo. Em ambientes remotos ou isolados, execute `ambiente_connect` para verificar o estado observável; suporte a links é reportado como não testado sem efeitos colaterais.

O marketplace do repositório também lista **connect-http** como alternativa. `.github/copilot/settings.json` registra o marketplace `impulsa` e habilita somente `connect` por padrão; selecione `connect-http` manualmente quando necessário.

O plugin Copilot não configura nem substitui o Windows MCP. PowerShell e controle da
máquina permanecem no servidor MCP do host, separado e sujeito às aprovações dele.
Consulte `docs/host-control-boundary.md` antes de habilitar ferramentas de host.

## Codex e ChatGPT Work

O marketplace local em `.agents/plugins/marketplace.json` oferece **Connect**
(STDIO, padrão) e **Connect HTTP (Local)**. O pacote versionado em
`plugins/connect-http` compartilha as mesmas skills e tools. Para gerar uma cópia
de distribuição em `dist/connect-http`, execute `npm run build:connect-http -- dist/connect-http`.
No ChatGPT Desktop, adicione este repositório como marketplace e instale
somente uma das variantes. Codex CLI, extensão IDE e ChatGPT Work em execução local
podem usar o MCP local pela configuração compartilhada do host. Hooks não gerenciados
precisam ser revisados e autorizados pelo Codex.

Use a variante HTTP somente se o host não conseguir iniciar um MCP stdio. Inicie o
servidor separado na raiz do repo e deixe-o em execução:

```
node plugins/connect-http/mcp/connect-mcp.mjs --transport=http --port=3737
```

O endpoint fica em `http://127.0.0.1:3737/mcp`; a porta pode ser alterada por
`--port` ou `CONNECT_MCP_PORT`. `--transport=http` também pode ser substituído por
`CONNECT_MCP_TRANSPORT=http`. O servidor só escuta em loopback. Não instale as duas
variantes simultaneamente no mesmo host: ambas expõem as mesmas tools.

ChatGPT Work em execução na nuvem não acessa o processo local nem os caminhos da
máquina. Essa modalidade exige endpoint MCP remoto HTTPS com autenticação e
hospedagem configuradas; este repositório não presume nem provisiona essa
infraestrutura.

## Antigravity App

Os pacotes `plugins/connect` e `plugins/connect-http` incluem o overlay
`.antigravity-plugin/plugin.json`, a configuração MCP e o hook `SessionStart` no
formato nativo do Antigravity. Instale a variante desejada a partir do diretório
local (`agy plugin install ./plugins/connect` ou
`agy plugin install ./plugins/connect-http`) ou coloque-a em `.agents/plugins/`.
Para validar, execute `agy plugin validate --strict` no diretório escolhido.

Todos os hosts (Cowork, Copilot, Codex e Antigravity) usam o mesmo `CONNECT_HOME`,
padrão `~/Connect`: `repos`, `subVaults`, matriz e perfil do operador são por máquina
e não por host. Um `PLUGIN_DATA` separado por host deixava o config sem `repos` e sem
sub-vaults, e o agente não resolvia o que o Cowork resolve. Defina `CONNECT_HOME` só se
quiser outro local, e o mesmo em todos os hosts.

Todos os adaptadores preservam a fronteira do host: Connect não inclui execução
genérica de shell/PowerShell nem controle de desktop. O Windows MCP segue separado.

## Estrutura (marketplace + plugin)

```
.claude-plugin/marketplace.json     # marketplace "impulsa" — aponta ./plugins/connect
plugins/connect/                     # o plugin instalável
  ├── .claude-plugin/plugin.json     # ← fonte da VERSÃO
  ├── .mcp.json                      # registra o MCP stdio local "connect"
  ├── mcp/connect-mcp.mjs            # servidor MCP (iniciar_sessao + primitivos de mount)
  ├── lib/                           # núcleo testável, zero-dep
  │   ├── mount.mjs                  #   junction (Windows) / symlink (POSIX)
  │   ├── matriz.mjs                 #   identidade + montagem da camada 1
  │   ├── session.mjs                #   iniciarSessao() — o bootstrap
  │   └── render.mjs                 #   bloco de contexto da sessão
  ├── hooks/                         # SessionStart (type: command) → iniciarSessao
  ├── skills/connect-knowledge-mount/
  ├── scripts/spike-junction.ps1     # spike da premissa 2 (junction NTFS) no host
  └── config/connect.config.example.json
scripts/build-plugin.sh              # empacota o .plugin (caminho secundário)
docs/                                # SPEC, notas do POC
tests/                               # spikes que matam premissas (repetíveis)
```

## Configuração (paths locais, nunca versionados)

Via env ou por `{CONNECT_HOME}/connect.config.json`
(ver `plugins/connect/config/connect.config.example.json`):

- `CONNECT_HOME` — pasta fixa do Connect, **fora do OneDrive** (scaffold das sessões).
- `CONNECT_VAULT_MATRIZ` — caminho local da matriz.
- `CONNECT_CEREBRO_PESSOAL` — caminho local do cérebro pessoal (identidade).

## Testes

```
node tests/spike-mecanismo.mjs     # núcleo ponta a ponta (symlink no Linux, junction no Windows)
node tests/handshake-mcp.mjs       # handshake do MCP + iniciar_sessao
```

Ver `docs/POC-NOTES.md` para o spike das premissas 1–3 no host Windows/Cowork.

