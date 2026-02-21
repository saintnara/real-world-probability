# Real World Probability — Plan v1

## Goal
Build a probability engine for Polymarket that finds positive-expected-value opportunities and suggests a side (YES/NO) with confidence + risk sizing.

## Important principle
No model is always right. We optimize for long-term expected value, strict risk controls, and survival with small capital.

## What we can do on Polymarket (besides simple betting)
1. Provide liquidity and trade around spread/mispricing.
2. Trade in/out before resolution (not only hold to settlement).
3. Build watchlists for event categories (crypto, macro, politics, sports, etc).
4. Do cross-market consistency checks (related markets should imply coherent probabilities).
5. Potentially create markets/conditions (platform- and policy-dependent) with clear rules, resolution source, and unambiguous wording.

## Engine architecture (v1)
- Data Ingestion
  - Polymarket market + price feed
  - Optional external signals: news/events/calendar
- Feature Layer
  - Implied probability, momentum, spread, volume, liquidity depth
  - Time-to-resolution, volatility, event uncertainty score
- Modeling Layer
  - Baseline calibration model
  - Mispricing detector vs fair-probability estimate
- Decision Layer
  - Entry/exit rules
  - Position sizing (fractional Kelly cap)
  - Max drawdown guardrails
- Monitoring
  - Telegram/Slack alerts
  - Trade journal + post-mortem

## Risk guardrails (must-have)
- Max risk per trade: 0.5%–1.5% of bankroll
- Daily max loss stop
- Weekly max drawdown stop
- No all-in trades
- Confidence threshold before action

## Milestones
M1: Data pipeline + market scanner
M2: Simple probability baseline + signal scoring
M3: Paper-trading mode + performance dashboard
M4: Small-cap live mode with strict risk limits

## Success metrics
- Calibration quality (Brier score / log loss)
- Hit rate vs breakeven threshold
- Sharpe-like return/risk on paper trading
- Max drawdown discipline
