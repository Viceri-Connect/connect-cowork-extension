# Host Control Boundary

Connect's MCP server is a domain server. It must not expose arbitrary PowerShell, shell, process execution, or desktop automation tools.

The host may separately register the existing Windows MCP integration for machine-control workflows. That server runs with host permissions and is a distinct trust boundary from Connect and from a Linux or remote agent sandbox. Keep its current installation and approval behavior; do not copy its credentials, executable paths, or unrestricted command interface into the Connect plugin bundle.

Before enabling host-control tools for a harness, verify:

- The MCP process runs on the intended host, not inside an isolated sandbox.
- The tool surface is limited to named operations and does not accept arbitrary command strings.
- State-changing actions require the host's user approval and have bounded arguments and timeouts.
- File operations are confined to explicit roots and do not follow paths outside those roots.
- The harness can reach the host MCP server through a supported connection mechanism; filesystem visibility alone is not proof of reachability.

The Copilot bundle includes only the Connect MCP server. The Windows MCP server remains a separate host configuration and must be composed by the operator without replacing `.vscode/mcp.json` or the Cowork plugin's `.mcp.json`.