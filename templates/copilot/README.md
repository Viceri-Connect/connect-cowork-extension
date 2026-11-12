# Connect Agent Plugin

This is the portable Agent Plugins 1.0 package for GitHub Copilot and compatible harnesses. It shares the Connect MCP server and Agent Skills with the Claude Cowork plugin and includes a Copilot-native `sessionStart` hook that injects the Connect bootstrap context. It does not configure host-level machine control.

## Requirements

- GitHub Copilot in VS Code with Agent Plugins enabled and MCP server support.
- Node.js 20.11.1 or later available on `PATH`.
- Install the plugin from the marketplace repository or directly from this plugin directory.

The portable package uses root `mcp.json`, root `plugin.json`, `skills/`, and `com.github.copilot/hooks/hooks.json`. VS Code starts Connect over stdio with the same `CONNECT_HOME` as the Cowork plugin (default `~/Connect`), so `repos`, `subVaults`, and the matrix resolve identically. At session start, the hook runs `iniciar_sessao` and injects its context; Copilot reports `startup`, `resume`, or `new` as the session source. When no matrix is configured yet, that context directs the agent through the guided first-use flow.

## Configure Connect

Set the optional `CONNECT_VAULT_MATRIZ` / `CONNECT_CEREBRO_PESSOAL` environment variables for the VS Code process, or use the Connect configuration flow. `CONNECT_HOME` defaults to `~/Connect` (shared with Cowork); set the same value in every host if you move it. Configured vault paths must be accessible to the process running the MCP server; remote or sandboxed workspaces may not share the host filesystem. Call `ambiente_connect` to inspect the available runtime and path access.

## Host control

This bundle does not provide arbitrary shell or PowerShell execution. Keep the existing Windows MCP integration configured separately in the host, with its own approvals and restrictions. Do not expose a generic command runner to the agent.
