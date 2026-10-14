#!/bin/sh
# run-node.sh - garante o Node portatil e executa o script recebido (macOS/Linux).
#
# Espelho POSIX de run-node.bat (P175, 0.37.0). Mesma garantia do D153: o hook e o
# MCP nunca dependem de `node` no PATH. Mesma casa do runtime da 0.15.0: fora do
# pacote, em $CONNECT_HOME/bin - atualizar o plugin nunca toca arquivo em uso.
#
# Quem chama: mcp/launcher.cmd e scripts/run-node.bat (linha `:;` poliglota),
# quando o interpretador e `sh`. No Windows este arquivo nunca executa.
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

BIN_DIR="$CONNECT_HOME/bin"
NODE_BIN="$BIN_DIR/node"

erro() { printf '[connect] %s\n' "$*" >&2; }

limpar_tmp() { [ -n "${TMP:-}" ] && rm -rf "$TMP"; }

usar_path() {
  # `exec` nao dispara o trap de EXIT: a pasta temporaria sai aqui, antes.
  limpar_tmp; trap - EXIT INT TERM HUP
  # Ultimo recurso, declarado (D153): avisa em stderr em vez de degradar em silencio.
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

  # Sobra de download interrompido (0.38.3, medido no Mac do Advisor em 14/10: 24 MB
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
