# Validation record

Release target: 0.1.0. Update this file with evidence, not intent.

## Verified locally

- TypeScript strict checking and bundled Action/CLI generation pass.
- 54 deterministic tests pass, including engine outcomes and repair, budget denial, filesystem traversal and links, replay guards/promotion, provider protocol parsing, command environment/timeout/output limits, HTTP redirect rejection, and a real stdio MCP fixture.
- The same suite passes on Node 24.21.0, the supported release runtime.
- The bundled CLI executes the reviewed manifest runbook and independently verifies its result with zero model calls and no API key.
- npm dependency audit reports no known vulnerabilities at initial installation. This is a point-in-time advisory check, not a security audit.

## Release gates still to record

- Public GitHub repository and release URL.
- Linux/macOS/Windows CI results and packaged Action execution on a real GitHub runner.
- Live OpenAI, Anthropic and compatible-provider acceptance. No inference key is present in the authoring environment. Mock protocol tests and local MCP tests do not establish live provider quality.
- Real service integration acceptance under customer-owned least-privilege credentials.
- Independent security review, design-partner outcomes, repeated-run savings, willingness-to-pay, and retention. None has been claimed or manufactured.
