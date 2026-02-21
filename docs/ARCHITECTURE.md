# Real World Probability — Web-Based Multi-Agent Trading Pipeline (v1)

## Objective
Build a web system where specialized AI agents:
1. gather market/news information,
2. estimate probability + signal quality,
3. reject weak trades,
4. generate a full executive summary PDF for strong trades,
5. execute position (human-approved in v1),
6. review post-resolution and learn from outcome.

---

## Core Pipeline

1. **Market Scanner Agent**
   - Scans Polymarket markets for potential mispriced odds.
   - Flags candidates with metadata (liquidity, spread, volume, time-to-resolution).

2. **Research Agent**
   - Collects supporting/contradicting evidence from trusted web sources.
   - Produces structured evidence list with confidence and recency.

3. **Probability & Signal Agent**
   - Computes fair probability estimate + uncertainty.
   - Generates signal score (0–100) from model + evidence quality.

4. **Risk Manager Agent**
   - Decides position size using bankroll constraints and max loss limits.
   - Blocks/downsizes positions violating risk-to-reward rules.

5. **Decision Gate**
   - If signal score < threshold: reject and log reason.
   - If signal score >= threshold: continue to executive summary + trade ticket.

6. **Executive Summary Agent**
   - Creates pre-trade report (Markdown + PDF):
     - Market and thesis
     - Evidence for/against
     - Probability estimate
     - Risk sizing rationale
     - Entry/exit criteria
     - Invalidating conditions

7. **Execution Agent**
   - v1: proposes trade + waits for approval.
   - v2: controlled auto-execution within strict guardrails.

8. **Post-Trade Review Agent**
   - After market resolution, records P/L and decision quality.
   - Gathers ex-post explanation: why position succeeded/failed.
   - Updates strategy memory for future decisions.

---

## Web App Modules

- **Dashboard**
  - Wallet balance, exposure, open positions, realized P/L.
- **Opportunity Queue**
  - Candidate markets with signal status and gate result.
- **Position Detail Page**
  - Full decision log + executive summary PDF download.
- **Review Lab**
  - Closed positions and post-mortem analysis.
- **Risk Console**
  - Configurable caps (per trade/day/week), Kelly fraction cap, drawdown stop.

---

## Folder & Data Policy

Single root folder for learning continuity:

```text
real-world-probability/
  data/
    positions/
      YYYY/
        <position-id>/
          01_pretrade.json
          02_exec_summary.md
          03_exec_summary.pdf
          04_execution.json
          05_outcome.json
          06_postmortem.md
          07_postmortem_sources.json
```

Every position keeps full lifecycle artifacts for training and auditing.

---

## Wallet & Capital Safety

- Separate dedicated wallet for this system.
- Hard limits:
  - max risk per position (default 1%)
  - daily loss cap
  - weekly drawdown cap
  - max concurrent exposure
- Risk Manager has veto authority over Execution Agent.
- No martingale, no doubling after losses.

---

## Behavior Emulation Framework

We can test decision styles inspired by top forecasters/traders:
- calibration-first (probabilistic rigor)
- asymmetric payoff hunter
- event-driven contrarian
- conservative bankroll defender

Each style runs in paper mode first; best risk-adjusted profile becomes production default.

---

## v1 Build Plan

1. Web app scaffold + position data schema
2. Scanner + research + scoring pipeline (paper-only)
3. Executive summary generator (Markdown → PDF)
4. Risk gate + manual execution ticketing
5. Post-mortem automation and strategy memory updates
