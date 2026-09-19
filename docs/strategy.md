# Product strategy and defensibility

## What we can defend today

The implementation delivers a coherent contract-to-runbook lifecycle: constrained capability calls, independent checks, a portable receipt, explicit promotion, immutable task/input matching, prerequisite observation guards, and replay without model initialization. These are testable properties of this repository. They are a technical wedge, **not an established economic moat**. No feature here is assumed uncopyable.

The first release does not claim cross-customer training data, privileged distribution, enterprise customers, patents, market leadership or durable switching costs. Competitors already offer tools, budgets, outcomes and forms of replay. Calling those a moat would mislead both customers and Flock.

## The moat to build

1. **A useful corpus of verified automation contracts.** Each reusable task family needs fixtures, failure cases, independent validators, cost/latency observations, and reviewed deterministic exits. Quality and accumulated compatibility work matter more than connector count. Publish general-purpose recipes and keep customer-specific artifacts private.
2. **Longitudinal outcome data, with explicit consent.** A customer-owned record of whether changes passed checks, were accepted, recurred and saved work can improve selection and promotion. Private data stays isolated. Any cross-customer aggregate must be opt-in and contain no code, prompts or secrets. The current runner collects no telemetry and has no such dataset yet.
3. **Operational embedding.** Integrations with policy owners, approval systems and incident/release workflows can create trust and migration cost because they encode real organizational process. Exports and open contracts preserve customer ownership; avoid artificial lock-in.
4. **Distribution through Flock and interoperable tools.** The Flock development environment can become an author/review surface; Actions is the execution surface. This is a distribution hypothesis, not shipped integration. Support incumbent agents and workflows instead of requiring replacement.

Measure moat progress through the size and quality of the validated corpus, organization-level retention, repeatability coverage, accepted-outcome performance and integration depth. Stars, raw connector counts and generated YAML are insufficient.

## Product boundaries

Keep the local runner, core security checks, provider adapters, receipt format and runbook format Apache-2.0. Monetize a managed organizational service: policy distribution, cross-repo oversight, retention, signed provenance, allocation and support. Do not put critical local safety behind a paywall or depend on increasing inference usage for revenue.

Do not silently learn executable procedures from one run. First support explicit reviewed runbooks for stable inputs. Then add parameterized contracts with declared preconditions and typed binding rules, evaluated against held-out task fixtures. Eventually recommend promotion only when outcomes and replay invariants meet measured criteria; a reviewer still controls deployment.

## Roadmap with exit gates

**0–30 days: validate the kernel.** Publish a tagged preview; pass deterministic tests and GitHub-hosted execution; validate one live run per supported provider route with consenting accounts. Recruit 5 design-partner teams through founder-led outreach outside this repository. Ship 3 task families: CI diagnosis, release documentation, and issue triage. Acceptance targets: at least 50 labeled cases per family, zero unauthorized-capability executions in the adversarial suite, and visible failure when verification is inconclusive. Targets are not current results.

**31–90 days: prove recurring value.** Capture at least 500 real task outcomes across partners with permission. Compare against a deterministic baseline and a leading incumbent on the same inputs. Targets: ≥70% maintainer-accepted outcomes on the selected bounded tasks, ≥30% reduction in median time to resolution, and ≥20% of repeat eligible operations executed without inference. Report sample sizes, p50/p95 cost and failure severity. Retain at least 3 of 5 teams weekly and secure at least 2 willingness-to-pay commitments. If exact-input recurrence is poor, prioritize safe parameterized runbooks or drop the replay wedge; do not inflate the denominator.

**3–6 months: pilot paid control plane.** Build organization policy packs, searchable metadata-only receipt ingestion, role-based views, budget allocation and 30/90-day retention. Add GitHub App installation only after least-privilege design review. Pilot $149/team/month pricing and measure support cost. Keep execution on customer runners. Gate expansion on useful repeat workflows, acceptable security review, and gross margin after support.

**6–12 months: enterprise operations.** Add SSO/SCIM, tamper-evident provenance, policy approval, private deployment and auditable retention where paid customers require them. Integrate GitLab/Buildkite through the same CLI and receipt format. Invest in native OIDC and gateway auth only for validated demand. Do not promise compliance certifications before obtaining them.

**12–24 months: trusted automation network.** Offer a curated registry of task families with versioned evaluations and compatibility evidence, organization-private policy/recipe distribution and optional managed execution. A marketplace is justified only after customers reuse and maintain packages. Consider revenue share only when distribution adds measurable value; avoid a speculative marketplace tax.

## Launch and growth

Public repository and clear examples first; no fabricated testimonials or benchmark wins. Publish comparisons on equal tasks with transparent prices and failure cases. Make runbooks and receipts inspectable in PRs. Use maintainers and platform engineers as the audience. Partner with agent/gateway/runner ecosystems rather than claiming to replace them.

Success metric: **cost and human time per accepted, independently checked outcome**, with risk tracked separately. Supporting metrics: onboarding completion, recurring weekly workflows, verification coverage, failure recovery, zero-inference share among eligible repeats, and customer retention. Model calls per user is a cost metric, not a growth objective.
