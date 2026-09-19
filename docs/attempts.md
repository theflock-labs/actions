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
