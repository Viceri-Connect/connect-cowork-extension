# Anotações das tools

Toda tool do MCP declara as `annotations` do protocolo MCP. Os hosts usam isso para decidir
quando pedir aprovação ao operador.

| Dica | Significa |
|---|---|
| `readOnlyHint` | não altera nada (nem config, nem atalho, nem arquivo) |
| `destructiveHint` | pode sobrescrever ou remover algo existente |
| `idempotentHint` | repetir com os mesmos argumentos não muda o resultado |
| `openWorldHint` | fala com algo fora da máquina (OneDrive/SharePoint) |

## Classificação

| Grupo | Tools |
|---|---|
| Só leitura | `ambiente_connect`, `estado_sessao`, `resolver_repo`, `listar_repos`, `estado_operador`, `medir_navegacao`, `gerar_codigo_instancia`, `list_mounts` |
| Escreve sem sobrescrever | `iniciar_sessao`, `resolver`, `registrar_subvault_local`, `registrar_repo_local`, `catalogo_sync`, `sincronizar_subvault` (OneDrive) |
| Sobrescreve ou remove | `configurar`, `publicar_governanca`, `mount_junction`, `unmount_junction`, `configurar_por_codigo` (OneDrive) |

Na dúvida, a tool conta como escrita/destrutiva.

## Onde

Tabela `ANOTACOES` em `plugins/connect/mcp/connect-mcp.mjs`. Tool nova sem anotação falha em
`tests/unit/mcp-anotacoes.test.mjs`.
