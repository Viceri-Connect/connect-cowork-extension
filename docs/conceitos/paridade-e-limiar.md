# Paridade e limiar

**Paridade:** os quatro hosts entregam o mesmo resultado ao operador. **Limiar:** a diferença
aceita quando um host não consegue, dita em uma frase com o porquê e a mitigação.

O Connect nasceu no Cowork. Na migração, o Cowork é a **referência** do que já funcionava, mas
não é dependência: cada capacidade é descrita pelo resultado, e o Cowork também declara limiar
quando outro host faz melhor (exemplo: ele não reinjeta o contexto depois de compactar; o Codex
reinjeta).

## Onde está

- Tabela: `tests/architecture/paridade.mjs` (fonte).
- Leitura: [`docs/paridade-harness.md`](../paridade-harness.md) (gerado por `npm run gerar:paridade`).

## O que o build prova

| Prova | Como |
|---|---|
| Funcionalidade | Toda capacidade tem decisão (`igual` ou `limiar`) em todo host, com feature ou teste que a prova; limiar sem explicação não passa. |
| Superfície nova | Todo evento de hook de qualquer host precisa cair numa capacidade. Hook novo sem linha na tabela quebra o build. |
| Funcionamento | Os quatro hooks rodam no mesmo estado de máquina (matriz governada e perfil do operador) e o contexto entregue é idêntico fora dos blocos declarados por host (`BLOCOS_POR_HOST`). |

## Como decidir um limiar

1. Descreva o resultado, não o mecanismo ("o briefing fica agendado", não "usa a ferramenta X").
2. Se o host entrega o resultado por outro caminho, é `igual` (cite o caminho no detalhe).
3. Se não entrega por inteiro, é `limiar`: o quanto fica aquém, por que, e como contorna.
4. Aponte a prova (feature do contrato ou arquivo de teste).
