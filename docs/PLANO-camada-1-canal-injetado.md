# Plano de implementação — camada 1 pelo canal injetado

> Substitui o desenho de **espelho derivado** da ADR-17 por **governança + ponteiro** (proposta do
> Gabriel, 26/08). A fonte da camada 1 continua sendo `_cerebro/camada-1.md`; nada de conteúdo é
> duplicado. Ver "Por que mudou" abaixo antes de implementar.
>
> Estado: proposto · 2026-08-26 · aguarda emenda da ADR-17

---

## Por que mudou

O desenho anterior publicava `{vault}/CLAUDE.md` como **espelho** do conteúdo da carta, com
`CNCT-L1-{vault}-{hash-da-fonte}`, regenerado quando o hash divergisse. Isso exige escrita
recorrente no vault.

**A objeção que derrubou:** matriz e Tribo Impulsa são bibliotecas compartilhadas do OneDrive.
Escrita recorrente no mesmo arquivo, por N operadores, gera cópia de conflito — e não é hipótese.
A **P144** mediu, em 26/08, o OneDrive resolvendo **dois** conflitos a favor da versão velha, um
deles a própria carta da matriz. O efeito foi silencioso e durou sessões: o caminho continuou
válido e toda sessão foi injetada com conteúdo superado.

O desenho novo troca uma garantia forte com risco de sync recorrente por uma garantia um pouco
mais fraca com **risco de sync zero**:

| | Escreve quando | Entrega a camada 1 |
|---|---|---|
| Espelho (ADR-17 original) | toda vez que a carta muda | conteúdo já no contexto |
| **Governança + ponteiro (este plano)** | **uma vez, no nascimento do vault** | um passo de leitura, num arquivo que abre |

O que torna o passo de leitura confiável é a segunda metade da proposta: **a matriz vira pasta
conectada do projeto Cowork**, então `_cerebro/camada-1.md` abre por construção. O que falhou em
26/08 foi o `contexto-sessao.md`, que mora no *workspace* — com a matriz conectada, o workspace
sai do caminho crítico da camada 1.

---

## O artefato

`{vault}/CLAUDE.md`, **write-once**, materializado pela `cnct-fabrica-navegacao`:

```markdown
<!-- CNCT-GOV-{vault} · gerado-em: {iso} · mecanismo Connect -->

# {Nome do vault} — vault governado

Este acervo é governado pelo Connect. Navegação fora das regras abaixo produz
resposta errada a partir de nota que só a varredura acha — que é, por definição,
nota órfã.

## Antes de qualquer coisa
Leia `_cerebro/camada-1.md` — a carta de navegação declarada por este vault
(por onde entrar, o que carregar por gatilho, onde o vault termina).
Sem ela você navega por adivinhação.

## Regras duras
{REGRAS_DURAS, fonte única compartilhada com o render}
```

**Invariantes:**

- não carrega conteúdo da carta — logo não tem hash de frescor e nunca desatualiza;
- marcador é de **identidade**, não de versão: responde *"este arquivo é nosso?"*, nada mais;
- só em vault de **conhecimento** (`tipo-vault: matriz|sub-vault` em `_cerebro/vault-config.md`).
  Perfil de operador nunca — lá `CLAUDE.md` já é a Camada 0 (`lib/matriz.mjs:130`);
- vault que não recebe escrita (legado, somente-leitura) não recebe o arquivo;
- **nunca sobrescreve** arquivo sem marcador nosso: reporta e para.

---

## Fases

### Fase 0 — emenda da ADR-17 *(não é código, mas bloqueia)*

Os itens 2, 3 e 5 da Decisão mudam (espelho derivado → arquivo de governança; marca com hash →
marca de identidade; supressão por endereçamento → adiada). Itens 1 e 6 sobrevivem intactos.
Atualizar junto `config/contrato-navegacao.md` §2.1 e §5.

⚠️ Se o time achar que isso é decisão diferente e não emenda, vira **ADR-18 substituindo a 17**.
Decisão do Gabriel.

### Fase 1 — `lib/governanca.mjs` *(novo, isolado)*

Módulo sem dependência do resto; testável sozinho; nenhum arquivo existente tocado.

| Função | Devolve |
|---|---|
| `gerarArquivoGovernanca({ vault, alias })` | string do `CLAUDE.md` |
| `lerMarcador(md)` | `{ vault, geradoEm }` ou `null` |
| `verificarRaiz(vaultRoot)` | `'ausente' \| 'governado' \| 'nao-governado'` |

