# Context Governance

## Summary
The system shall govern the scope, timing and operator consent for any context injection or provider integration.

## Requirements

### Requirement 1: Minimal context exposure
The system shall expose only the minimum context required for the active session and task, never the full workspace or unrelated business memory unless explicitly requested.

### Requirement 2: Operator consent gate
Any injection into the editor, workspace or remote model context shall require explicit operator approval or a clearly enabled workspace setting.

### Requirement 3: Local-first control
All source-of-truth knowledge and local resolution state shall remain on the local machine, with no mandatory connection to a hosted provider service.

### Requirement 4: Auditability
The system shall log each context injection in a local artifact under `.connect/` so the operator can review what was loaded and when.
