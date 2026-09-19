# Security policy and threat model

Flock Actions is an early preview. Report suspected vulnerabilities through [private security reporting](https://github.com/theflock-labs/actions/security/advisories/new). Do not include credentials in public issues. Supported fixes target the latest release.

## Authority and trust

Workflow YAML, task contracts, runbooks, verifier code, command adapters, MCP servers and their dependencies are trusted code. The model, issue text, repository content and tool observations are untrusted. A repository maintainer must review capabilities and credentials just as they would review any other workflow code.

The model can invoke only registered tools with locally validated JSON arguments. Write tools are omitted unless `permissions.write` is true. Write-enabled tasks require a verifier. Built-in file tools restrict relative paths, common credential locations, symlinks and hard links, and cannot modify `.git`, `.github`, `.flock-tasks` or receipt storage under `.flock`.

These are application-level controls, **not an OS sandbox**. A trusted command or MCP process can access files and network resources available to the runner account, regardless of a declared `read` effect. A malicious peer process can race filesystem checks. A legitimate GET endpoint may itself cause side effects. HTTP policy fixes the destination chosen by the workflow author; it is not an SSRF filter for malicious workflow authors or a substitute for network egress control.

## Safe deployment pattern

1. Start with `permissions: contents: read`, `persist-credentials: false`, narrowly scoped paths, and a low model budget.
2. Load task definitions, tools and verifiers from a trusted revision. Do not use `pull_request_target` with attacker-controlled code or task configuration. Forked PRs do not need provider or write credentials for deterministic CI.
3. Treat PR/issue text as input data. Never interpolate it into shell scripts, command argv, trusted prompts, task definitions or URLs. Parse a schema-validated result in a subsequent deterministic step.
4. Separate reasoning from privileged publication. Prefer a read-only agent job and a later narrowly authorized write/deployment job with GitHub Environment approval. A prompt is not authorization.
5. Use ephemeral hosted/container runners. Avoid persistent self-hosted runners with production credentials or cached home directories. Pin dependencies, Action SHAs and MCP servers; never invoke an unpinned `npx ...@latest` server.
6. Keep verifiers and their dependencies outside agent-writable paths. A verifier run in the same mutable checkout is not an independent security boundary. High-assurance checks need a trusted separate job or external service.

## Credentials and data

Model keys are used only in provider requests. Command/MCP child environments inherit a minimal OS environment plus explicitly declared keys; they do not inherit all runner credentials. HTTP bearer/custom-header authentication resolves a named environment variable at execution time. HTTPS is required except explicitly enabled loopback HTTP. Redirects are rejected for provider and HTTP tool requests; the MCP transport also receives `redirect:error`.

Flock masks exact known credential values in input data, tool feedback, receipts and surfaced errors. Values of environment variables with KEY/TOKEN/SECRET/PASSWORD/CREDENTIAL names and explicit tool credential variables are included. This does not detect unknown secrets in files, short values, encodings, fragments, or arbitrary PII. It does not make a malicious authorized tool safe. Review data paths and artifacts; send only content your model provider and connected services may receive.

Receipts omit raw tool outputs and full transcripts but retain tool arguments and structured results after redaction. Arguments can contain private source or customer data. Use private artifacts and deliberate retention. No content is sent to Flock Labs. Model providers, MCP servers and declared endpoints receive the information necessary for their calls under your accounts.

## Budgets, cancellation and partial failure

Turn, tool-call, token, output-size and time bounds prevent an unbounded normal loop. Requests that fail after submission may still cost money. USD estimates are not invoice caps; cached/reasoning tokens and vendor price changes can differ. Use provider/gateway enforcement as well.

Flock does not automatically retry model requests or external side effects. Prior successful writes are not rolled back when a later tool, verifier or budget fails. On timeout it terminates command process groups on Unix and the immediate process on Windows; descendant cleanup on Windows requires an external job/container boundary. MCP cleanup is best effort on cancellation. Do not assume exactly-once delivery or transactionality.

## Runbook review

A receipt checksum proves only internal consistency, not authorship. Accept receipts and runbooks only from trusted workflow runs. Review every write for repeatability and duplicate effects. Input/task fingerprints and prerequisite digests reduce stale replay; they do not authenticate remote observations. Retrying a reviewed runbook can repeat an external mutation. Use service idempotency keys and GitHub concurrency where applicable.

## Release controls

Dependencies are locked, bundles are checked against source in CI, all CI actions are SHA-pinned, and credentials are absent from deterministic tests. A public preview is not a penetration-test certification. Live provider/account-specific compatibility and production adoption are separate validation gates in [validation.md](docs/validation.md).
