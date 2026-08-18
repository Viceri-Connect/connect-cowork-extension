# Changelog — connect

## 0.11.0 — 2026-08-17
- **Corte de raiz sobre o P69 (2ª rodada de dogfooding, mesma sessão): manifesto nunca mais
  guarda path/url — nem relativo.** O fix da 0.10.2 (varrer o corpo inteiro por
  `onedrive-rel`) tratava o sintoma; o operador cortou a causa: path é sempre por-operador,
  por-máquina (D35), nunca conteúdo coletivo. Frontmatter agora é puro:
  - `fonte`/`url` **removidos inteiros** do contrato de manifesto. Campos novos: `escopo`
    (chave estável, nunca inferida do nome do arquivo), `externo` (bool — tem acervo fora da
    matriz?), `criado-por`/`criado-em` (já foi materializado, ou é só intenção declarada?),
    `entrada` (nota-hub dentro do acervo, pra pousar direto sem tatear).
  - `lib/resolver.mjs` reescrito: `onedriveRoot()`/`resolverFonte()` removidos por completo
    (zero aritmética de path). Path local mora só em `connect.config.json` (`subVaults:
    {escopo: caminho}`), nova tabela em `lib/session.mjs` (`resolveConfig`) + primitivo
    novo `registrarSubVaultLocal()`.
  - Status novos do `resolver`: `sem-acervo-externo` (entidade sem `externo:true` — conteúdo
    inline na matriz), `pendente-criacao` (declarada, acervo ainda não nasceu — aciona
    fábrica), `local-nao-configurado` (escopo sem path nesta máquina — pergunta ao operador).
    `resolvido` agora devolve `entrada` pra pousar na nota certa sem tatear diretório.
  - Novo MCP tool `registrar_subvault_local` — grava o path local de um escopo; nunca no
    vault.
  - `config/protocolo-mecanismo.md` ganhou a seção "Camada 2 em detalhe — resolve-on-touch":
    disciplina explícita (nunca grep como primeira tentativa, status dita a ação, alias
    resolvido vale pro resto da sessão) — antes vivia só como entendimento implícito.
  - `contrato-manifesto.md` (v0.2.0) e as skills `cnct-nucleo-sessao`/`cnct-nucleo-conhecimento`
    realinhadas ao schema novo.
  - Aresta `depende-de` área↔tribo (herança de processo) fica **fora de escopo desta rodada**
    — deferida pelo operador.

## 0.10.2 — 2026-08-17
- **Bug real corrigido: `resolver()` não achava `onedrive-rel` em vault-config.md real.**
  `onedriveRoot()` (`lib/resolver.mjs`) restringia a busca a `extrairFrontmatter()` (só o
  bloco YAML entre os primeiros `---`), mas `onedrive-rel` mora no **corpo** do arquivo
  (seção `## Sincronização`) em todo `vault-config.md` real (matriz e Tribo Impulsa) —
  mesma convenção que `montarL1`/`parseKeyValues` (`matriz.mjs`) já respeitavam lendo o
  arquivo inteiro. Sem o fix, `resolver()` falhava com `origem-nao-resolvida` para
  **qualquer** sub-vault com fonte relativa — não era specific do Impulsa, era sistêmico.
  - Fix: busca no conteúdo inteiro do arquivo, não só no frontmatter.
  - Teste de regressão adicionado em `spike-resolver.mjs` (formato real, campo no corpo) —
    suíte agora 20/20 (era 19/19).
  - Achado e diagnosticado no dogfooding desta sessão (dia 17/08), tentando resolver a
    Tribo Impulsa pela primeira vez.

## 0.10.1 — 2026-08-17
- **Correção de território sobre a 0.10.0 (mesma sessão).** `cnct-fabrica-matriz` (skill +
  `templates/vault-config.template.md`) **removida** — misturava dois territórios distintos:
  (a) Connect↔Matriz, o plugin garantindo que a matriz cresça com a forma pra guardar
  contexto global (empresa/áreas/clientes/processos/normas) — maior, ainda não desenhado,
  não é uma fábrica-de-nascimento-única; (b) o stub de **conhecimento de uma skill do
  plugin** na matriz (ex.: `cnct-nucleo-escrita.md`) — esse sim é o padrão certo, só que
  pertence à própria skill que o consome, não a uma fábrica separada.
  - `templates/cnct-nucleo-escrita.template.md` **movido** para dentro da skill que o usa:
    `skills/cnct-nucleo-escrita/templates/`.
  - `cnct-nucleo-escrita` (v0.3.0) ganhou o **Passo 2a**: se a matriz não tiver o contrato
    ainda, materializa o stub do próprio template e avisa o operador que o índice de vaults
    precisa ser personalizado — nunca sobrescreve se já existir.
  - Território Matriz↔Sub-vaults (como um processo maduro, ex. SDD, desce com deltas e vira
    skill customizada tipo `discovery-intake`) **não é mecanismo do plugin** — nasce no
    vault, usa o empacotamento `.skill` já existente (`convencao-skills.md`). Fora de escopo
    do Connect possuir essa skill.