Reusa a escrita atômica (tmp + rename) do `lib/contexto-arquivo.mjs`.
Teste: `tests/spike-governanca.mjs`.

### Fase 2 — fonte única das regras duras

`REGRAS_DURAS` hoje é const em `lib/render.mjs:146`. O `CLAUDE.md` precisa do mesmo texto.
Extrair para módulo compartilhado **antes** da fase 4 — senão nasce duplicado e diverge na
primeira edição.

### Fase 3 — detecção *(read-only, não pode quebrar nada)*

- `lib/navegacao.mjs` — `lerCarta()` passa a devolver o estado da raiz junto;
- `lib/session.mjs` — varre a raiz dos vaults conhecidos no startup;
- **`resolver`** — mesmo gancho para sub-vault lazy. Sem isso o check cobre metade do grafo:
  `iniciar_sessao` só conhece matriz + pessoal + operador; sub-vault é resolvido depois;
- `lib/render.mjs` — emite o aviso de raiz não governada.

**Entrega sozinha a mitigação de primeira linha da P145** (ADR-17 §6). Se as fases seguintes
atrasarem, isto já tira o slot da invisibilidade.

### Fase 4 — materialização *(primeira escrita)*

`cnct-fabrica-navegacao`, Passo 3, passa a materializar o `CLAUDE.md` de raiz junto da carta.
Passo 4 (verificação) confere o marcador. Recortes da seção "O artefato" valem todos aqui.

### Fase 5 — setup da pasta conectada

A metade que faz o ponteiro funcionar, e é configuração, não código:

- primeiro uso (`configurar` / `cnct-nucleo-sessao`) instrui a conectar a matriz como pasta do
  projeto Cowork;
- o bloco de concessão do `render.mjs` menciona;
- documentar no README do plugin.

⚠️ **Passo de setup se pula.** Se ninguém conectar, degrada em silêncio para o comportamento de
hoje. Vale um aviso explícito quando a matriz **não** for pasta conectada.

### Fase 6 — skills, contrato e versão

- `cnct-nucleo-audit` ganha o check de raiz governada;
- `config/contrato-navegacao.md` §5 — o check de marcador sai de *pendente* conforme a fase 3 entra;
- versão do plugin.

---

## Ordem, e o argumento dela

Detecção (3) **antes** de escrita (4): read-only não quebra nada e já entrega a P145.
Regras compartilhadas (2) **antes** de gerar (4): evita duplicação nascendo junto com o artefato.
Setup (5) pode correr em paralelo — é doc e prompt, não toca o mecanismo.

---

## Limites honestos

**Cobre o que estiver conectado, não o grafo.** Sub-vault é lazy e numeroso (MAPFRE, Yamaha,
cliente futuro) e ninguém conecta pasta de cada cliente à mão. O canal serve a matriz e o que
for conectado; o resto continua dependendo do mecanismo — mesmo teto que o espelho tinha.

**As regras duras chegam duas vezes** em sessão com pasta conectada: pelo `CLAUDE.md` injetado e
pelo bloco curto do hook. ~200 tok. O hook não tem como saber que o outro canal disparou (é o
bloqueador original da P139). **Custo aceito** — suprimir isso é a fase adiada de endereçamento.

**A P144 fica sem detector.** O hash do espelho ia ser a primeira detecção de corrupção por sync
que o produto teria (saída (b) da P144). Arquivo estático não detecta nada: ou é write-once, ou
carrega hash que muda com a carta. A P144 volta a precisar de dono próprio — provavelmente a
saída (a), varredura de `*-DESKTOP-*` / `*conflicted*` no `vault-audit`.

---

## Adiado, não descartado

Partir o `contexto-sessao.md` em cargas endereçáveis (`protocolo.md` · `carta-{vault}.md` ·
`camada-0.md`) com supressão por marcador. É a maior superfície do projeto, mexe no hook, e é
**otimização, não garantia** (D228). Destrava os dois alvos vivos da P138 — o protocolo do
mecanismo (1.844 tok, 34% do piso) virando lazy, e orçamento por camada.

---

## Em aberto

1. **Emenda à ADR-17 ou ADR-18 substituindo?** — Gabriel.
2. **Duplicação das regras duras** — aceitar os ~200 tok ou antecipar a supressão?
3. **Dono da P144** agora que ela perdeu o detector de lambuja.
4. **Vault legado somente-leitura** (MAPFRE) — confirma que não recebe o arquivo, ou recebe na
   migração?

<!-- fim: PLANO-camada-1-canal-injetado.md · 7ª sessão de 26/08 -->
