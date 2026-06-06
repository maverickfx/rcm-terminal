/* ─── RCM Platform — Data Utility Layer ────────────────────────────────────
   Rapid Capital Management | rcm-utils.js v1.2

   ARCHITECTURE:
   Layer 1 (Cowork)    — window.cowork.callMcpTool() — IB MCP + FMP MCP
                         Available in Cowork mode only.
   Layer 2 (Browser)   — TwelveData REST API via fetch()
                         Primary browser source. Free: 800 req/day.
                         Key stored in localStorage (rcm_td_api_key).
   Layer 3 (Fallback)  — FMP REST API via fetch()
                         Fallback if TwelveData key not set.
                         Key stored in localStorage (rcm_fmp_api_key).

   Usage:
     const data = await RCM.quote('EUR/USD');
     const bars  = await RCM.history('EURUSD', '1D', 90);
     const acct  = await RCM.account();
──────────────────────────────────────────────────────────────────────────── */

const RCM = (() => {

  /* ── Cowork detection ── */
  const isCowork = () => typeof window !== 'undefined' && !!window.cowork;

  /* ── API keys (stored in localStorage) ── */
  const TD_KEY_STORAGE  = 'rcm_td_api_key';
  const FMP_KEY_STORAGE = 'rcm_fmp_api_key';
  const getTdKey  = () => localStorage.getItem(TD_KEY_STORAGE)  || '';
  const setTdKey  = (k) => localStorage.setItem(TD_KEY_STORAGE, k);
  const getFmpKey = () => localStorage.getItem(FMP_KEY_STORAGE) || '';
  const setFmpKey = (k) => localStorage.setItem(FMP_KEY_STORAGE, k);

  /* ── IB MCP tool IDs ── */
  const IB = 'mcp__c5c4b258-c195-40b0-80eb-29affac08285';
  const FMP_MCP = 'mcp__a97bb01e-3373-4b7d-b3ec-66a6a4524ffe';

  /* ── Cowork MCP helper ── */
  const mcp = async (server, tool, args = {}) => {
    if (!isCowork()) throw new Error('Cowork not available');
    const toolName = `${server}__${tool}`;
    const r = await window.cowork.callMcpTool(toolName, args);
    if (r.isError) throw new Error(r.content?.[0]?.text || 'MCP error');
    if (r.structuredContent) return r.structuredContent;
    const txt = r.content?.[0]?.text;
    if (!txt) return null;
    try { return JSON.parse(txt); } catch { return txt; }
  };

  /* ── TwelveData REST helper ── */
  const td = async (endpoint, params = {}) => {
    const key = getTdKey();
    if (!key) throw new Error('TD_KEY_MISSING');
    const url = new URL(`https://api.twelvedata.com${endpoint}`);
    url.searchParams.set('apikey', key);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`TwelveData ${res.status}: ${res.statusText}`);
    const json = await res.json();
    if (json.status === 'error') throw new Error(json.message || 'TwelveData error');
    return json;
  };

  /* ── TwelveData symbol format ── */
  // FX 6-char pairs → EUR/USD format; equities/ETFs stay as-is
  const tdSymbol = (sym) => {
    const s = sym.replace('/', '').toUpperCase();
    if (/^[A-Z]{6}$/.test(s)) return s.slice(0, 3) + '/' + s.slice(3);
    return s;
  };

  /* ── TwelveData interval map ── */
  const TD_INTERVAL = {
    '1m':'1min', '5m':'5min', '15m':'15min', '30m':'30min',
    '1H':'1h',   '4H':'4h',  '1D':'1day',   '1W':'1week',
  };

  /* ── FMP REST helper ── */
  const fmp = async (path, params = {}) => {
    const key = getFmpKey();
    if (!key) throw new Error('FMP_KEY_MISSING');
    const url = new URL(`https://financialmodelingprep.com/api${path}`);
    url.searchParams.set('apikey', key);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`FMP ${res.status}: ${res.statusText}`);
    return res.json();
  };

  /* ── Symbol normalisation ── */
  // IB uses "EUR" (forex), FMP uses "EURUSD" — normalise to pair like "EURUSD"
  const normSymbol = (sym) => sym.replace('/', '').toUpperCase();
  const fxPair = (sym) => {
    const s = normSymbol(sym);
    // If 6 chars and all alpha, assume forex pair
    if (/^[A-Z]{6}$/.test(s)) return s;
    return s;
  };

  /* ──────────────────────────────────────────────────────────
     PUBLIC API
  ────────────────────────────────────────────────────────── */

  /**
   * Get real-time quote for a symbol.
   * Returns: { symbol, bid, ask, last, change, changePct, volume, timestamp }
   */
  const quote = async (symbol) => {
    const sym = normSymbol(symbol);

    if (isCowork()) {
      try {
        const raw = await mcp(IB, 'get_price_snapshot', { symbol: sym });
        // IB snapshot shape varies; normalise it
        const d = Array.isArray(raw) ? raw[0] : raw;
        return {
          symbol: sym,
          bid:       d?.bid ?? d?.BID ?? null,
          ask:       d?.ask ?? d?.ASK ?? null,
          last:      d?.last ?? d?.LAST ?? d?.close ?? null,
          change:    d?.change ?? null,
          changePct: d?.changePct ?? d?.changePercent ?? null,
          volume:    d?.volume ?? null,
          timestamp: d?.timestamp ?? Date.now(),
          source:    'IB',
        };
      } catch (e) {
        console.warn('IB quote failed, falling back to FMP:', e.message);
      }
    }

    // TwelveData (primary browser source)
    if (getTdKey()) {
      try {
        const d = await td('/quote', { symbol: tdSymbol(sym) });
        return {
          symbol:    sym,
          bid:       null,
          ask:       null,
          last:      parseFloat(d.close),
          change:    parseFloat(d.change),
          changePct: parseFloat(d.percent_change),
          volume:    parseFloat(d.volume) || 0,
          timestamp: Date.now(),
          source:    'TD',
        };
      } catch (e) {
        console.warn('TwelveData quote failed, falling back to FMP:', e.message);
      }
    }

    // FMP fallback
    const data = await fmp('/v3/quote/' + sym);
    const d = Array.isArray(data) ? data[0] : data;
    if (!d) throw new Error('No quote data for ' + sym);
    return {
      symbol:    d.symbol,
      bid:       d.bid ?? null,
      ask:       d.ask ?? null,
      last:      d.price,
      change:    d.change,
      changePct: d.changesPercentage,
      volume:    d.volume,
      timestamp: d.timestamp * 1000,
      source:    'FMP',
    };
  };

  /**
   * Get OHLCV price history.
   * timeframe: '1m','5m','15m','1H','4H','1D','1W'
   * bars: number of bars to return
   * Returns: [{ time, open, high, low, close, volume }]
   */
  const history = async (symbol, timeframe = '1D', bars = 200) => {
    const sym = normSymbol(symbol);

    if (isCowork()) {
      try {
        const ibPeriod = {
          '1m':'1m', '5m':'5m', '15m':'15m', '30m':'30m',
          '1H':'1h', '4H':'4h', '1D':'1d', '1W':'1w'
        }[timeframe] || '1d';

        const raw = await mcp(IB, 'get_price_history', {
          symbol: sym,
          period: ibPeriod,
          bars,
        });

        const arr = Array.isArray(raw) ? raw : raw?.bars ?? raw?.data ?? [];
        return arr.map(b => ({
          time:   b.time ?? b.date ?? b.t,
          open:   b.open ?? b.o,
          high:   b.high ?? b.h,
          low:    b.low  ?? b.l,
          close:  b.close ?? b.c,
          volume: b.volume ?? b.v ?? 0,
          source: 'IB',
        })).sort((a, b) => (a.time > b.time ? 1 : -1));
      } catch (e) {
        console.warn('IB history failed, falling back to FMP:', e.message);
      }
    }

    // TwelveData (primary browser source)
    if (getTdKey()) {
      try {
        const interval = TD_INTERVAL[timeframe] || '1day';
        const data = await td('/time_series', {
          symbol:     tdSymbol(sym),
          interval,
          outputsize: bars,
          order:      'ASC',
        });
        const arr = Array.isArray(data.values) ? data.values : [];
        return arr.map(b => ({
          time:   b.datetime,
          open:   parseFloat(b.open),
          high:   parseFloat(b.high),
          low:    parseFloat(b.low),
          close:  parseFloat(b.close),
          volume: parseFloat(b.volume) || 0,
          source: 'TD',
        }));
      } catch (e) {
        console.warn('TwelveData history failed, falling back to FMP:', e.message);
      }
    }

    // FMP fallback — choose endpoint by timeframe
    const isIntraday = ['1m','5m','15m','30m','1H','4H'].includes(timeframe);
    let data;
    if (isIntraday) {
      const fmpTf = {'1m':'1min','5m':'5min','15m':'15min','30m':'30min','1H':'1hour','4H':'4hour'}[timeframe];
      data = await fmp(`/v3/historical-chart/${fmpTf}/${sym}`, { limit: bars });
    } else {
      data = await fmp(`/v3/historical-price-full/${sym}`, { timeseries: bars });
      data = data?.historical ?? data;
    }

    const arr = Array.isArray(data) ? data : [];
    return arr.map(b => ({
      time:   b.date ?? b.t,
      open:   b.open,
      high:   b.high,
      low:    b.low,
      close:  b.close,
      volume: b.volume ?? 0,
      source: 'FMP',
    })).sort((a, b) => (a.time > b.time ? 1 : -1));
  };

  /**
   * Get IB account summary.
   * Returns: { netLiq, cashBalance, buyingPower, unrealizedPnl, currency, source }
   */
  const account = async () => {
    if (!isCowork()) return { source: 'unavailable' };

    try {
      const raw = await mcp(IB, 'get_account_summary');
      const d = Array.isArray(raw) ? raw[0] : raw;
      return {
        netLiq:       parseFloat(d?.NetLiquidation ?? d?.netLiq ?? 0),
        cashBalance:  parseFloat(d?.TotalCashValue ?? d?.cash ?? 0),
        buyingPower:  parseFloat(d?.BuyingPower ?? d?.buyingPower ?? 0),
        unrealizedPnl:parseFloat(d?.UnrealizedPnL ?? d?.unrealizedPnl ?? 0),
        currency:     d?.currency ?? 'USD',
        source:       'IB',
      };
    } catch (e) {
      console.warn('Account summary failed:', e.message);
      return { source: 'error', error: e.message };
    }
  };

  /**
   * Get current IB positions.
   * Returns: [{ symbol, conid, quantity, avgCost, marketValue, unrealizedPnl, currency }]
   */
  const positions = async () => {
    if (!isCowork()) return [];

    try {
      const raw = await mcp(IB, 'get_account_positions');
      const arr = Array.isArray(raw) ? raw : raw?.positions ?? [];
      return arr.map(p => ({
        symbol:       p.symbol ?? p.contractDesc ?? p.Symbol,
        conid:        p.conid ?? p.CONID,
        quantity:     parseFloat(p.position ?? p.size ?? p.qty ?? 0),
        avgCost:      parseFloat(p.avgCost ?? p.avgPrice ?? 0),
        marketValue:  parseFloat(p.mktValue ?? p.marketValue ?? 0),
        unrealizedPnl:parseFloat(p.unrealizedPnl ?? p.unrealizedPNL ?? 0),
        currency:     p.currency ?? 'USD',
        assetClass:   p.assetClass ?? p.secType ?? 'STK',
      }));
    } catch (e) {
      console.warn('Positions failed:', e.message);
      return [];
    }
  };

  /**
   * Get recent IB trades.
   * Returns: [{ conid, symbol, side, quantity, price, commission, time }]
   */
  const trades = async () => {
    if (!isCowork()) return [];

    try {
      const raw = await mcp(IB, 'get_account_trades');
      const arr = Array.isArray(raw) ? raw : raw?.trades ?? [];
      return arr.map(t => ({
        symbol:     t.symbol ?? t.contractDesc,
        side:       t.side ?? t.buySell,
        quantity:   parseFloat(t.size ?? t.quantity ?? 0),
        price:      parseFloat(t.price ?? t.execPrice ?? 0),
        commission: parseFloat(t.commission ?? 0),
        time:       t.trade_time ?? t.time,
        pnl:        parseFloat(t.realizedPnl ?? t.pnl ?? 0),
      }));
    } catch (e) {
      console.warn('Trades failed:', e.message);
      return [];
    }
  };

  /**
   * Search IB contracts by symbol string.
   * Returns: [{ conid, symbol, description, secType, exchange, currency }]
   */
  const searchContracts = async (query) => {
    if (!isCowork()) return [];
    try {
      const raw = await mcp(IB, 'search_contracts', { query });
      return Array.isArray(raw) ? raw : raw?.contracts ?? [];
    } catch (e) { return []; }
  };

  /**
   * Get options IV data for a symbol (IB only — no FMP fallback for this)
   */
  const optionsIV = async (symbol) => {
    if (!isCowork()) return null;
    const sym = normSymbol(symbol);
    try {
      const [iv, ivPct] = await Promise.allSettled([
        mcp(IB, 'implied-vol-underlying', { symbol: sym }),
        mcp(IB, 'implied-volatility-percentile', { symbol: sym }),
      ]);
      return {
        iv:       iv.status === 'fulfilled' ? iv.value : null,
        ivRank:   ivPct.status === 'fulfilled' ? ivPct.value : null,
        source:   'IB',
      };
    } catch (e) { return null; }
  };

  /**
   * Get FMP news for a symbol.
   */
  const news = async (symbol, limit = 10) => {
    const sym = normSymbol(symbol);
    if (isCowork()) {
      try {
        const raw = await mcp(FMP_MCP, 'news', { ticker: sym, limit });
        return Array.isArray(raw) ? raw : raw?.news ?? [];
      } catch {}
    }
    const data = await fmp('/v3/stock_news', { tickers: sym, limit });
    return Array.isArray(data) ? data : [];
  };

  /**
   * Get multiple quotes at once (batch).
   */
  const batchQuotes = async (symbols) => {
    if (isCowork()) {
      const results = await Promise.allSettled(symbols.map(s => quote(s)));
      return results.map((r, i) => r.status === 'fulfilled' ? r.value : { symbol: symbols[i], error: true });
    }

    // TwelveData batch (comma-separated symbols)
    if (getTdKey()) {
      try {
        const syms = symbols.map(s => tdSymbol(normSymbol(s))).join(',');
        const data = await td('/quote', { symbol: syms });
        // TD returns object keyed by symbol when batching, or single object
        const normalize = (d, origSym) => ({
          symbol:    origSym,
          last:      parseFloat(d.close),
          change:    parseFloat(d.change),
          changePct: parseFloat(d.percent_change),
          volume:    parseFloat(d.volume) || 0,
          source:    'TD',
        });
        if (data && typeof data === 'object' && !data.close) {
          // Batched response is keyed by TD symbol
          return symbols.map((s) => {
            const key = tdSymbol(normSymbol(s));
            const d = data[key];
            return d ? normalize(d, s) : { symbol: s, error: true };
          });
        }
        // Single symbol response
        return [normalize(data, symbols[0])];
      } catch (e) {
        console.warn('TwelveData batch failed, falling back to FMP:', e.message);
      }
    }

    // FMP batch fallback
    const sym = symbols.map(normSymbol).join(',');
    const data = await fmp('/v3/quote/' + sym);
    return Array.isArray(data) ? data.map(d => ({
      symbol:    d.symbol,
      last:      d.price,
      change:    d.change,
      changePct: d.changesPercentage,
      volume:    d.volume,
      source:    'FMP',
    })) : [];
  };

  /* ── Source status ── */
  const getSourceStatus = async () => {
    if (isCowork()) {
      try {
        await mcp(IB, 'get_account_summary');
        return 'ib';
      } catch {}
      return 'fmp';
    }
    if (getTdKey())  return 'td';
    if (getFmpKey()) return 'fmp';
    return 'off';
  };

  /* ── Settings helpers ── */
  const saveSetting = (key, val) => localStorage.setItem(`rcm_${key}`, JSON.stringify(val));
  const loadSetting = (key, def) => {
    const v = localStorage.getItem(`rcm_${key}`);
    return v !== null ? JSON.parse(v) : def;
  };

  /* ── Number formatters ── */
  const fmt = {
    price:  (v, d=4) => v == null ? '—' : Number(v).toFixed(d),
    pct:    (v)      => v == null ? '—' : (v > 0 ? '+' : '') + Number(v).toFixed(2) + '%',
    money:  (v, c='$') => v == null ? '—' : c + Math.abs(Number(v)).toLocaleString('en-US', {minimumFractionDigits:0, maximumFractionDigits:0}),
    num:    (v, d=2) => v == null ? '—' : Number(v).toFixed(d),
    compact:(v)      => {
      if (v == null) return '—';
      const n = Math.abs(Number(v));
      if (n >= 1e9) return (v/1e9).toFixed(1) + 'B';
      if (n >= 1e6) return (v/1e6).toFixed(1) + 'M';
      if (n >= 1e3) return (v/1e3).toFixed(1) + 'K';
      return Number(v).toFixed(0);
    },
    ts: (v) => v ? new Date(v).toLocaleTimeString('en-SG', {timeZone:'Asia/Singapore'}) : '—',
    dt: (v) => v ? new Date(v).toLocaleDateString('en-SG', {timeZone:'Asia/Singapore'}) : '—',
  };

  /* ── Colour helper ── */
  const dirColor = (val) => {
    if (val == null) return '';
    return Number(val) > 0 ? 'up' : Number(val) < 0 ? 'dn' : '';
  };

  /* ── Public exports ── */
  return {
    isCowork,
    quote,
    history,
    account,
    positions,
    trades,
    searchContracts,
    optionsIV,
    news,
    batchQuotes,
    getSourceStatus,
    getTdKey,
    setTdKey,
    TD_KEY_STORAGE,
    getFmpKey,
    setFmpKey,
    FMP_KEY_STORAGE,
    saveSetting,
    loadSetting,
    fmt,
    dirColor,
  };

})();

