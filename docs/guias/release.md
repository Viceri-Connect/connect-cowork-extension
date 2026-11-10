# Release

1. **Versão** igual em `plugins/connect/.claude-plugin/plugin.json`, `plugin.json` e
   `.antigravity-plugin/plugin.json`. O `.claude-plugin` é a fonte; `release.test.mjs` exige que
   ela seja a primeira entrada do `CHANGELOG.md`.
2. **CHANGELOG** em `plugins/connect/CHANGELOG.md`: o que muda para o operador, por quê, e o que
   foi medido.
3. **Artefatos gerados:**
   ```
   npm run gerar:regras
   npm run gerar:paridade
   # apague plugins/connect-http antes
   npm run build:connect-http -- plugins/connect-http
   ```
4. **Testes:** `npm test`. Rodar num checkout limpo pega o que o diretório de trabalho esconde
   (fim de linha, modo 755).
5. **Pacotes** em `dist/` (ignorado pelo git):
   ```
   bash scripts/build-plugin.sh "$(pwd)/dist/release-X.Y.Z"
   npm run build:copilot -- dist/release-X.Y.Z/copilot
   npm run build:connect-http -- dist/release-X.Y.Z/connect-http
   ```
   O `build-plugin.sh` precisa de caminho absoluto.
6. **Commits:** um por pacote de mudança, cada um verde sozinho; mensagem em português, no
   imperativo, com o porquê.
7. **Avise os operadores do Codex:** ele pede revisão dos hooks a cada versão que muda hook ou
   script.
