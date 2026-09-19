# Pricing and unit economics

## What costs money today

Flock Actions is free under Apache-2.0. There is no paid Flock plan, hosted service, billing account or inference markup. Users supply model credentials and their own runner. Their provider, GitHub/runner and external tools charge under existing accounts.

Built-in reference prices for OpenAI `gpt-5-mini`: $0.25 per million input tokens and $2.00 per million output tokens, verified on 20 September 2026. Cached-input discounts are not assumed. The price is explicit in the engine and overrideable; other models require both prices in the task. Source: [official model pricing](https://developers.openai.com/api/docs/models/gpt-5-mini).

The engine estimates cost as `(input_tokens × input_price + output_tokens × output_price) / 1,000,000`. It sums provider-reported usage across calls and checks a conservative byte reservation before the next call. This is not exact vendor tokenization or an enforceable bill cap. Runner time, tool charges, storage, gateway markups and taxes are excluded. Incomplete/failed responses may still incur charges. Set provider/gateway spend limits too.

## Illustrative workload economics

These are arithmetic examples, **not measured model-quality or latency benchmarks**:

- Triage: 4,000 input + 600 output tokens → $0.0022 inference per run at reference prices.
- Diagnosis: 20,000 cumulative input + 3,000 output → $0.011 per run.
- Bounded remediation: 80,000 cumulative input + 10,000 output → $0.04 per run.
- Reviewed deterministic replay: zero model calls → $0 inference, while runner and external operations still cost money.

At 10,000 diagnostic runs/month, the example inference cost is $110. If 40% are legitimately eligible and executed as runbooks, remaining inference is $66: $44 saved. This alone does **not** justify a $149 service. Avoided investigation time, consistency and governance must supply the rest of the value.

If 100 engineer-hours/month are spent on eligible incidents, a measured 30% reduction at an assumed $75/hour loaded cost would create $2,250/month of time value. Loaded cost and time reduction are buyer-specific hypotheses. Count accepted outcomes and actual time saved; do not sell theoretical tokens as business ROI.

Runner example: at an assumed $0.006/minute and two minutes per run, 10,000 runs consume $120 compute. This is a modeling input, not a quote for a particular GitHub runner. Substitute the organization's plan, platform, discounts and free allowances. Agent startup, checkout, model latency and retries all affect runtime.

## Proposed future plans — not yet available

**Community: $0.** Local Action/CLI, all core capabilities, verifiers, budgets, receipts and runbooks. Bring your own models and runners. Public documentation and community support. No seat limit imposed by the runner.

**Team hypothesis: $149/organization/month.** A managed control plane for up to 25 active repositories, 25,000 metadata receipts/month, shared policy packs, 30-day retention and team views. Unlimited viewers. BYO inference and execution. Hard opt-in caps on ingestion and retention, not surprise overages. Receipt export remains available. Validate price and limits with design partners.

**Scale hypothesis: $499/organization/month.** Up to 100 active repositories, 100,000 metadata receipts/month, longer retention, environment policy, allocation and priority support. Additional volume should be explicit and predictable, such as $5 per 10,000 metadata receipts after opt-in. Do not charge by token, seat, or model call when the product is meant to eliminate unnecessary inference.

**Enterprise hypothesis: from $18,000/year, negotiated.** SSO/SCIM, organizational isolation, signed evidence, private connectivity/deployment options, security review and support commitments. Price from deployment and support cost, not an invented certification claim. A minimum is a planning assumption until real quotations exist.

Paid control-plane capability is roadmap, not shipped. No purchase or subscription is being created by publishing this project.

## Cost to serve and margin sensitivity

Customer-paid inference and execution remove the most volatile costs from a BYO service. Cost to serve still includes storage, database writes/queries, authentication, monitoring, billing, support, incident response and security work.

At the $149 Team hypothesis:

- Low service scenario: $10 infrastructure + $10 support allocation = $20 cost → 86.6% gross margin.
- Base scenario: $15 infrastructure + $20 support allocation = $35 → 76.5% margin.
- High-support scenario: $25 infrastructure + $60 support allocation = $85 → 43.0% margin.

These are assumptions, not measured costs. Support dominates early-stage economics. At 25,000 receipts/month and 4 KB/receipt, raw monthly payload is about 100 MB before indices, replication and overhead; raw storage size alone does not estimate the bill. Enforce payload and retention limits and separate raw artifacts from metadata ingestion.

At $499 with assumed $100 cost to serve, gross profit is $399 (80%). At $149 with $35 cost, gross profit is $114. An illustrative $600 acquisition cost would take 5.3 months to recover at $114/month gross profit; $1,500 CAC would take 13.2 months. Exclude expansion revenue until observed. A crude gross-profit LTV at 3% monthly churn is $3,800; at 8% churn it falls to $1,425. This approximation is not a valuation and ignores discounting/cohort effects.

Revenue scenario: 100 Team organizations + 20 Scale organizations → $24,880 MRR / $298,560 ARR. At base cost assumptions, gross profit is $19,380/month before engineering, sales and corporate overhead. This is a planning scenario with no customers implied.

## Long-term monetization sequence

First establish free adoption and measurable accepted outcomes. Next sell organization governance and support under BYO execution. Then offer enterprise deployment and evidence requirements. Managed execution can be an optional later product with explicit compute pricing and isolated infrastructure; do not subsidize unlimited agent loops. A curated recipe marketplace is only credible after a maintained corpus and demand exist.

Commercial durability depends on retention and workflow embedding, not an inference resale margin. Kill paid features that customers can already satisfy through GitHub, their gateway or their observability stack unless Flock materially reduces operational work.
