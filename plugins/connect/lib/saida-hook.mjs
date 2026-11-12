// connect/lib/saida-hook.mjs
// Serializacao da resposta JSON dos hooks (Codex, Copilot, Antigravity).
//
// 0.41.0 — no Windows, quando o host roda o hook por PowerShell, a saida de um
// processo nativo passa pelo pipeline do PowerShell 5.1 e e redecodificada pela pagina
// OEM: acento vira lixo (o mesmo defeito que levou o hook do Claude ao run-node.ps1 na
// 0.39.0). JSON com todo caractere fora do ASCII escapado como \uXXXX atravessa
// qualquer pagina de codigo intacto, e o host o decodifica de volta para o texto certo.

export function jsonAscii(valor) {
  return JSON.stringify(valor).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}
