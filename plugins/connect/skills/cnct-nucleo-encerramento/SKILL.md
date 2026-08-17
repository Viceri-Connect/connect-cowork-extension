---
name: cnct-nucleo-encerramento
description: >
  Encerra uma sessão de trabalho Connect consolidando tudo que precisa ser
  persistido — em TODOS os vaults tocados na sessão (matriz + qualquer
  sub-vault resolvido), nunca assumindo um único vault ativo. Use SEMPRE que o
  operador disser 'encerra sessão', 'fecha sessão', 'session close', 'consolida
  memória', 'persiste contexto', ou ao final de qualquer sessão de trabalho
  Connect.
metadata:
  version: "0.2.0"
  program: "Impulsa / Viceri"
---

# cnct-nucleo-encerramento — encerramento de sessão multi-vault

Executor genérico (mecanismo, D96). Uma sessão Connect pode tocar mais de um vault (a
matriz + N sub-vaults resolvidos) — este executor nunca assume um único vault ativo.

## Protocolo

**Passo 1 — Enumerar vaults tocados.**
Chamar `list_mounts(workspace_dir)` — todo alias montado nesta sessão é candidato a
destino de conteúdo (`./matriz`, qualquer sub-vault resolvido via `resolver`). `./operador`
é destino **separado** (Passo 4, não é conteúdo de vault). `./pessoal`, quando presente, é
enriquecimento do operador — não recebe conteúdo de vault por este protocolo.

**Passo 2 — Varrer a conversa (fonte primária).**
Percorrer a sessão inteira identificando itens capturáveis (decisão, pendência, artefato
gerado, mudança de status, pessoa nova, skill criada/atualizada). Para **cada item**,
atribuir o **alias/vault a que ele pertence** — nunca depositar num vault por default
quando o item é de outro.

**Passo 3 — Persistir cada item de vault via `cnct-nucleo-escrita`.**
Para cada alias com itens atribuídos: invocar o protocolo `cnct-nucleo-escrita` passando
esse alias como vault alvo. Este executor **nunca escreve direto** em conteúdo de vault —
delega sempre.

**Passo 4 — Persistir estado do operador.**
Tasks pessoais (novas, concluídas, mudança de status) e delta de identidade vão em
`./operador/TASKS.md` e `./operador/_cerebro/meu-config.md` — **direto**, sem passar por
`cnct-nucleo-escrita` (não é conteúdo de vault, é estado gerido pelo Connect, D113). Se
`./operador` não estiver acessível ainda (Cowork não concedeu acesso à origem), solicitar
o acesso antes de escrever — nunca pular o passo silenciosamente.

**Passo 5 — Despromoção obrigatória, por vault, antes de acrescentar.**
Regra do contrato `cnct-nucleo-escrita` (matriz): identificar o que deixou de ser
corrente, confirmar que já existe na fonte, só então substituir. Nunca podar sem
confirmar duplicação.

**Passo 6 — Relatório final, por vault.**
```
## Encerramento — DD/MM/YYYY HH:mm

### Vaults tocados
- ./matriz: [N] itens persistidos
- {alias do sub-vault}: [N] itens persistidos

### Operador (./operador)
TASKS.md: [N] concluídas · [N] novas · [N] atualizadas

### ⚠️ Para revisão manual (se houver)
- [itens sem vault claro, ou vault sem taxonomia — reportados na íntegra, nunca descartados]
```

## Fora de escopo (não faz)

- Não gera nem altera artefatos de entrega (specs, discoveries) — isso acontece durante o
  trabalho, não no encerramento.
- Não cria conteúdo — se não está na conversa, não preenche.
- Idempotente — rodar duas vezes não duplica.
