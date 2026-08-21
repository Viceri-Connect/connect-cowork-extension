## Context

The Connect repository already contains the core mechanism for contextual navigation and business-aware knowledge resolution. The mechanism is implemented around a local MCP server, a vault-based navigation model, and a session bootstrap flow that is strongly tied to the Claude Cowork runtime. The current architecture is functionally strong, but it is not portable because the provider-facing layer is still embedded in Claude-specific hooks and plugin packaging.

The practical need is to preserve the business logic, guardrails, context loading and sub-vault resolution while adapting the runtime to GitHub Copilot and any other local execution environment. The design must therefore separate the provider interaction layer from the core engine.

## Goals / Non-Goals

**Goals:**
- Keep the current Connect core behavior intact for session bootstrap, resolution, navigation and source-of-truth governance.
- Create a provider abstraction that can host Claude and Copilot adapters with the same contract.
- Support a GitHub Copilot onboarding path through a local bridge plus a minimal VS Code integration.
- Make skills manifest-driven and provider-aware without losing current vault semantics.
- Preserve guardrails and consent behavior for any provider.

**Non-Goals:**
- Rewriting the business vault model or changing the core navigation rules.
- Moving all knowledge to a cloud service or removing local-first operation.
- Making every provider equivalent in UI and features; the goal is portability of the mechanism, not identical product semantics.

## Decisions

### 1. Core engine remains provider-agnostic

The current `mcp/connect-mcp.mjs` server and the libraries under `plugins/connect/lib/` represent the real execution engine. They already implement the session lifecycle, vault resolution and guardrails. This layer should remain untouched as the source of truth, and all provider-specific concerns should be moved to adapters.

Rationale:
- It minimizes impact to the proven model.
- It keeps the business rules stable.
- It avoids re-implementing context logic in every provider.

Alternative considered:
- Rewriting the logic into Claude-specific code. Rejected because it couples the engine to one environment and violates the portability objective.

### 2. Create a provider interface and adapter contract

Introduce a `providers/` layer with a common interface such as:
- `startSession(options)`
- `injectContext(context)`
- `resolveConcept(concept, workspaceDir)`
- `getSkillManifest(skillName)`
- `readProviderEnvironment()`

The actual provider implementations will wrap Claude, Copilot and generic adapters.

Rationale:
- It formalizes how runtime-specific behavior is mapped to the engine.
- It makes onboarding of a new provider a change in adapter layer, not in the business logic.

Alternative considered:
- Keep provider logic scattered in hooks and launcher scripts. Rejected because the code becomes non-portable and hard to audit.

### 3. Route Copilot through a local bridge + VS Code extension

For GitHub Copilot, the least risky path is not direct marketplace-level plugin injection but a local adapter:
- a Node bridge exposing a small HTTP or local socket API,
- a VS Code extension or command that triggers `iniciar_sessao` and writes the context into a workspace file or editor block,
- optional auto-injection based on a workspace setting.

Rationale:
- It works without depending on private provider APIs or Claude marketplace semantics.
- It provides a predictable, auditable and local-first control surface.

Alternative considered:
- Direct API integration with Copilot Chat internals. Rejected because the environment is not openly documented and would create a more brittle dependency.

### 4. Make skills manifest-first and multi-harness

Each skill should expose a small manifest describing:
- id
- provider support
- source file(s)
- template files
- triggers
- delta policy
- guardrails

This allows skills to have a canonical source plus provider deltas, instead of hardcoding to Claude-native concepts like `CLAUDE.md` or a platform-specific session model.

Rationale:
- It creates a stable contract independent from the host model.
- It preserves the connective logic while allowing `copilot`, `claude`, and future providers to override only the transport or wrapper.

Alternative considered:
- Continue to maintain nested Claude-only skill templates. Rejected because it hardcodes consumer assumptions.

### 5. Keep explicit governance and consent boundaries

Every provider has to respect a small governance contract:
- no secret or token leakage to workspace files or logs,
- explicit operator consent before injecting long context blocks,
- keep source-of-truth files on local machine,
- expose only the minimal locked context required for the task.

Rationale:
- This preserves the operator’s trust and keeps the system safe in multi-provider flows.

## Risks / Trade-offs

- [Provider API surface is not standardized] → Mitigation: keep provider integration behind a narrow interface and test it via local bridge and extension contracts.
- [Copilot extension scope may be limited] → Mitigation: prefer local bridge + workspace injection rather than direct chat internals.
- [Skills may drift between provider-specific templates] → Mitigation: single manifest and provider-specific deltas with strong validation.
- [Session context may become too heavy] → Mitigation: keep the lazy load model and inject only necessary layers.
- [Operator override may be inconsistent] → Mitigation: keep explicit consent gates and logs in `.connect`.

## Migration Plan

1. Stabilize the current core engine and ensure the JSON-RPC MCP server is healthy.
2. Introduce the provider abstraction layer without changing runtime behavior.
3. Add the Copilot adapter and local bridge to the `providers/` tree.
4. Introduce manifest-driven skills with Claude and Copilot support for a small subset.
5. Ship the VS Code extension command for context injection.
6. Validate with a real local workspace and with the existing Matriz/Tribo vaults.

## Open Questions

- What exact Copilot extension/command APIs are available in the target environment?
- Should the default injection mode be file-based (`.connect/context.md`) or editor-comment insertion?
- Which skills should be migrated first to the manifest-first pattern: navigation, session, or writing?
- Is there a requirement for automatic session start in the VS Code extension or manual trigger only?
