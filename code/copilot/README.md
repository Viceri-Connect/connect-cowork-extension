Copilot integration scaffold

This folder contains Copilot-specific adapters and instruction placeholders.
Files here are non-invasive copies and do not modify the Claude `plugins/connect/skills` files.

Structure:
- `providers/` — Copilot provider adapters (copy of runtime adapters used for local development)
- `skills/` — per-skill Copilot instruction files and provider-specific assets

The repository's Claude plugin (under `plugins/connect`) remains the canonical package
for the Claude Cowork marketplace. Files under `code/copilot/` are for local Copilot
integration and can be generated or updated by an installer script.
