# Connect — notas do POC (fatia 1: iniciar_sessao)

> Objetivo desta fatia: provar, na máquina real, que o bootstrap da sessão funciona
> ponta a ponta no Cowork — restaura identidade, monta a matriz como atalho flat,
> carrega a camada 1 — e matar as premissas 1, 2 e 3 da SPEC-V1.

## O que já está provado (no sandbox)

- `tests/spike-mecanismo.mjs` — 15 checagens do núcleo: scaffold fora da origem,
  matriz e pessoal montados, **leitura através do atalho**, identidade parseada,
  L1 montada, origem intacta, idempotência. (No Linux via symlink; a lógica é a
  mesma do Windows via junction.)
- `tests/handshake-mcp.mjs` — o MCP sobe, lista `iniciar_sessao` e responde.
- Rodado também contra os **dados reais** (cópia da matriz + second brain em
  `D:\Impulsa`): identidade e L1 casaram com o formato real, zero avisos.

## Premissas que só o host Windows + Cowork matam

| # | Premissa | Como provar |
|---|----------|-------------|
| 2 | Cowork lê **através** de junction NTFS fora do OneDrive | `scripts/spike-junction.ps1` (abaixo) + abrir o arquivo pela file tool do próprio Cowork |
| 1 | Hook `SessionStart` dispara no Cowork com `session_id` único por janela | instalar o plugin, abrir 2 janelas, comparar o scaffold criado |
| 3 | Consentimento de mount da pasta fixa persiste entre sessões | conectar `CONNECT_HOME` uma vez, fechar, reabrir |

### Passo A — spike da junction (premissa 2), não precisa do Cowork

```powershell
cd D:\Workspaces\github\Viceri-Connect\connect-cowork-extension\plugins\connect\scripts
powershell -ExecutionPolicy Bypass -File .\spike-junction.ps1 `
  -Matriz "CAMINHO\DA\SUA\viceri-vault"
```

Espera-se duas linhas "OK" (leitura pela junction + origem intacta).

### Passo B — instalar no Cowork e provar premissas 1 e 3

Install **nativo do Cowork** (não é a CLI do Claude Code):

1. Commit + push deste repo (o Cowork adiciona o marketplace pela URL do git).
2. No Cowork, adicionar um marketplace de plugins pela **URL do repo**
   (`https://github.com/Viceri-Connect/connect-cowork-extension`) e instalar o
   plugin **connect** do marketplace `impulsa`.
   - Alternativa leiga (sem git): `bash scripts/build-plugin.sh` gera
     `dist/connect.plugin`; abrir o arquivo no Cowork e aceitar.
3. Configurar os caminhos (uma vez) — via env do usuário ou
   `{CONNECT_HOME}/connect.config.json`:
   - `CONNECT_HOME` = `%LOCALAPPDATA%\Connect` (fora do OneDrive)
   - `CONNECT_VAULT_MATRIZ` = caminho local da matriz
   - `CONNECT_CEREBRO_PESSOAL` = caminho local do second brain
4. Conectar a pasta `CONNECT_HOME` ao Cowork **uma vez** (consentimento de mount).
5. Abrir uma sessão nova → o hook deveria injetar o bloco "Connect — sessão iniciada"
   com a identidade e o atalho `./matriz`.
6. **Premissa 1:** abrir uma segunda janela e conferir se surgem dois scaffolds
   distintos em `%LOCALAPPDATA%\Connect\sessions\` (um `session_id` por janela).
7. **Premissa 3:** fechar tudo, reabrir, e ver se a pasta `CONNECT_HOME` já aparece
   conectada sem novo consentimento.

> **Premissa 1 é a que mais pode cair:** a skill `create-cowork-plugin` diz que
> hooks são *"rarely used in Cowork"*. Se o `SessionStart` não disparar no Cowork,
> cai para o fallback: chamar a tool MCP `iniciar_sessao` manualmente (ou por
> instrução no protocolo das skills) — o mecanismo é o mesmo, só muda o gatilho.

> **Configuração pra leigo (gap aberto):** o formato de plugin do Cowork não tem
> UI de `user_config`. Hoje os 3 caminhos vêm de env / `connect.config.json`. O
> passo que falta pra um leigo é uma **configuração guiada no 1º uso** (o agente
> pergunta onde está a matriz e grava o `connect.config.json`) — próxima fatia.

## Notas de decisão embutidas nesta fatia

- **Sem entidade "cliente".** O único mount incondicional é a casca + a matriz
  (teto de governança). Sub-vaults descem por conceito, via `resolver` (próxima
  fatia), acionado pelo protocolo compartilhado das skills.
- **Camada 1 hoje é um conjunto sensato hardcoded** (`lib/matriz.mjs`). A definição
  canônica de camadas por **tipo de vault** é o trilho de tipologia (manifesto de
  vault + molde da matriz), aterrado no vault MAPFRE — entra aqui depois.
- **Identidade lida na origem** (não pela junction) durante o boot, para não
  depender da premissa 2 antes de ela estar provada.
