# RCM Terminal — Trade Setup Page Design Plan
**Status:** Pre-build · Pending taxonomy sign-off
**Page:** trade-setup/index.html (enhancement of existing page)
**Last updated:** 2026-06-06

---

## Corrected Architecture

```
TRADE SETUP PAGE — Decision point. Everything happens here.
  • NLP parser → parse Otter/spoken text → pre-fill form
  • Taxonomy tagging → label the trade at inception
  • Position sizer → calculate lot/share/contract size from risk params
  • MT4 bridge → send to execution
  • Output: structured trade record (tagged, sized, filed)

JOURNAL PAGE — Review only. Reads from structured trade records.
  • No tagging, no NLP
  • Pulls IB history + local trade records
  • Performance analysis, pattern recognition, improvement loop
```

The taxonomy must live at **entry time** — when the PM is thinking about the trade,
not after the fact when memory fades and ego edits the narrative.

---

## Module 1: NLP Parser (Otter → Trade Setup)

### Purpose

PM speaks during pre-trade analysis or as they size the position.
The system extracts all trade parameters and tags, pre-fills the form.
PM reviews and clicks confirm. One voice note → complete structured trade record.

### Input Sources

1. **Otter import** — via Otter MCP, fetch transcript from most recent recording
   containing trigger phrase (e.g. `"trade setup:"` or `"position:"`)
2. **Paste field** — PM pastes text from anywhere (Otter, Notes, email to self)
3. **Typed notes** — free text in the notes field; NLP runs on blur/submit

### Trigger Phrase Convention (to decide)

Recommend: `"Trade setup:"` as spoken prefix in Otter recordings.
PM speaks: *"Trade setup: long EURUSD, entry 1.0850, stop 1.0800, target 1.0950,
risk $300, high conviction, NFP catalyst, risk-on backdrop"*

This mirrors the `"RCM note:"` convention already used for PM Desk.

### What NLP Extracts

**Trade Parameters (Job 1 — quantitative)**
```
symbol       → "EURUSD"
direction    → "long" | "short"
entry        → 1.0850  (price)
stop_loss    → 1.0800
take_profit  → 1.0950
risk_usd     → 300  (or derive from conviction + account size)
```

**Trade Tags (Job 2 — qualitative)**
```
setup_type   → news | trend | reversal | breakout | range | flow
conviction   → 1 | 2 | 3
regime       → risk-on | risk-off | trending | choppy
notes        → cleaned free-text summary
```

### NLP Implementation: Hybrid Engine

**Layer 1 — Regex rules (browser, instant, no API)**

```javascript
// In shared/rcm-utils.js → RCM.journalNLP(text)

const NLP_RULES = {
  symbol: [
    { pattern: /\b(EUR\/USD|EURUSD)\b/i,       value: 'EURUSD' },
    { pattern: /\b(GBP\/USD|GBPUSD)\b/i,       value: 'GBPUSD' },
    { pattern: /\b(USD\/JPY|USDJPY)\b/i,       value: 'USDJPY' },
    { pattern: /\b(XAU\/USD|XAUUSD|gold)\b/i,  value: 'XAUUSD' },
    { pattern: /\b(SPY|ES|NQ|SPX)\b/i,         value: (m) => m[0].toUpperCase() },
    // Generic 6-char FX pair
    { pattern: /\b([A-Z]{6})\b/, value: (m) => m[1] },
  ],
  direction: [
    { pattern: /\b(long|buy|buying|bought)\b/i,   value: 'long' },
    { pattern: /\b(short|sell|selling|sold)\b/i,  value: 'short' },
  ],
  entry: [
    { pattern: /(?:entry|entering?|at price)\s+(?:around\s+)?(\d+\.?\d*)/i },
    { pattern: /(?:buy|sell)\s+at\s+(\d+\.?\d*)/i },
  ],
  stop_loss: [
    { pattern: /stop(?:\s+loss)?\s+(?:at\s+)?(\d+\.?\d*)/i },
    { pattern: /sl\s+(\d+\.?\d*)/i },
  ],
  take_profit: [
    { pattern: /(?:target|take profit|tp)\s+(?:at\s+)?(\d+\.?\d*)/i },
    { pattern: /target(?:ing)?\s+(\d+\.?\d*)/i },
  ],
  risk_usd: [
    { pattern: /risk(?:ing)?\s+\$?(\d+)/i },
    { pattern: /\$(\d+)\s+risk/i },
  ],
  setup_type: [
    { pattern: /\b(nfp|cpi|fomc|gdp|central bank|earnings|data|news|catalyst|event)\b/i, value: 'news' },
    { pattern: /\b(trend|momentum|following|with the trend)\b/i,                          value: 'trend' },
    { pattern: /\b(reversal|fade|counter.trend|mean.revert|extreme)\b/i,                  value: 'reversal' },
    { pattern: /\b(breakout|break(?:ing)? (?:above|below|out))\b/i,                       value: 'breakout' },
    { pattern: /\b(range|support|resistance|fading the (high|low))\b/i,                   value: 'range' },
    { pattern: /\b(cot|positioning|flows?|fund flow|options flow)\b/i,                    value: 'flow' },
  ],
  conviction: [
    { pattern: /\b(high conviction|very confident|strong view|max size|full size)\b/i,    value: 3 },
    { pattern: /\b(probe|testing|small|starter|toe in)\b/i,                               value: 1 },
  ],
  regime: [
    { pattern: /\b(risk.on|risk appetite|positive sentiment|buy everything)\b/i,          value: 'risk-on' },
    { pattern: /\b(risk.off|defensive|flight to quality|safe haven)\b/i,                  value: 'risk-off' },
    { pattern: /\b(choppy|ranging|no signal|sideways|messy)\b/i,                          value: 'choppy' },
  ],
};
```

