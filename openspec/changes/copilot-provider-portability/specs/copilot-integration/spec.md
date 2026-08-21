# Copilot Integration

## Summary
The Connect mechanism must be usable in a GitHub Copilot workflow through a local adapter that injects the required business context without requiring a Claude-specific plugin marketplace.

## Requirements

### Requirement 1: Local adapter entry point
The system shall provide a local adapter for GitHub Copilot that can trigger Connect session bootstrap and context resolution from a workspace-local execution environment.

### Requirement 2: Workspace context injection
The adapter shall write or inject the generated Connect context into the workspace or active editor in a controlled way approved by the operator.

### Requirement 3: No mandatory dependency on Claude runtime
The Copilot flow shall not require Claude-specific plugin registration or marketplace packaging to run the same core governance and navigation model.

### Requirement 4: Local execution is auditable
The adapter shall preserve a traceable local artifact such as `.connect/context.md` or an equivalent consented injection log for review.
