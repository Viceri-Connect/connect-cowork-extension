# Connect HTTP (Local)

This package uses the same Connect skills, hooks, and MCP tools as the stdio plugin, over a loopback-only Streamable HTTP endpoint.

Start the server and keep it running. The launcher provisions the same portable Node runtime as Cowork, so Node on PATH is not required:

```
plugins/connect-http/scripts/connect-mcp --transport=http --port=3737        # macOS/Linux
plugins\connect-http\scripts\connect-mcp.cmd --transport=http --port=3737   # Windows
```

The endpoint is `http://127.0.0.1:3737/mcp`. The server binds only to localhost and rejects non-local Host and Origin headers. Set `CONNECT_HOME` before starting it if the default Connect data directory is not the one you want.

Use this marketplace option only when the agent host cannot launch a stdio MCP server. Do not install both Connect transport variants in the same host session, because they expose the same tools.
