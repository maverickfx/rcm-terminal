# RCM Terminal — Trade Journal Design Plan
**Status:** Pre-build · Dependent on Trade Setup taxonomy sign-off
**Page:** journal/index.html
**Last updated:** 2026-06-06

---

## Role Clarification

The journal is a **read-only analysis layer**. It does not tag, classify, or parse.
All of that happens at entry time in the Trade Setup page.

The journal's job:
1. Pull closed trade history from IB MCP
2. Merge with tags stored at entry (from Trade Setup)
3. Surface patterns — what's working, what's not
4. Help improve future decision-making

No NLP in the journal. No taxonomy decisions here. Those are committed at Trade Setup.

---

## Data Sources

```
IB MCP → get_account_trades
  Provides: symbol, direction, entry price, exit price, PnL, size, timestamps

localStorage → trade records (keyed by IB trade ID)
  Provides: setup_type, conviction, regime, notes
  Written at entry time by Trade Setup page

Merged record:
  Complete trade: quantitative (IB) + qualitative (Trade Setup tags)
```

If no tag record exists for a trade (e.g. trade was entered directly in IB without
using the Trade Setup page), the journal shows the quantitative data only and marks
the trade as "untagged".

---

## Analysis Views

### View 1 — Trade Log (default)

Chronological table of all closed trades, most recent first.

| Date | Symbol | Dir | Entry | Exit | PnL | Size | Setup | Conv | Outcome |
|------|--------|-----|-------|------|-----|------|-------|------|---------|
| 06-06 | EURUSD | L | 1.0850 | 1.0911 | +$366 | 0.6L | news | ●●● | — |
| 06-05 | USDJPY | S | 157.20 | 156.80 | +$250 | 0.5L | trend | ●●○ | — |

Filters: Date range / Asset class / Setup type / Conviction / Win/Loss

---

### View 2 — Performance Dashboard

**KPI cards (top row)**
```
Win Rate     Profit Factor    Avg Win      Avg Loss     Expectancy
  58%            1.8          +$420         -$230         +$97/trade
```

**Breakdown tables**

By Setup Type:
| Setup | Trades | Win% | Avg PnL | Avg RR | Notes |
|-------|--------|------|---------|--------|-------|
| news | 12 | 67% | +$340 | 2.1 | Best performer |
| trend | 8 | 50% | +$180 | 1.4 | Underperforming |
| reversal | 5 | 40% | -$60 | 0.9 | Review or cut |

By Conviction Level:
| Conv | Trades | Win% | Avg PnL | Avg Size |
|------|--------|------|---------|---------|
| 3 | 8 | 75% | +$520 | 0.8L |
| 2 | 14 | 57% | +$210 | 0.5L |
| 1 | 6 | 33% | -$80 | 0.2L |

By Regime:
| Regime | Win% | Avg PnL | Comment |
|--------|------|---------|---------|
| risk-on | 65% | +$320 | Trade more |
| risk-off | 55% | +$140 | Selective |
| choppy | 30% | -$150 | Reduce size or stay out |

---

### View 3 — Equity Curve

LightweightCharts line series — daily cumulative closed PnL.
Drawdown shading below high-water mark.
Toggle: show by conviction level (3 separate lines).

---

### View 4 — Improvement Notes (future)

Auto-generated observations based on the data:

```
● Your news trades have 2.1 avg RR vs 1.3 for trend — consider upweighting news setups
● Conviction 1 trades are net negative (-$80 avg). Consider: skip probes or tighten stops.
● You underperform in choppy regimes (-$150 avg). TIDE regime flag could help filter these.
● 6 trades have no tags (entered directly in IB). Tag at entry for complete analysis.
```

This view is aspirational for a later build pass. It requires sufficient trade volume
(50+ tagged trades) to be meaningful.

---

## What the Journal Does NOT Do

- ❌ Tag trades after the fact (that's Trade Setup's job, done at entry)
- ❌ Run NLP on transcripts (Trade Setup handles this)
- ❌ Replace a proper risk management system
- ❌ Make decisions — it informs them

---

## Build Sequence (Journal Page)

```
Step 1 — Trade Log table
  Pull get_account_trades from IB
  Merge with localStorage trade tags
  Render sortable/filterable table
  Flag untagged trades

Step 2 — KPI cards
  Win rate, profit factor, avg win/loss, expectancy
  Recalculate on filter change

Step 3 — Breakdown tables
  By setup type, conviction, regime
  Highlight best/worst performing categories

Step 4 — Equity curve
  Daily cumulative PnL, LightweightCharts line
  Drawdown shading

Step 5 — CSV export
  Full trade log with all fields
  For external analysis (Excel, etc.)
```

---

## Dependency

**The journal is only as good as the tags from Trade Setup.**
Build and validate the Trade Setup taxonomy + NLP first.
See: `docs/TRADE_SETUP_DESIGN.md`
