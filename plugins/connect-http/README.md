# Connect HTTP (Local)

This package uses the same Connect skills and MCP tools as the stdio plugin, over a loopback-only Streamable HTTP endpoint.

Start the server from the repository root and keep it running:

```powershell
node plugins/connect-http/mcp/connect-mcp.mjs --transport=http --port=3737
```

The endpoint is `http://127.0.0.1:3737/mcp`. The server binds only to localhost and rejects non-local Host and Origin headers. Set `CONNECT_HOME` before starting it if the default Connect data directory is not the one you want.

Use this marketplace option only when the agent host cannot launch a stdio MCP server. Do not install both Connect transport variants in the same host session, because they expose the same tools.
