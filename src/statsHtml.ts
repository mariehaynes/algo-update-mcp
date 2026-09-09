import { UsageStats } from './telemetry.js';

export function renderStatsHtml(stats: UsageStats): string {
  const toolLabels: Record<string, { label: string; desc: string }> = {
    get_latest_updates: {
      label: 'get_latest_updates',
      desc: 'Recent updates, AI Mode rollouts & Gemini changes'
    },
    search_updates: {
      label: 'search_updates',
      desc: 'Historical keyword & topic search (2012–2026)'
    },
    get_updates_by_date_range: {
      label: 'get_updates_by_date_range',
      desc: 'GA4 / GSC traffic drop date correlation'
    },
    get_all_categories: {
      label: 'get_all_categories',
      desc: 'Category and platform index metadata'
    },
    api_updates: {
      label: 'REST API (/api/updates)',
      desc: 'Direct public JSON developer feed requests'
    }
  };

  const transportLabels: Record<string, { label: string; desc: string }> = {
    streamable_http: {
      label: 'Streamable HTTP (/mcp)',
      desc: 'Modern MCP standard (Claude, Antigravity, Cursor, WebMCP)'
    },
    sse: {
      label: 'Legacy SSE (/sse)',
      desc: 'Claude Desktop (supergateway) & SSE clients'
    },
    api: {
      label: 'Direct REST API',
      desc: 'HTTP GET queries to /api/updates and /updates.json'
    },
    stdio: {
      label: 'Local Stdio',
      desc: 'Local command-line or subprocess MCP connections'
    }
  };

  // Build rolling 14-day history array
  const last14Days: { date: string; displayDate: string; count: number }[] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const display = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    last14Days.push({
      date: key,
      displayDate: display,
      count: stats.dailyUsage[key] || 0
    });
  }

  const maxDaily = Math.max(...last14Days.map(d => d.count), 5);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Usage Dashboard | Marie Haynes Algorithm MCP</title>
  <meta name="description" content="Live, anonymous usage statistics for Marie Haynes' Algorithm & AI Search MCP Server. 100% privacy-compliant volume tracking.">
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-2N5XDDYHFL"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-2N5XDDYHFL');
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&family=Poppins:wght@600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --brand-orange: #f15a25;
      --brand-deep-purple: #5c2882;
      --brand-purple: #662d91;
      --brand-charcoal: #333333;
      --bg-light: #faf9fc;
      --card-bg: #ffffff;
      --border-color: #e5dfec;
      --code-bg: #f8f6fb;
      --code-border: #e2d8ea;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Noto Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      color: var(--brand-charcoal);
      background-color: var(--bg-light);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    h1, h2, h3, h4, .brand-font {
      font-family: 'Poppins', sans-serif;
      font-weight: 700;
      color: var(--brand-deep-purple);
    }
    header {
      background: #ffffff;
      border-bottom: 1px solid #ede7f4;
      padding: 2.5rem 1.5rem 2rem;
      text-align: center;
      box-shadow: 0 2px 14px rgba(92, 40, 130, 0.04);
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .logo-container {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.2rem;
      width: 100%;
    }
    .logo-container img {
      height: 80px;
      width: auto;
      object-fit: contain;
    }
    .nav-back {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--brand-purple);
      font-weight: 700;
      text-decoration: none;
      font-size: 0.92rem;
      margin-bottom: 1.2rem;
      transition: color 0.2s ease;
    }
    .nav-back:hover {
      color: var(--brand-orange);
    }
    .badge {
      display: inline-block;
      background-color: var(--brand-orange);
      color: #ffffff;
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 4px 14px;
      border-radius: 999px;
      margin-bottom: 0.75rem;
      box-shadow: 0 2px 8px rgba(241, 90, 37, 0.25);
    }
    header h1 {
      color: var(--brand-deep-purple);
      font-size: 2.1rem;
      margin-bottom: 0.6rem;
      letter-spacing: -0.5px;
    }
    header p {
      font-size: 1.05rem;
      color: #4f4a59;
      max-width: 700px;
      margin: 0 auto;
    }
    .container {
      max-width: 1060px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem;
    }
    /* Privacy Banner */
    .privacy-banner {
      background: #fbf8fe;
      border: 2px solid #e0d0eb;
      border-left: 6px solid var(--brand-purple);
      border-radius: 12px;
      padding: 1.5rem 1.8rem;
      margin-bottom: 2.2rem;
      box-shadow: 0 4px 16px rgba(92, 40, 130, 0.04);
    }
    .privacy-banner h3 {
      font-size: 1.15rem;
      color: var(--brand-deep-purple);
      margin-bottom: 0.4rem;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .privacy-banner p {
      font-size: 0.95rem;
      color: #4a4555;
      line-height: 1.6;
    }
    /* KPI Cards */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.2rem;
      margin-bottom: 2.2rem;
    }
    .kpi-card {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 4px 16px rgba(92, 40, 130, 0.04);
      text-align: center;
    }
    .kpi-number {
      font-family: 'Poppins', sans-serif;
      font-size: 2.2rem;
      font-weight: 800;
      color: var(--brand-deep-purple);
      line-height: 1.1;
      margin-bottom: 0.35rem;
    }
    .kpi-label {
      font-size: 0.88rem;
      font-weight: 700;
      color: var(--brand-purple);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 0.2rem;
    }
    .kpi-sub {
      font-size: 0.8rem;
      color: #6a6476;
    }
    /* Grid 2 Columns */
    .sections-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.8rem;
      margin-bottom: 2.2rem;
    }
    @media (max-width: 800px) {
      .sections-grid {
        grid-template-columns: 1fr;
      }
    }
    .panel {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.8rem;
      box-shadow: 0 4px 16px rgba(92, 40, 130, 0.04);
    }
    .panel h2 {
      font-size: 1.25rem;
      color: var(--brand-deep-purple);
      margin-bottom: 1.2rem;
      padding-bottom: 0.6rem;
      border-bottom: 2px solid #ede7f4;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .stat-row {
      margin-bottom: 1.1rem;
    }
    .stat-row-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 0.35rem;
      font-size: 0.92rem;
    }
    .stat-title {
      font-weight: 600;
      color: var(--brand-charcoal);
    }
    .stat-count {
      font-weight: 700;
      color: var(--brand-deep-purple);
      font-family: monospace;
      font-size: 0.95rem;
    }
    .stat-desc {
      font-size: 0.78rem;
      color: #716b7e;
      margin-bottom: 0.4rem;
    }
    .progress-bar-bg {
      background: #eee8f4;
      border-radius: 999px;
      height: 8px;
      overflow: hidden;
      width: 100%;
    }
    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--brand-purple), var(--brand-orange));
      border-radius: 999px;
      transition: width 0.5s ease;
    }
    /* Daily Activity Chart */
    .chart-panel {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.8rem;
      margin-bottom: 2.2rem;
      box-shadow: 0 4px 16px rgba(92, 40, 130, 0.04);
    }
    .chart-panel h2 {
      font-size: 1.25rem;
      color: var(--brand-deep-purple);
      margin-bottom: 1.2rem;
      padding-bottom: 0.6rem;
      border-bottom: 2px solid #ede7f4;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .bar-chart-container {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      height: 180px;
      padding: 1rem 0.5rem 0;
      border-bottom: 2px solid #ede7f4;
      overflow-x: auto;
    }
    .bar-col {
      flex: 1;
      min-width: 32px;
      display: flex;
      flex-direction: column;
      align-items: center;
      height: 100%;
      justify-content: flex-end;
    }
    .bar-count-label {
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--brand-deep-purple);
      margin-bottom: 4px;
    }
    .bar-pillar {
      width: 100%;
      max-width: 36px;
      background: linear-gradient(180deg, var(--brand-orange), var(--brand-purple));
      border-radius: 4px 4px 0 0;
      min-height: 4px;
      transition: height 0.3s ease;
    }
    .bar-date-label {
      font-size: 0.72rem;
      color: #6a6476;
      margin-top: 8px;
      white-space: nowrap;
      text-align: center;
    }
    /* API Link Box */
    .api-box {
      background: #f7f3fb;
      border: 1px solid #e1d6eb;
      border-radius: 12px;
      padding: 1.4rem 1.8rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 2.5rem;
    }
    .api-box-text h4 {
      font-size: 1rem;
      color: var(--brand-deep-purple);
      margin-bottom: 0.2rem;
    }
    .api-box-text p {
      font-size: 0.88rem;
      color: #555060;
    }
    .api-btn {
      background: var(--brand-purple);
      color: #ffffff;
      padding: 8px 18px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 700;
      font-size: 0.88rem;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.2s ease;
    }
    .api-btn:hover {
      background: var(--brand-deep-purple);
    }
    footer {
      background: #ffffff;
      border-top: 1px solid #ede7f4;
      padding: 2.2rem 1.5rem;
      text-align: center;
      margin-top: 3rem;
    }
    footer a {
      color: var(--brand-purple);
      text-decoration: none;
      font-weight: 600;
    }
    footer a:hover {
      color: var(--brand-orange);
      text-decoration: underline;
    }
  </style>