/* ── RCM Header builder ── */
RCM.buildHeader = (opts = {}) => {
  const { title = '', subtitle = '', activePage = '', brandProduct = '' } = opts;
  const navLinks = [
    { href: '../index.html',              label: 'Dashboard',     key: 'dashboard' },
    { href: '../terminal/index.html',     label: 'Terminal',      key: 'terminal' },
    { href: '../trade-setup/index.html',  label: 'Trade Setup',   key: 'tradesetup' },
    { href: '../options/index.html',      label: 'Options IV',    key: 'options' },
    { href: '../journal/index.html',      label: 'Journal',       key: 'journal' },
    { href: '../quant-systems/index.html',label: 'Quant Systems', key: 'quantsystems' },
  ];

  // Brand lockup (e.g. RAPID TERMINAL) vs standard wordmark + title
  const leftSection = brandProduct
    ? `<div class="rcm-brand-lockup">
        <span class="rbl-firm">RAPID</span>
        <span class="rbl-sep"></span>
        <span class="rbl-product">${brandProduct.toUpperCase()}</span>
      </div>`
    : `<div class="rcm-wordmark">
        <span class="line1">Rapid Capital</span>
        <span class="line2">Management</span>
      </div>
      <div class="rcm-header-divider"></div>
      <div class="rcm-header-title">${title}</div>`;

  return `
  <header class="rcm-header">
    <div class="rcm-mark">
      <svg width="26" height="26" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
        <rect x="0"    y="0"    width="6.5" height="6.5" fill="#fff"/>
        <rect x="7.75" y="0"    width="6.5" height="6.5" fill="#fff"/>
        <rect x="15.5" y="0"    width="6.5" height="6.5" fill="#fff"/>
        <rect x="0"    y="7.75" width="6.5" height="6.5" fill="#fff"/>
        <rect x="0"    y="15.5" width="6.5" height="6.5" fill="#fff"/>
        <polygon points="10.5,22 22,22 16.25,13" fill="#C0392B"/>
      </svg>
    </div>
    ${leftSection}
    <div class="rcm-header-right">
      <nav class="rcm-header-nav">
        ${navLinks.map(l => `<a href="${l.href}" class="rcm-nav-link${activePage === l.key ? ' active' : ''}">${l.label}</a>`).join('')}
      </nav>
      <div id="rcm-source-badge" class="source-badge off" onclick="RCM.openSettingsModal()" title="Data feed settings" style="cursor:pointer;">Init</div>
      <button class="rcm-settings-btn" onclick="RCM.openSettingsModal()" title="Data feed settings" aria-label="Settings">⚙</button>
    </div>
  </header>`;
};

