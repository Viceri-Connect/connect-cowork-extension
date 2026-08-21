# Skill Portability

## Summary
Skills must be portable across providers without embedding Claude-specific assumptions in the source-of-truth skill definitions.

## Requirements

### Requirement 1: Manifest-based skill definition
Each skill shall declare its identity, trigger conditions, templates, supported providers, and any provider-specific deltas in a machine-readable manifest.

### Requirement 2: Canonical source plus provider delta
The base skill source shall remain provider-agnostic. Provider-specific changes shall be represented as deltas or templates, not as direct rewriting of the root content.

### Requirement 3: Template selection is runtime-driven
The runtime shall select the template or delta for the active provider based on the skill manifest and the current provider adapter.

### Requirement 4: Legacy Claude-specific assumptions remain isolated
Any `CLAUDE.md` or Claude-native hook behavior must be treated as provider-specific adapter context and not as the canonical skill definition.
