---
name: cnct-nucleo-audit
description: >
  Auditoria de saúde de TODO vault tocado na sessão (matriz + qualquer sub-vault
  resolvido) — nunca assume vault único. Três modos: AUDIT (escaneia e atualiza a
  capa de issues, não corrige), REPAIR (lê a capa e corrige interativamente, com
  filtro por operador e visão cruzada opcional, tudo logado) e SCHEDULE (cria
  tarefa agendada real de AUDIT, por operador, com escopo/critérios próprios). Use
  quando o operador disser "audita vault", "saúde do vault", "vault audit",
  "reindexar vault", "limpar vault", "repara vault", "executa repair", "agenda
  auditoria", ou quando uma tarefa agendada disparar. Roda sempre dois níveis de
  checagem por vault: os checks de MECANISMO do produto (contrato de manifesto,
  carta de navegação, notas órfãs achadas só por varredura — config/contrato-manifesto.md
  §5 e config/protocolo-mecanismo.md) e o CONHECIMENTO específico daquele
  vault/cliente (vault-audit.md, carregado de dentro do próprio vault — nunca
  hardcoded aqui).
metadata:
  version: "0.1.0"
  eixo: nucleo
  program: "Impulsa / Viceri"
---

# cnct-nucleo-audit — auditoria de saúde multi-vault

Executor genérico (mecanismo, D96). Uma sessão Connect pode tocar mais de um vault (a
matriz + N sub-vaults resolvidos) — este executor nunca assume um único vault ativo,
mesmo princípio do `cnct-nucleo-encerramento`.

Dois níveis de conhecimento, nunca misturados:
- **Mecanismo (produto, aqui embutido):** checks de contrato válidos para QUALQUER vault
  desta instância Connect — schema de manifesto, carta de navegação, orfandade por
  varredura forçada. Fonte: `config/contrato-manifesto.md` §5 + `config/protocolo-mecanismo.md`.
- **Conhecimento do vault (por-vault, carregado em runtime):** critérios específicos do
  cliente — vive em `{vault}/_inteligencia/skills/vault-audit/vault-audit.md`. Este
  executor nunca hardcoda critério de cliente nenhum; quem sabe é o próprio vault.

> Para atualizar critérios de mecanismo (o que vale pra todo vault): editar este `SKILL.md`
> — reinstalar o `.skill`.
> Para atualizar critérios específicos de um vault: editar `vault-audit.md` daquele vault —
> sem reinstalar nada.
> **Agnóstico de cliente:** nenhum vault, cliente ou critério específico é assumido aqui.

---

## Passo 1 — Enumerar vaults tocados

Chamar `list_mounts(workspace_dir)`. Todo alias montado nesta sessão é candidato a alvo de
auditoria — `./matriz` e qualquer sub-vault resolvido via `resolver`. `./operador` e
`./pessoal` são **estado do operador gerido pelo Connect**, fora de escopo desta skill (mesma
fronteira do `cnct-nucleo-escrita`/`cnct-nucleo-encerramento`) — auditoria aqui é sobre
conteúdo de vault, não sobre `TASKS.md`/perfil do operador.

Se nenhum vault estiver montado: abortar com aviso — "Sem vault ativo; nada a auditar."

## Passo 2 — Determinar o modo

**Modo AUDIT:** acionado por "audita vault", "audit", tarefa agendada, ou qualquer scan.
**Modo REPAIR:** acionado por "repara vault", "executa repair", "corrige issues", "limpa vault".
**Modo SCHEDULE:** acionado por "agenda auditoria", "cria tarefa agendada de audit", "quero
que isso rode sozinho".
**Modo não especificado:** perguntar. Sugerir AUDIT se a capa estiver vazia/velha em algum
vault tocado, REPAIR se houver issues pendentes.

## Passo 3 — Para cada vault tocado, carregar os dois níveis de conhecimento

### 3a. Checks de mecanismo (produto — sempre, em todo vault, sem exceção)

Do contrato de manifesto (`config/contrato-manifesto.md` §5):

| Check | Dispara issue quando |
|-------|----------------------|
| Schema do manifesto | Manifesto sem `tipo`, `papel` ou `governanca` |
| Registro autorado proibido | Existe `_cerebro/sub-vaults.json` (ou índice autorado equivalente) |
| Path/URL no manifesto | Manifesto declara path ou URL (frontmatter ou corpo) — só `conceito`/`alias` são chave válida |
| Lar do cliente | Manifesto `tipo: cliente` fora de `clientes/` (mora sob a árvore organizacional) |
| Grafo bidirecional | Aresta `depende-de: {alvo: B}` declarada em A sem a inversa correspondente em B |
| Acervo pendente há muito tempo | `externo:true` sem `criado-por`/`criado-em` (`pendente-criacao`) persistindo além de `status-desatualizado-dias` do vault — sinalizar, nunca criar sozinho |

