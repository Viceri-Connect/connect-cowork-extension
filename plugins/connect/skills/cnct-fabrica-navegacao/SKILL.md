---
name: cnct-fabrica-navegacao
metadata:
  version: "0.1.0"
  eixo: nucleo
  program: "Impulsa / Viceri"
  camada: "L2 — fábrica por tipo"
description: Materializa ou completa a CARTA DE NAVEGAÇÃO (`_cerebro/camada-1.md`) de um vault desta instância Connect — a camada 1 declarada pelo próprio vault: por onde se entra, o que carrega por gatilho, onde termina. Dispara quando o mecanismo reporta "lacuna de navegação" ou "carta incompleta" ao montar a matriz ou um sub-vault, quando o operador diz "criar a camada 1", "carta de navegação", "hot cache do coletivo", "o vault monta e o agente não sabe navegar", ou quando um vault legado ainda usa `_cerebro/CLAUDE.md` e precisa migrar para a casa canônica. Convenção `cnct-fabrica-<tipo>`: esta é a fábrica do tipo "navegação" (artefato de interior, contrato em config/contrato-navegacao.md). Nunca sobrescreve carta existente — completa por delta.
---

# cnct-fabrica-navegacao — a camada 1 que o vault declara

> **Camada L2 (fábrica por tipo).** Objeto: o artefato de **interior** de um vault.
> Contrato: `config/contrato-navegacao.md` (mecanismo). Molde das perguntas: destilado de
> um coletivo maduro que navega bem **sem** Connect — a prova de que curadoria de navegação
> não é derivável por varredura, é decisão de quem governa o vault.

## Por que esta fábrica existe

O manifesto resolve a fronteira ("existe, quem governa, tem acervo externo"). Montado o
acervo, **o mecanismo fica cego**: sem carta, não há ponto de pouso, não há gatilho, não há
fronteira declarada — e o vazio força o contorno (`grep`), que a espinha proíbe.

O produto **não pode** preencher esse vazio por prescrição: decidir que "`organizacao/` é o
eixo de governança" é conteúdo da empresa. O que o produto faz é **exigir a resposta**,
**conduzir a elicitação** e **garantir que a resposta chega ao contexto** toda sessão.

## Passo 1 — Localizar o vault e ler o que já existe

1. Identificar o vault alvo pelo alias montado na sessão (`./matriz`, `./impulsa`, …). Se o
   operador nomear um conceito ainda não montado, `resolver` primeiro — nunca pedir caminho.
2. Ler, nesta ordem, e **não inventar nada** a partir de outra fonte:
   - `_cerebro/camada-1.md` — a carta canônica (existe? o que já responde?);
   - `_cerebro/CLAUDE.md` — a carta **legada** (coletivo anterior ao Connect). Se existir, ela
     é o insumo principal: o conteúdo já foi curado, o trabalho é **migrar de casa**, não
     reescrever;
   - `_cerebro/vault-config.md` — identidade machine-readable (empresa, contexto, ponto focal).
3. Rodar a validação do mecanismo (as 5 seções obrigatórias) e apresentar ao operador **o que
   falta**, uma linha por seção — nunca o identificador seco.

> **Modo delta, sempre.** Carta existente nunca é sobrescrita: acrescentam-se as seções
> ausentes e as correções que o operador ratificar. Vault legado mantém o `CLAUDE.md`
> intocado até o operador decidir a migração (pode haver outra ferramenta lendo aquele
> arquivo — o Connect não decide isso por ele).

## Passo 2 — Elicitar (uma pergunta por vez, cada uma dizendo por que importa)

Perguntas por seção obrigatória. Se a leitura do Passo 1 já responde, **não pergunte** —
apresente a resposta encontrada para ratificação.

**O que é este vault**
- "Em uma frase, o que este vault guarda?" — sem isso o agente não sabe se o que ele tem em
  mãos pertence aqui.
- "E o corte: o que **não** entra?" — o corte é o que impede o vault de virar depósito. Um
  princípio que funciona no caso real: *se depende de onde a pessoa está sentada, é do
  operador; se é verdade para qualquer pessoa do coletivo, é do vault*.

**Estrutura**
- "Para cada pasta de topo, qual o **propósito**?" — a resposta substitui a varredura: dá
  destino sem listar diretório. Propósito, não conteúdo ("uma nota por projeto", não a lista
  de projetos).
- "Alguma pasta é **peça pesada** (não carregar sem gatilho)?" — é o que protege o orçamento
  de token.

**Ordem de entrada**
- "Chegando aqui sem contexto, qual nota se abre primeiro?" — é o ponto de pouso; se o
  manifesto declara `entrada`, confirmar que é essa e que o caminho está declarado.
- "E depois dela, qual a sequência natural?" — a ordem é o que garante que nota é alcançada
  por caminho, não por sorte.

**Quando carregar** (a tabela mais valiosa da carta)
- "Que **assunto na conversa** deve fazer o agente abrir cada arquivo?" — construir a tabela
  `gatilho detectado → arquivo`. Gatilho é o que o operador reconhece no diálogo real, nunca
  jargão do vault.
- "Algum arquivo é **obrigatório** antes de certa ação?" (ex.: antes de escrever, carregar o
  protocolo de escrita) — vira `## Triggers obrigatórios`.

**Fronteiras**
- "O que as pessoas vão procurar aqui e **não** mora aqui?" — cada item vira `conceito` a
  resolver, fechando o loop com o manifesto. Nunca caminho de máquina, nunca URL.

