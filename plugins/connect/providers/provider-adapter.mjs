// Minimal provider adapter for session bootstrap and provider helpers
// This file implements a small, provider-agnostic helper surface used by
// provider-facing entrypoints (hooks, bridges, extensions). It centralizes
// environment names and basic extraction logic so provider-specific
// assumptions (e.g., CLAUDE_SESSION_ID) live behind a single adapter.

export function extractSessionId(payload = {}) {
  if (!payload) payload = {};
  // Prefer explicit fields from payload
  const explicit = payload.session_id || payload.sessionId || payload.session || null;
  if (explicit) return explicit;

  // Common environment variables used by various provider integrations.
  const envNames = [
    'CONNECT_SESSION_ID',
    'CLAUDE_SESSION_ID',
    'COPILOT_SESSION_ID',
    'PROVIDER_SESSION_ID',
  ];

  for (const n of envNames) {
    if (process.env[n]) return process.env[n];
  }

  return null;
}

export default {
  extractSessionId,
};