Do protocolo do mecanismo (`config/protocolo-mecanismo.md`):

| Check | Dispara issue quando |
|-------|----------------------|
| Nota órfã achada por varredura | A ordem de resolução canônica (resolver → carta → ponteiro) não alcançou uma nota, e ela só foi achada por varredura forçada — o achado em si é o defeito |
| Carta de navegação incompleta/ausente | `_cerebro/camada-1.md` do vault falta, ou a validação (`presentes`/`faltando`, contrato `config/contrato-navegacao.md`) reporta lacuna |
| `entrada` sem caminho válido | Manifesto declara `entrada` mas a nota-hub correspondente não existe no acervo |
| **Conteúdo não governado na raiz** (ADR-18) | Há `{vault}/CLAUDE.md` **sem** marcador `CNCT-GOV-…`. O harness carrega esse arquivo sozinho e o rotula como *override* — é o slot de maior precedência do contexto, ocupado por autoria não verificada (D222/P145). ⚠️ **Severidade alta e tratamento especial: o REPAIR nunca apaga nem sobrescreve.** Pode ser Camada 0 legítima de operador, sonda de medição ou conteúdo de terceiro — a correção é *mostrar ao operador e perguntar*, nunca remediar sozinho |
| **Canal injetado não preparado** | Vault que **recebe escrita** não tem `{vault}/CLAUDE.md` publicado. Severidade baixa: a camada 1 continua chegando pelo mecanismo, só perde o caminho redundante. Correção: `publicar_governanca` via `cnct-fabrica-navegacao`. **Vault somente-leitura não gera issue** — ausência ali é o caso normal, nunca lacuna |

Estes checks rodam em **todo** vault tocado, independente de cliente — não fazem parte do
`vault-audit.md` de ninguém, porque não são conhecimento de cliente, são garantia de produto.

### 3b. Conhecimento do vault (por-vault, cliente)

Ler `{vault}/_inteligencia/skills/vault-audit/vault-audit.md` (ex.: `./matriz/_inteligencia/...`,
ou `./{sub-vault}/_inteligencia/...`).

- **Se não existir:** o vault ainda não tem conhecimento de auditoria provisionado. Materializar
  o **stub** a partir de `templates/vault-audit.template.md` (desta skill), interpolando
  `{{DATA_INSTALACAO}}` = hoje. **Nunca sobrescrever** se já existir. Avisar o operador que, até
  o stub ser personalizado, só os checks de mecanismo (3a) rodam naquele vault.
- **Se existir:** usar as verificações habilitadas, critérios, formato de issue e política de
  escopo/`criterios-override` que ele declarar — sempre a versão **daquele vault**, nunca
  herdada de outro.

## Passo 4 — Derivar artefatos de estado (por vault tocado)

| Arquivo | Propósito | Quando ler |
|---------|-----------|------------|
| `{vault}/_automacoes/vault-audit/issues.md` | **Capa** — só issues pendentes (`aberto`/`em-reparo`), idempotente | Sempre, no início de AUDIT e REPAIR daquele vault |
| `{vault}/_automacoes/vault-audit/issues-historico.md` | Issues resolvidas — apêndice | Sob demanda: leitura histórica de uma issue, ou auditoria de trilha |
| `{vault}/_automacoes/vault-audit/log.md` | Histórico de runs + repairs — append-only | Sob demanda, mesma regra do histórico |
| `{vault}/_automacoes/vault-audit/criterios-customizados.md` | Critérios dinâmicos (recorrentes/pontuais) daquele vault, se houver | Sempre que existir, dentro do AUDIT daquele vault |

> ⚠️ Nunca hardcodar caminho. Todo path é `{alias do vault}/_automacoes/vault-audit/...`,
> derivado do Passo 1. Custo de contexto: a capa é a única leitura obrigatória por vault a
> cada execução — histórico e log só entram sob demanda.

---

## MODO AUDIT (por vault, dentro do loop do Passo 1)

Repetir para cada vault tocado:

1. Ler a capa (`issues.md`) daquele vault. Se não existir, criar vazia.
2. Rodar os checks de mecanismo (3a) — sempre.
3. Rodar os módulos/critérios do `vault-audit.md` daquele vault (3b), dentro do escopo
   efetivo: `audit-config` do operador (`meu-config.md`) → senão `audit-defaults` do
   `vault-config.md` daquele vault → senão escopo pessoal apenas.
   **Critérios próprios do operador (`criterios-override`) só têm efeito em verificações de
   escopo pessoal** — nunca sobrescrevem o critério único de uma verificação coletiva
   (evita abre/fecha divergente no backlog compartilhado entre operadores).
