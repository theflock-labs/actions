# Evaluate whether AI earns its place

Flock includes a versioned suite format, an evaluation runner, an offline scorer, and three small synthetic corpora. Use them to expose failure and measure incremental value against ordinary code. They do not establish product-market fit or best-in-market model performance.

## Included corpora and observed deterministic baselines

Run `npm run eval:baseline` with Node 24. No credentials, network services, or model calls are needed. The script generates observations and scores them through the bundled CLI.

- **Issue triage: 11 of 16 cases passed.** A simple keyword classifier misses underspecified reports, mixed vocabulary and some intent distinctions. Expected labels follow the rubric in `evals/triage/task.json`.
- **CI diagnosis: 11 of 12 cases passed.** A signature matcher identifies common failures cheaply; it mistakes an authentication keyword inside user-controlled fixture text for the actual assertion failure.
- **Release-note constraints: 8 of 8 cases passed.** A deterministic template satisfies the mechanical heading/citation checks. This result does not measure readability, factual entailment or resistance to copying malicious instructions; editorial review is still needed.

These counts were observed by running [the baseline](../evals/baseline.mjs) against [the authored fixtures](../evals/build-fixtures.mjs). They are regression examples deliberately including edge cases, not a representative or held-out production sample. Do not infer that these percentages predict real workloads. No live model or competitor quality result is claimed.

