# Guarda de varredura

A regra dura 4 diz: dentro de um vault, navegue pela carta de navegação → ponto de pouso →
ponteiro declarado; **varredura é último recurso e deixa marca**. A guarda faz a regra valer
antes da ferramenta rodar, nos hosts que têm hook de pré-ferramenta.

## Como funciona

1. Reconhece busca recursiva: `grep`, `rg`, `find`, `fd`, `findstr`, `Select-String`, listagem
   com `-Recurse`/`/s`, e as ferramentas de busca do host.
2. Confere se o alvo está **dentro de um vault do Connect**: matriz, cérebro pessoal, sub-vaults,
   workspace de sessão ou atalho `./matriz`.
3. Registra a marca em `CONNECT_HOME/logs/varredura.jsonl`.
4. Devolve a decisão no formato do host.

Fora do vault, ou em qualquer erro, não decide nada: a guarda nunca bloqueia trabalho comum.

## Por host

| Host | Decisão |
|---|---|
| Antigravity | Pede confirmação ao operador (`grep_search`, `find_by_name`). `run_command` fica de fora pelo custo de subir o runtime em todo comando. |
| Codex | Não suporta "perguntar" no PreToolUse: a busca segue, o agente recebe a regra com a ordem de reportar e o operador vê o aviso. |
| Copilot | Ainda não instalada (o hook aceita "perguntar"; é o próximo). |
| Claude/Cowork | Ainda não instalada (custaria ~300 ms por busca). |

## Código

`plugins/connect/lib/varredura.mjs` (regras) e `plugins/connect/hooks/guarda-varredura.mjs`
(entrada do hook, recebe o host como argumento).