**Opcionais, quando houver sinal**
- Modelo relacional ("X tem N Y; Y não contém X") — pergunte se a estrutura tiver dois eixos
  que se confundem (o erro clássico: pasta por squad quando squad é metadado do projeto).
- Camadas de herança — se o processo desce por deltas, declare a cadeia e a regra de
  precedência.
- Estado volátil — o que muda toda semana e **onde mora** (nunca dentro da carta: índice não
  guarda estado).

## Passo 3 — Materializar

1. Escrever a partir de `templates/camada-1.template.md`, interpolando as respostas.
   Seção sem resposta ratificada **não entra vazia**: fica de fora e é reportada como lacuna
   remanescente (carta incompleta honesta é melhor que seção decorativa).
2. Antes de escrever, carregar o protocolo de escrita do vault alvo (`cnct-nucleo-escrita`) —
   a carta é conteúdo do vault, sujeita às regras dele.
3. **Wikilink obrigatório:** cada caminho citado na carta existe, e a carta é linkada de pelo
   menos uma nota existente (nunca nota solta).
4. Nunca sobrescrever: se `camada-1.md` existir, aplicar só o delta.

### Passo 3b — Publicar a governança na raiz

Depois da carta, chamar a tool **`publicar_governanca`** com a raiz do vault. Ela materializa
`{vault}/CLAUDE.md` — o arquivo que o harness carrega sozinho da raiz de pasta conectada e
rotula como *override*. Sem ele, o slot de maior precedência do contexto fica sob autoria não
governada.

- **Nunca escrever esse arquivo à mão.** O marcador `CNCT-GOV-{vault}` é gerado pela tool; um
  arquivo digitado a mão não é reconhecido como governado e vira issue no início da sessão.
- **Ele não copia a carta** — declara que o vault é governado, carrega as regras duras e aponta
  para `_cerebro/camada-1.md`. Se você sentir vontade de colar o conteúdo da carta ali, não cole:
  espelho de conteúdo exige escrita recorrente, e escrita recorrente em vault sincronizado
  produz cópia de conflito.
- **Só em vault de conhecimento.** Perfil de operador nunca — lá `CLAUDE.md` é a Camada 0.
- **Status `recusado`** significa que já existe um `CLAUDE.md` sem marcador do Connect ali.
  **Não force e não apague**: mostre o arquivo ao operador e pergunte. Pode ser Camada 0
  legítima, sonda de medição ou conteúdo de terceiro.
- **Status `inalterado`** é sucesso, não falha: o corpo já era o esperado e a tool
  deliberadamente não tocou o arquivo (é o que evita o conflito de sync).

## Passo 4 — Verificar de verdade (não declarar sucesso)

1. Reler o arquivo escrito e rodar a validação: **5 seções obrigatórias presentes** (§3) e a
   seção `## Alcance` declarada.
   ⚠️ **O teto de 250 linhas foi RISCADO** (contrato §5, check 4): linha é a grandeza errada, e a
   medição é a prova — as quatro cartas desta instância tinham 124–147 linhas, todas abaixo do
   limite, custavam ~1.900 a ~3.600 tokens cada, e o aviso **nunca disparou em nenhuma**. Não
   validar por contagem de linha.
1b. **Chamar a tool `medir_navegacao`** com o diretório do vault, e reportar M1 a M7 ao operador.
   Sem isso a fábrica declara "carta verificada" pelo critério que o produto mediu como inoperante,
   e não roda a métrica que reprovaria o artefato — "ok" falso é pior que nenhuma verificação.
   Falha esperada num vault recém-nascido: nenhuma. Vault sem conteúdo é conformante por
   construção; M1 sem `## Alcance` declarado, sim, reprova — e é o que esta chamada pega.
2. **Conferir cada caminho citado** — ponteiro morto na carta é pior que carta ausente, porque
   custa uma tentativa de leitura e ensina o agente a desconfiar do índice.
3. Reiniciar o contexto do vault (`resolver` de novo, ou `iniciar_sessao` se for a matriz) e
   confirmar que a carta aparece **injetada verbatim** no bloco — a carta que não chega ao
   contexto não existe.
4. **Conferir que a raiz saiu de "não governada":** o bloco de sessão não deve mais abrir com a
   seção de conteúdo não governado para este vault. Se ainda abrir, o `publicar_governanca` foi
   recusado ou o arquivo foi escrito à mão — nos dois casos, reportar, não remediar sozinho.
5. Reportar ao operador: seções materializadas, lacunas remanescentes, ponteiros conferidos,
   e o status da publicação da governança.

## Passo 5 — Fechar o ciclo com a fronteira

- Se o manifesto do vault (na matriz) declara `entrada` como **nome de nota**, oferecer a
  correção para **caminho relativo** — é a outra metade do mesmo defeito.
- Se a carta declarou fronteiras, conferir que cada `conceito` citado casa em `resolver`
  (fronteira que não resolve é promessa quebrada).

---

> Regras de mecanismo que sustentam esta fábrica (ver `GLOSSARIO.md`):
> `corte-mecanismo-conteudo` (mecanismo × conteúdo), `gatilho-de-nascimento` (ausência =
> nascimento), `vault-declara-produto-nao-prescreve` (produto hospeda, não prescreve),
> `carregamento-lazy` (acervo lazy, token-efficiency), `ponteiro-tipado`,
> `espinha-e-mecanismo` (espinha injetada), `canal-injetado-governado` (canal injetado recebe
> governança e ponteiro — Passo 3b).
> Contrato: `config/contrato-navegacao.md`.
