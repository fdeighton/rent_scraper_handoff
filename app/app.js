/* =============================================================================
   Comp Tracker SPA — recreation of the screenshot views, reskinned under the
   Fitzrovia AI Studio design system, populated from window.COMP_DATA (seed).
   No build step, no framework, no network: hand-rolled router + SVG charts.
============================================================================= */
(function () {
  "use strict";
  const D = window.COMP_DATA;
  const $view = document.getElementById("view");
  const $nav = document.getElementById("nav");

  const UNIT_TYPES = ["bachelor", "1-bed", "1-bed+den", "2-bed", "2-bed+den", "3-bed", "3-bed+den", "4-bed"];
  const TYPE_LABEL = {
    "bachelor": "Bachelor", "1-bed": "1-Bed", "1-bed+den": "1-Bed+Den",
    "2-bed": "2-Bed", "2-bed+den": "2-Bed+Den", "3-bed": "3-Bed", "3-bed+den": "3-Bed+Den", "4-bed": "4-Bed",
  };
  // Comp palette — benchmark is brand orange; comps are navy + supporting shades, dashed.
  const COMP_COLORS = ["#061031", "#2A6FDB", "#7C3AED", "#0891B2", "#1F8A5B", "#C77A0F", "#DC2626", "#4F46E5", "#0D9488", "#9333EA", "#0EA5E9", "#65A30D"];
  const BENCH_COLOR = "#FF4E31";

  // ---- icons (Lucide-style, inline so it works offline) --------------------
  const ICONS = {
    "chevron-left": '<path d="M15 18l-6-6 6-6"/>',
    "globe": '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18"/>',
    "building": '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "sun": '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>',
    "search": '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>',
    "map": '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
    "list": '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    "download": '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    "settings": '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.5L3 11a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1l.3 2.5h5l.3-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5a7 7 0 0 0 .1-1z"/>',
    "chart": '<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "check": '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
    "edit": '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    "doc": '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
  };
  const icon = (n) => `<span class="ic">${ICONS[n] ? `<svg viewBox="0 0 24 24">${ICONS[n]}</svg>` : ""}</span>`;

  // ---- helpers -------------------------------------------------------------
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const money = (n) => (n == null ? "—" : "$" + Math.round(n).toLocaleString());
  const psf = (n) => (n == null ? "—" : "$" + Number(n).toFixed(2));
  const fmtDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
    return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
  };
  const shortDate = (ymd) => {
    const d = new Date(ymd + "T00:00:00");
    return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
  };
  const bld = (id) => D.buildings[id];
  const analysisById = (id) => D.analyses.find((a) => a.id === id);

  function delta(cur, prev) {
    if (cur == null || prev == null) return "";
    const d = Math.round(cur - prev);
    if (d === 0) return `<span class="delta flat">$0</span>`;
    const cls = d > 0 ? "up" : "down";
    const arrow = d > 0 ? "▲" : "▼";
    return `<span class="delta ${cls}">${arrow} $${Math.abs(d).toLocaleString()}</span>`;
  }

  // ============================================================== Sidebar ===
  function renderNav() {
    const route = location.hash || "#/universe";
    let html = `<button class="nav-item ${route.startsWith("#/universe") ? "active" : ""}" data-go="#/universe">
        ${icon("globe")}<span class="nav-item__label">Building Universe</span></button>`;
    html += `<div class="sidebar__section">Analyses</div>`;
    for (const a of D.analyses) {
      const active = route.includes("/analysis/" + a.id);
      html += `<button class="nav-item ${active ? "active" : ""}" data-go="#/analysis/${a.id}">
          ${icon("building")}<span class="nav-item__label">${esc(a.name)}</span></button>`;
    }
    html += `<button class="nav-item" data-go="#/universe">${icon("plus")}<span class="nav-item__label">New Analysis</span></button>`;
    $nav.innerHTML = html;
    $nav.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => (location.hash = b.dataset.go)));
  }

  // ===================================================== Building Universe ===
  let buState = { q: "", view: "list" };
  function renderUniverse() {
    const ids = Object.keys(D.buildings);
    const q = buState.q.trim().toLowerCase();
    const filtered = ids
      .map((id) => D.buildings[id])
      .filter((b) => b.isActive !== false)
      .filter((b) => !q || (b.name + " " + (b.address || "") + " " + (b.city || "")).toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));

    let body;
    if (buState.view === "map") {
      body = `<div class="card"><div class="empty">${icon("map")}<br/>Map view renders on live CartoDB tiles — available in the deployed app. ${filtered.length} buildings would be plotted across Toronto, Montreal, Vancouver &amp; Mississauga.</div></div>`;
    } else {
      body = `<div class="bu-grid">${filtered.map(buCard).join("")}</div>`;
    }

    $view.innerHTML = `
      <div class="page-head">
        <div class="page-head__main">
          <h1 class="page-title">Building Universe</h1>
          <div class="page-sub">${D.counts.buildings} buildings tracked · ${D.counts.analyses} analyses · seed exported ${esc(D.generatedAt)}</div>
        </div>
        <div class="page-actions">
          <div class="search">${icon("search")}<input id="bu-search" placeholder="Search buildings, address, city…" value="${esc(buState.q)}"/></div>
          <div class="segmented">
            <button data-v="list" class="${buState.view === "list" ? "active" : ""}">List</button>
            <button data-v="map" class="${buState.view === "map" ? "active" : ""}">Map</button>
          </div>
          <button class="btn btn--accent">${icon("plus")} Add Building</button>
        </div>
      </div>
      ${body}`;

    const s = document.getElementById("bu-search");
    s.oninput = () => { buState.q = s.value; const g = $view.querySelector(".bu-grid"); if (g) g.innerHTML = idsToCards(s.value); };
    $view.querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => { buState.view = b.dataset.v; renderUniverse(); }));
  }
  function idsToCards(q) {
    q = (q || "").trim().toLowerCase();
    return Object.values(D.buildings)
      .filter((b) => b.isActive !== false)
      .filter((b) => !q || (b.name + " " + (b.address || "") + " " + (b.city || "")).toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(buCard).join("");
  }
  function buCard(b) {
    const sum = D.summary[b.id];
    const photo = `<div class="bcard__ph">${icon("building")}</div>` +
      (b.photo ? `<img src="${esc(b.photo)}" alt="" loading="lazy" onerror="this.style.display='none'"/>` : "");
    const badges = [];
    if (b.assetType) badges.push(`<span class="badge">${esc(b.assetType)}</span>`);
    if (b.yearBuilt) badges.push(`<span class="badge">Built ${b.yearBuilt}</span>`);
    if (b.unitCount) badges.push(`<span class="badge">${b.unitCount} units</span>`);
    let chips = "";
    if (sum && sum.byType) {
      chips = UNIT_TYPES.filter((t) => sum.byType[t]).slice(0, 4)
        .map((t) => `<span class="chip">${TYPE_LABEL[t]} <b>${money(sum.byType[t].avgRent)}</b></span>`).join("");
    }
    return `<div class="bcard" data-go="#/building/${b.id}" onclick="location.hash='#/building/${b.id}'">
      <div class="bcard__photo">${photo}</div>
      <div class="bcard__body">
        <div class="bcard__name">${esc(b.name)}</div>
        <div class="bcard__addr">${esc(b.address || "")}${b.city ? ", " + esc(b.city) : ""}</div>
        <div class="bcard__badges">${badges.join("")}</div>
        <div class="bcard__chips">${chips || '<span class="sub">No recent units captured</span>'}</div>
        <div class="bcard__foot">${icon("clock")} ${b.lastScrape ? "Last scraped " + fmtDate(b.lastScrape) : "Not yet scraped"}</div>
      </div>
    </div>`;
  }

  // ============================================================ Comp Table ===
  function compSetBuildings(a) {
    const list = [];
    if (a.benchmark && bld(a.benchmark)) list.push({ b: bld(a.benchmark), bench: true });
    for (const c of a.comps) if (bld(c.building)) list.push({ b: bld(c.building), bench: false, distance: c.distance });
    return list;
  }
  function presentTypes(cols) {
    const set = new Set();
    cols.forEach(({ b }) => { const s = D.summary[b.id]; if (s) Object.keys(s.byType).forEach((t) => set.add(t)); });
    return UNIT_TYPES.filter((t) => set.has(t));
  }

  function renderAnalysis(id, tab) {
    const a = analysisById(id);
    if (!a) return renderUniverse();
    tab = tab || "summary";
    const cols = compSetBuildings(a);

    const head = `
      <div class="page-head">
        <div class="page-head__main">
          <div class="eyebrow">${icon("building")} ${esc(a.assetType || "Analysis")} · ${esc(a.city || "")}</div>
          <h1 class="page-title"><span class="accent">${esc(a.name)}</span> — Competitive Analysis</h1>
          <div class="page-sub">${esc(a.address || "")}${a.city ? ", " + esc(a.city) : ""} · benchmark vs ${a.comps.length} comparable buildings</div>
        </div>
        <div class="page-actions">
          <div class="segmented">
            <button data-tab="summary" class="${tab === "summary" ? "active" : ""}">Summary</button>
            <button data-tab="trends" class="${tab === "trends" ? "active" : ""}">Rent Trends</button>
          </div>
          <button class="btn" onclick="window.print()">${icon("download")} Export PDF</button>
        </div>
      </div>`;

    $view.innerHTML = head + `<div id="tabbody"></div>`;
    $view.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => (location.hash = `#/analysis/${id}/${b.dataset.tab}`)));
    if (tab === "trends") renderTrends(a, cols);
    else renderSummary(a, cols);
  }

  function kpiStrip(a, cols) {
    const bench = cols.find((c) => c.bench);
    const benchSum = bench ? D.summary[bench.b.id] : null;
    const compSums = cols.filter((c) => !c.bench).map((c) => D.summary[c.b.id]).filter(Boolean);
    const mktRent = compSums.length ? Math.round(compSums.reduce((s, x) => s + (x.weighted ? x.weighted.avgRent : 0), 0) / compSums.length) : null;
    const mktPsf = compSums.length ? (compSums.reduce((s, x) => s + (x.weighted && x.weighted.avgPsf ? x.weighted.avgPsf : 0), 0) / compSums.length) : null;
    const bRent = benchSum && benchSum.weighted ? benchSum.weighted.avgRent : null;
    const posn = bRent != null && mktRent != null ? Math.round(((bRent - mktRent) / mktRent) * 100) : null;
    return `<div class="kpis">
      <div class="kpi"><div class="kpi__val accent tnum">${money(bRent)}</div><div class="kpi__label">Benchmark avg gross rent</div></div>
      <div class="kpi"><div class="kpi__val tnum">${money(mktRent)}</div><div class="kpi__label">Comp-set avg rent (${compSums.length})</div></div>
      <div class="kpi"><div class="kpi__val tnum">${psf(benchSum && benchSum.weighted ? benchSum.weighted.avgPsf : null)}<span style="font-size:14px">/sf</span></div><div class="kpi__label">Benchmark avg PSF · mkt ${psf(mktPsf)}</div></div>
      <div class="kpi"><div class="kpi__val ${posn != null && posn >= 0 ? "success" : ""} tnum">${posn == null ? "—" : (posn > 0 ? "+" : "") + posn + "%"}</div><div class="kpi__label">Benchmark vs market</div></div>
    </div>`;
  }

  function renderSummary(a, cols) {
    const types = presentTypes(cols);
    const colHead = cols.map(({ b, bench }) => `<th class="${bench ? "col-bench" : ""}">${esc(b.name)}${bench ? " ★" : ""}</th>`).join("");

    const cell = (c, html) => `<td class="${c.bench ? "col-bench" : ""}">${html}</td>`;
    const rowMeta = (label, fn) => `<tr><td class="rowlabel">${label}</td>${cols.map((c) => cell(c, fn(c))).join("")}</tr>`;

    let rows = "";
    rows += `<tr class="group-row"><td class="rowlabel">Property</td><td colspan="${cols.length}"></td></tr>`;
    rows += rowMeta("", (c) => {
      const b = c.b;
      const ph = b.photo ? `<img class="prop-photo" src="${esc(b.photo)}" onerror="this.style.display='none'"/>` : "";
      return `${ph}<div class="prop-name ${c.bench ? "bench" : ""}">${esc(b.name)}</div>`;
    });
    rows += rowMeta("Address", (c) => `<span class="sub">${esc(c.b.address || "—")}${c.b.city ? "<br/>" + esc(c.b.city) + ", " + esc(c.b.province || "") : ""}</span>`);
    rows += rowMeta("Year built", (c) => c.b.yearBuilt || "—");
    rows += rowMeta("Units", (c) => c.b.unitCount || "—");
    rows += rowMeta("Owner / manager", (c) => esc(c.b.owner || "—"));
    rows += rowMeta("Asset type", (c) => esc(c.b.assetType || "—"));
    rows += rowMeta("Distance to site", (c) => (c.bench ? "Benchmark" : c.distance != null ? c.distance + " m" : "—"));

    // incentives
    rows += `<tr class="incentive-row"><td class="rowlabel">Incentives</td>${cols.map((c) => {
      const s = D.summary[c.b.id];
      return `<td class="${c.bench ? "col-bench" : ""}">${s && s.incentives ? esc(s.incentives) : '<span class="sub">None advertised</span>'}</td>`;
    }).join("")}</tr>`;

    // latest snapshot group
    const benchDate = cols.map((c) => D.summary[c.b.id] && D.summary[c.b.id].date).filter(Boolean).sort().reverse()[0];
    rows += `<tr class="group-row"><td class="rowlabel">Latest snapshot</td><td colspan="${cols.length}">as of ${fmtDate(benchDate)} · gross rent, $/sf, avg size, week-over-week Δ</td></tr>`;

    for (const t of types) {
      rows += `<tr><td class="rowlabel">${TYPE_LABEL[t]}</td>${cols.map((c) => {
        const s = D.summary[c.b.id], p = D.prevSummary[c.b.id];
        const cur = s && s.byType[t] ? s.byType[t] : null;
        const prev = p && p.byType[t] ? p.byType[t] : null;
        if (!cur) return `<td class="${c.bench ? "col-bench" : ""}"><span class="sub">—</span></td>`;
        return `<td class="${c.bench ? "col-bench" : ""}">
          <div class="metric tnum">${money(cur.avgRent)}${delta(cur.avgRent, prev && prev.avgRent)}</div>
          <div class="sub tnum">${psf(cur.avgPsf)}/sf · ${cur.avgSqft || "—"} sf · n=${cur.count}</div>
        </td>`;
      }).join("")}</tr>`;
    }

    // weighted average
    rows += `<tr class="wavg"><td class="rowlabel">Weighted average</td>${cols.map((c) => {
      const s = D.summary[c.b.id], p = D.prevSummary[c.b.id];
      const cur = s && s.weighted ? s.weighted : null;
      const prev = p && p.weighted ? p.weighted : null;
      if (!cur) return `<td class="${c.bench ? "col-bench" : ""}"><span class="sub">—</span></td>`;
      return `<td class="${c.bench ? "col-bench" : ""}">
        <div class="metric tnum">${money(cur.avgRent)}${delta(cur.avgRent, prev && prev.avgRent)}</div>
        <div class="sub tnum">${psf(cur.avgPsf)}/sf · ${cur.avgSqft || "—"} sf · n=${cur.count}</div>
      </td>`;
    }).join("")}</tr>`;

    document.getElementById("tabbody").innerHTML =
      kpiStrip(a, cols) +
      `<div class="comp-wrap"><table class="comp">
        <thead><tr><th class="rowlabel">Metric</th>${colHead}</tr></thead>
        <tbody>${rows}</tbody></table></div>`;
  }

  // ============================================================== Trends =====
  let trendState = {};
  function renderTrends(a, cols) {
    const key = a.id;
    if (!trendState[key]) trendState[key] = { metric: "avgPsf", type: "__all", off: {}, from: null, to: null };
    const st = trendState[key];

    // gather all dates across series
    const allDates = new Set();
    cols.forEach((c) => (D.trends[c.b.id] || []).forEach((p) => allDates.add(p.date)));
    let dates = [...allDates].sort();
    if (!dates.length) {
      document.getElementById("tabbody").innerHTML = `<div class="card"><div class="empty">No snapshot history available for this comp set.</div></div>`;
      return;
    }
    const minD = dates[0], maxD = dates[dates.length - 1];
    if (!st.from) st.from = minD;
    if (!st.to) st.to = maxD;

    const typeOpts = ['<option value="__all">All units (weighted)</option>']
      .concat(UNIT_TYPES.map((t) => `<option value="${t}" ${st.type === t ? "selected" : ""}>${TYPE_LABEL[t]}</option>`)).join("");

    document.getElementById("tabbody").innerHTML = `
      <div class="filters">
        <label>Metric</label>
        <select id="f-metric">
          <option value="avgPsf" ${st.metric === "avgPsf" ? "selected" : ""}>Average Rent PSF</option>
          <option value="avgRent" ${st.metric === "avgRent" ? "selected" : ""}>Average Gross Rent</option>
        </select>
        <label>Unit type</label>
        <select id="f-type">${typeOpts}</select>
        <label>From</label><input type="date" id="f-from" value="${st.from}" min="${minD}" max="${maxD}"/>
        <label>To</label><input type="date" id="f-to" value="${st.to}" min="${minD}" max="${maxD}"/>
      </div>
      <div class="card chart-card">
        <h3>${st.metric === "avgPsf" ? "Average Rent PSF" : "Average Gross Rent"}${st.type !== "__all" ? " · " + TYPE_LABEL[st.type] : ""}</h3>
        <div id="chart"></div>
        <div class="legend" id="legend"></div>
      </div>`;

    const draw = () => drawChart(a, cols, st);
    document.getElementById("f-metric").onchange = (e) => { st.metric = e.target.value; renderTrends(a, cols); };
    document.getElementById("f-type").onchange = (e) => { st.type = e.target.value; renderTrends(a, cols); };
    document.getElementById("f-from").onchange = (e) => { st.from = e.target.value; draw(); };
    document.getElementById("f-to").onchange = (e) => { st.to = e.target.value; draw(); };
    draw();
  }

  function seriesValue(point, st) {
    if (st.type === "__all") return point[st.metric];
    const bt = point.byType && point.byType[st.type];
    return bt ? bt[st.metric] : null;
  }

  function drawChart(a, cols, st) {
    const W = Math.max(720, (document.getElementById("chart").clientWidth || 900));
    const H = 420, padL = 64, padR = 24, padT = 16, padB = 56;
    const dates = (() => {
      const s = new Set();
      cols.forEach((c) => (D.trends[c.b.id] || []).forEach((p) => { if (p.date >= st.from && p.date <= st.to) s.add(p.date); }));
      return [...s].sort();
    })();
    if (!dates.length) { document.getElementById("chart").innerHTML = `<div class="empty">No data in selected range.</div>`; return; }
    const xIdx = new Map(dates.map((d, i) => [d, i]));
    const x = (d) => padL + (dates.length === 1 ? (W - padL - padR) / 2 : (xIdx.get(d) / (dates.length - 1)) * (W - padL - padR));

    // collect series
    const series = cols.map((c, i) => {
      const pts = (D.trends[c.b.id] || [])
        .filter((p) => p.date >= st.from && p.date <= st.to)
        .map((p) => ({ d: p.date, v: seriesValue(p, st) }))
        .filter((p) => p.v != null && xIdx.has(p.d));
      return { id: c.b.id, name: c.b.name, bench: c.bench, color: c.bench ? BENCH_COLOR : COMP_COLORS[i % COMP_COLORS.length], pts };
    });
    const visible = series.filter((s) => !st.off[s.id] && s.pts.length);
    let vals = [];
    visible.forEach((s) => s.pts.forEach((p) => vals.push(p.v)));
    if (!vals.length) { document.getElementById("chart").innerHTML = `<div class="empty">No visible series — toggle one on in the legend.</div>`; renderLegend(a, cols, st, series); return; }
    let yMin = Math.min(...vals), yMax = Math.max(...vals);
    const pad = (yMax - yMin) * 0.12 || yMax * 0.1;
    yMin = Math.max(0, yMin - pad); yMax = yMax + pad;
    const y = (v) => padT + (1 - (v - yMin) / (yMax - yMin)) * (H - padT - padB);

    const fmtY = st.metric === "avgPsf" ? (v) => "$" + v.toFixed(2) + "/sf" : (v) => "$" + Math.round(v).toLocaleString();
    const ticks = 5;
    let grid = "";
    for (let i = 0; i <= ticks; i++) {
      const v = yMin + (i / ticks) * (yMax - yMin);
      const yy = y(v);
      grid += `<g class="grid"><line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}"/></g>
               <text class="axis-label" x="${padL - 10}" y="${yy + 4}" text-anchor="end">${fmtY(v)}</text>`;
    }
    // x labels — thin out
    const step = Math.ceil(dates.length / 14);
    let xlab = "";
    dates.forEach((d, i) => { if (i % step === 0 || i === dates.length - 1) xlab += `<text class="axis-label" x="${x(d)}" y="${H - padB + 20}" text-anchor="middle">${shortDate(d)}</text>`; });

    // lines
    let lines = "";
    // draw comps first, benchmark last (on top)
    const ordered = visible.slice().sort((s1, s2) => (s1.bench === s2.bench ? 0 : s1.bench ? 1 : -1));
    ordered.forEach((s) => {
      const pathD = s.pts.map((p, i) => (i ? "L" : "M") + x(p.d) + " " + y(p.v)).join(" ");
      const sw = s.bench ? 3 : 1.5;
      const dash = s.bench ? "" : 'stroke-dasharray="5 4"';
      lines += `<path d="${pathD}" fill="none" stroke="${s.color}" stroke-width="${sw}" ${dash} stroke-linecap="round" stroke-linejoin="round"/>`;
      s.pts.forEach((p) => {
        lines += s.bench
          ? `<circle cx="${x(p.d)}" cy="${y(p.v)}" r="3.5" fill="${s.color}"/>`
          : `<circle cx="${x(p.d)}" cy="${y(p.v)}" r="2.6" fill="#fff" stroke="${s.color}" stroke-width="1.4"/>`;
      });
    });

    document.getElementById("chart").innerHTML =
      `<svg class="linechart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
        ${grid}${xlab}<g class="axis">${lines}</g></svg>`;
    renderLegend(a, cols, st, series);
  }

  function renderLegend(a, cols, st, series) {
    const lg = document.getElementById("legend");
    lg.innerHTML = series.map((s) =>
      `<span class="lg ${st.off[s.id] ? "off" : ""}" data-id="${s.id}">
        <span class="dot" style="background:${s.color}"></span>${esc(s.name)}${s.bench ? " ★" : ""}</span>`).join("");
    lg.querySelectorAll(".lg").forEach((el) => (el.onclick = () => {
      st.off[el.dataset.id] = !st.off[el.dataset.id];
      drawChart(a, cols, st);
    }));
  }

  // ========================================================= Building Detail =
  function renderBuilding(id) {
    const b = bld(id);
    if (!b) return renderUniverse();
    const hist = D.history[id] || [];
    const total = hist.length, ok = hist.filter((h) => h.status === "success").length, err = hist.filter((h) => h.status === "error").length;
    const sum = D.summary[id];
    const q = D.quarterly[id] || [];

    const ph = `<div class="detail-media"><div class="ph">${icon("building")}</div>` +
      (b.photo ? `<img src="${esc(b.photo)}" loading="lazy" onerror="this.style.display='none'"/>` : "") + `</div>`;

    const cfg = `<div class="card"><div class="card__title">${icon("settings")} Scrape Configuration</div>
      <dl class="kv">
        <dt>URL</dt><dd>${b.scrapeUrl ? `<a href="${esc(b.scrapeUrl)}" target="_blank" style="color:var(--info)">${esc(b.scrapeUrl)}</a>` : "—"}</dd>
        <dt>Strategy</dt><dd>${esc(b.strategy || "—")}</dd>
        <dt>Initial wait</dt><dd>${b.initialWaitMs != null ? b.initialWaitMs + " ms" : "—"}</dd>
        <dt>Scroll</dt><dd>${b.scroll ? "Yes" : "No"}</dd>
      </dl></div>`;

    const stats = `<div class="card"><div class="card__title">${icon("chart")} Scrape Stats</div>
      <div class="stat3">
        <div class="s"><b class="tnum">${total}</b><span>Total scrapes</span></div>
        <div class="s ok"><b class="tnum">${ok}</b><span>Successful</span></div>
        <div class="s err"><b class="tnum">${err}</b><span>Errors</span></div>
      </div>
      <div class="sub" style="margin-top:16px">${sum ? "Last scraped " + fmtDate(sum.date) + " · " + (sum.weighted ? sum.weighted.count : 0) + " units from latest snapshot" : "No successful scrape yet"}</div>
    </div>`;

    let qrows = "";
    q.forEach((row, qi) => {
      qrows += `<tr class="qtotal" data-q="${qi}"><td>Total / Avg (${esc(row.quarter)})</td><td class="tnum">${row.activeListings}</td><td class="tnum">${row.avgSqft || "—"}</td><td class="tnum">${money(row.avgRent)}</td><td class="tnum">${psf(row.avgPsf)}</td></tr>`;
      UNIT_TYPES.filter((t) => row.byType[t]).forEach((t) => {
        const x = row.byType[t];
        qrows += `<tr class="qsub" data-parent="${qi}" style="display:none"><td>${TYPE_LABEL[t]}</td><td class="tnum">${x.count}</td><td class="tnum">${x.avgSqft || "—"}</td><td class="tnum">${money(x.avgRent)}</td><td class="tnum">${psf(x.avgPsf)}</td></tr>`;
      });
    });
    const histTable = `<div class="card"><div class="card__title">${icon("chart")} Historical Rental Market Data</div>
      ${q.length ? `<table class="hist"><thead><tr><th>Quarter</th><th>Active listings</th><th>Avg size (sf)</th><th>Avg rent</th><th>Avg PSF</th></tr></thead><tbody>${qrows}</tbody></table>` : '<div class="empty">No history.</div>'}
    </div>`;

    const scrapeHist = `<div class="card"><div class="card__title">${icon("clock")} Scrape History</div>
      <div class="scrape-hist">${hist.slice(0, 15).map((h) => `
        <div class="row">
          <span class="${h.status === "success" ? "dot-ok" : "dot-err"}">${icon(h.status === "success" ? "check" : "edit")}</span>
          <span class="when">${fmtDate(h.date)}</span>
          <span class="tnum" style="width:64px">${h.units} units</span>
          <span class="inc">${h.incentives ? esc(h.incentives) : '<span class="sub">No incentive captured</span>'}</span>
        </div>`).join("") || '<div class="empty">No scrapes recorded.</div>'}
      </div></div>`;

    $view.innerHTML = `
      <div class="page-head"><div class="page-head__main">
        <div class="eyebrow"><a href="#/universe" style="color:var(--info)">${icon("chevron-left")} Building Universe</a></div>
      </div></div>
      <div class="detail-head">
        ${ph}
        <div>
          <h1 class="page-title">${esc(b.name)}</h1>
          <div class="page-sub">${esc(b.address || "")}${b.city ? ", " + esc(b.city) + ", " + esc(b.province || "") : ""}</div>
          <div class="bcard__badges" style="margin-top:10px">
            ${b.assetType ? `<span class="badge badge--blue">${esc(b.assetType)}</span>` : ""}
            ${b.yearBuilt ? `<span class="badge">Built ${b.yearBuilt}</span>` : ""}
            ${b.unitCount ? `<span class="badge">${b.unitCount} units</span>` : ""}
            ${b.owner ? `<span class="badge badge--orange">${esc(b.owner)}</span>` : ""}
          </div>
        </div>
      </div>
      <div class="detail-grid">${cfg}${stats}</div>
      ${histTable}
      <div style="height:24px"></div>
      ${scrapeHist}`;

    $view.querySelectorAll("tr.qtotal").forEach((tr) => (tr.onclick = () => {
      tr.classList.toggle("open");
      $view.querySelectorAll(`tr.qsub[data-parent="${tr.dataset.q}"]`).forEach((r) => (r.style.display = r.style.display === "none" ? "table-row" : "none"));
    }));
  }

  // ============================================================== Router =====
  function route() {
    const h = location.hash || "#/universe";
    renderNav();
    window.scrollTo(0, 0);
    const m = h.match(/^#\/analysis\/([^/]+)(?:\/(\w+))?/);
    if (h.startsWith("#/universe")) renderUniverse();
    else if (m) renderAnalysis(m[1], m[2]);
    else if (h.startsWith("#/building/")) renderBuilding(h.split("/")[2]);
    else renderUniverse();
  }
  window.addEventListener("hashchange", route);
  window.addEventListener("resize", () => { if ((location.hash || "").includes("/trends")) route(); });
  route();
})();
