# RCM Terminal — Development Roadmap & Task Tracker

**Project:** RCM Terminal (rcm-terminal)
**Owner:** Andrew Han — Rapid Capital Management
**Build Environment:** Claude Cowork (primary) | Replit (secondary)
**Repo:** HFOS/03_TRADE_OPERATIONS/GITHUB/rcm-terminal
**Deploy Target:** Cloudflare Pages + Cloudflare Access

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Complete |
| 🔄 | In Progress |
| 🔲 | Pending |
| ⛔ | Blocked |
| 🔁 | Recurring / Ongoing |

---

## PHASE 1 — Foundation (Complete)
*Target: Week 1 · Status: ✅ Done*

### Core Infrastructure
- [x] Define platform architecture (Pre-Market → Analysis → Decision → Execution → Feedback)
- [x] Resolve GitHub Pages private repo issue → **Solution: Cloudflare Pages + Access (free)**
- [x] Establish two-layer data model: IB MCP (Cowork) / FMP REST (universal)
- [x] Map all IB MCP tools (11 tools, server ID documented)
- [x] Map all FMP MCP tools
- [x] Design RCM brand token system for platform (navy/gold/risk/trade)

### Shared Modules
- [x] `shared/rcm-style.css` — Full brand stylesheet, all tokens, print CSS
- [x] `shared/rcm-utils.js` — Two-layer data utility, IB MCP + FMP fallback, formatters, header/footer

---

## PHASE 2 — Core Pages (In Progress)
*Target: Weeks 1–2 · Status: 🔄 Active*

