# Task and Action reference

Task files are strict JSON, version 1. Unknown top-level keys are rejected. The authoritative schema is [task.schema.json](../schema/task.schema.json). Put trusted task definitions under `.flock-tasks/`, which built-in file writes cannot modify.

## Task fields

- `name`, `prompt`: required task identity and trusted instructions. Never splice issue bodies, PR titles, or other untrusted text into the instruction prompt. Pass them through `inputs`.
- `inputs`: arbitrary JSON object, default `{}`. This is data, not instructions. CLI `--inputs file.json` and Action `inputs` replace it.
- `context`: explicit file paths to load before reasoning. They must also be authorized in `permissions.readPaths`. Prefer guarded `read_file` calls when planning to promote a run; context-based runs cannot currently be promoted.
- `permissions.write`: false by default. True is required to expose write capabilities and requires at least one verifier.
- `permissions.readPaths`, `writePaths`: exact relative filenames or directory prefixes ending in `/`. `.` grants the whole workspace except protected paths. Prefer narrow filenames. Symlinks, hard links, traversal, key files and common credential paths are rejected. `.github/`, `.flock/`, `.flock-tasks/` and `.git/` cannot be written by built-in file tools.
- `tools`: named command/HTTP capabilities. Names match `[a-zA-Z][a-zA-Z0-9_]{0,63}`. Each includes `description`, JSON `inputSchema`, and `effect` (`read` or `write`; defaults to write).
- `mcp`: explicit MCP connections and per-tool effects. At most 10 servers and 64 exposed tools in total. Remote schemas are validated locally too.
- `resultSchema`: JSON Schema enforced on `finish.result`. Format validation is not proof of factual correctness.
- `verifiers`: trusted file or command outcome checks. All must pass. Failed agent verification is returned as feedback for another bounded attempt. A failed runbook check fails immediately.

JSON Schema uses Ajv strict mode and the draft-07 vocabulary for tool/result/file schemas. Do not use external `$ref`s, custom formats, or arbitrary executable validation extensions. The generated task document itself uses Zod's generated schema dialect.

## Model configuration

```json
{
  "model": {
    "provider": "openai-compatible",
    "name": "your-tool-capable-model",
    "baseUrl": "https://gateway.example/v1",
    "apiKeyEnv": "MODEL_GATEWAY_KEY",
    "inputUsdPerMillion": 1,
    "outputUsdPerMillion": 5
  }
}
```

Providers: `openai` (Chat Completions), `anthropic` (Messages), `openai-compatible` (Chat Completions). The default is OpenAI `gpt-5-mini`. Default credentials are `OPENAI_API_KEY` and `ANTHROPIC_API_KEY`; use `apiKeyEnv` to override. HTTPS is required. `allowInsecureLocalhost: true` permits HTTP only at localhost, 127.0.0.1 or ::1; compatible local endpoints can be keyless.

Supply both price fields for any model other than the built-in OpenAI mini snapshot/alias on the standard endpoint. Gateways must support tools, `tool_choice: required`, non-streaming responses and usage counters. The compatible adapter uses `max_tokens`; OpenAI uses `max_completion_tokens`. Unsupported gateway dialects fail instead of silently falling back. No native Bedrock SigV4, Vertex service-account, Azure custom-header authentication, or interactive OAuth flow is bundled.

## Default budgets

8 model turns, 24 capability calls, 100,000 cumulative input tokens, 16,000 cumulative output tokens, 2,048 output tokens per turn, $1 estimated inference, 300 seconds wall time. Configure them in `budget` using `maxTurns`, `maxToolCalls`, `maxInputTokens`, `maxOutputTokens`, `maxOutputTokensPerTurn`, `maxCostUsd`, `maxDurationSeconds`.

Before a model request, Flock reserves a conservative input byte estimate plus protocol overhead and maximum output cost. Afterward it checks provider usage before executing any requested tools. Estimates can differ from billed tokens, caching/reasoning charges or changed vendor pricing. Network failures may occur after a billable request. Flock never retries inference automatically. Use provider-side project limits for financial enforcement.

Files and command output are limited to 128 KiB; HTTP/tool results to 256 KiB; model responses to 1 MB. Model requests time out after at most 90 seconds; command timeouts default to 30 seconds; MCP requests are bounded too. Limits are deliberate to keep context, memory and costs bounded.

## Command tool

```json
{
  "inspect_build": {
    "type": "command", "description": "Inspect the latest build using a trusted adapter.",
    "effect": "read", "command": "node", "args": ["automation/inspect-build.mjs"],
    "env": ["BUILD_API_TOKEN"], "timeoutSeconds": 30,
    "inputSchema": {
      "type": "object", "properties": { "build": { "type": "integer", "minimum": 1 } },
      "required": ["build"], "additionalProperties": false
    }
  }
}
```

Arguments supplied by the model arrive as JSON on stdin. The executable and argv are fixed by the trusted task, never generated by the model. The process gets PATH, Windows system paths, temporary-directory variables and explicitly listed environment keys. HOME, provider credentials, and GitHub tokens are not inherited by default. A command can still read files or use the network as the runner user; its declared effect is an author assertion, not sandbox enforcement.

## Verifiers

A file verifier can require existence, `contains`, and/or a JSON Schema. A command verifier receives `{result, inputs}` as JSON on stdin and passes only on exit code 0. It is not exposed as a model tool. Protect verifier code and dependencies from agent writes and from untrusted checkouts. For deployment/security checks, run authoritative verification in a separate job with trusted code.

## Action interface

Inputs: `prompt`, `task-file`, `inputs`, `api-key`, `provider`, `model`, `max-cost-usd`, `mode`, `runbook`. Only `mode` has an Action-level default (`agent`); other overrides preserve task-file values. `mode` accepts `agent`, `runbook`, `dry-run`. Runbook mode requires `runbook`; other modes reject it. Without `task-file`, a prompt is required and no tools are granted.

Outputs: `status`, `verified`, `result`, `receipt-path`, `estimated-cost-usd`, `model-calls`. Failed execution sets the Action failure status and still emits a receipt when the engine started. Configuration failures before the engine starts fail the step without a receipt. Receipt paths live in a private temporary directory and can be uploaded in a subsequent `if: always()` step.

`verified` means the configured checks passed, not that the model's reasoning is globally correct. `unverified` is a successful report with no independent checks. `dry-run` validates the contract without tools, credentials or inference. It does not validate live service reachability or credentials.

## CLI

Requires Node 24 or newer; release validation targets Node 24. `node dist/cli.js --help` lists commands. `--cwd` selects the workspace. `--receipt` chooses a new receipt file; existing files are never overwritten. `promote` accepts only a verified, unredacted, checksum-consistent agent receipt for the exact task and inputs and writes `reviewed:false`. Review steps for idempotency before changing it to true in a PR.

Runbook prerequisite reads must have `expectDigest` and precede all writes. All capabilities and schemas are checked before the first tool executes. A changed observation fails, with no automatic AI fallback. Runbooks repeat side effects; they are not a distributed exactly-once system. Use Actions concurrency and external idempotency keys where needed.
