# Validation record

Release target: 0.1.1. Update this file with evidence, not intent.

## Verified locally

- TypeScript strict checking and bundled Action/CLI generation pass.
- 65 deterministic tests pass, including engine outcomes and repair, budget denial, incomplete billing, filesystem traversal, credential paths, Windows aliases and links, replay guards/promotion, provider protocol parsing, command environment/timeout/output limits, HTTP redirect rejection, and real stdio and Streamable HTTP MCP fixtures.
- The same suite passes on Node 24.21.0, the supported release runtime.
- The bundled CLI executes the reviewed manifest runbook and independently verifies its result with zero model calls and no API key.
- npm dependency audit reports no known vulnerabilities at initial installation. This is a point-in-time advisory check, not a security audit.

## Verified on GitHub

- Repository: [theflock-labs/actions](https://github.com/theflock-labs/actions), public, Apache-2.0 detected by GitHub; private vulnerability reporting enabled.
- [Initial CI run](https://github.com/theflock-labs/actions/actions/runs/35473899127) passed all 54 initial tests on Linux, macOS and Windows, reproduced the committed bundles, passed the production dependency audit and executed the packaged Action on an Ubuntu GitHub runner. The uploaded receipt confirms independent verification and zero model calls.
- [Expanded-suite CI](https://github.com/theflock-labs/actions/actions/runs/35474198262) passed all 58 tests on all three operating systems at commit `99bbdf413cb551896729712586afda85135de624`, including both MCP transports, replay preflight and incomplete-billing behavior. Bundles, generated schema and third-party notices reproduced in CI.

## Release gates still to record

- Release: [v0.1.0 preview](https://github.com/theflock-labs/actions/releases/tag/v0.1.0), followed by [v0.1.1 hardening](https://github.com/theflock-labs/actions/releases/tag/v0.1.1). See release pages for exact commits and runtime dependency SBOMs.
- Live OpenAI, Anthropic and compatible-provider acceptance. No inference key is present in the authoring environment. Mock protocol tests and local MCP tests do not establish live provider quality.
- Real service integration acceptance under customer-owned least-privilege credentials.
- Independent security review, design-partner outcomes, repeated-run savings, willingness-to-pay, and retention. None has been claimed or manufactured.
