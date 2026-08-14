#!/usr/bin/env bash
# build-plugin.sh — empacota o plugin Connect como um bundle .plugin do Cowork
# (zip do conteúdo de plugins/connect/, com o .claude-plugin/plugin.json na raiz
# do zip). Caminho SECUNDÁRIO de instalação (um clique / leigo). O caminho
# primário é adicionar este repo como marketplace pela URL do git no Cowork.
#
# Uso:  bash scripts/build-plugin.sh [dir-de-saida]   (default: ./dist)
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN="$ROOT/plugins/connect"
OUT="${1:-$ROOT/dist}"
mkdir -p "$OUT"

[ -f "$PLUGIN/.claude-plugin/plugin.json" ] || { echo "ERRO: plugin.json não encontrado em $PLUGIN/.claude-plugin/"; exit 1; }

cd "$PLUGIN"
rm -f /tmp/connect.plugin
# empacota em /tmp primeiro (escrita direta no mount pode falhar), depois copia
zip -q -r /tmp/connect.plugin . -x "*.DS_Store" "**/sessions/*" "*.local" "connect.config.json"
cp /tmp/connect.plugin "$OUT/connect.plugin"
echo "OK -> $OUT/connect.plugin ($(stat -c%s "$OUT/connect.plugin") bytes)"
echo "conteúdo:"; unzip -Z1 "$OUT/connect.plugin" | sed 's/^/  /'