4. Atualizar a capa (idempotente). Toda issue nova carrega **Gerado por** (operador que
   rodou), **Data** (primeira detecção) e **Responsável pelo repair** (vazio). Issue já
   aberta e ainda presente → só atualizar última detecção, sem tocar nesses três campos.
5. Append no log daquele vault.
6. Repetir para o próximo vault tocado.

Ao final: resumo consolidado, um bloco por vault (issues novas / resolvidas desde a última
execução / top categorias).

**Se executado por tarefa agendada:** encerrar aqui. Nunca entrar em REPAIR nem SCHEDULE.

---

## MODO REPAIR (por vault, nunca agendado)

Nunca executa sem o operador presente. Repetir para cada vault com issues pendentes dentro
do escopo (perguntar ao operador se quer revisar todos os vaults tocados ou só um):

1. Ler a capa daquele vault. **Filtro padrão:** só issues cujo **Gerado por** é o operador
   atual. Oferecer a alternativa explícita — "ver todas as issues pendentes do escopo deste
   vault, inclusive de outros operadores" — para reparo proativo.
2. Separar por severidade/prioridade; apresentar cada issue: arquivo · problema · Gerado
   por · Data · ação proposta.
3. Aguardar resposta: `"sim"` / `"pula"` / `"ajusta: {instrução}"` / `"delega: {nome}"`.
4. `"delega: {nome}"` → preencher **Responsável pelo repair** com `{nome}` na capa, registrar
   a delegação no log, seguir para a próxima issue sem executar a correção agora.
5. `"sim"`/`"ajusta"` → carregar `cnct-nucleo-escrita` (protocolo de escrita governada) antes
   de qualquer escrita semântica naquele vault; executar conforme a ação sugerida pelo
   `vault-audit.md` daquele vault (issues de mecanismo têm ação padrão — ex.: manifesto sem
   `governanca` → perguntar e preencher; aresta órfã → perguntar se cria a inversa ou remove
   a original).
6. Issue resolvida → **mover de `issues.md` para `issues-historico.md`** daquele vault,
   preenchendo Resolvido por + Data resolução. Nunca apenas remover da capa.
7. Append no log — **rastreabilidade obrigatória, sem exceção**: data-hora, quem reparou/
   delegou, Gerado por original, ISSUE, vault, ação.

Relatório final: todas as correções e delegações da sessão, por vault.

---

## MODO SCHEDULE

Cria uma tarefa agendada real de AUDIT (nunca de REPAIR — REPAIR sempre exige revisão
humana presente). Cada operador pode ter sua própria tarefa, com seu próprio escopo/vaults/
critérios — tarefas de operadores diferentes não se sobrepõem.

1. **Escopo:** perguntar quais vaults tocados entram (matriz sempre; sub-vaults, sob
   confirmação). Ler `audit-config` do operador em `meu-config.md` (escopo +
   `verificacoes-skip` + `criterios-override`); oferecer usar como está ou ajustar só para
   esta tarefa.
2. **Cadência:** sugerir default por contexto (squad ativa → semanal; vault estável →
   quinzenal; onboarding/vault novo → diária nos primeiros 30 dias). Confirmar.
3. **Criar a tarefa** com a ferramenta de tarefa agendada da plataforma (nunca scheduler
   efêmero da sessão). Nome: `Vault Audit — {operador} — {vault(s)/cliente}`.
   **O prompt precisa ser autocontido** — cada disparo é uma sessão nova, sem memória desta:
   identidade do operador, vaults/escopo/critérios confirmados (embutidos, não "o que estiver
   configurado no momento"), instrução de rodar só AUDIT (nunca REPAIR), persistir na capa
   de cada vault com Gerado por = este operador, resumo final sem pedir confirmação.
4. Confirmar ao operador: nome, cadência, escopo embutido. Lembrar que outros operadores
   podem repetir este fluxo para ter a própria tarefa.

---

## Fora de escopo

- Não audita `./operador` nem `./pessoal` como conteúdo de vault (estado do Connect —
  ver `cnct-nucleo-encerramento`).
- REPAIR e SCHEDULE nunca corrigem/agendam fora do escopo confirmado pelo operador.
- Não cria manifesto, sub-vault ou carta de navegação por conta própria — issues desses
  tipos **oferecem** a fábrica correspondente (`cnct-fabrica-navegacao`, `cnct-fabrica-<tipo>`),
  nunca materializam sozinhas.
- **Nunca apaga nem sobrescreve `CLAUDE.md` de raiz**, em modo nenhum, com ou sem confirmação
  em lote. É a única classe de arquivo em que o REPAIR não tem autoridade de escrita: ele pode
  ser Camada 0 de operador, sonda de medição em curso ou conteúdo de terceiro, e apagar qualquer
  um dos três destrói conhecimento ou uma medição. O reparo é **mostrar e perguntar**.