**Layer 2 — Claude Haiku (Cowork, augments regex)**

```javascript
// Runs after regex, fills gaps + resolves ambiguous extractions
const prompt = `Extract trade setup fields from this text.
Return JSON only. Fields: symbol, direction (long|short),
entry (number), stop_loss (number), take_profit (number),
risk_usd (number), setup_type (news|trend|reversal|breakout|range|flow),
conviction (1|2|3), regime (risk-on|risk-off|trending|choppy), notes (string).
Return null for any field not determinable.
TEXT: "${inputText}"`;

const result = await window.cowork.askClaude(prompt, []);
```

**Merge strategy:** Regex output wins on high-confidence numeric fields (prices, $).
Claude wins on semantic fields (setup_type, regime). User can override both.

---

## Module 2: Trade Taxonomy

### Design Principle

Tags are set at **entry time, in the Trade Setup flow**, not retrospectively.
If it's too hard to tag at entry, the taxonomy is too complex.

### Setup Type (required — one per trade)

| ID | Label | Plain language trigger |
|----|-------|----------------------|
| `news` | News / Event | Catalyst, data release, central bank, earnings |
| `trend` | Trend Follow | Going with the move, momentum |
| `reversal` | Reversal | Counter-trend, fade at extremes |
| `breakout` | Breakout | Clearing structure, range boundary |
| `range` | Range Trade | Fade high/low within defined range |
| `flow` | Flow / Positioning | COT signal, options flow, positioning extreme |

**6 types** — enough granularity for meaningful pattern analysis, not so many that
the PM agonises over classification. `corr` is dropped from the earlier draft (captured
by setup notes instead). `retest` subsumed into `breakout`.

### Conviction (required — 1/2/3 only)

Visual: three dots — filled = committed, empty = available
```
●●● = 3  High conviction. Max size.
●●○ = 2  Conviction. Standard size.
●○○ = 1  Probe. Smallest size, testing.
```

**Conviction also drives the position sizer** (see Module 3).

### Regime (optional at entry — auto from TIDE if connected)

`risk-on` | `risk-off` | `trending` | `choppy`

If TIDE radar artifact is live and has a current regime reading, pre-populate.
Otherwise manual selection or leave blank.

### Where Tags Are Stored

Tags travel with the trade instruction:
1. Appended to `pending_trade.json` (MT4 bridge)
2. Stored in `localStorage` keyed by IB trade ID (for journal retrieval)
3. Optionally: appended to `rcm-command-intent` artifact as a filed idea

```json
{
  "symbol": "EURUSD",
  "direction": "long",
  "entry": 1.0850,
  "stop_loss": 1.0800,
  "take_profit": 1.0950,
  "lot_size": 0.60,
  "risk_usd": 300,
  "rr_ratio": 2.0,
  "setup_type": "news",
  "conviction": 3,
  "regime": "risk-on",
  "notes": "NFP miss, USD weakness expected, trend confirms",
  "timestamp": "2026-06-06T08:30:00+08:00",
  "status": "PENDING"
}
```

---

## Module 3: Position Sizer

### Purpose

Given risk amount + entry/stop → calculate exact position size per instrument type.
The sizer must handle different pip/tick/contract conventions across the asset universe.

### Input Fields

```
Account size ($)        [from IB MCP auto-populate or manual]
Risk per trade (%)      [default: 1% — stored in localStorage]
  OR
Risk amount ($)         [overrides % if specified]
Instrument type         [FX | CFD | Futures | Equity | Options]
Symbol                  [auto from NLP or manual]
Entry price             [auto from NLP or manual]
Stop loss price         [auto from NLP or manual]
```

### Calculation Engine by Instrument

**FX (Spot / Axi)**
```
Stop pips = |entry - stop| × pip_multiplier
  where pip_multiplier: JPY pairs = 100, all others = 10000

Pip value per lot:
  If quote currency = USD:  $10 per pip per lot (standard)
  If base currency = USD:   $10 / exchange_rate per pip per lot
  Cross pairs:              approximate via USD conversion

Lot size = Risk($) / (Stop pips × pip_value_per_lot)
Result rounded to 2dp (0.01 lot minimum)
```

