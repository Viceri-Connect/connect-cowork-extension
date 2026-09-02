---
tipo-artefato: camada-1
vault: {{NOME_DO_VAULT}}
# HERANÇA DE PROCESSO (contrato §9.3) — remover as duas linhas se este vault não
# executa processo nenhum. Ausência NÃO é lacuna: o vault navega igual, só não
# herda e carrega tudo na carta local.
processo: {{PROCESSO_QUE_ESTE_VAULT_EXECUTA}}
topologia: {{TOPOLOGIA_DECLARADA_PELA_CARTA_DAQUELE_PROCESSO}}
versao: "1.0"
atualizado: {{DATA}}
---

# Camada 1 — {{NOME_DO_VAULT}}

> **Carta de navegação deste vault.** Índice + gatilhos: o mecanismo injeta o **corpo** deste
> arquivo verbatim no início de toda sessão em que o vault é montado. O frontmatter e a seção
> `## Alcance` são declaração para o mecanismo e **não** chegam ao contexto — não ponha ali o que
> o agente precisa ler. Peso mora no destino, nunca aqui: se esta carta crescer, ela virou o
> problema que resolve. Orçamento medido pela M3 (§9.4).
> Contrato: `config/contrato-navegacao.md` (Connect).

## O que é este vault

{{UMA_FRASE_DE_ESCOPO}}

**Corte:** {{O_QUE_ENTRA_E_O_QUE_NAO_ENTRA}}

## Estrutura

Uma linha por **casa**, com quem a governa — nunca uma entrada por nível do vault. O detalhe de
cada nível vive no hub dela e só é cobrado de quem entra (contrato §8.0.1).

| Casa | O quê | Governada por |
|---|---|---|
| {{PASTA_1}} | {{PROPOSITO_1}} | {{HUB_1}} |
| {{PASTA_2}} | {{PROPOSITO_2}} | {{HUB_2}} |

> Peças pesadas (nunca carregar sem gatilho): {{PECAS_PESADAS}}

## Alcance

> **Declaração para o mecanismo — não é injetada no contexto.** Sem ela, TODO arquivo do vault é
> órfã por definição e a M1 reprova (contrato §8). Colunas: **Casa** (onde mora; a raiz é `.`,
> explícita) · **Padrão** (como se chama; `{N}` inteiro, `{data}` AAAA-MM-DD, `{qualquer}` um
> segmento) · **Grau** (`derivável` \| `listável` \| `autorado`) · **Filtros** (campos de
> frontmatter que recortam) · **Hub** (preenchido e sem padrão = casa **delegada**: o alcance
> daquele nível está no hub, e é ele que responde por ele).
>
> Só declare aqui o que é **deste vault**. O que é do processo vem herdado; o que é de uma casa
> ilimitada (contexto de cliente, produtos, catálogos) **delegue ao hub dela**.

| Casa | Padrão | Grau | Filtros | Hub |
|---|---|---|---|---|
| {{CASA_1}} | {{PADRAO_1}} | {{GRAU_1}} | {{FILTROS_1}} | {{HUB_OU_TRACO}} |
| {{CASA_2}} | — | — | — | {{HUB_QUE_DECLARA_O_NIVEL}} |

## Ordem de entrada

1. {{PONTO_DE_POUSO}} — ponto de pouso (o que o manifesto declara em `entrada`, caminho relativo
   ao acervo — nunca nome de nota)
2. {{SEGUNDO_PASSO}}
3. {{TERCEIRO_PASSO}} — se este vault herda processo, a ordem dele entra aqui e não se repete

> Daqui para frente, só ponteiro declarado: wikilink, tabela de gatilho abaixo, ou `resolver`
> de um conceito da seção Fronteiras. Varredura é último recurso e deixa marca.

## Quando carregar

Só os gatilhos que resolvem para **casa ou nota de topo**. Gatilho que resolve para nível interno
desce para o hub daquela casa — massa aqui é cobrada de toda sessão, inclusive de quem ia para
outro lugar (§8.0.1). Gatilho do processo herdado **não** se repete aqui.

| Gatilho detectado na conversa | Arquivo |
|---|---|
| {{GATILHO_1}} | {{ARQUIVO_1}} |
| {{GATILHO_2}} | {{ARQUIVO_2}} |

## Fronteiras

O que **não** mora aqui — resolver o conceito, nunca supor caminho:

- {{ASSUNTO_1}} → conceito `{{CONCEITO_1}}`
- {{ASSUNTO_2}} → conceito `{{CONCEITO_2}}`

<!-- SEÇÕES OPCIONAIS — manter só as que tiverem resposta ratificada -->

## Modelo relacional

{{QUEM_CONTEM_QUEM_E_O_QUE_E_METADADO}}

## Triggers obrigatórios

- {{ACAO}} → carregar {{ARTEFATO}} antes. {{POR_QUE}}

## Estado volátil

| O quê | Onde |
|---|---|
| {{ESTADO_1}} | {{ONDE_1}} |
