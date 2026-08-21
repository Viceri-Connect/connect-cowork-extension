## 1. Provider Abstraction

- [x] 1.1 Define provider interface contract for session lifecycle and context injection
- [x] 1.2 Create `providers/` directory and isolate provider-specific adapter entry points
- [x] 1.3 Move Claude-specific bootstrap assumptions behind a Claude adapter

## 2. Copilot Local Integration

- [x] 2.1 Implement local bridge for Connect MCP to expose session and resolution endpoints
- [x] 2.2 Add a Copilot-facing adapter that triggers the same session bootstrap contract
- [x] 2.3 Write context artifacts to `.connect/context.md` for workspace-local consumption

## 3. Skill Portability

- [x] 3.1 Define a manifest format for skills with provider support and template selection
- [x] 3.2 Refactor one or more skills to use the manifest-driven source/delta model
- [ ] 3.3 Validate legacy Claude skill files remain compatible with the new provider-aware runtime

## 4. Governance and Safety

- [ ] 4.1 Add consent and exposure rules to the local Connect configuration model
- [ ] 4.2 Add logging and audit file generation for session and injection operations
- [ ] 4.3 Validate that context exposure remains minimal and local-first

## 5. Validation

- [ ] 5.1 Run the MCP validation flow against the core server
- [ ] 5.2 Validate the Copilot bridge and workspace context generation end-to-end
- [ ] 5.3 Confirm the new provider abstraction preserves the current Matriz/Tribo behavior