RCM.buildFooter = (subtitle = 'Internal · Confidential') => `
  <footer class="rcm-footer">
    <span class="left">${subtitle}</span>
    <span class="right">Rapid Capital Management</span>
  </footer>`;

/* ── Source badge updater ── */
RCM.updateSourceBadge = async () => {
  const el = document.getElementById('rcm-source-badge');
  if (!el) return;
  el.textContent = 'Checking…';
  try {
    const src = await RCM.getSourceStatus();
    el.className = `source-badge ${src}`;
    el.textContent = src === 'ib' ? 'IB Live' : src === 'td' ? 'TwelveData' : src === 'fmp' ? 'FMP' : 'Offline';
  } catch {
    el.className = 'source-badge off';
    el.textContent = 'Offline';
  }
};

/* ── API key prompt (shown in browser if no data key set) ── */
RCM.promptFmpKey = () => {
  if (RCM.isCowork()) return;
  if (RCM.getTdKey()) return; // TwelveData key present — no prompt needed
  const hasFmp = RCM.getFmpKey();

  const div = document.createElement('div');
  div.id = 'rcm-key-banner';
  div.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#C9A14A;color:#0B1D3A;padding:10px 20px;display:flex;align-items:center;gap:12px;z-index:9999;font-size:12px;font-weight:700;flex-wrap:wrap;';

  div.innerHTML = `
    <span>📊 Add <a href="https://twelvedata.com" target="_blank" style="color:#0B1D3A;text-decoration:underline;">TwelveData</a> key for charts &amp; quotes (free 800 req/day)</span>
    <input id="td-key-input" type="text" placeholder="TwelveData API key…"
      style="flex:1;min-width:200px;max-width:280px;padding:5px 10px;border:none;border-radius:3px;font-size:12px;">
    <button onclick="RCM.setTdKey(document.getElementById('td-key-input').value.trim());document.getElementById('rcm-key-banner').remove();location.reload();"
      style="padding:5px 14px;background:#0B1D3A;color:#fff;border:none;border-radius:3px;cursor:pointer;font-weight:700;">Save</button>
    ${hasFmp ? '' : `<span style="opacity:.7;">· or <a href="#" onclick="event.preventDefault();document.getElementById('rcm-fmp-row').style.display='flex';" style="color:#0B1D3A;">use FMP key instead</a></span>
    <div id="rcm-fmp-row" style="display:none;width:100%;gap:12px;margin-top:6px;align-items:center;">
      <input id="fmp-key-input" type="text" placeholder="FMP API key…"
        style="flex:1;min-width:200px;max-width:280px;padding:5px 10px;border:none;border-radius:3px;font-size:12px;">
      <button onclick="RCM.setFmpKey(document.getElementById('fmp-key-input').value.trim());document.getElementById('rcm-key-banner').remove();location.reload();"
        style="padding:5px 14px;background:#0B1D3A;color:#fff;border:none;border-radius:3px;cursor:pointer;font-weight:700;">Save FMP</button>
    </div>`}
    <button onclick="this.closest('#rcm-key-banner').remove();"
      style="margin-left:auto;padding:5px 10px;background:transparent;border:1px solid #0B1D3A;border-radius:3px;cursor:pointer;font-size:11px;">✕</button>`;

  document.body.prepend(div);
};

