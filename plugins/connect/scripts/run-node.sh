#!/bin/sh
# run-node.sh - garante o Node portatil e executa o script recebido (macOS/Linux).
#
# Espelho POSIX de run-node.bat (0.37.0). Mesma garantia do Node gerenciado: o hook e o
# MCP nunca dependem de `node` no PATH. Mesma casa do runtime da 0.15.0: fora do
# pacote, em $CONNECT_HOME/bin - atualizar o plugin nunca toca arquivo em uso.
#
# Quem chama: mcp/launcher.cmd e scripts/run-node.bat (linha `:;` poliglota),
# quando o interpretador e `sh`; scripts/connect-mcp e os hooks de Codex, Copilot e
# Antigravity (0.41.0). No Windows este arquivo nunca executa.
#
# Uso: run-node.sh <caminho-do-script.mjs> [args...]

NODE_VERSAO="v20.11.1"

# CONNECT_HOME: env var, ou o perfil do usuario (mesma resolucao de
# lib/config-local.mjs). O Cowork repassa variavel NAO definida como o texto
# literal "${CONNECT_HOME}" (medido em 13/10) - isso conta como ausente.
case "${CONNECT_HOME:-}" in
  ""|*'${'*) CONNECT_HOME="$HOME/.connect" ;;
esac
export CONNECT_HOME

# 0.40.0 - Sessao na nuvem (CLAUDE_CODE_REMOTE=true): o servidor ja traz Node, e
# baixar o runtime portatil ali e trafego e disco por sessao sem nenhum ganho - o
# Connect de verdade roda no PC do operador. Com node no PATH, usa-o direto.
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ] && command -v node >/dev/null 2>&1; then
  exec node "$@"
fi

BIN_DIR="$CONNECT_HOME/bin"

# 0.41.0 - Host em SANDBOX (Copilot CLI com sandbox de sessao, Codex): o processo pode
# nao ter escrita no CONNECT_HOME e so alcancar a pasta de dados que o host da ao
# plugin. Sem runtime ja instalado e sem escrita aqui, o Node portatil vai para essa
# pasta (PLUGIN_DATA do Agent Plugins/Codex, COPILOT_PLUGIN_DATA, CLAUDE_PLUGIN_DATA).
# Texto literal com "${" e variavel nao definida, como no CONNECT_HOME.
dados_do_host() {
  for v in "${PLUGIN_DATA:-}" "${COPILOT_PLUGIN_DATA:-}" "${CLAUDE_PLUGIN_DATA:-}"; do
    case "$v" in ""|*'${'*) ;; *) printf '%s' "$v"; return 0 ;; esac
  done
  return 1
}
if [ ! -x "$BIN_DIR/node" ] && ! { mkdir -p "$BIN_DIR" 2>/dev/null && [ -w "$BIN_DIR" ]; }; then
  if ALT=$(dados_do_host); then BIN_DIR="$ALT/bin"; fi
fi
NODE_BIN="$BIN_DIR/node"

erro() { printf '[connect] %s\n' "$*" >&2; }

limpar_tmp() { [ -n "${TMP:-}" ] && rm -rf "$TMP"; }

usar_path() {
  # `exec` nao dispara o trap de EXIT: a pasta temporaria sai aqui, antes.
  limpar_tmp; trap - EXIT INT TERM HUP
  # Ultimo recurso, declarado: avisa em stderr em vez de degradar em silencio.
  if command -v node >/dev/null 2>&1; then
    erro "AVISO: usando o node do PATH - runtime portatil indisponivel."
    exec node "$@"
  fi
  erro "ERRO: runtime indisponivel. Falha ao obter o Node portatil ($NODE_VERSAO)"
  erro "e nao ha node no PATH. Verifique conectividade/proxy corporativo."
  exit 1
}

if [ ! -x "$NODE_BIN" ]; then
  case "$(uname -s)" in
    Darwin) SO="darwin" ;;
    Linux)  SO="linux" ;;
    *)      erro "sistema nao suportado: $(uname -s)"; usar_path "$@" ;;
  esac
  case "$(uname -m)" in
    arm64|aarch64) ARQ="arm64" ;;
    x86_64|amd64)  ARQ="x64" ;;
    *)             erro "arquitetura nao suportada: $(uname -m)"; usar_path "$@" ;;
  esac

  PACOTE="node-$NODE_VERSAO-$SO-$ARQ"
  URL="https://nodejs.org/dist/$NODE_VERSAO/$PACOTE.tar.gz"
  mkdir -p "$BIN_DIR" 2>/dev/null || usar_path "$@"

  # Sobra de download interrompido (0.38.3, medido num Mac real: 24 MB
  # em `.node-download.3402`). O `rm` do fim nunca roda quando o processo morre no meio
  # (estouro de tempo do hook, SIGKILL). Apaga so a de processo que ja nao existe: o
  # hook e o MCP sobem juntos e podem estar baixando ao mesmo tempo.
  for velho in "$BIN_DIR"/.node-download.*; do
    [ -d "$velho" ] || continue
    pid="${velho##*.}"
    case "$pid" in ''|*[!0-9]*) rm -rf "$velho"; continue ;; esac
    kill -0 "$pid" 2>/dev/null || rm -rf "$velho"
  done

  TMP="$BIN_DIR/.node-download.$$"
  # Interrupcao capturavel (Ctrl+C, TERM, fechamento do terminal) limpa na hora;
  # SIGKILL nao e capturavel, e para ele existe a varredura acima.
  trap 'limpar_tmp' EXIT
  trap 'limpar_tmp; exit 1' INT TERM HUP
  rm -rf "$TMP"; mkdir -p "$TMP" || usar_path "$@"

  # Download ATOMICO e verificado (mesma regra do .bat): -f falha em erro HTTP, para
  # uma pagina 404 nunca virar binario "existente" e bloquear as proximas tentativas.
  if curl -fsSL "$URL" -o "$TMP/node.tar.gz" \
     && tar -xzf "$TMP/node.tar.gz" -C "$TMP" "$PACOTE/bin/node" \
     && chmod +x "$TMP/$PACOTE/bin/node" \
     && "$TMP/$PACOTE/bin/node" -v >/dev/null 2>&1; then
    mv -f "$TMP/$PACOTE/bin/node" "$NODE_BIN"
  fi
  limpar_tmp; trap - EXIT INT TERM HUP
  [ -x "$NODE_BIN" ] || usar_path "$@"
fi

# Baixado nao e o mesmo que funciona: binario truncado so se revela na execucao.
if ! "$NODE_BIN" -v >/dev/null 2>&1; then
  rm -f "$NODE_BIN"
  usar_path "$@"
fi

exec "$NODE_BIN" "$@"
