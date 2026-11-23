# Acesso no ritmo do host

O Connect lê e escreve fora do projeto: `CONNECT_HOME` e as pastas dos vaults. O agente precisa
saber **quais** pastas pedir, e pedir antes de ler — nunca contornar por varredura.

## Por host

| Host | Como o acesso funciona | O que o hook injeta |
|---|---|---|
| Claude/Cowork | Concessão de pasta por sessão | Pedido completo em toda sessão |
| Codex | Aprovação do sandbox, guardada | Completo na 1ª sessão e quando as pastas mudam; depois, lembrete |
| Copilot | Aprovação guardada; com sandbox de sessão, `sandbox.userPolicy` | Idem |
| Antigravity | `ask_permission`, guardado | Idem |

Repetir o pedido completo a cada sessão num host que já guardou a permissão ensina o operador a
ignorá-lo. O lembrete mantém a regra "pede, nunca contorna" sem o ruído.

## Como o mecanismo decide

`registrarOrientacaoDeAcesso()` em `lib/bootstrap.mjs` grava em
`CONNECT_HOME/hosts/<host>.json` uma assinatura das pastas pedidas. Mesma assinatura → lembrete.
Assinatura nova ou marca ilegível → pedido completo (pedir a mais é seguro; a menos, não).

## Prova

Feature "acesso no ritmo do host": roda o hook duas vezes no mesmo `CONNECT_HOME` e exige
completo e depois lembrete fora do Cowork, e completo nas duas vezes no Cowork.
