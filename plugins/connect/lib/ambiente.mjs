// connect/lib/ambiente.mjs
// Onde esta sessao roda — e por que isso muda o que o hook pode afirmar.
//
// 0.40.0. Numa sessao na NUVEM (agente e hook no servidor; o MCP do Connect no PC do
// operador, chamado pela ponte do app desktop), o hook SessionStart roda no servidor,
// com um CONNECT_HOME vazio. Medido em 07/11: ele lia "matriz nao configurada, perfil nao
// provisionado" e mandava o agente parar tudo para fazer o 1o uso — com o operador
// plenamente configurado no PC. O hook nao enxerga o estado; so o MCP, na maquina dele,
// enxerga. Entao, na nuvem e sem configuracao local, o hook nao diagnostica: orienta.
//
// O sinal e `CLAUDE_CODE_REMOTE=true`, que o servidor define. `CONNECT_EXECUCAO`
// (local | nuvem) existe para teste e para forcar o comportamento quando o sinal mudar.

export function execucaoNaNuvem(env = process.env) {
  const forcado = String(env.CONNECT_EXECUCAO || '').toLowerCase().trim();
  if (forcado === 'nuvem') return true;
  if (forcado === 'local') return false;
  return String(env.CLAUDE_CODE_REMOTE || '').toLowerCase().trim() === 'true';
}
