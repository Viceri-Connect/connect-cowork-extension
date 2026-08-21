HTTP → MCP bridge (POC)

Quick start (from repo root):

1. Start bridge (it will spawn the connect MCP):

```powershell
node plugins/connect/bridge/index.mjs
```

2. Start a session (bridge will write `.connect/context.md` in workspace):

```bash
curl -X POST http://localhost:3000/iniciar_sessao -H "Content-Type: application/json" -d '{}'
```

3. Resolve a conceito:

```bash
curl -X POST http://localhost:3000/resolver -H "Content-Type: application/json" -d '{"conceito":"impulsa","workspace_dir":"."}'
```

Notes
- This is a POC. It spawns `plugins/connect/mcp/connect-mcp.mjs` and communicates over stdio using JSON-RPC.
- The bridge writes `.connect/context.md` with the textual block returned by `iniciar_sessao` / `resolver`.
