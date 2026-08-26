# vault-audit — Conhecimento (STUB — personalizar)

> Stub gerado automaticamente pelo `cnct-nucleo-audit` em {{DATA_INSTALACAO}}, porque este
> vault ainda não tinha conhecimento de auditoria próprio. Enquanto este arquivo não for
> personalizado, **só os checks de mecanismo rodam aqui** (contrato de manifesto + protocolo
> — ver `cnct-nucleo-audit/SKILL.md` §3a). Editar este arquivo NÃO exige reinstalar nada.

→ [[vault-config]] · [[modelo-roteamento]] (ajuste os links conforme a estrutura real deste vault)

## Versão atual

- **v1.0 (stub)** — {{DATA_INSTALACAO}} — gerado automaticamente, nenhuma verificação
  específica de cliente ainda habilitada.

## Estrutura/pastas esperadas deste vault

> ‹PROVISIONAR› Quais pastas este vault percorre e qual a topologia esperada (projetos por
> status, produtos, squads, status, cliente)? Derive do processo efetivo da squad
> (`processo-squad` › etapas → pasta) + `roteamento` — nunca hardcode uma lista aqui.

## Verificações habilitadas (além dos checks de mecanismo, sempre ativos)

> ‹PROVISIONAR› Quais checks fazem sentido para este vault, além dos estruturais genéricos
> (links quebrados, notas isoladas, config ausente, frescor de status, projeto↔produto)?
> Formato sugerido:

| Módulo | Check | Dispara issue quando | Escopo |
|--------|-------|----------------------|--------|
| M1 | Links quebrados | Wikilink aponta para arquivo inexistente | coletivo |
| M2 | Notas isoladas | Arquivo sem nenhum link de entrada (exceto canônicos — ‹PROVISIONAR› lista) | coletivo |
| M3 | Frescor de status | Nota de projeto sem atualização há mais de N dias (`status-desatualizado-dias` do vault-config) | pessoal e coletivo |

**Canônicos sem link de entrada** (excluir do check de órfãs): ‹PROVISIONAR›.

Critérios dinâmicos (recorrentes/pontuais), se este vault tiver, vivem em
`_automacoes/vault-audit/criterios-customizados.md`.

## Escopo e critérios configuráveis

Lê `audit-config` do `meu-config.md` pessoal de cada operador; default = `audit-defaults` do
`vault-config.md` deste vault.

**Critérios próprios por operador (`criterios-override`):** só têm efeito sobre verificações
de **escopo pessoal** daquele operador. Verificações de escopo coletivo sempre usam o
critério único de `audit-defaults` — nunca sobrescritas por operador, para não gerar
abre/fecha divergente no backlog compartilhado.

## Tarefa agendada (SCHEDULE)

Qualquer operador pode pedir para agendar seu próprio AUDIT periódico deste vault ("agenda
auditoria"). A skill cria a tarefa de verdade, com escopo e `criterios-override` daquele
operador embutidos no prompt. Mais de um operador pode ter sua própria tarefa agendada.
**REPAIR nunca é agendado.**

## Arquivos de estado

| Arquivo | Propósito |
|---------|-----------|
| `_automacoes/vault-audit/issues.md` | Capa — só issues pendentes, idempotente |
| `_automacoes/vault-audit/issues-historico.md` | Issues resolvidas — apêndice, leitura sob demanda |
| `_automacoes/vault-audit/log.md` | Histórico de runs + repairs — append-only, leitura sob demanda |

## Formato de issue (capa)

```
| ID | Tipo | Descrição | Encontrado em | Prioridade | Gerado por | Data | Responsável pelo repair |
```

- **Gerado por:** operador que rodou o AUDIT que detectou a issue (nunca vazio).
- **Data:** primeira detecção.
- **Responsável pelo repair:** vazio até alguém assumir ou ser delegado (`"delega: {nome}"`).

Ao resolver, a issue migra para `issues-historico.md` com **Resolvido por** e **Data
resolução** — nunca é apenas apagada da capa.

## Regra de arquivamento

> ‹PROVISIONAR› Este vault nunca deleta (move para histórico/arquivado), ou pode deletar
> redundâncias diretamente? Em que condições?

<!-- fim: vault-audit.md · stub gerado por cnct-nucleo-audit -->
