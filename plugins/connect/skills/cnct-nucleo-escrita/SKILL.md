---
name: cnct-nucleo-escrita
description: >
  Protocolo obrigatório antes de criar ou editar qualquer arquivo dentro de um
  vault desta instância Connect (a matriz, ou qualquer sub-vault resolvido).
  CARREGAR sempre que o trabalho envolver salvar conhecimento em ./matriz ou
  em qualquer alias de sub-vault montado na sessão.
metadata:
  version: "0.4.0"
  eixo: nucleo
  program: "Impulsa / Viceri"
---

# cnct-nucleo-escrita — escrita governada

Executor genérico (mecanismo, D96). Não sabe onde nada mora — quem sabe é o contrato da
matriz. Toda especificidade de conteúdo vive no *knowledge*, nunca aqui.

## Quando disparar

Sempre que a sessão for **criar ou editar** um arquivo dentro de um vault desta instância
(a matriz, ou qualquer alias de sub-vault já resolvido) — nunca para escrita em
`./operador/` (estado do operador, fora de escopo — ver `## Fora de escopo`).

## Protocolo

**Passo 1 — Identificar o vault alvo.** Qual alias, relativo ao workspace da sessão, vai
receber a escrita.

**Passo 2 — Carregar o contrato da matriz (única fonte de "onde").**
Ler `./matriz/_inteligencia/skills/cnct-nucleo-escrita/cnct-nucleo-escrita.md`. Este
executor **nunca deduz nem hardcoda** onde a taxonomia de um vault mora — o contrato diz.
Seguir exatamente o que ele indicar para localizar a taxonomia do vault alvo (Passo 3) e
aplicar as regras universais que ele já traz inline.

**Passo 2a — Matriz sem o contrato ainda (stub).**
Se o arquivo do Passo 2 não existir: é o próprio conhecimento desta skill que falta na
matriz, não erro. Materializar o stub a partir de `templates/cnct-nucleo-escrita.template.md`
(desta skill), interpolando `{{DATA_INSTALACAO}}` = hoje. **Nunca sobrescrever** se já
existir. Avisar o operador: o "Índice de vaults" do stub traz só a própria matriz — precisa
ser personalizado à mão assim que o primeiro sub-vault ganhar manifesto no grafo.

**Passo 3 — Carregar a taxonomia do vault alvo**, no caminho que o contrato do Passo 2
indicou. **Se não existir:** reportar a lacuna ao operador — nunca herdar taxonomia de
outro vault, nunca inventar. É gatilho de elicitação (D97), não erro silencioso.

**Passo 4 — Aplicar**, na ordem: regras universais do contrato (Passo 2) → panorama de
camadas, decisão de pasta, testes de classificação e checklist específicos da taxonomia
do vault alvo (Passo 3).

## Fora de escopo

Estado do operador gerido pelo Connect (`./operador/`, ex.: `TASKS.md`, perfil) não é
conteúdo de vault — não passa por este protocolo. Ver `cnct-nucleo-encerramento`.
