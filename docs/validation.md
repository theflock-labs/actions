# Validation record

Release target: 0.2.0. Update this file with evidence, not intent.

Owner direction (2026-09-20): keep live inference validation pending and wait on the real-world pilot. Resume those activities only when the owner asks; no credentials or pilot selection are needed now.

## Verified locally

- TypeScript strict checking and bundled Action/CLI generation pass.
- 87 deterministic tests pass, including engine outcomes and repair, budget denial, incomplete billing, filesystem traversal, credential paths, Windows aliases and links, replay guards/promotion, provider protocol parsing, command environment/timeout/output limits, HTTP redirect rejection, real stdio and Streamable HTTP MCP fixtures, evaluation isolation/provenance/scoring, and structural JSON redaction.
- The same suite passes on Node 24.21.0, the supported release runtime.
- The bundled CLI executes the reviewed manifest runbook and independently verifies its result with zero model calls and no API key.
- The bundled offline scorer reproduces deterministic baselines of 11/16 issue-triage cases, 11/12 CI-diagnosis cases and 8/8 release-note constraint cases. All 36 cases are authored synthetic fixtures. The release-note checks measure mechanical constraints, not editorial quality. These are not model performance results.
- npm dependency audit reports no known vulnerabilities at initial installation. This is a point-in-time advisory check, not a security audit.

## Verified on GitHub

- Repository: [theflock-labs/actions](https://github.com/theflock-labs/actions), public, Apache-2.0 detected by GitHub; private vulnerability reporting enabled.
- [Initial CI run](https://github.com/theflock-labs/actions/actions/runs/35473899127) passed all 54 initial tests on Linux, macOS and Windows, reproduced the committed bundles, passed the production dependency audit and executed the packaged Action on an Ubuntu GitHub runner. The uploaded receipt confirms independent verification and zero model calls.
- [Expanded-suite CI](https://github.com/theflock-labs/actions/actions/runs/35474198262) passed all 58 tests on all three operating systems at commit `99bbdf413cb551896729712586afda85135de624`, including both MCP transports, replay preflight and incomplete-billing behavior. Bundles, generated schema and third-party notices reproduced in CI.
- [0.1.1 release CI](https://github.com/theflock-labs/actions/actions/runs/35474451812) passed all 65 tests on Linux, macOS and Windows, plus bundle reproduction, dependency audit and packaged Action execution at release commit `409a5161198d93170d3c146f3e27183cb7cc1519`.
- [Published consumer smoke test](https://github.com/theflock-labs/actions/actions/runs/35474588454) consumed `theflock-labs/actions@v0.1.1` through GitHub's public Action resolution, verified the generated manifest, asserted zero model calls and complete metering, and uploaded the actual receipt.
- [0.2.0 release CI](https://github.com/theflock-labs/actions/actions/runs/35475963792) passed all 87 tests on Linux, macOS and Windows at commit `ad1ac0a8ef744cff14149844a85979a4189b8a07`. It reproduced bundles, schemas and synthetic fixtures, audited production dependencies, exercised the bundled offline scorer and executed the packaged Action. The release includes all three synthetic baseline reports downloaded from this run.
- [0.2.0 public consumer smoke test](https://github.com/theflock-labs/actions/actions/runs/35476080226) successfully consumed `theflock-labs/actions@v0.2.0`, independently verified its manifest and asserted zero model calls and complete accounting.

## Release gates still to record

- Releases: [v0.1.0 preview](https://github.com/theflock-labs/actions/releases/tag/v0.1.0), [v0.1.1 hardening](https://github.com/theflock-labs/actions/releases/tag/v0.1.1), and [v0.2.0 evaluation preview](https://github.com/theflock-labs/actions/releases/tag/v0.2.0). See release pages for exact commits, runtime dependency SBOMs and checksums.
- Live OpenAI, Anthropic and compatible-provider acceptance. No inference key is present in the authoring environment. Mock protocol tests and local MCP tests do not establish live provider quality.
- Real service integration acceptance under customer-owned least-privilege credentials.
- Independent security review, design-partner outcomes, repeated-run savings, willingness-to-pay, and retention. None has been claimed or manufactured.
