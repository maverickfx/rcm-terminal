# RCM Terminal — Development Roadmap & Task Tracker

**Project:** RCM Terminal (rcm-terminal)
**Owner:** Andrew Han — Rapid Capital Management
**Build Environment:** Claude Cowork (primary) | Replit (secondary)
**Repo:** HFOS/03_TRADE_OPERATIONS/GITHUB/rcm-terminal
**Deploy Target:** Cloudflare Workers + Cloudflare Access
**Live URL:** https://rcm-terminal.ahanx8.workers.dev

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
- [x] Resolve GitHub Pages private repo issue → **Solution: Cloudflare Workers + Access (free)** *(not Pages — Pages not available)*
- [x] Establish three-layer data model: IB MCP (Cowork) / TwelveData REST (browser primary) / FMP REST (fallback)
- [x] Map all IB MCP tools (11 tools, server ID documented)
- [x] Map all FMP MCP tools
- [x] Design RCM brand token system for platform (navy/gold/risk/trade)
- [x] Add TwelveData REST as Layer 2 (800 req/day free, FX + equities + crypto)
- [x] Data feed settings modal (⚙ button) — key management, source status, feed priority UI

### Shared Modules
- [x] `shared/rcm-style.css` — Full brand stylesheet, all tokens, print CSS; brand lockup CSS (`.rcm-brand-lockup`)
- [x] `shared/rcm-utils.js` — Three-layer data utility (IB→TD→FMP), `buildHeader` with `brandProduct` param, settings modal, source badge
- [x] `wrangler.toml` — Workers Assets config; enables `npx wrangler deploy` via Cloudflare CI

---

## PHASE 2 — Core Pages (In Progress)
*Target: Weeks 1–2 · Status: 🔄 Active*

### Platform Pages
- [x] `index.html` — Main dashboard: tool nav cards, account KPIs, market watch (10 symbols), positions table
- [x] `terminal/index.html` — Full charting terminal: LightCharts v4.2, TF selector, chart types, sync volume, IV overlay, watchlist, OHLC sidebar; **RAPID TERMINAL** brand lockup
- [x] `trade-setup/index.html` — Trade Setup Generator: 6 instrument schemas (FX, CFD, Futures, Equity, EqOpt, FutOpt), auto-calcs, MT4 bridge
- [x] `quant-systems/index.html` — Tech Stack Reference Card (this document's companion)

### Branding
- [x] **RAPID TERMINAL** compound brand mark — Bloomberg Terminal-style lockup (bold white RAPID + separator + gold TERMINAL)
- [x] `buildHeader({ brandProduct: 'TERMINAL' })` pattern — reusable for any sub-product brand mark
- [x] Page title updated to `RAPID TERMINAL — RCM`

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
*Target: Week 3 · Status: 🔄 Partially Complete*

### Cloudflare Workers Setup ✅
- [x] Cloudflare Workers account connected — **Workers only, Pages not available**
- [x] GitHub repo `rcm-terminal` connected to Cloudflare CI
  - Deploy command: `npx wrangler deploy`
  - Branch: `main`
- [x] `wrangler.toml` created — `[assets] directory = "./"` with SPA fallback
- [x] Auto-deploy on push confirmed working — `https://rcm-terminal.ahanx8.workers.dev` is live
- [x] Git auth via GitHub Desktop (Google OAuth account — no password/PAT needed)

### Cloudflare Access (Auth Gate) 🔲
- [ ] Enable Cloudflare Access on the Workers route
- [ ] Create policy: Email OTP → allow `ahanx8@gmail.com`
- [ ] Test login from mobile browser (cross-device verification)

### Configuration Files
- [x] `wrangler.toml` committed to repo
- [ ] Add `.gitignore` (exclude any local config files with keys)
- [ ] Update `README.md` with platform overview and Workers setup steps

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

| Date | Commit | Version | Changes | Status |
|------|--------|---------|---------|--------|
| 2026-06-06 | `822f4fe` | v0.1.0 | Initial build — dashboard, terminal, trade-setup, quant-systems | ✅ Deployed |
| 2026-06-06 | `4fe6b0b` | v0.1.1 | Fix: `promptFmpKey` added to terminal; duplicate watchlist call removed | ✅ Deployed |
| 2026-06-06 | `6b38139` | v0.2.0 | Brand: RAPID TERMINAL lockup — `buildHeader` + brand lockup CSS | ✅ Deployed |
| 2026-06-06 | `4bd4538` | v0.2.1 | Fix: `wrangler.toml` added — CI deploys now work; TwelveData Layer 2 | ✅ Deployed |

---

## Notes

- **Data feed priority**: IB MCP (Cowork) → TwelveData REST (browser primary) → FMP REST (fallback). TwelveData free tier = 800 req/day; add key via ⚙ settings button. Design intent: platform works 100% in Cowork; ~80% in browser.
- **IB MCP is Cowork-only**: When accessed via Cloudflare URL, IB features degrade gracefully to TwelveData/FMP or "not available" message.
- **MT4 Bridge is local-only**: File bridge reads/writes only work when MT4 is running on the same machine as the HFOS folder. Remote use requires a different approach (e.g., Axi API if available).
- **API keys**: Stored in browser `localStorage` only — never sent to RCM servers. Add via ⚙ settings modal on any page.
- **Cloudflare Workers — NOT Pages**: Deployment is via `npx wrangler deploy` with `wrangler.toml`. Cloudflare Pages is not available on this account. Do not suggest or attempt Pages-based deployment.
- **GitHub auth**: Account uses Google OAuth — no password/PAT. Use GitHub Desktop for all git push operations.
- **Chart data**: IB MCP provides full OHLCV history for all asset classes. TwelveData covers FX/equities/crypto. FMP REST covers equities/ETFs. For futures not covered by REST APIs, Terminal shows "IB required" in standalone mode.
