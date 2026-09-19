# Build and validation notes

## Local Node version versus test-runner support

The workstation initially provided Node 25.2.1; Vitest 5 declares support for Node 22.12, 24, and 26+. Tests ran, but an engine warning is not a supported-platform validation. CI and the Action target Node 24. Run the release checks under Node 24 before release.

## HTTP test listener typing

Extracting `Parameters<typeof createServer>[0]` selects an overload's options type, not its listener. Use Node's exported `RequestListener` type. No runtime failure was involved.

## Replay preflight must precede side effects

Validation found that checking a runbook one step at a time could write files before rejecting a later read-after-write sequence. The engine now preflights the full sequence, schemas, capabilities, and call count before executing the first step. Changed contract/review checks also precede MCP initialization.

## Market research is not proof of a moat

GitHub Agentic Workflows already implements safe outputs, multi-provider engines, budgets, and outcome measurement. None of those alone is a Flock moat. The shipped differentiator is the contract-to-reviewed-runbook lifecycle. Adoption, repeat-run savings, and organization-level workflow data must still be demonstrated; no customer evidence is fabricated.

## Missing usage is not a zero-dollar request

Review found that an API transport error could leave an estimate of zero even though the submitted request might be billed. Receipts and the Action now expose `accountingComplete` / `accounting-complete`; job summaries explicitly mark incomplete metering instead of presenting a complete price. Existing known usage remains available. No automatic retry is introduced.

## Cross-platform credential paths

Final boundary review identified additional common credential files (`.npmrc`, `.netrc`, `.pypirc`, `.git-credentials`, Docker and Kubernetes config) and Windows path aliases as gaps in built-in file protections. The follow-up patch denies those paths, alternate-stream colons and trailing dot/space components and matches protected workflow/task directories case-insensitively. These controls still do not replace runner isolation or detect arbitrary secrets in allowed files.

## GitHub workflow registration is eventually consistent

An immediate dispatch of the newly pushed `release-smoke.yml` returned HTTP 404 even though the push succeeded. No run had started. Listing workflows later confirmed registration; dispatching its observed workflow ID then succeeded. Check registration and run state before retrying so transient API lag does not create duplicate runs.

## Secret redaction must preserve structured metadata

A regression using a numeric secret (`1234`) reproduced invalid JSON when the same digits appeared in token counts or durations: redaction was performed on serialized JSON. Redaction now walks user-controlled JSON data and text fields while preserving numeric metering, status enums and fingerprints. This is a correctness fix to `src/engine.ts`, `src/util.ts` and the evaluation report writer; known secrets in user strings remain masked.

## Capture provider inputs at call time in tests

An initial ground-truth isolation assertion inspected the provider mock's retained message-array reference after the engine appended the model response, producing a false positive. The test now snapshots messages when the provider is called. Expected labels are not sent in the model prompt.