/* ── Data Feed Settings Modal ─────────────────────────────────────────── */
RCM.openSettingsModal = async () => {
  // Remove any existing modal
  const existing = document.getElementById('rcm-settings-overlay');
  if (existing) { existing.remove(); return; }

  // Determine current source
  const src = await RCM.getSourceStatus();
  const srcLabel = { ib: 'IB Live (Cowork)', td: 'TwelveData REST', fmp: 'FMP REST', off: 'Offline' }[src] || 'Unknown';
  const srcColor = { ib: '#4CAF50', td: '#C9A14A', fmp: '#C9A14A', off: '#666' }[src] || '#666';

  const tdKey  = RCM.getTdKey();
  const fmpKey = RCM.getFmpKey();

  const overlay = document.createElement('div');
  overlay.id = 'rcm-settings-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(11,29,58,.72);
    z-index: 10000; display: flex; align-items: flex-start;
    justify-content: flex-end; padding: 60px 20px 0 0;
  `;

  overlay.innerHTML = `
    <div id="rcm-settings-panel" style="
      background: #0B1D3A; border: 1px solid rgba(201,161,74,.4);
      border-radius: 10px; width: 380px; max-width: calc(100vw - 40px);
      box-shadow: 0 16px 48px rgba(0,0,0,.5); overflow: hidden;
      font-family: 'Segoe UI', sans-serif; color: #E0E0E0;
    ">
      <!-- Header -->
      <div style="background:#0d2244;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(201,161,74,.25);">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:15px;">⚙</span>
          <span style="font-size:13px;font-weight:700;letter-spacing:.5px;color:#fff;">Data Feed Settings</span>
        </div>
        <button onclick="document.getElementById('rcm-settings-overlay').remove();"
          style="background:none;border:none;color:#aaa;cursor:pointer;font-size:16px;line-height:1;padding:2px 6px;" title="Close">✕</button>
      </div>

      <!-- Active Feed Status -->
      <div style="padding:16px 18px 12px;border-bottom:1px solid rgba(255,255,255,.07);">
        <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#888;margin-bottom:10px;">Active Feed</div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:10px;height:10px;border-radius:50%;background:${srcColor};flex-shrink:0;"></div>
          <span style="font-size:14px;font-weight:700;color:#fff;">${srcLabel}</span>
        </div>
        <div style="margin-top:8px;font-size:11px;color:#8898aa;line-height:1.5;">
          ${src === 'ib' ? '✓ Interactive Brokers MCP — live bid/ask streaming via Cowork.' :
            src === 'td' ? '↻ TwelveData REST — polled on page load &amp; manual refresh. <strong style="color:#C9A14A;">Not live streaming.</strong>' :
            src === 'fmp' ? '↻ Financial Modeling Prep REST — polled on page load &amp; manual refresh.' :
            '⚠ No data source configured. Enter a TwelveData API key below.'}
        </div>
        ${src !== 'ib' ? `<div style="margin-top:6px;font-size:10px;color:#666;font-style:italic;">Streaming requires IB via Cowork mode · Free APIs are REST-only</div>` : ''}
      </div>

      <!-- TwelveData Key -->
      <div style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.07);">
        <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#888;margin-bottom:8px;">
          TwelveData API Key
          <span style="font-weight:400;text-transform:none;letter-spacing:0;color:#556;margin-left:6px;">
            — <a href="https://twelvedata.com" target="_blank" style="color:#C9A14A;text-decoration:none;">Get free key ↗</a> (800 req/day)
          </span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <input id="sett-td-key" type="text"
            value="${tdKey ? tdKey.slice(0,8) + '••••••••' : ''}"
            placeholder="${tdKey ? 'Key saved ✓ — paste to update' : 'Paste TwelveData API key…'}"
            onfocus="if(this.dataset.masked){this.value='';delete this.dataset.masked;}"
            data-masked="${tdKey ? '1' : ''}"
            style="flex:1;padding:7px 10px;border-radius:4px;border:1px solid rgba(201,161,74,.3);
              background:rgba(255,255,255,.05);color:#fff;font-size:12px;outline:none;"
          >
          <button onclick="(function(){
              const el=document.getElementById('sett-td-key');
              if(el.dataset.masked) return;
              const val=el.value.trim();
              if(!val){alert('Enter a TwelveData key first.');return;}
              RCM.setTdKey(val);
              el.value=val.slice(0,8)+'••••••••';
              el.dataset.masked='1';
              document.getElementById('rcm-settings-overlay').remove();
              location.reload();
            })()"
            style="padding:7px 14px;background:#C9A14A;color:#0B1D3A;border:none;border-radius:4px;
              cursor:pointer;font-size:11px;font-weight:700;white-space:nowrap;">Save</button>
        </div>
        ${tdKey ? `<button onclick="RCM.setTdKey('');document.getElementById('rcm-settings-overlay').remove();location.reload();"
          style="margin-top:6px;background:none;border:none;color:#666;cursor:pointer;font-size:10px;text-decoration:underline;padding:0;">
          Remove TwelveData key</button>` : ''}
      </div>

      <!-- FMP Key -->
      <div style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.07);">
        <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#888;margin-bottom:8px;">
          FMP API Key <span style="font-weight:400;text-transform:none;letter-spacing:0;color:#556;">(fallback)</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <input id="sett-fmp-key" type="text"
            value="${fmpKey ? fmpKey.slice(0,8) + '••••••••' : ''}"
            placeholder="${fmpKey ? 'Key saved ✓ — paste to update' : 'Paste FMP API key…'}"
            onfocus="if(this.dataset.masked){this.value='';delete this.dataset.masked;}"
            data-masked="${fmpKey ? '1' : ''}"
            style="flex:1;padding:7px 10px;border-radius:4px;border:1px solid rgba(255,255,255,.15);
              background:rgba(255,255,255,.05);color:#fff;font-size:12px;outline:none;"
          >
          <button onclick="(function(){
              const el=document.getElementById('sett-fmp-key');
              if(el.dataset.masked) return;
              const val=el.value.trim();
              if(!val){alert('Enter an FMP key first.');return;}
              RCM.setFmpKey(val);
              el.value=val.slice(0,8)+'••••••••';
              el.dataset.masked='1';
              document.getElementById('rcm-settings-overlay').remove();
              location.reload();
            })()"
            style="padding:7px 14px;background:rgba(255,255,255,.1);color:#ccc;border:1px solid rgba(255,255,255,.15);
              border-radius:4px;cursor:pointer;font-size:11px;font-weight:700;white-space:nowrap;">Save</button>
        </div>
        ${fmpKey ? `<button onclick="RCM.setFmpKey('');document.getElementById('rcm-settings-overlay').remove();location.reload();"
          style="margin-top:6px;background:none;border:none;color:#666;cursor:pointer;font-size:10px;text-decoration:underline;padding:0;">
          Remove FMP key</button>` : ''}
      </div>

      <!-- Feed Priority Explainer -->
      <div style="padding:12px 18px;border-bottom:1px solid rgba(255,255,255,.07);">
        <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#888;margin-bottom:8px;">Feed Priority</div>
        <div style="font-size:11px;color:#6a7f9c;line-height:1.7;">
          <div style="display:flex;align-items:center;gap:8px;"><span style="color:#4CAF50;font-weight:700;">①</span> IB via Cowork — live bid/ask</div>
          <div style="display:flex;align-items:center;gap:8px;"><span style="color:#C9A14A;font-weight:700;">②</span> TwelveData REST — FX + equities + crypto</div>
          <div style="display:flex;align-items:center;gap:8px;"><span style="color:#888;font-weight:700;">③</span> FMP REST — equities/ETFs only</div>
        </div>
      </div>

      <!-- Footer note -->
      <div style="padding:10px 18px;text-align:center;">
        <span style="font-size:10px;color:#444;">Keys stored locally in browser · never sent to RCM servers</span>
      </div>
    </div>
  `;

  // Close on overlay click (outside panel)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  document.body.appendChild(overlay);
};