**Futures (IB)**
```
Tick value table (hardcoded, updatable):
  ES   → $12.50 / tick, 0.25 tick size
  NQ   → $5.00  / tick, 0.25 tick size
  CL   → $10.00 / tick, 0.01 tick size
  GC   → $10.00 / tick, 0.10 tick size
  ZN   → $15.625 / tick
  (user can override tick value)

Stop ticks = round(|entry - stop| / tick_size)
Contracts  = floor(Risk($) / (Stop ticks × tick_value))
Min: 1 contract
```

**Equities / ETFs (IB)**
```
Share risk = Entry - Stop (long) | Stop - Entry (short)
Shares = floor(Risk($) / Share risk)
Position value = Shares × Entry (show for margin awareness)
```

**CFD (Axi)**
```
Point value per lot = contract_size × point_value
  (user inputs or pulled from Axi reference)
Stop points = |entry - stop|
Lot size = Risk($) / (Stop points × point_value_per_lot)
```

### Output Display

```
┌─────────────────────────────────────────────┐
│ POSITION SIZER                              │
│ Risk: $300  (1.0% of $30,000)               │
├─────────────┬───────────────────────────────┤
│ Entry       │ 1.08500                       │
│ Stop        │ 1.08000  (50 pips)            │
│ Target      │ 1.09500  (100 pips)  RR: 2.0 │
├─────────────┴───────────────────────────────┤
│ ► LOT SIZE:  0.60 lots                      │
│   Pip value: $10.00/lot                     │
│   Margin req: ~$645  (est.)                 │
└─────────────────────────────────────────────┘
```

RR ratio auto-calculates and highlights: green (≥2), amber (1–2), red (<1).

### Conviction Multiplier (optional setting)

If enabled, conviction level scales the sizer output:
```
Conviction 3 (High) → 100% of calculated size
Conviction 2        →  67% of calculated size
Conviction 1 (Probe)→  33% of calculated size
```

This makes conviction a position-sizing input, not just a label.
Toggle on/off in settings. Default: off (manual control preferred by most PMs).

---

## Updated Trade Setup Page Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  RAPID TERMINAL                              [🎙 Parse Otter]    │
│  TRADE SETUP                                                      │
├──────────────────────────────────────────────────────────────────┤
│  [NLP PARSE BAR]                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Paste or type your trade idea…              [Parse ▶]   │   │
│  └──────────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────┤
│  INSTRUMENT                                                        │
│  [FX ▾] [EURUSD    ] [LONG ▾]                                   │
│                                                                    │
│  ENTRY  [1.08500]  STOP [1.08000]  TARGET [1.09500]             │
│                                                                    │
│  ┌────────────────────── POSITION SIZER ─────────────────────┐   │
│  │ Risk: [$300] = [1.0]% of account                          │   │
│  │ ► 0.60 lots  |  50 pips stop  |  RR 2.0  |  Margin ~$645 │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  SETUP TYPE                                                        │
│  [NEWS] [TREND] [REVERSAL] [BREAKOUT] [RANGE] [FLOW]            │
│   ●                                                               │
│                                                                    │
│  CONVICTION  [●●●]     REGIME  [RISK-ON ▾]                      │
│                                                                    │
│  NOTES                                                             │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ NFP miss drove USD lower; trend confirms…                  │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  [+ Stage in IB]    [▶ Send to MT4]    [📋 Save Only]           │
└──────────────────────────────────────────────────────────────────┘
```

---

## Build Sequence (Trade Setup Page)

```
Step 1 — NLP Parse Bar
  Add text input + Parse button above existing form
  Implement regex NLP layer (RCM.tradeNLP)
  Wire pre-fill to existing form fields

Step 2 — Taxonomy Tags
  Add setup_type button group (6 chips, one active at a time)
  Add conviction dot picker (3 dots, click to set)
  Add regime dropdown (optional)
  Save tags to trade JSON output

Step 3 — Position Sizer
  Add sizer section between entry/stop/target and tags
  FX calculation first (primary instrument type)
  Futures + equity calcs in subsequent pass
  Wire account size from IB MCP (auto-populate if Cowork)

Step 4 — Otter Integration
  "Parse Otter" button → search recent recordings for "trade setup:"
  Fetch transcript → run NLP → pre-fill all fields
  User reviews → confirm

Step 5 — Claude NLP augmentation
  Add askClaude pass for semantic fields when in Cowork
  Merge with regex output
```

---

## Open Questions — Trade Setup

1. **Conviction multiplier on/off?** — Should conviction automatically scale lot size,
   or is it purely a label? Recommend: off by default, toggle in settings.

2. **Otter trigger phrase** — `"Trade setup:"` or keep as `"RCM note:"` family?
   Suggest a distinct phrase to avoid mixing with PM Desk imports.

3. **Account size source** — Always manual input, or auto from IB `get_account_summary`?
   IB call adds latency; could cache the last known value with a refresh button.

4. **MT4 bridge — JSON path** — Where does `pending_trade.json` live on disk?
   Needs to be a fixed path accessible to both HFOS and the MT4 EA installation.

5. **Multi-instrument sizer** — Build FX first, then futures/equity? Or build all three
   instrument types in one pass since the schema is already defined?
