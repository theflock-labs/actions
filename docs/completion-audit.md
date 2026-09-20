# Objective audit

Status: substantial public preview delivered; the full product/business objective is **not yet proven**. This distinguishes shipped artifacts from validation that requires accounts or real users.

## Proven from current artifacts

- **New public Flock Labs repository:** https://github.com/theflock-labs/actions; GitHub reports PUBLIC and the owner is `theflock-labs`.
- **Open source:** Apache-2.0, recognized by GitHub, with NOTICE and generated bundled dependency licenses.
- **Published Action:** [version 0.2.0](https://github.com/theflock-labs/actions/releases/tag/v0.2.0) at commit `ad1ac0a8ef744cff14149844a85979a4189b8a07`; release assets include a runtime dependency SBOM, checksums and the synthetic deterministic baseline reports from CI.
- **Public consumer execution:** [smoke test](https://github.com/theflock-labs/actions/actions/runs/35476080226) resolved and ran `theflock-labs/actions@v0.2.0`, independently verified the artifact, and asserted zero model calls and complete accounting.
- **Working execution paths:** Action/CLI/library, scoped files, command/HTTP tools and both MCP transports. [Release CI](https://github.com/theflock-labs/actions/actions/runs/35475963792) passes 87 tests on Linux, macOS and Windows and runs the packaged Action on GitHub.
- **Avoid unnecessary AI:** deterministic runbooks bypass provider initialization and independently verify outputs with zero model calls. Examples keep ordinary filtering, building, testing and deployment in existing Actions/scripts.
- **Evaluation foundation:** the `evaluate` and offline `score` commands use shared labeled suites, input fingerprints, explicit provenance, budget controls and independent checks. There are 36 authored synthetic cases across triage, CI diagnosis and release-note constraints, plus reproducible no-model baselines. These are not live model results or production performance evidence.
- **Research:** [market assessment](market.md) evaluates direct competitors, adjacent agents/review tools, workflow platforms, deterministic substitutes and security/gateway complements using current primary sources. No fictitious TAM, market share or benchmark ranking is presented.
- **Monetization plan:** [pricing](pricing.md) describes a free local runner, proposed organization plans, a 24-month monetization sequence, and explicit unit-economic assumptions and sensitivities.
- **Integration breadth:** [integration guide](integrations.md) covers transport/auth routes across source control, planning, chat, observability, cloud, build/release, data, security and workflow systems. It separates implemented adapters, examples, gateway routes and unsupported authentication.

## Not yet proven

- **Live model usefulness and compatibility:** OpenAI/Anthropic/compatible provider protocol fixtures pass, but no model key exists in the authoring environment or repository secrets. The manual `Live provider acceptance` workflow is ready to execute a real bounded file-generation task and verify it once a provider secret is configured. Do not describe mock tests as live inference validation.
- **An actual commercial moat:** the contract-to-reviewed-runbook lifecycle is implemented and tested. Customer adoption, repeatability frequency, longitudinal outcome advantage, retention and willingness to pay are not established. The [strategy](strategy.md) defines evidence gates. Code and market research alone cannot establish these facts.
- **Universal integration certification:** generic adapters allow broad composition; not every service, cloud authentication scheme, model or account has been live-tested. Native cloud model auth, interactive MCP OAuth and parameterized promotion are explicitly outside this preview.
- **Best-in-market performance:** requires equal-task comparisons, representative labeled cases, live accounts, accepted-outcome measurements and security review. No unsupported superlative is claimed.

## Next evidence to obtain

The owner deferred live inference validation and the real-world pilot on 2026-09-20. The following are future evidence needs, not actions to start or repeatedly request now.

1. When live validation resumes, configure a provider secret and run live acceptance; inspect the actual receipt, artifact, usage and verifier results.
2. After resumption, run live models and a leading incumbent on the included cases, then expand beyond synthetic fixtures to representative, permissioned, independently labeled data. Preserve equal inputs and explicit execution/provenance differences.
3. When the pilot resumes, enroll consenting design partners and measure accepted outcomes, investigation time, repeat eligibility and retention. No customer messages or outreach have been sent as part of this build.
4. Validate proposed prices and support costs before offering a paid plan. Keep the open runner and critical local controls free.

Flock graph tools were unavailable in this session. Repository [decisions](decisions.md) and [failed-attempt notes](attempts.md) preserve the implementation context for later graph synchronization; no claim is made that the graph was queried or updated.