</head>
<body>

<header>
  <div class="logo-container">
    <a href="/"><img src="/logo.jpg" alt="Marie Haynes Consulting Inc. Logo"></a>
  </div>
  <a href="/" class="nav-back">&larr; Back to MCP Setup & Archive Explorer</a>
  <span class="badge">Anonymous Telemetry</span>
  <h1>Algorithm Update MCP — Live Usage Dashboard</h1>
  <p>Real-time, anonymous activity metrics across Claude Desktop, Antigravity, Cursor, and custom AI agents.</p>
</header>

<div class="container">

  <!-- Privacy Guarantee Banner -->
  <div class="privacy-banner">
    <h3>🔒 100% Anonymous & Zero-Knowledge Guarantee</h3>
    <p>In strict adherence to my privacy promise, this server only tallies aggregate tool counts. I <strong>never</strong> log, inspect, or store user prompts, search query strings, client URLs, website traffic data, or IP addresses. Your proprietary site analysis and client conversations remain strictly confidential within your local AI workspace.</p>
  </div>

  <!-- KPI Metrics -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-number">${stats.totalCalls.toLocaleString()}</div>
      <div class="kpi-label">Total Queries Served</div>
      <div class="kpi-sub">Aggregate tool executions</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-number">590+</div>
      <div class="kpi-label">Updates in Archive</div>
      <div class="kpi-sub">Core, Spam & AI changes</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-number">2 Active</div>
      <div class="kpi-label">Transports Supported</div>
      <div class="kpi-sub">Streamable HTTP & SSE</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-number">2012–2026</div>
      <div class="kpi-label">Archive Coverage</div>
      <div class="kpi-sub">15 years of search shifts</div>
    </div>
  </div>

  <!-- Breakdown Grid -->
  <div class="sections-grid">
    <!-- Tool Breakdown -->
    <div class="panel">
      <h2>
        <span>Tool Popularity</span>
        <span style="font-size: 0.8rem; font-weight: 500; color: #716b7e;">Total: ${stats.totalCalls}</span>
      </h2>
      ${Object.entries(toolLabels).map(([toolKey, meta]) => {
        const count = stats.byTool[toolKey] || 0;
        const pct = stats.totalCalls > 0 ? Math.round((count / stats.totalCalls) * 100) : 0;
        return `
        <div class="stat-row">
          <div class="stat-row-header">
            <span class="stat-title"><code>${meta.label}</code></span>
            <span class="stat-count">${count.toLocaleString()} <span style="font-size: 0.78rem; font-weight: 500; color: #716b7e;">(${pct}%)</span></span>
          </div>
          <div class="stat-desc">${meta.desc}</div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${pct}%;"></div>
          </div>
        </div>
        `;
      }).join('')}
    </div>

    <!-- Transport Breakdown -->
    <div class="panel">
      <h2>
        <span>Client Transports</span>
        <span style="font-size: 0.8rem; font-weight: 500; color: #716b7e;">Protocols</span>
      </h2>
      ${Object.entries(transportLabels).map(([transportKey, meta]) => {
        const count = stats.byTransport[transportKey] || 0;
        const totalTransports = Object.values(stats.byTransport).reduce((a, b) => a + b, 0);
        const pct = totalTransports > 0 ? Math.round((count / totalTransports) * 100) : 0;
        return `
        <div class="stat-row">
          <div class="stat-row-header">
            <span class="stat-title">${meta.label}</span>
            <span class="stat-count">${count.toLocaleString()} <span style="font-size: 0.78rem; font-weight: 500; color: #716b7e;">(${pct}%)</span></span>
          </div>
          <div class="stat-desc">${meta.desc}</div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${pct}%;"></div>
          </div>
        </div>
        `;
      }).join('')}
    </div>
  </div>

  <!-- Daily Activity Bar Chart -->
  <div class="chart-panel">
    <h2>
      <span>Daily Activity (Last 14 Days)</span>
      <span style="font-size: 0.82rem; font-weight: 600; color: var(--brand-purple);">Rolling 14-Day Query Volume</span>
    </h2>
    <div class="bar-chart-container">
      ${last14Days.map(item => {
        const heightPct = Math.max(Math.round((item.count / maxDaily) * 100), 4);
        return `
        <div class="bar-col">
          <span class="bar-count-label">${item.count > 0 ? item.count : ''}</span>
          <div class="bar-pillar" style="height: ${heightPct}%;" title="${item.date}: ${item.count} queries"></div>
          <span class="bar-date-label">${item.displayDate}</span>
        </div>
        `;
      }).join('')}
    </div>
  </div>

  <!-- API Feed Link -->
  <div class="api-box">
    <div class="api-box-text">
      <h4>⚡ Programmatic Developer API</h4>
      <p>Need these live usage statistics for custom monitoring or reports? Query the open JSON endpoint.</p>
    </div>
    <a href="/api/stats" target="_blank" class="api-btn">Open /api/stats (JSON) &rarr;</a>
  </div>

</div>

<footer>
  <p style="margin-bottom: 0.75rem; font-weight: 700; color: var(--brand-deep-purple); font-size: 1.05rem;">Maintained by Marie Haynes Consulting Inc.</p>
  <div style="display: flex; justify-content: center; gap: 24px; flex-wrap: wrap; margin-bottom: 1.2rem; font-size: 0.95rem;">
    <a href="/">🏠 MCP Server Home</a>
    <a href="/api/stats" target="_blank">⚡ JSON Stats Feed</a>
    <a href="https://github.com/mariehaynes/algo-update-mcp" target="_blank" rel="noopener">⭐ GitHub Open Source</a>
    <a href="https://mariehaynes.com/newsletter" target="_blank" rel="noopener">📬 Marie's Newsletter</a>
    <a href="https://mariehaynes.com/contact" target="_blank" rel="noopener">✉️ Contact Marie</a>
  </div>
  <p style="font-size: 0.82rem; opacity: 0.75;">Original Article & 15-Year Archive: <a href="https://www.mariehaynes.com/resources/algo-changes-and-more/" target="_blank">mariehaynes.com/resources/algo-changes-and-more/</a></p>
</footer>

</body>
</html>`;
}
