# Design-partner validation protocol

This is a prepared experiment plan, not a claim that partners have enrolled. No customer outreach or messages have been sent.

## Decision to test

Does Flock reduce investigation and maintenance work at acceptable risk and cost compared with the team's existing scripts and agent tooling? Does a useful share of repeat work become a reviewed deterministic procedure? Will the organization pay for the proposed control-plane features after seeing that value?

## Before starting

Identify a consenting repository owner and a maintainer who will judge outcomes. Choose one bounded task family. Agree on the data that may leave the organization, the model account, retention, allowed tools, publication restrictions and the maximum experimental spend. Use a repository-owned task contract and read-only credentials at first. Do not collect private code, customer information or secrets for a shared benchmark without appropriate authorization.

Document a dated baseline: current incident volume, time spent per task, existing automation, current provider/runner costs, and error severity. Existing partner/user consent and organizational controls remain authoritative; this protocol is not a legal agreement.

## Case collection and labels

Start with at least 50 real cases per selected family. Preserve the full selection window and inclusion/exclusion criteria so results are not hand-picked. Keep a development set separate from a held-out evaluation set. Include failures, ambiguous cases and benign/no-op cases at their observed prevalence; run an additional adversarial suite separately rather than presenting it as the production distribution.

Two maintainers should label the desired outcome before seeing system outputs. Record disagreement and adjudicate it; do not rewrite labels to make Flock's response pass. Separate objective checks (correct issue label, exact failing line, tests pass, no unauthorized change) from subjective checks (usefulness, clarity, whether the change should ship).

Use the versioned suite format for automatable assertions and a separate customer-owned review record for human acceptance. Record anonymized case IDs, selected system/version, reviewer, acceptance/rejection, rejection reason, review time, incident resolution time, and any harmful or unauthorized behavior. Minimize and protect personal data.

## Comparison

Compare the existing deterministic process, the team's chosen incumbent agent, and Flock on the same held-out cases. Give each the same permitted data, outcome definition, tools, wall-time and spend ceiling. Randomize presentation order to reviewers and blind system names where practical. Run repeated trials for stochastic systems. Report sample sizes and per-category results, not only the best run.

The supplied offline scorer can check imported outputs, but imported usage and provenance remain self-reported. Keep original workflow receipts and service billing evidence to resolve discrepancies. Do not equate a task passing JSON Schema with maintainer acceptance.

## Required outcome evidence

- Accepted outcomes out of all eligible cases, with failures and not-run cases visible.
- Human review and investigation time, including the work needed to correct wrong results.
- Inference, runner and external-tool costs, including failed attempts and incomplete billing.
- Severity and scope of mistakes, unauthorized attempts, accidental publication, and recovery effort.
- Repeat eligibility under the runbook's actual constraints. Count exact-input recurrence separately from future parameterized task families.
- Whether a promoted runbook remains correct when prerequisites change, and whether it blocks stale execution as intended.
- Continued weekly usage after the initial trial and a real willingness-to-pay decision from the budget owner.

## Gates and decisions

The existing strategy's 90-day targets remain hypotheses: 500 consented outcomes across partners, at least 70% accepted outcomes in selected bounded tasks, at least 30% median time improvement, and at least 20% of eligible repeats executed without inference. Also seek 3 of 5 weekly retained teams and 2 willingness-to-pay commitments. These numbers are not claimed as achieved.

If a deterministic baseline performs adequately, use it. If inference savings are tiny but human time savings are material, sell the workflow value rather than cheap tokens. If verifiers are costly to author or exact-input repeats are rare, revise the product thesis before building a paid control plane. If unsafe behavior appears, stop that automation and investigate it before expanding permissions.

## Publication

Publish only owner-approved, anonymized aggregates and fixtures with clear provenance and rights. Keep customer-specific source, prompts, credentials and proprietary failure details private. State limitations and negative results. A commercial moat can only be argued from durable corpus quality, useful integration depth and retained customer value; a synthetic fixture score cannot establish it.
