# Examples

## No-key runbook

`runbook/task.json` and `runbook/runbook.json` create an exact release manifest and validate its JSON. Run `npm run demo`. It is intentionally predictable work, so the workflow uses no model. The CI distribution job exercises the same bundled Action and asserts zero model calls.

## Issue triage

`triage/task.json` gives the model a constrained label set and asks it to justify a classification. It has no tools and returns `unverified`: schema validity cannot establish that an issue was classified correctly. Copy the [workflow](triage/workflow.yml) after adding a provider secret. It produces a receipt for review; it does not modify the issue.

## CI diagnosis

`ci-diagnosis/task.json` reads a bounded log and package metadata to produce ranked evidence and a next step. It does not execute commands from the log. Collect and truncate logs deterministically before calling it. This is a report, so a maintainer must evaluate its accuracy.

## Documentation maintenance

`docs-maintenance/task.json` permits a single generated document, with an independent verifier checking links against supplied change IDs. It demonstrates a meaningful but limited mechanical check; human editorial review remains appropriate before publication.

## Approved mutation after reasoning

Use a read-only Flock job to produce a schema-constrained result. Pass the result as a job output/artifact to a separate environment-gated job. A trusted script validates the schema and exact allowed resource IDs again, then invokes a fixed API or existing action. Never paste model output into `run:`. Use `env` or JSON files and parse them.

## New task design

Choose a genuinely ambiguous decision. Collect only the relevant data. Define one or two narrow tools. Define observable success independently. Add a low budget. Start read-only or with local artifact writes. Measure maintainer acceptance before automating publication. Promote only stable repeatable procedures; a new issue body should trigger a new decision, not a stale runbook.