[Release CI](https://github.com/theflock-labs/actions/actions/runs/35475963792) reproduced these counts. The [v0.2.0 release assets](https://github.com/theflock-labs/actions/releases/tag/v0.2.0) retain its three reports, including suite fingerprints, per-case outcomes and explicit imported/self-reported provenance.

The lesson is narrower and useful: a model must demonstrate added value beyond a cheap baseline, and a weak acceptance check cannot prove a strong outcome. Do not aggregate the three scores into a purported general automation accuracy number.

## Run a live evaluation

After configuring the task's model credentials:

```sh
node dist/cli.js evaluate \
  --task evals/triage/task.json \
  --suite evals/triage/suite.json \
  --max-cost-usd 0.25 \
  --output .flock/triage-report.json
```

The default threshold is 1: any failed or missing case causes a nonzero exit. To collect a baseline without enforcing an accuracy target, use `--min-pass-rate 0`. Missing cases and incomplete accounting still produce a nonzero exit. A report is written even when model execution fails inside the engine.

Each case gets a new temporary workspace seeded only with its declared fixtures and trusted support files. It cannot accidentally inherit an artifact created by a previous case. Expected labels and expected output contents are never sent to the model. The ordinary task contract still defines tools, permissions and independent runtime verifiers.

An explicit suite budget is required. Each case receives at most the lesser of its normal task budget and the remaining suite allowance. Once a request has unknown billing, the suite stops; remaining cases are reported as not run. USD limits remain estimates and exclude compute, external tools, gateway markups and unknown charges. Per-case engine limits and `--max-duration-seconds` also apply. Never treat this as a provider-enforced invoice cap.

For the documentation suite, the trusted verifier runs a command, so explicitly enable such execution:

```sh
node dist/cli.js evaluate \
  --task evals/docs/task.json --suite evals/docs/suite.json \
  --max-cost-usd 0.25 --allow-external-tools \
  --save-receipts --output .flock/docs-evaluation/report.json
```

Command, HTTP, MCP and command-verifier execution is rejected by default during evaluation because repeated cases can repeat real operations. Enabling it does not sandbox those tools. Use disposable service resources, scoped credentials, idempotent operations and trusted code. Fixture files may be executed by a trusted command; do not accept arbitrary evaluation suites from untrusted contributors in a privileged job.

`--save-receipts` is opt-in. Reports normally contain checks, hashes, counts and timings, not raw inputs/results. Per-case receipts can contain source text in tool arguments; their privacy implications are the same as ordinary receipts. Put private data under `evals/private/` or outside the repository; both `evals/private/` and `.flock/` are ignored by Git.

The manual **Live task evaluation** workflow runs all three suites on the trusted main branch. Its default budget is $0.25 per suite, $0.75 across the matrix, excluding unknown/runner/tool charges. It collects quality results rather than asserting a perfect score. It is not triggered automatically on PRs. Do not dispatch it until `OPENAI_API_KEY` is configured.

## Suite format

The generated [suite schema](../schema/evaluation-suite.schema.json) provides editor assistance; runtime validation also enforces semantic rules such as unique IDs and nonempty expectations.

```json
{
  "version": 1,
  "name": "Small triage regression",
  "provenance": {
    "kind": "synthetic",
    "description": "Authored examples; not production accuracy evidence."
  },
  "cases": [{
    "id": "empty-export",
    "category": "bug",
    "inputs": { "title": "Export crashes on empty reports", "body": "Clicking export throws a TypeError." },
    "expect": {
      "resultSchema": {
        "type": "object", "properties": { "label": { "const": "bug" } },
        "required": ["label"]
      }
    }
  }]
}
```

`provenance.kind` is `synthetic`, `public`, or `consented`. The description must explain where the cases and labels came from. Use `source` for an attribution, consent record reference or dataset version; do not put sensitive credentials in it. A declaration is not independent proof of provenance.

Case `files` maps relative paths to UTF-8 fixture contents. `supportFiles` lists trusted files to copy from the invocation workspace, such as a verifier. A case cannot shadow support code, including through path aliases, and support code cannot be inside agent-writable paths. Expected file checks support `contains` (all listed fragments), `equals`, and `jsonSchema` for JSON documents. At least one independent result or file expectation is required per case.

Suites are limited to 500 cases and 10 MB on disk, with bounded individual file content. Local file policies also apply. Raw suite-file bytes are not the fingerprint: `suiteDigest` hashes the parsed, default-expanded suite. `caseDigest` hashes the parsed case's inputs and fixture files. Use the exported helpers to generate matching fingerprints.

## Compare another agent or an existing script

Run the same cases with the other system and write observations using the [results schema](../schema/evaluation-results.schema.json):

```json
{
  "version": 1,
  "suiteDigest": "<digest from validateSuite + digest>",
  "engine": "your-existing-automation/version",
  "method": "deterministic",
  "timingScope": "End-to-end run time, including tools but excluding setup.",
  "cases": [{
    "caseId": "empty-export",
    "caseDigest": "<caseDigest from the parsed case>",
    "status": "completed",
    "result": { "label": "bug" },
    "durationMs": 12,
    "modelCalls": 0,
    "estimatedCostUsd": 0,
    "accountingComplete": true
  }]
}
```

```sh
node dist/cli.js score --suite suite.json --results observations.json \
  --output .flock/other-system-report.json --min-pass-rate 0
```

Unknown or duplicate case IDs, changed case inputs, and a mismatched suite fingerprint are rejected. Missing observations remain visible as not-run cases. Provide captured artifacts in the observation's `files` map for file expectations. Use `null` for unknown cost or model calls and false for incomplete billing; missing evidence is not converted into a verified zero.

Imports are always marked **`imported-self-reported`**. Flock checks the supplied outputs; it cannot attest that another system actually produced them or validate its billing claim. Direct engine evaluations are marked `provider-execution`; evaluations using an injected test provider are marked `test-fixture`. The included deterministic baseline is scored through the same import path. These categories are never silently equated.

Match permissions, models, prompts, fixtures, timeouts, cost assumptions and timing scope before drawing a comparative conclusion. Retain upstream receipts and commit/model revisions for audit. An exact suite fingerprint establishes identical cases and expectations, not identical execution environments or a fair task specification by itself.

## What the metrics mean

- `passRate`: cases passing all declared expectations divided by **all suite cases**, including those not run.
- `passRateAmongExecuted`: conditional rate among attempted cases, reported separately so budget exhaustion cannot improve the headline denominator.
- `costPerPassedCaseUsd`: all known inference cost, including failed cases, divided by passed cases. It is null if no cases passed or any billing is incomplete.
- `p50DurationMs` and `p95DurationMs`: nearest-rank percentiles of attempted-case durations under the report's stated timing scope. Failed attempts are included; not-run cases have no fabricated duration.
- Category counts reveal concentrated failures. Raw model calls and known cost are reported separately from completeness flags.

Report checksums detect accidental modification, not forgery. A mechanically passed case is not automatically a human-accepted business outcome. For real product decisions, use independently labeled, permissioned data, held-out cases, repeated runs, adjudicated human reviews and measured time savings. See [the pilot protocol](pilot.md).