### Platform Pages
- [x] `index.html` — Main dashboard: tool nav cards, account KPIs, market watch (10 symbols), positions table
- [x] `terminal/index.html` — Full charting terminal: LightCharts v4.2, TF selector, chart types, sync volume, IV overlay, watchlist, OHLC sidebar
- [x] `trade-setup/index.html` — Trade Setup Generator: 6 instrument schemas (FX, CFD, Futures, Equity, EqOpt, FutOpt), auto-calcs, MT4 bridge
- [x] `quant-systems/index.html` — Tech Stack Reference Card (this document's companion)

### Pending Phase 2
- [ ] `options/index.html` — IV Percentile Scanner
  - IV rank by symbol
  - Historical vs Implied Vol spread (HV/IV)
  - Put/Call ratio grid
  - Screener across watchlist universe
  - **Requires IB MCP (no FMP fallback for IV)**
- [ ] `journal/index.html` — Trade Journal & Performance
  - IB trade history ingestion (get_account_trades)
  - PnL by asset class breakdown
  - Win rate / avg win / avg loss
  - Max drawdown, Sharpe estimate
  - Equity curve chart (Lightweight Charts line)
  - Export to CSV

---

## PHASE 3 — Execution Layer
*Target: Week 2–3 · Status: 🔲 Pending*

### MT4 File Bridge (Axi FX/CFD)
- [ ] Design JSON schema for `pending_trade.json`
  ```json
  {
    "timestamp": "ISO",
    "instrument": "FX|CFD",
    "symbol": "EURUSD",
    "direction": "long|short",
    "entry": 1.08500,
    "stop_loss": 1.08200,
    "take_profit": 1.09100,
    "lot_size": 0.10,
    "risk_usd": 300,
    "rr_ratio": 2.0,
    "status": "PENDING"
  }
  ```
- [ ] Write MQL4 Expert Advisor (~60 lines)
  - 1-second OnTimer() loop
  - FileReadString / FileOpen from HFOS/EXECUTION/pending_trade.json
  - Parse JSON via StringFind / StringSubstr
  - Confirm popup with OrderSend parameters
  - On user confirm → OrderSend()
  - Write status back to JSON: "EXECUTED" or "CANCELLED"
- [ ] Test with EURUSD on Axi demo
- [ ] Document installation path for MT4 EA on Axi

### IB Order Staging (create_order_instruction)
- [ ] Wire "+ Stage in IB" button on Trade Setup → calls create_order_instruction
- [ ] Map instrument schemas to IB contract types (STK, FUT, OPT, FOP)
- [ ] Handle multi-leg options (spread orders)
- [ ] Show order instruction link in result panel

---

## PHASE 4 — Deployment & Auth
*Target: Week 3 · Status: 🔲 Pending (User Action Required)*

### Cloudflare Pages Setup
- [ ] Create Cloudflare account (free)
- [ ] Connect GitHub repo `rcm-terminal` to Cloudflare Pages
  - Build command: *(none — static site)*
  - Build output: `/` (root)
- [ ] Test auto-deploy on next GitHub push

### Cloudflare Access (Auth Gate)
- [ ] Enable Cloudflare Access on the Pages app
- [ ] Create policy: Email OTP → allow `ahanx8@gmail.com`
- [ ] Test login from mobile browser (cross-device verification)

### Configuration Files
- [ ] Add `.gitignore` (exclude any local config files with keys)
- [ ] Update `README.md` with platform overview and Cloudflare setup steps

---

## PHASE 5 — Options Intelligence
*Target: Week 3–4 · Status: 🔲 Pending*

### `options/index.html` — IV Screener
- [ ] Universe watchlist (user-configurable, saved to localStorage)
- [ ] Per-symbol IV fetch via IB MCP (get_price_snapshot with implied vol)
- [ ] IV Rank calculation (52-week rolling)
- [ ] IV Percentile calculation
- [ ] HV (20-day realized vol) vs IV spread table
- [ ] Put/Call ratio (FMP fallback for options volume)
- [ ] Color-coded heatmap table: green (low IV) → gold (mid) → red (high)
- [ ] Click symbol → opens in Terminal

---

## PHASE 6 — Performance & Journal
*Target: Week 4 · Status: 🔲 Pending*

### `journal/index.html` — Trade Journal
- [ ] Load IB trade history (get_account_trades)
- [ ] Classify by asset class (FX, Futures, Equity, Options)
- [ ] Closed PnL table with sort/filter
- [ ] Performance KPIs: Win Rate, Profit Factor, Avg Win/Loss, Max DD
- [ ] Equity curve chart (LightCharts, daily cumulative PnL)
- [ ] Monthly PnL grid (heatmap calendar)
- [ ] Trade tags (from Trade Setup setup type field)
- [ ] Export to CSV

---

## PHASE 7 — Integration & Polish
*Target: Week 5+ · Status: 🔲 Future*

### Enhanced Features
- [ ] Real-time quote auto-refresh (configurable interval, localStorage setting)
- [ ] Alert system: price alert, IV alert → browser Notification API
- [ ] Multi-account support (IB account selector)
- [ ] Dark mode toggle (CSS custom property swap)
- [ ] Mobile responsive audit — all pages tested on iPhone Safari

### Cowork Artifact Integration
- [ ] Link to existing rcm-morning-dispatch-brief artifact from Terminal header
- [ ] Link to rcm-command-intent from Trade Setup (pre-fill from active trade idea)
- [ ] Link to rcm-pm-note from Journal (file daily PnL note)
- [ ] TIDE radar data pull for FX correlation context in Terminal sidebar

### Performance Optimisation
- [ ] Lazy-load TradingView library (defer until chart page)
- [ ] Quote cache (5s throttle on IB MCP calls)
- [ ] Service Worker for offline mode (stale-while-revalidate)

---

## Deployment Log

| Date | Version | Changes | Deployed By |
|------|---------|---------|------------|
| 2026-06-06 | v0.1.0 | Initial build — dashboard, terminal, trade-setup, quant-systems | Claude Cowork |

---

## Notes

- **IB MCP is Cowork-only**: When accessed via Cloudflare URL (browser), all IB features degrade gracefully to FMP REST or "not available" message. Design intent: platform works 100% in Cowork; ~80% in browser.
- **MT4 Bridge is local-only**: File bridge reads/writes only work when MT4 is running on the same machine as the HFOS folder. Remote use requires a different approach (e.g., Axi API if available).
- **FMP API key**: Andrew must add his FMP API key on first browser load. Key persists in localStorage until cleared.
- **Chart data**: IB MCP provides full OHLCV history for all asset classes. FMP REST provides equity/ETF/FX history. For futures not on FMP, Terminal shows "IB required" in standalone mode.
