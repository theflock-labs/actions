# Flock Actions

**Prompts when you need judgment. Programs once you don't.**

[![CI](https://github.com/theflock-labs/actions/actions/workflows/ci.yml/badge.svg)](https://github.com/theflock-labs/actions/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)

Flock Actions is an open-source GitHub Action and CLI for bounded, verifiable agentic automation. Describe the outcome, declare the capabilities, and let an agent work. Check the result with ordinary code. Promote suitable successful runs into reviewed runbooks that execute without a model.

Built by [Flock Labs](https://github.com/theflock-labs). **Early preview: v0.1.0.** No hosted service, account, subscription, telemetry, or inference markup.

## Start with a prompt

```yaml
permissions:
  contents: read

steps:
  - uses: theflock-labs/actions@v0.1.0 # Pin a full commit SHA in production.
    id: assess
    with:
      api-key: ${{ secrets.OPENAI_API_KEY }}
      max-cost-usd: '0.05'
      prompt: >-
        Explain this build failure and recommend the next diagnostic step.
        Return a JSON object with diagnosis and next_step.
      inputs: '{"log":"TypeError: Cannot read properties of undefined (reading id), at exportReport"}'
```

Prompt-only mode has **no repository or external tool access**. Pass data through `inputs`; grant capabilities through a task contract when the agent needs to act. A report without independent verifiers returns `status: unverified`, even when its JSON is valid. Do not treat it as deployment authorization.

## Give the agent a job, tools, and a definition of done

Save this as `.flock-tasks/release-notes.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/theflock-labs/actions/v0.1.0/schema/task.schema.json",
  "version": 1,
  "name": "Draft release notes",
  "prompt": "Read changes.txt. Group user-visible changes into a concise release draft in release-notes.md. Cite the change IDs. Do not invent features. Return the output path.",
  "permissions": {
    "write": true,
    "readPaths": ["changes.txt"],
    "writePaths": ["release-notes.md"]
  },
  "resultSchema": {
    "type": "object",
    "properties": { "path": { "const": "release-notes.md" } },
    "required": ["path"],
    "additionalProperties": false
  },
  "verifiers": [
    { "type": "file", "name": "Draft exists", "path": "release-notes.md", "contains": "#" }
  ]
}
```

```yaml
- uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6
  with:
    persist-credentials: false
- uses: theflock-labs/actions@v0.1.0
  id: draft
  with:
    task-file: .flock-tasks/release-notes.json
    api-key: ${{ secrets.OPENAI_API_KEY }}
- uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4
  if: always()
  with:
    name: flock-receipt
    path: ${{ steps.draft.outputs.receipt-path }}
```

This verifier proves only that a draft exists with a heading. Add a trusted command verifier for citation coverage and release-specific requirements. Keep editorial approval before publication. See [complete examples](examples/README.md).

## Repeat without paying for reasoning again

```sh
git clone https://github.com/theflock-labs/actions.git
cd actions
npm ci
npm run demo
```

The included reviewed runbook writes and verifies a release manifest. It requires **no API key** and performs **zero model calls**. The checked-in bundles also run directly with Node 24 without installing packages:

```sh
node dist/cli.js run --task examples/runbook/task.json --runbook examples/runbook/runbook.json
```

To promote an agent run:

```sh
node dist/cli.js run --task .flock-tasks/task.json --receipt receipt.json
node dist/cli.js promote --task .flock-tasks/task.json --receipt receipt.json --output runbook.json
# Review every step and its repeatability, then set reviewed to true.
node dist/cli.js run --task .flock-tasks/task.json --runbook runbook.json
```

Promotion only accepts independently verified agent receipts. The runbook binds the exact task, inputs, and prerequisite observations. Changed inputs fail closed. It does **not** replay yesterday's issue classification onto today's issue. This first release supports exact-input runbooks; parameterized families and statistical promotion are roadmap work.

## Where AI earns its keep

- Diagnose ambiguous failures using logs and repository context.
- Classify issues or assess changes against written criteria.
- Draft release notes and documentation that need synthesis.
- Choose among explicitly authorized remediation tools, then run checks.

Use ordinary Actions for dependency installation, building, testing, artifact upload, version arithmetic, routine dependency updates, and known deployment procedures. Use Actions `if:` and path filters before invoking a model. A stable procedure belongs in a script or runbook.

## What ships

- OpenAI and Anthropic protocol adapters; an OpenAI-compatible adapter for gateways and local endpoints.
- Explicit file permissions, fixed commands with JSON stdin, fixed-endpoint HTTP, MCP stdio and Streamable HTTP with tool allowlists.
- Per-run turn, tool, token, time and estimated USD budgets; no hidden model retries.
- Independent file/schema/command verifiers and bounded repair after failed verification.
- Portable JSON receipts, contract fingerprints, secret-value redaction, GitHub outputs and job summaries.
- Reviewed runbooks with prerequisite digests and no inference dependency.
- Generated [JSON Schema](schema/task.schema.json), local CLI, cross-platform tests, and bundled Action distribution.

Protocol and adapter tests are not a certification of every vendor or model. This release's live-inference validation status is recorded in [validation](docs/validation.md).

## Cost and trust

The action is free under Apache-2.0. You pay your model provider and, where applicable, your runner and external tools. The default model is `gpt-5-mini`; prices are explicit and replaceable. `max-cost-usd` is a conservative **estimate**, not a provider-enforced billing cap. [Cost controls and proposed business model](docs/pricing.md).

Commands and MCP servers are trusted code with their runner's authority. Capability checks are not an OS sandbox. Use trusted task files, scoped credentials and ephemeral runners; keep production approval in GitHub Environments. [Security model](SECURITY.md).

## Documentation

- [Task format, outputs, CLI and limits](docs/reference.md)
- [Integration guide and coverage](docs/integrations.md)
- [Architecture and runbook lifecycle](docs/architecture.md)
- [Market research and competitive assessment](docs/market.md)
- [Differentiation, defensibility and roadmap](docs/strategy.md)
- [Pricing and unit economics](docs/pricing.md)
- [Contributing](CONTRIBUTING.md)

Flock is not the first agentic workflow system. [GitHub Agentic Workflows](https://github.github.com/gh-aw/) is a strong alternative, particularly for sandboxed GitHub automation. Our focus is turning verified agent work into reviewable, portable automation that needs less inference over time.