## 0.10.0 — 2026-08-17
- **Realinhamento, correção de rumo (P66).** `cnct-nucleo-escrita`/`cnct-nucleo-encerramento`
  tinham dois defeitos apontados pelo operador: (1) linguagem de "convive/coexiste com o
  executor antigo" no próprio executor — mecanismo não precisa saber da "moda antiga" nem
  contornar; (2) o executor **hardcoded** a convenção de onde a taxonomia de um sub-vault
  mora — deveria ser só o contrato da matriz quem diz isso. Ambos corrigidos: executores
  reescritos sem menção ao modelo antigo; Passo 3 de `cnct-nucleo-escrita` agora só segue o
  que o contrato da matriz indicar, nunca deduz.
- **Matriz e Tribo Impulsa alinhadas de verdade** (os dois vaults reais desta instância, não
  só o mecanismo abstrato):
  - `_inteligencia/skills/cnct-nucleo-escrita/cnct-nucleo-escrita.md` da matriz reescrito
    como **índice real** dos vaults desta instância (matriz, Tribo Impulsa, MAPFRE) +
    regras universais de escrita elevadas de conteúdo duplicado (histórico, Casa da
    ADR/RNF, despromoção — já "equalizadas" entre coletivos, portanto mecanismo de fato).
  - **Tribo Impulsa ganhou seu `_inteligencia/skills/vault-write/vault-write.md`** (não
    existia) — taxonomia própria (`projetos/`, `squads/`), sem duplicar as regras
    universais (aponta pro contrato da matriz).
- **`cnct-fabrica-matriz` (L2, nova)** — provisiona matriz do zero por elicitação (empresa,
  contexto, ponto focal, âncora `onedrive-rel` — perguntada já na elicitação, não descoberta
  só quando um `resolver` falhar, achado do dogfooding desta sessão). Templates próprios
  (`vault-config.template.md`, `cnct-nucleo-escrita.template.md`) fecham o ciclo: a matriz
  real desta instância já reflete a mesma forma que o template gera.
- Suíte de testes confirmada verde (nenhuma mudança de código, só knowledge/skills/templates).

## 0.9.0 — 2026-08-17
- **Realinhamento de protocolos, Passo 2/6 (P66) — primitivos de escrita/encerramento
  multi-vault.** Duas skills novas no plugin, família `nucleo` (L1), **sem alterar** os
  executores `vault-write`/`session-close` existentes (convivem — coletivo ainda não
  migrado continua usando o antigo sem mudança nenhuma):
  - **`cnct-nucleo-escrita`** — escrita governada em duas camadas: contrato universal na
    matriz (`_inteligencia/skills/cnct-nucleo-escrita/cnct-nucleo-escrita.md`, novo,
    mecanismo) + taxonomia específica do vault alvo (`_inteligencia/skills/vault-write/
    vault-write.md`, existente, intocado — reaproveitado como conteúdo). Sem taxonomia no
    vault alvo, reporta a lacuna — nunca herda de outro vault nem inventa.
  - **`cnct-nucleo-encerramento`** — assume o papel operacional do `session-close`, mas
    generalizado para **multi-vault**: enumera todos os aliases montados na sessão
    (`list_mounts`), atribui cada item capturado ao vault a que pertence, e delega a
    escrita a `cnct-nucleo-escrita` por vault — nunca assume "1 coletivo ativo".
  - **`lib/session.mjs`: `./operador` passa a ser montado sempre** (novo `ALIAS_OPERADOR`),
    expondo `{CONNECT_HOME}/operador/` como superfície de escrita do estado do operador
    (`TASKS.md`, delta de identidade) — decisão desta sessão: TASKS.md do operador
    centraliza no CONNECT_HOME por ora (não depende do vault pessoal Obsidian opcional);
    segregar/conviver com vault separado fica como evolução futura. Mesma exigência de
    acesso do Cowork que qualquer outro mount (não concede leitura por si só).
  - Suíte de testes (5 arquivos) confirmada verde após a mudança de mount — nenhum spike
    quebrou.

