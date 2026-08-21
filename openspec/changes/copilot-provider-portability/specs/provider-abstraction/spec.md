# Provider Abstraction

## Summary
The Connect runtime must support multiple provider adapters without changing the source-of-truth engine that resolves context, navigation, and session state.

## Requirements

### Requirement 1: Common provider contract
The system shall expose a provider interface that defines how a runtime adapter starts a session, resolves a concept, injects context, and returns skill metadata.

### Requirement 2: Core engine remains provider-neutral
The mechanism in `plugins/connect/lib` and `plugins/connect/mcp` shall be valid for any provider implementation and shall not depend on Claude-only environment variables or packaging assumptions.

### Requirement 3: Provider-specific behavior is isolated
Claude-specific hooks, launchers, and environment assumptions shall live behind provider adapters rather than inside the shared engine.

### Requirement 4: Session bootstrap remains consistent
Each provider adapter shall trigger the same minimal session lifecycle: start session, mount workspace context, and apply the relevant lazy-load layer.
