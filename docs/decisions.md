# Decisions

These notes are the repository copy of design decisions. The Flock graph MCP is not exposed in the build session, so graph lookup and synchronization are pending; these notes do not claim to replace the shared graph.

## Outcome contracts, then runbooks

Scope: `src/engine.ts`, `src/runbook.ts`, `src/config.ts`, `docs/strategy.md`.

GitHub Agentic Workflows already offers multi-engine automation, safe outputs, and cost controls. Another CLI wrapper is insufficient. Flock separates reasoning from execution, checks outcomes independently, and exports reviewed deterministic runbooks. Promotion is explicit; it never silently replays a previous decision against changed inputs. Reject automatic "learning" from a single successful trace: success does not prove generality.

## Tools are capabilities, not a shell prompt

Scope: `src/tools.ts`, `src/workspace.ts`, `SECURITY.md`.

The agent receives only workflow-declared tools. Commands use fixed executable/argv with JSON on stdin; HTTP origins/methods are author-controlled; MCP tools require an explicit allowlist. All tool arguments use JSON Schema validation. Commands and MCP servers remain trusted code, not an OS sandbox. Use ephemeral runners for untrusted work.

## Keep predictable work free of inference

Scope: `src/engine.ts`, `src/runbook.ts`, `examples/`.

Native Actions `if`, paths, concurrency, reusable workflows, environment approval, and standard build/test/deploy actions stay in charge. Agent calls are reserved for ambiguity. Runbooks bypass model initialization and require no API key. Independent verifiers run after execution in either mode.

## Portable open core with bring-your-own inference

Scope: `LICENSE`, `src/providers.ts`, `docs/pricing.md`, `docs/integrations.md`.

Apache-2.0 follows Flock Labs' existing public project. Local execution, budgets, verifiers, runbooks, and integrations stay free. A future paid control plane would sell organization governance, fleet insight, retention and support, not an inference markup or safety paywall. Proposed pricing is a hypothesis, not a currently purchasable service.

## Fail closed on missing evidence

Scope: `src/engine.ts`, `src/providers.ts`, `src/receipt.ts`.

Model prose is never proof of task success. Receipts distinguish independently verified outcomes from unverified reports, failures, and dry runs. Missing token accounting, limits, schema violations and tool failures cannot be silently treated as success. USD values are estimates from configured prices, not provider-enforced invoice caps.