## 0.8.2 — 2026-08-17
- **Realinhamento de protocolos, Passo 1/6 (P66, roteiro-sessao-realinhamento-protocolos).** A espinha
  injetada (`render.mjs` § "Protocolo desta sessao") ainda descrevia o `resolver` como **"em
  construcao"** — defasado desde o P61/D110 (17/08), que já fechou o realinhamento do `resolver` ao
  índice derivado de manifestos. Texto atualizado para refletir o modelo real (deriva do
  `contrato-manifesto.md`, casa por slug/gatilho).
  - **`plugin.json`:** description trocava "(roadmap) resolver conceitos" — mesma classe de drift,
    corrigida.
  - **`mcp/connect-mcp.mjs`:** description da tool `resolver` ainda citava o `_cerebro/sub-vaults.json`
    removido (achado durante dogfooding desta sessão); `SERVER_INFO.version` estava travado em `0.4.0`
    desde o 0.4.0, sem acompanhar os bumps do CHANGELOG — ambos corrigidos/sincronizados em `0.8.2`.
  - `config/protocolo-mecanismo.md` conferido contra D109/D114 — já usa a linguagem "manifesto + acervo"
    corretamente; nenhuma mudança necessária ali.

## 0.8.1 — 2026-08-17
- **Passe de agnosticismo (produto ≠ matriz do MVP).** Remove vazamento do contexto de
  dogfooding do código e das docs normativas, mantendo só a **proveniência** (author
  "Impulsa / Viceri", marketplace `impulsa`) — regra: branding ≠ contexto forçado.
  - **Código:** `lib/matriz.mjs` lê identidade por campo **genérico** (`emails`/`email`),
    não mais `email-viceri` (campo específico de empresa). Alinha com o template `meu-config`.
  - **Docs de produto** com exemplos **100% genéricos** (Empresa X, tribo-a, cliente-a):
    `contrato-manifesto.md`, `CONCEITOS.md`, `FRAMEWORK.md` (§5 marcada como "exemplo —
    instância de dogfooding", não catálogo do produto).
  - **Config/comentários:** `connect.config.example.json`, comentários de `resolver.mjs` e
    `spike-junction.ps1` genéricos; `docs/POC-NOTES.md` com disclaimer de dogfooding.
  - Testes atualizados ao campo genérico; suíte 5/5 verde.

## 0.8.0 — 2026-08-17
- **Taxonomia canônica (`CONCEITOS.md`).** Documenta sem ambiguidade: **instância** (uma mente
  = 1 matriz + N sub-vaults; "mais de uma matriz" = mais de uma instância), **matriz** (a
  espinha dorsal, define o que é filho — 1 por instância), **sub-vault** (contexto-filho; **a
  MAPFRE é sub-vault, NÃO matriz**), **vault pessoal** (opcional) e **CONNECT_HOME** (estado do
  Connect: config + perfil + sessões).
- **Vault pessoal deixa de ser obrigatório; perfil do operador vive no CONNECT_HOME.** O
  `iniciarSessao` restaura a identidade de `{CONNECT_HOME}/operador` (perfil gerido pelo
  produto), com fallback para o vault pessoal (back-compat). Sem perfil e sem vault → aviso que
  delega à `cnct-fabrica-operador` (estado zero). O vault Obsidian próprio do usuário passa a
  ser **enriquecimento** montado como `./pessoal`, nunca condição do mecanismo — os dois
  coexistem. Removido o aviso duro "CONNECT_CEREBRO_PESSOAL não definido".
- **`cnct-fabrica-operador` aponta o destino para `{CONNECT_HOME}/operador`** (Passos 1 e 4);
  o perfil é auto-descoberto pelo mecanismo, sem `configurar` para o perfil. Novo teste
  `spike-perfil-operador.mjs` (7 checks: identidade sem vault pessoal + delegação no estado
  zero). Suíte: 5 arquivos verdes.

## 0.7.0 — 2026-08-17
- **Contrato de manifesto de entidade (`config/contrato-manifesto.md`).** Materializa o
  contrato mínimo (CH-01/CH-02) que até agora vivia só como decisão (D97/D99): o schema de
  frontmatter de todo manifesto — `tipo`, `papel`, `governanca`, `fonte[]`, `depende-de` — as
  invariantes (registro autorado proibido, índice **derivado em runtime**, cliente fora da
  árvore, acervo nunca expandido no render, ponteiro tipado resolve-on-touch), o **grafo de
  dependências com arestas bidirecionais** (D102) e a **face de verificação** que o
  `vault-audit` passa a checar. É a exigência que o realinhamento do `resolver` (P59/P60/P61)
  vai consumir no lugar do `sub-vaults.json`.
- **`resolver` realinhado ao índice derivado (P61 fechada).** `lib/resolver.mjs` deixa de ler
  o registro autorado `_cerebro/sub-vaults.json` (**removido** — proibido pelo contrato §3) e
  passa a **derivar o índice dos manifestos** em runtime: varre o frontmatter (`tipo` + `fonte`),
  casa o conceito por slug/`tags`, e resolve a `fonte` (relativa ao OneDrive) para caminho
  absoluto via `onedrive-rel` do `vault-config` da matriz (âncora por-máquina, D35). Novos
  helpers exportados: `parseManifesto`, `onedriveRoot`. Novo status: `origem-nao-resolvida`.
  Teste `spike-resolver.mjs` reescrito para o modelo derivado (19 checks); suíte verde.
- **Notas de estado das skills `cnct-nucleo-*` atualizadas** — de "resolver ainda lê
  sub-vaults.json (P61 aberta)" para "índice derivado (P61 fechada)".

## 0.6.0 — 2026-08-15
- **Framework do catálogo de skills (`FRAMEWORK.md`).** Padrão único ao qual toda skill do
  Connect adere: anatomia executor × knowledge (corte D96), três camadas do catálogo
  (L1 primitivos · L2 fábricas por tipo · L3 meta, D101), o padrão `cnct-fabrica-<tipo>`, a
  **convenção de nomes `cnct-<família>-<objeto>`** (§3.1) e a **classificação do catálogo
  atual** (varredura D96 — resposta em princípio ao P58, com os casos de split marcados).
- **Convenção de nomes aplicada — renomeação do catálogo de mecanismo.** As skills do plugin
  passam a seguir `cnct-<família>-<objeto>`: `connect-bootstrap` → **`cnct-nucleo-sessao`**,
  `connect-knowledge-mount` → **`cnct-nucleo-conhecimento`**, `fabrica-operador` →
  **`cnct-fabrica-operador`**. Skills de conteúdo (família SDD) mantêm o nome de domínio.
- **Skill `cnct-fabrica-operador` (L2, referência).** Provisiona um vault de operador do zero
  por elicitação, **self-contained** (roda no estado zero, sem coletivo montado). Materializa
  só o **delta** (a espinha vem do `protocolo-mecanismo.md`, D104); templates genéricos em
  `skills/cnct-fabrica-operador/templates/` (`meu-config.template.md`, `CLAUDE.template.md`).
  Supersede o `Template-Onboarding-Vault-Individual` do coletivo (D105).
- **`cnct-nucleo-sessao` (era connect-bootstrap) — delegação + modelo de grafo.** (1) Ausência
  de vault de operador deixa de ser erro: detecta a pasta em branco / `cerebro_pessoal`
  ausente e **delega à `cnct-fabrica-operador`** (gatilho de nascimento, D97/D105). (2) Passo 4
  reescrito para o modelo canônico de **grafo de manifestos** (D102): casamento na skill,
  índice derivado (P60/D35), MCP só com o primitivo de mount — com nota do estado do código
  (`resolver` v0.4.0 ainda lê `sub-vaults.json`; realinhamento = P61).
- **`cnct-nucleo-conhecimento` (era connect-knowledge-mount) — alinhada ao modelo remodelado.**
  Seção de sub-vault reescrita para grafo/manifesto derivado (D102/P60/P61); o `sub-vaults.json`
  passa de contrato a **nota de estado do código** (comportamento vigente até o P61).

## 0.5.0 — 2026-08-15
- **Garantia de protocolo executado (D104).** A espinha dorsal do dois-cérebros
  (resolução lazy em camadas, regra de escrita/wikilinks, calibração "identificador
  nunca vem sozinho", check de atualizações) deixa de depender do `CLAUDE.md` do
  operador e passa a ser **entregue pelo produto**: novo `config/protocolo-mecanismo.md`,
  lido por `lerProtocoloMecanismo()` e **injetado verbatim no bloco de sessão** pelo
  `render.mjs`. Como é arquivo do plugin (pasta de mecanismo, D96), a garantia é
  estrutural — não há "esquecer de ler" nem deletar do lado do usuário.
- **Handshake do vault pessoal (D104).** `iniciarSessao` passa a carregar a **Camada 0
  pessoal** via `montarL1Pessoal()` (hot cache `_cerebro/CLAUDE.md` inline + ponteiros
  lazy para `CLAUDE.md` raiz, `_cerebro/memory`, `30-Áreas`, `TASKS.md`). Antes o
  cérebro pessoal entrava só como mount + identidade (`meu-config.md`); o delta pessoal
  nunca disparava.
- `render.mjs`: duas seções novas no bloco de sessão — "Protocolo do mecanismo
  (garantido pelo Connect)" e "Cerebro pessoal — camada 0". Testes existentes
  (`spike-mecanismo`, `handshake-mcp`, `spike-resolver`, `spike-config-guiada`) seguem
  verdes; comportamento novo verificado contra os vaults reais.

## 0.4.0 — 2026-08-15
- **`resolver(conceito)` implementado** (era roadmap): entrega um sub-vault por
  CONCEITO como atalho flat no workspace. Lê um **registro declarativo**
  (`_cerebro/sub-vaults.json`) no cérebro pessoal e/ou na matriz (pessoal vence),
  casa o conceito por nome ou gatilho, monta a junction/symlink da origem e carrega
  a camada 1 do sub-vault (quando ele tem forma de vault). Novo `lib/resolver.mjs`
  (zero-dep) e tool MCP `resolver` (`conceito`, `workspace_dir`, `alias?`, `replace?`).
- Registro declarativo `_cerebro/sub-vaults.json`: lista de
  `{ conceito, origem, alias?, gatilhos?[], nota? }` — o "ponteiro declarativo" que
  deixa a próxima sessão saber o caminho de cada contexto.
- Teste `spike-resolver` (casar por conceito/gatilho/substring, montar, ler através
  do atalho, origem intacta, L1, idempotência, não-encontrado).

## 0.3.0 — 2026-08-14
- Repo tratado como **marketplace** (`impulsa`) instalável no Cowork pela **URL do
  repo git**; `.plugin` de um clique mantido como caminho secundário
  (`scripts/build-plugin.sh`). CLI do Claude Code rebaixada a dev-only.
- **Configuração guiada do 1º uso**: tool `configurar` grava os caminhos em
  `connect.config.json` (atualização parcial, valida existência, reporta inválidos).
- Tool `estado_sessao`: checagem leve (configurado? montado nesta sessão?) sem efeito colateral.
- Skill **connect-bootstrap**: fallback do hook — dispara em qualquer menção a
  trabalho e restaura o contexto coletivo (identidade + matriz + camada 1); conduz
  a config guiada; aprofunda sob demanda. Mesmo mecanismo do hook, gatilho por skill.

## 0.2.0 — 2026-08-14
- Reconcebida a superfície do MCP (decisão 2026-08-14): **sem entidade "cliente"**.
  Adicionada a tool `iniciar_sessao` (bootstrap da sessão); primitivos de mount
  (`mount_junction`/`unmount_junction`/`list_mounts`) mantidos como base do futuro
  `resolver`.
- `iniciar_sessao`: cria o scaffold da sessão fora do OneDrive, monta a **matriz**
  como `./matriz`, restaura a **identidade** do operador (cérebro pessoal) e carrega
  o **contexto lazy da camada 1** da matriz (inline curto + ponteiros).
- Núcleo reorganizado em `lib/` (mount, matriz, session, render), zero-dep.
- Hook `SessionStart` (`type: command`, matcher `startup|resume|fork`) chama o mesmo
  núcleo do `iniciar_sessao`.
- Repositório reestruturado no padrão marketplace + `plugins/connect/` (PACKAGING §3).
- Testes: `spike-mecanismo` (15 checagens, ponta a ponta) e `handshake-mcp`.

## 0.1.0 — 2026-08-13 (banco de provas, lab)
- Primitivo de mount provado na máquina real: junction NTFS (mount/read/unmount,
  origem intacta), MCP handshake, hook SessionStart montando aliases de config,
  travas de segurança. Origem: `D:\Impulsa\lab\lab\connect`.
