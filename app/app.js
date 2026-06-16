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
    "star": '<path d="M12 2l2.9 6.3 6.9.6-5.2 4.5 1.6 6.8L12 17.3 5.8 20.7l1.6-6.8L2.2 8.9l6.9-.6z"/>',
    "calendar": '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/>',
    "chevron-down": '<path d="M6 9l6 6 6-6"/>',
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
    const d = cur - prev;
    if (Math.round(d) === 0) return `<span class="delta flat">$0 (0.0%)</span>`;
    const cls = d > 0 ? "up" : "down";
    const pct = prev ? (Math.abs(d / prev) * 100).toFixed(1) : "0.0";
    return `<span class="delta ${cls}">$${Math.abs(Math.round(d)).toLocaleString()} (${pct}%)</span>`;
  }

  // ========================================== New Analysis (create flow) ====
  // Great-circle distance in metres — mirrors schema.sql haversine_distance().
  function haversine(la1, lo1, la2, lo2) {
    if ([la1, lo1, la2, lo2].some((v) => v == null)) return null;
    const R = 6371000, t = Math.PI / 180;
    const dLat = (la2 - la1) * t, dLng = (lo2 - lo1) * t;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(la1 * t) * Math.cos(la2 * t) * Math.sin(dLng / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  const CUSTOM_KEY = "comp_custom_analyses_v1";
  function loadCustomAnalyses() {
    try {
      const arr = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
      // Replace a matching seed analysis with the stored (edited) copy, else add.
      arr.forEach((a) => {
        const i = D.analyses.findIndex((x) => x.id === a.id);
        if (i >= 0) D.analyses[i] = a; else D.analyses.push(a);
      });
    } catch (e) {}
  }
  function saveCustomAnalyses() {
    // Persist user-created analyses AND any seed analysis the user has edited.
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(D.analyses.filter((a) => a.custom || a.edited))); } catch (e) {}
  }
  function deleteAnalysis(id) {
    const i = D.analyses.findIndex((a) => a.id === id);
    if (i >= 0) D.analyses.splice(i, 1);
    saveCustomAnalyses();
    location.hash = "#/universe";
  }
  function createAnalysis({ name, benchmark, compIds }) {
    const bb = bld(benchmark);
    const id = "custom-" + Date.now().toString(36);
    const comps = compIds.map((cid, i) => {
      const cb = bld(cid);
      return { building: cid, order: i, distance: bb && cb ? haversine(bb.lat, bb.lng, cb.lat, cb.lng) : null };
    });
    D.analyses.push({
      id, name, address: bb && bb.address, city: bb && bb.city, province: bb && bb.province,
      yearBuilt: bb && bb.yearBuilt, unitCount: bb && bb.unitCount, assetType: bb && bb.assetType,
      benchmark, order: 999, comps, custom: true,
    });
    saveCustomAnalyses();
    renderNav();
    location.hash = "#/analysis/" + id;
  }

  function openNewAnalysisModal() {
    const buildings = Object.values(D.buildings).filter((b) => b.isActive !== false).sort((a, b) => a.name.localeCompare(b.name));
    const benchSet = benchmarkIds();
    // surface Fitzrovia benchmark buildings first, then the rest
    const ordered = buildings.slice().sort((a, b) => (benchSet.has(b.id) - benchSet.has(a.id)) || a.name.localeCompare(b.name));
    const benchOpts = ordered.map((b) => `<option value="${b.id}">${esc(b.name)}${b.city ? " — " + esc(b.city) : ""}${benchSet.has(b.id) ? "  ★" : ""}</option>`).join("");

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="New Analysis">
      <div class="modal__head">
        <div class="modal__chip">${icon("building")}</div>
        <div class="modal__title">New Analysis</div>
        <button class="modal__x" data-close aria-label="Close">&times;</button>
      </div>
      <div class="modal__body">
        <div class="field" id="f-name">
          <label for="na-name">Analysis name</label>
          <input type="text" id="na-name" placeholder="e.g. Collection - Yorkville"/>
          <div class="err"></div>
        </div>
        <div class="field" id="f-bench">
          <label for="na-bench">Benchmark building <span class="sub">(★ = Fitzrovia property)</span></label>
          <select id="na-bench"><option value="">Select a building…</option>${benchOpts}</select>
          <div class="err"></div>
        </div>
        <div class="field" id="f-comps">
          <label>Comparable buildings</label>
          <div class="search" style="margin-bottom:8px">${icon("search")}<input type="text" id="na-search" placeholder="Filter buildings…"/></div>
          <div class="checklist" id="na-list"></div>
          <div class="selcount" id="na-count">0 selected</div>
          <div class="err"></div>
        </div>
      </div>
      <div class="modal__foot">
        <span class="modal-note">Saved in this browser only — not shared</span>
        <button class="btn" data-close>Cancel</button>
        <button class="btn btn--primary" id="na-create">Create analysis</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);

    const selected = new Set();
    const $ = (sel) => overlay.querySelector(sel);
    const listEl = $("#na-list"), benchSel = $("#na-bench");

    function renderList() {
      const q = ($("#na-search").value || "").trim().toLowerCase();
      const benchId = benchSel.value;
      const items = buildings.filter((b) => b.id !== benchId).filter((b) => !q || (b.name + " " + (b.city || "")).toLowerCase().includes(q));
      listEl.innerHTML = items.map((b) =>
        `<label class="ci"><input type="checkbox" value="${b.id}" ${selected.has(b.id) ? "checked" : ""}/> <span>${esc(b.name)}</span><span class="city">${esc(b.city || "")}</span></label>`).join("") || '<div class="empty">No matches</div>';
      listEl.querySelectorAll("input").forEach((cb) => (cb.onchange = () => {
        cb.checked ? selected.add(cb.value) : selected.delete(cb.value);
        $("#na-count").textContent = selected.size + " selected";
      }));
    }
    renderList();
    $("#na-search").oninput = renderList;
    benchSel.onchange = () => { selected.delete(benchSel.value); $("#na-count").textContent = selected.size + " selected"; renderList(); };

    function close() { overlay.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    overlay.querySelectorAll("[data-close]").forEach((b) => (b.onclick = close));
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    $("#na-create").onclick = () => {
      const name = $("#na-name").value.trim();
      const benchmark = benchSel.value;
      const compIds = [...selected];
      let bad = false;
      const setErr = (fid, msg) => {
        const f = $(fid), e = f.querySelector(".err");
        if (msg) { f.classList.add("invalid"); e.textContent = msg; e.style.display = "block"; bad = true; }
        else { f.classList.remove("invalid"); e.style.display = "none"; }
      };
      // error contract: validate on submit, say what to do, never lose input
      setErr("#f-name", name ? "" : "Add a name for this analysis.");
      setErr("#f-bench", benchmark ? "" : "Pick the benchmark building.");
      setErr("#f-comps", compIds.length ? "" : "Select at least one comparable building.");
      if (bad) return;
      close();
      createAnalysis({ name, benchmark, compIds });
    };
    setTimeout(() => $("#na-name").focus(), 0);
  }

  // ========================================== Add Building (create flow) =====
  const CUSTOM_B_KEY = "comp_custom_buildings_v1";
  const PROV_MAP = {
    "Ontario": "ON", "Quebec": "QC", "Québec": "QC", "British Columbia": "BC",
    "Alberta": "AB", "Manitoba": "MB", "Saskatchewan": "SK", "Nova Scotia": "NS",
    "New Brunswick": "NB", "Newfoundland and Labrador": "NL", "Prince Edward Island": "PE",
  };
  const STRATEGIES = ["playwright_render", "static_html", "tricon_api", "modal_iterate", "iframe_extract", "filter_iterate", "akamai_stealth"];

  function loadCustomBuildings() {
    try {
      const arr = JSON.parse(localStorage.getItem(CUSTOM_B_KEY) || "[]");
      arr.forEach((b) => { if (!D.buildings[b.id]) D.buildings[b.id] = b; });
    } catch (e) {}
  }
  function saveCustomBuildings() {
    try { localStorage.setItem(CUSTOM_B_KEY, JSON.stringify(Object.values(D.buildings).filter((b) => b.custom))); } catch (e) {}
  }
  function createBuilding(b) {
    const id = "cb-" + Date.now().toString(36);
    D.buildings[id] = {
      id, name: b.name, address: b.address || null, city: b.city || null, province: b.province || null,
      lat: b.lat != null ? +b.lat : null, lng: b.lng != null ? +b.lng : null, photo: null,
      yearBuilt: b.yearBuilt || null, unitCount: b.unitCount || null, owner: b.owner || null,
      assetType: b.assetType || null, scrapeUrl: b.scrapeUrl || null,
      strategy: b.scrapeUrl ? (b.strategy || "playwright_render") : null,
      initialWaitMs: null, scroll: null, isActive: true, lastScrape: null, custom: true,
    };
    saveCustomBuildings();
    location.hash = "#/building/" + id;
  }
  function deleteBuilding(id) {
    if (!D.buildings[id]) return;
    delete D.buildings[id];
    saveCustomBuildings();
    location.hash = "#/universe";
  }

  async function geocodeSearch(q) {
    const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=ca&q=" + encodeURIComponent(q);
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }
  function geoToCandidate(g) {
    const a = g.address || {};
    const city = a.city || a.town || a.village || a.municipality || a.county || "";
    const prov = PROV_MAP[a.state] || a.state || "";
    const street = [a.house_number, a.road].filter(Boolean).join(" ");
    const nameGuess = a.building || a.amenity || (g.display_name || "").split(",")[0];
    return { name: nameGuess, address: street || (g.display_name || "").split(",").slice(0, 1).join(""), city, province: prov, lat: g.lat, lng: g.lon, display: g.display_name };
  }

  function openAddBuildingModal() {
    const stratOpts = STRATEGIES.map((s) => `<option value="${s}">${s}</option>`).join("");
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="Add Building">
      <div class="modal__head">
        <div class="modal__chip">${icon("building")}</div>
        <div class="modal__title">Add Building</div>
        <button class="modal__x" data-close aria-label="Close">&times;</button>
      </div>
      <div class="modal__body">
        <div class="field">
          <label for="ab-q">Find the building <span class="sub">(search by name + address, e.g. “500 Wellington West Toronto”)</span></label>
          <div class="ab-searchrow">
            <input type="text" id="ab-q" placeholder="Search name or address…"/>
            <button class="btn btn--primary" id="ab-search" type="button">${icon("search")} Search</button>
          </div>
          <div class="geo-results" id="ab-results" style="display:none"></div>
          <div class="geo-note" id="ab-note"></div>
        </div>
        <hr class="modal-sep"/>
        <div class="field" id="f-bname"><label for="ab-name">Building name *</label><input type="text" id="ab-name" placeholder="The Selby"/><div class="err"></div></div>
        <div class="field"><label for="ab-addr">Address</label><input type="text" id="ab-addr" placeholder="592 Sherbourne St"/></div>
        <div class="field-row">
          <div class="field"><label for="ab-city">City</label><input type="text" id="ab-city"/></div>
          <div class="field"><label for="ab-prov">Province</label><input type="text" id="ab-prov" placeholder="ON"/></div>
        </div>
        <div class="field-row">
          <div class="field"><label for="ab-asset">Asset type</label>
            <select id="ab-asset"><option value="">—</option><option>PBR</option><option>Condo</option><option>Other</option></select></div>
          <div class="field"><label for="ab-year">Year built</label><input type="text" id="ab-year" inputmode="numeric"/></div>
          <div class="field"><label for="ab-units">Units</label><input type="text" id="ab-units" inputmode="numeric"/></div>
        </div>
        <div class="field"><label for="ab-owner">Owner / manager</label><input type="text" id="ab-owner"/></div>
        <hr class="modal-sep"/>
        <div class="field"><label for="ab-surl">Scrape URL <span class="sub">(the page that lists available units)</span></label><input type="text" id="ab-surl" placeholder="https://…/floorplans"/></div>
        <div class="field"><label for="ab-strat">Scrape strategy</label>
          <select id="ab-strat">${stratOpts}</select>
          <div class="geo-note">Pick a best guess now; the scraper's onboarding (debug_url.py + new-site skill) confirms/auto-tunes this once API keys are configured. Auto-detection can't run in the browser.</div>
        </div>
      </div>
      <div class="modal__foot">
        <span class="modal-note">Saved in this browser only — not shared</span>
        <button class="btn" data-close>Cancel</button>
        <button class="btn btn--primary" id="ab-create">Add building</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    const $ = (s) => overlay.querySelector(s);

    function fill(c) {
      if (c.name && !$("#ab-name").value) $("#ab-name").value = c.name;
      $("#ab-addr").value = c.address || "";
      $("#ab-city").value = c.city || "";
      $("#ab-prov").value = c.province || "";
      $("#ab-name")._lat = c.lat; $("#ab-name")._lng = c.lng;
      $("#ab-note").textContent = c.lat ? `Location set: ${(+c.lat).toFixed(5)}, ${(+c.lng).toFixed(5)} — will appear on the map.` : "";
    }
    $("#ab-search").onclick = async () => {
      const q = $("#ab-q").value.trim();
      if (!q) return;
      const res = $("#ab-results"), note = $("#ab-note");
      res.style.display = "block"; res.innerHTML = '<div class="geo-loading">Searching OpenStreetMap…</div>'; note.textContent = "";
      try {
        const data = await geocodeSearch(q);
        if (!data.length) { res.innerHTML = '<div class="geo-empty">No matches — enter details manually below.</div>'; return; }
        const cands = data.map(geoToCandidate);
        res.innerHTML = cands.map((c, i) => `<button type="button" class="geo-item" data-i="${i}"><b>${esc(c.name || "(unnamed)")}</b><span>${esc(c.display)}</span></button>`).join("");
        res.querySelectorAll(".geo-item").forEach((el) => (el.onclick = () => {
          fill(cands[+el.dataset.i]);
          res.querySelectorAll(".geo-item").forEach((x) => x.classList.toggle("sel", x === el));
        }));
      } catch (e) {
        res.innerHTML = `<div class="geo-empty">Search unavailable (${esc(e.message)}). You can still enter details manually below.</div>`;
      }
    };
    $("#ab-q").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); $("#ab-search").onclick(); } };

    function close() { overlay.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    overlay.querySelectorAll("[data-close]").forEach((b) => (b.onclick = close));
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    $("#ab-create").onclick = () => {
      const name = $("#ab-name").value.trim();
      const f = $("#f-bname"), err = f.querySelector(".err");
      if (!name) { f.classList.add("invalid"); err.textContent = "Enter the building name."; err.style.display = "block"; return; }
      const toNum = (v) => { const n = parseInt(String(v).replace(/[^\d]/g, ""), 10); return isNaN(n) ? null : n; };
      close();
      createBuilding({
        name, address: $("#ab-addr").value.trim(), city: $("#ab-city").value.trim(), province: $("#ab-prov").value.trim(),
        assetType: $("#ab-asset").value, yearBuilt: toNum($("#ab-year").value), unitCount: toNum($("#ab-units").value),
        owner: $("#ab-owner").value.trim(), scrapeUrl: $("#ab-surl").value.trim(), strategy: $("#ab-strat").value,
        lat: $("#ab-name")._lat, lng: $("#ab-name")._lng,
      });
    };
    setTimeout(() => $("#ab-q").focus(), 0);
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
          ${icon("building")}<span class="nav-item__label">${esc(a.name)}</span>${a.custom ? '<span class="nav-tag">custom</span>' : ""}</button>`;
    }
    html += `<button class="nav-item" data-action="new-analysis">${icon("plus")}<span class="nav-item__label">New Analysis</span></button>`;
    $nav.innerHTML = html;
    $nav.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => (location.hash = b.dataset.go)));
    $nav.querySelectorAll('[data-action="new-analysis"]').forEach((b) => (b.onclick = openNewAnalysisModal));
  }

  // ===================================================== Building Universe ===
  let buState = { q: "", view: "list", city: "__all", bucket: "__all" };
  let uMap = null, uCluster = null, uLines = null;
  const benchmarkIds = () => new Set(D.analyses.map((a) => a.benchmark));

  // Buildings shown on the map given the current search + comp-set bucket.
  // In bucket mode we show one analysis's benchmark (orange) + its comps (navy),
  // and expose the benchmark as the "anchor" so we can draw connector lines.
  function bucketBuildings() {
    const q = (buState.q || "").trim().toLowerCase();
    const match = (b) => !q || (b.name + " " + (b.address || "") + " " + (b.city || "")).toLowerCase().includes(q);
    if (buState.bucket && buState.bucket !== "__all") {
      const a = analysisById(buState.bucket);
      const ids = [];
      if (a) { if (a.benchmark) ids.push(a.benchmark); a.comps.forEach((c) => ids.push(c.building)); }
      const list = ids.map((id) => bld(id)).filter(Boolean).filter(match);
      const anchor = a && a.benchmark ? bld(a.benchmark) : null;
      return { list, benchSet: new Set(a && a.benchmark ? [a.benchmark] : []), anchor };
    }
    return { list: universeList(buState.q), benchSet: benchmarkIds(), anchor: null };
  }

  function universeList(q) {
    q = (q || "").trim().toLowerCase();
    return Object.values(D.buildings)
      .filter((b) => b.isActive !== false)
      .filter((b) => !q || (b.name + " " + (b.address || "") + " " + (b.city || "")).toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function destroyMap() {
    if (uMap) { try { uMap.remove(); } catch (e) {} }
    uMap = null; uCluster = null; uLines = null;
  }
  function renderUniverse() {
    destroyMap();
    const filtered = universeList(buState.q);
    const hasLeaflet = typeof window.L !== "undefined";

    let body;
    if (buState.view === "map") {
      body = hasLeaflet ? mapShellHtml(filtered) :
        `<div class="card"><div class="empty">${icon("map")}<br/>The map needs the Leaflet library + CartoDB tiles, which load over the network. You appear to be offline — switch to List view, or reopen with a connection.</div></div>`;
    } else {
      body = `<div class="bu-grid">${filtered.map(buCard).join("")}</div>`;
    }

    $view.innerHTML = `
      <div class="page-head">
        <div class="page-head__main">
          <h1 class="page-title">Building Universe</h1>
          <div class="page-sub">${universeList("").length} buildings tracked · ${D.analyses.length} analyses · seed exported ${esc(D.generatedAt)}</div>
        </div>
        <div class="page-actions">
          <div class="search">${icon("search")}<input id="bu-search" placeholder="Search buildings, address, city…" value="${esc(buState.q)}"/></div>
          <div class="segmented">
            <button data-v="list" class="${buState.view === "list" ? "active" : ""}">List</button>
            <button data-v="map" class="${buState.view === "map" ? "active" : ""}">Map</button>
          </div>
          <button class="btn btn--accent" id="bu-add">${icon("plus")} Add Building</button>
        </div>
      </div>
      ${body}`;

    const s = document.getElementById("bu-search");
    s.oninput = () => {
      buState.q = s.value;
      if (buState.view === "map" && uCluster) setUniverseMarkers();
      else { const g = $view.querySelector(".bu-grid"); if (g) g.innerHTML = idsToCards(s.value); }
    };
    $view.querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => { buState.view = b.dataset.v; renderUniverse(); }));
    const addBtn = document.getElementById("bu-add");
    if (addBtn) addBtn.onclick = openAddBuildingModal;

    if (buState.view === "map" && hasLeaflet) wireMap(filtered);
  }
  function idsToCards(q) { return universeList(q).map(buCard).join(""); }

  // ---- Map (Leaflet + CartoDB Positron, branded markers) -------------------
  function mapCities() {
    const counts = {};
    universeList("").forEach((b) => { if (b.lat != null && b.city) counts[b.city] = (counts[b.city] || 0) + 1; });
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  }
  function mapShellHtml(list) {
    const cityBtns = ['<button class="city-btn ' + (buState.city === "__all" ? "active" : "") + '" data-city="__all">All</button>']
      .concat(mapCities().map((c) => `<button class="city-btn ${buState.city === c ? "active" : ""}" data-city="${esc(c)}">${esc(c)}</button>`)).join("");
    const bucketOpts = ['<option value="__all">All buildings</option>']
      .concat(D.analyses.map((a) => `<option value="${a.id}" ${buState.bucket === a.id ? "selected" : ""}>${esc(a.name)} (${a.comps.length} comps)</option>`)).join("");
    const inBucket = buState.bucket && buState.bucket !== "__all";
    return `<div class="map-shell">
      <div class="map-toolbar">
        <div class="bucket-pick">
          <label for="bu-bucket">Compare set</label>
          <select id="bu-bucket">${bucketOpts}</select>
        </div>
        <div class="city-btns" ${inBucket ? 'style="opacity:.5;pointer-events:none"' : ""}>${cityBtns}</div>
        <div class="map-legend">
          <span class="lg"><span class="swatch bench"></span> ${inBucket ? "Benchmark" : "Fitzrovia benchmark"}</span>
          <span class="lg"><span class="swatch comp"></span> ${inBucket ? "Comp in set" : "Competitor"}</span>
          ${inBucket ? '<span class="lg"><span class="swatch line"></span> Compared to</span>' : ""}
        </div>
      </div>
      <div id="bu-map"></div>
    </div>`;
  }
  function markerIcon(isBench) {
    const glyph = isBench ? ICONS.star : ICONS.building;
    return window.L.divIcon({
      className: "",
      html: `<div class="mk ${isBench ? "mk--bench" : "mk--comp"}"><svg viewBox="0 0 24 24">${glyph}</svg></div>`,
      iconSize: isBench ? [38, 38] : [30, 30],
      iconAnchor: isBench ? [19, 19] : [15, 15],
    });
  }
  function clusterIcon(cluster) {
    const n = cluster.getChildCount();
    const size = n < 10 ? 34 : n < 50 ? 42 : 50;
    return window.L.divIcon({
      className: "",
      html: `<div class="mk-cluster" style="width:${size}px;height:${size}px"><div>${n}</div></div>`,
      iconSize: [size, size],
    });
  }
  // Light hover hint (ephemeral). Rich detail lives in the click popup below.
  function tipHtml(b) {
    return `<div class="mk-tip__inner"><div><div class="mk-tip__name">${esc(b.name)}</div><div class="mk-tip__meta">${esc(b.city || "")} · click for details</div></div></div>`;
  }
  // Persistent popup opened on marker click — stays open until a major change
  // (view toggle / bucket / search / city / navigation) rebuilds the layer.
  function popupHtml(b) {
    const sum = D.summary[b.id];
    const photo = b.photo ? `<img class="pop-photo" src="${esc(b.photo)}" onerror="this.style.display='none'"/>` : "";
    const badges = [b.assetType, b.yearBuilt ? "Built " + b.yearBuilt : null, b.unitCount ? b.unitCount + " units" : null]
      .filter(Boolean).map((x) => `<span class="badge">${esc(x)}</span>`).join("");
    const stats = sum && sum.weighted
      ? `<div class="pop-stats">
           <div><b class="tnum">${money(sum.weighted.avgRent)}</b><span>avg gross rent</span></div>
           <div><b class="tnum">${psf(sum.weighted.avgPsf)}/sf</b><span>avg PSF</span></div>
           <div><b class="tnum">${sum.weighted.count}</b><span>units</span></div>
         </div>` : "";
    const inc = sum && sum.incentives ? `<div class="pop-inc">${esc(sum.incentives)}</div>` : "";
    const dateline = sum ? `<div class="pop-date">Latest snapshot ${fmtDate(sum.date)}</div>` : `<div class="pop-date">No successful scrape yet</div>`;
    return `<div class="pop">
      ${photo}
      <div class="pop-name">${esc(b.name)}</div>
      <div class="pop-addr">${esc(b.address || "")}${b.city ? ", " + esc(b.city) : ""}</div>
      <div class="pop-badges">${badges}</div>
      ${stats}${inc}${dateline}
      <a class="pop-btn" href="#/building/${b.id}">View building →</a>
    </div>`;
  }
  function setUniverseMarkers() {
    if (!uCluster) return;
    const { list, benchSet, anchor } = bucketBuildings();
    uCluster.clearLayers();
    if (uLines) uLines.clearLayers();
    const pts = [];

    // connector lines benchmark -> each comp (only in bucket mode)
    if (anchor && anchor.lat != null && uLines) {
      list.forEach((b) => {
        if (b.id === anchor.id || b.lat == null || b.lng == null) return;
        window.L.polyline([[anchor.lat, anchor.lng], [b.lat, b.lng]], {
          color: "#1F2750", weight: 1.5, opacity: 0.35, dashArray: "4 5", interactive: false,
        }).addTo(uLines);
      });
    }

    list.forEach((b) => {
      if (b.lat == null || b.lng == null) return;
      const m = window.L.marker([b.lat, b.lng], { icon: markerIcon(benchSet.has(b.id)) });
      m.bindTooltip(tipHtml(b), { direction: "top", offset: [0, -16], className: "mk-tip", opacity: 1 });
      m.bindPopup(popupHtml(b), {
        className: "mk-pop", closeButton: true, closeOnClick: false, autoClose: true,
        minWidth: 232, maxWidth: 264, offset: [0, -12],
      });
      // hide the hover hint while the persistent popup is open for this marker
      m.on("popupopen", () => m.closeTooltip());
      uCluster.addLayer(m);
      pts.push([b.lat, b.lng]);
    });
    if (pts.length) uMap.fitBounds(pts, { padding: [50, 50], maxZoom: 15 });
    else uMap.setView([43.7, -79.4], 11);
  }
  function wireMap(list) {
    const L = window.L;
    uMap = L.map("bu-map", { zoomControl: true, scrollWheelZoom: true, attributionControl: true });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd", maxZoom: 19, attribution: "&copy; OpenStreetMap, &copy; CARTO",
    }).addTo(uMap);
    uLines = L.layerGroup().addTo(uMap);
    uCluster = L.markerClusterGroup
      ? L.markerClusterGroup({ iconCreateFunction: clusterIcon, maxClusterRadius: 48, showCoverageOnHover: false, spiderfyOnMaxZoom: true })
      : L.layerGroup();
    uMap.addLayer(uCluster);
    setUniverseMarkers();
    setTimeout(() => uMap && uMap.invalidateSize(), 60);

    const bucketSel = document.getElementById("bu-bucket");
    if (bucketSel) bucketSel.onchange = () => {
      buState.bucket = bucketSel.value;
      buState.city = "__all";
      renderUniverse(); // re-render so toolbar (city lock, legend) reflects bucket mode
    };

    $view.querySelectorAll("[data-city]").forEach((btn) => (btn.onclick = () => {
      buState.city = btn.dataset.city;
      $view.querySelectorAll("[data-city]").forEach((x) => x.classList.toggle("active", x === btn));
      const subset = bucketBuildings().list.filter((b) => b.lat != null && (buState.city === "__all" || b.city === buState.city)).map((b) => [b.lat, b.lng]);
      if (subset.length && uMap) uMap.fitBounds(subset, { padding: [40, 40], maxZoom: buState.city === "__all" ? 14 : 13 });
    }));
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

  // ---- Historical snapshot selection ---------------------------------------
  const snapState = {}; // analysisId -> selected snapshot date (YYYY-MM-DD)

  // Run dates offered in the picker = the benchmark's recent snapshot dates
  // (newest first); fall back to the union of comp dates if no benchmark history.
  function runDates(a) {
    const snaps = D.snapshots || {};
    if (a.benchmark && snaps[a.benchmark] && snaps[a.benchmark].length) return snaps[a.benchmark].map((s) => s.date);
    const set = new Set();
    a.comps.forEach((c) => (snaps[c.building] || []).forEach((s) => set.add(s.date)));
    return [...set].sort().reverse().slice(0, 8);
  }
  // A building's snapshot as of `date` (the most recent on/before it) + the one before, for Δ.
  function snapshotAt(id, date) {
    const list = (D.snapshots || {})[id] || []; // newest first
    const i = list.findIndex((s) => s.date <= date);
    if (i === -1) return { cur: null, prev: null };
    return { cur: list[i], prev: list[i + 1] || null };
  }
  // Unify: with a snapDate use the historical snapshot; otherwise the latest summary.
  function colSnap(id, snapDate) {
    if (snapDate) return snapshotAt(id, snapDate);
    const s = D.summary[id], p = D.prevSummary[id];
    return {
      cur: s ? { date: s.date, incentives: s.incentives, byType: s.byType, weighted: s.weighted } : null,
      prev: p ? { byType: p.byType, weighted: p.weighted } : null,
    };
  }
  const selectedSnap = (a) => snapState[a.id] || (runDates(a)[0] || null);

  // ---- Add existing universe buildings to an analysis's comp set -----------
  function addCompsToAnalysis(a, ids) {
    const bb = bld(a.benchmark);
    let order = a.comps.length;
    ids.forEach((id) => {
      if (id === a.benchmark || a.comps.some((c) => c.building === id)) return;
      const cb = bld(id);
      const dist = bb && cb && bb.lat != null && cb.lat != null ? haversine(bb.lat, bb.lng, cb.lat, cb.lng) : null;
      a.comps.push({ building: id, order: order++, distance: dist });
    });
    a.edited = true;          // persist edits to seed analyses too (see loadCustomAnalyses)
    saveCustomAnalyses();
  }

  function openAddCompModal(a) {
    const existing = new Set([a.benchmark, ...a.comps.map((c) => c.building)]);
    const buildings = Object.values(D.buildings)
      .filter((b) => b.isActive !== false && !existing.has(b.id))
      .sort((x, y) => x.name.localeCompare(y.name));

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="Add buildings to comp set">
      <div class="modal__head">
        <div class="modal__chip">${icon("plus")}</div>
        <div class="modal__title">Add building to comp set</div>
        <button class="modal__x" data-close aria-label="Close">&times;</button>
      </div>
      <div class="modal__body">
        <div class="field">
          <label>Buildings from the universe <span class="sub">(buildings already in this set are hidden)</span></label>
          <div class="search" style="margin-bottom:8px">${icon("search")}<input type="text" id="ac-search" placeholder="Filter buildings…"/></div>
          <div class="checklist" id="ac-list"></div>
          <div class="selcount" id="ac-count">0 selected</div>
        </div>
      </div>
      <div class="modal__foot">
        <span class="modal-note">Saved in this browser only — not shared</span>
        <button class="btn" data-close>Cancel</button>
        <button class="btn btn--primary" id="ac-add">Add to set</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);

    const selected = new Set();
    const $ = (sel) => overlay.querySelector(sel);
    const listEl = $("#ac-list");
    function renderList() {
      const q = ($("#ac-search").value || "").trim().toLowerCase();
      const items = buildings.filter((b) => !q || (b.name + " " + (b.city || "")).toLowerCase().includes(q));
      listEl.innerHTML = items.map((b) =>
        `<label class="ci"><input type="checkbox" value="${b.id}" ${selected.has(b.id) ? "checked" : ""}/> <span>${esc(b.name)}</span><span class="city">${esc(b.city || "")}</span></label>`).join("") || '<div class="empty">No matches</div>';
      listEl.querySelectorAll("input").forEach((cb) => (cb.onchange = () => {
        cb.checked ? selected.add(cb.value) : selected.delete(cb.value);
        $("#ac-count").textContent = selected.size + " selected";
      }));
    }
    renderList();
    $("#ac-search").oninput = renderList;

    function close() { overlay.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    overlay.querySelectorAll("[data-close]").forEach((b) => (b.onclick = close));
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    $("#ac-add").onclick = () => {
      if (selected.size) addCompsToAnalysis(a, [...selected]);
      close();
      route(); // re-render the current analysis page with the new comps
    };
  }

  // ---- Excel (CSV) export of the comp set ----------------------------------
  function csvCell(v) {
    const s = v == null ? "" : String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function downloadFile(name, content, mime) {
    const blob = new Blob([content], { type: mime + ";charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = name;
    document.body.appendChild(link); link.click();
    setTimeout(() => { URL.revokeObjectURL(url); link.remove(); }, 0);
  }
  function exportAnalysisExcel(a) {
    const cols = compSetBuildings(a);
    const snap = selectedSnap(a);
    const types = presentTypes(cols);
    const bench = bld(a.benchmark);
    const rows = [];
    rows.push(["Competitive Analysis", a.name]);
    rows.push(["Benchmark", bench ? bench.name : ""]);
    rows.push(["Snapshot", snap ? fmtDate(snap) : "Latest"]);
    rows.push(["Comparables", String(cols.filter((c) => !c.bench).length)]);
    rows.push([]);
    rows.push(["Building", "Role", "Address", "City", "Year built", "Units", "Owner / manager", "Asset type",
      "Distance (m)", "Unit type", "Avg rent ($/mo)", "Avg PSF ($/sf)", "Avg size (sf)", "Δ rent ($)", "Δ rent (%)", "Incentives", "Snapshot date"]);
    cols.forEach((c) => {
      const { cur, prev } = colSnap(c.b.id, snap);
      const inc = cur && cur.incentives ? cur.incentives : "";
      const sdate = cur && cur.date ? cur.date : (snap || "");
      const base = [c.b.name, c.bench ? "Subject" : "Comp", c.b.address || "", c.b.city || "", c.b.yearBuilt || "",
        c.b.unitCount || "", c.b.owner || "", c.b.assetType || "", c.bench ? "Benchmark" : (c.distance != null ? c.distance : "")];
      const addMetric = (label, m, p, withInc) => {
        if (!m || m.avgRent == null) return;
        let dRent = "", dPct = "";
        if (p && p.avgRent != null) {
          dRent = Math.round(m.avgRent - p.avgRent);
          dPct = p.avgRent ? (((m.avgRent - p.avgRent) / p.avgRent) * 100).toFixed(1) : "";
        }
        rows.push([...base, label, Math.round(m.avgRent), m.avgPsf != null ? Number(m.avgPsf).toFixed(2) : "",
          m.avgSqft != null ? m.avgSqft : "", dRent, dPct, withInc ? inc : "", sdate]);
      };
      types.forEach((t) => addMetric(TYPE_LABEL[t], cur && cur.byType && cur.byType[t], prev && prev.byType && prev.byType[t], false));
      addMetric("Weighted average", cur && cur.weighted, prev && prev.weighted, true);
    });
    const csv = "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
    const safe = (a.name || "analysis").replace(/[^\w\- ]+/g, "").trim() || "analysis";
    downloadFile(`${safe} — comp analysis.csv`, csv, "text/csv");
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
          <button class="btn" id="a-addcomp">${icon("plus")} Add building</button>
          <button class="btn" id="a-map">${icon("map")} Map</button>
          <button class="btn" id="a-xlsx">${icon("download")} Excel</button>
          ${a.custom ? `<button class="btn" id="a-remove">Remove</button>` : ""}
          <button class="btn btn--accent" id="a-export">${icon("download")} Export PDF</button>
        </div>
      </div>`;

    $view.innerHTML = head + `<div id="tabbody"></div>`;
    $view.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => (location.hash = `#/analysis/${id}/${b.dataset.tab}`)));
    const rm = document.getElementById("a-remove");
    if (rm) rm.onclick = () => { if (confirm(`Remove the "${a.name}" analysis? This only deletes your custom analysis, not any building data.`)) deleteAnalysis(id); };
    const ex = document.getElementById("a-export");
    if (ex) ex.onclick = () => openReport(a);
    const addc = document.getElementById("a-addcomp");
    if (addc) addc.onclick = () => openAddCompModal(a);
    const mapb = document.getElementById("a-map");
    if (mapb) mapb.onclick = () => { buState.bucket = a.id; buState.view = "map"; buState.city = "__all"; location.hash = "#/universe"; };
    const xls = document.getElementById("a-xlsx");
    if (xls) xls.onclick = () => exportAnalysisExcel(a);
    if (tab === "trends") renderTrends(a, cols);
    else renderSummary(a, cols);
  }

  function kpiStrip(a, cols, snapDate) {
    const bench = cols.find((c) => c.bench);
    const benchSum = bench ? colSnap(bench.b.id, snapDate).cur : null;
    const compSums = cols.filter((c) => !c.bench).map((c) => colSnap(c.b.id, snapDate).cur).filter(Boolean);
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

  // Shared comp-table markup (used by the on-screen Summary and the PDF report).
  // snapDate selects which historical run to show (default: latest summary).
  function compTableHtml(cols, types, snapDate, minWidth, pdf) {
    types = types || presentTypes(cols);
    const sm = {}; cols.forEach((c) => (sm[c.b.id] = colSnap(c.b.id, snapDate)));
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

    // incentives (for the selected snapshot)
    rows += `<tr class="incentive-row"><td class="rowlabel">Incentives</td>${cols.map((c) => {
      const s = sm[c.b.id].cur;
      return `<td class="${c.bench ? "col-bench" : ""}">${s && s.incentives ? esc(s.incentives) : '<span class="sub">None advertised</span>'}</td>`;
    }).join("")}</tr>`;

    // snapshot group (selected run)
    const labelDate = snapDate || cols.map((c) => D.summary[c.b.id] && D.summary[c.b.id].date).filter(Boolean).sort().reverse()[0];
    const snapHint = pdf ? "" : " · click a cell to see its listings";
    rows += `<tr class="group-row"><td class="rowlabel">Snapshot</td><td colspan="${cols.length}">as of ${fmtDate(labelDate)} · gross rent, $/sf, avg size, vs prior scrape Δ${snapHint}</td></tr>`;

    // one metric cell — clickable to drill into the individual listings behind the average
    const metricCell = (c, cur, prev, type) => {
      if (!cur) return `<td class="${c.bench ? "col-bench" : ""}"><span class="sub">—</span></td>`;
      return `<td class="${c.bench ? "col-bench" : ""} td-click" data-bid="${c.b.id}" data-type="${type}" data-snap="${labelDate || ""}">
        <div class="metric tnum">${money(cur.avgRent)}${delta(cur.avgRent, prev && prev.avgRent)}</div>
        <div class="sub tnum">${psf(cur.avgPsf)}/sf · ${cur.avgSqft || "—"} sf</div>
      </td>`;
    };

    for (const t of types) {
      rows += `<tr><td class="rowlabel">${TYPE_LABEL[t]}</td>${cols.map((c) =>
        metricCell(c, sm[c.b.id].cur && sm[c.b.id].cur.byType[t], sm[c.b.id].prev && sm[c.b.id].prev.byType[t], t)
      ).join("")}</tr>`;
    }

    // weighted average
    rows += `<tr class="wavg"><td class="rowlabel">Weighted average</td>${cols.map((c) =>
      metricCell(c, sm[c.b.id].cur && sm[c.b.id].cur.weighted, sm[c.b.id].prev && sm[c.b.id].prev.weighted, "__all")
    ).join("")}</tr>`;

    const colGroup = `<colgroup><col class="c-label"/>${cols.map(() => '<col class="c-data"/>').join("")}</colgroup>`;
    const style = minWidth ? ` style="min-width:${minWidth}px"` : "";
    return `<table class="comp"${style}>${colGroup}<thead><tr><th class="rowlabel">Metric</th>${colHead}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  // Drill-down: the individual listings that rolled up into a clicked cell.
  function openUnitsModal(bid, type, snapDate) {
    const b = bld(bid); if (!b) return;
    const snap = snapshotAt(bid, snapDate).cur;
    const units = ((snap && snap.units) ? snap.units : [])
      .filter((u) => type === "__all" || u.type === type)
      .slice().sort((x, y) => y.rent - x.rent);
    const n = units.length;
    const avgRent = n ? Math.round(units.reduce((s, u) => s + u.rent, 0) / n) : null;
    const ps = units.filter((u) => u.psf != null);
    const avgPsf = ps.length ? ps.reduce((s, u) => s + u.psf, 0) / ps.length : null;
    const label = type === "__all" ? "All units (weighted)" : (TYPE_LABEL[type] || type);
    const body = n
      ? `<table class="units-tbl"><thead><tr><th>Unit / notes</th><th>Type</th><th>Sq ft</th><th>Rent</th><th>$/sf</th></tr></thead><tbody>${
          units.map((u) => `<tr><td>${esc(u.note || "—")}</td><td>${TYPE_LABEL[u.type] || u.type}</td><td class="tnum">${u.sqft || "—"}</td><td class="tnum">${money(u.rent)}</td><td class="tnum">${u.psf != null ? psf(u.psf) : "—"}</td></tr>`).join("")
        }</tbody></table>`
      : '<div class="empty">No individual listings recorded for this cell.</div>';
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `<div class="modal modal--wide" role="dialog" aria-modal="true">
      <div class="modal__head">
        <div class="modal__chip">${icon("building")}</div>
        <div><div class="modal__title">${esc(b.name)} — ${label}</div>
          <div class="sub">Snapshot ${fmtDate(snapDate)} · ${n} listing${n === 1 ? "" : "s"} · avg ${money(avgRent)}${avgPsf != null ? " · " + psf(avgPsf) + "/sf" : ""}</div></div>
        <button class="modal__x" data-close aria-label="Close">&times;</button>
      </div>
      <div class="modal__body">${body}</div>
      <div class="modal__foot"><span class="modal-note">Individual listings behind the cell average</span><button class="btn btn--primary" data-close>Close</button></div>
    </div>`;
    document.body.appendChild(overlay);
    const close = () => { overlay.remove(); document.removeEventListener("keydown", k); };
    const k = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", k);
    overlay.querySelectorAll("[data-close]").forEach((x) => (x.onclick = close));
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
  }

  function renderSummary(a, cols) {
    const dates = runDates(a);
    const sel = selectedSnap(a);
    const menu = dates.map((d, i) => `<button class="snap-opt ${d === sel ? "active" : ""}" data-d="${d}">${fmtDate(d)}${i === 0 ? " · latest" : ""}</button>`).join("");
    const picker = dates.length
      ? `<div class="snap-bar">
           <span class="snap-cap">Historical snapshot</span>
           <div class="snap-dd">
             <button class="snap-btn" id="snap-btn" aria-haspopup="true">${icon("calendar")}<span>${fmtDate(sel)}</span>${icon("chevron-down")}</button>
             <div class="snap-menu" id="snap-menu" hidden>${menu}</div>
           </div>
         </div>`
      : "";
    document.getElementById("tabbody").innerHTML =
      picker + kpiStrip(a, cols, sel) + `<div class="comp-wrap">${compTableHtml(cols, undefined, sel, 160 + cols.length * 150)}</div>`;

    const btn = document.getElementById("snap-btn");
    const dd = document.getElementById("snap-menu");
    if (btn && dd) {
      btn.onclick = (e) => { e.stopPropagation(); dd.hidden = !dd.hidden; };
      document.addEventListener("click", () => { dd.hidden = true; }, { once: true });
      dd.querySelectorAll(".snap-opt").forEach((o) => (o.onclick = () => {
        snapState[a.id] = o.dataset.d;
        renderSummary(a, cols);
      }));
    }

    const wrap = document.querySelector("#tabbody .comp-wrap");
    if (wrap) wrap.onclick = (e) => {
      const td = e.target.closest("td[data-bid]");
      if (td) openUnitsModal(td.dataset.bid, td.dataset.type, td.dataset.snap);
    };
  }

  // ====================================================== PDF Report =========
  // Ranked-bar competitive report matching docs/screenshots/05-pdf-report.png:
  // rich header + 4 median KPIs + narrative, then ALL-COHORT SUMMARY (avg rent
  // and avg PSF ranked bars per unit type, subject highlighted) and
  // WEEK-OVER-WEEK diverging bars (rent + PSF Δ vs previous scrape).
  const REPORT_TYPES = ["bachelor", "1-bed", "2-bed", "3-bed"];
  const ASSET_LONG = { PBR: "Purpose-Built Rental", Condo: "Condominium" };

  function median(arr) {
    const a = arr.filter((v) => v != null).slice().sort((x, y) => x - y);
    if (!a.length) return null;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }
  function reportDate() {
    try { return new Date().toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }); }
    catch (e) { return D.generatedAt; }
  }
  const fmtRent = (v) => "$" + Math.round(v).toLocaleString();
  const fmtPsf = (v) => "$" + Number(v).toFixed(2);
  const fmtSigned = (d, psf) => (d > 0 ? "+" : d < 0 ? "−" : "") + "$" + (psf ? Math.abs(d).toFixed(2) : Math.abs(Math.round(d)).toLocaleString());

  // Page header. opts.variant "continued" (pages 2+) swaps the eyebrow, the title
  // context (comp range), the sub line and the meta block for the page-of-N form.
  function reportHeader(a, cols, snapDate, opts) {
    opts = opts || {};
    const cont = opts.variant === "continued";
    const b = bld(a.benchmark) || {};
    const n = cols.filter((c) => !c.bench).length;
    const scrapedDate = snapDate || (D.summary[a.benchmark] ? D.summary[a.benchmark].date : null);
    const loc = `${esc(a.city || b.city || "")}${(a.province || b.province) ? ", " + esc(a.province || b.province) : ""}`;
    const scraped = esc(scrapedDate ? fmtDate(scrapedDate) : reportDate());
    const asset = esc(ASSET_LONG[a.assetType] || a.assetType || "Comparable Set");

    const eyebrow = cont ? "Export — Competitive Analysis · Continued" : "Export — Competitive Analysis · Summary";
    const ctx = cont
      ? `${opts.range ? `Comps ${opts.range} of ${opts.totalComps}` : "Detailed Comparables"} · Subject repeated for reference`
      : `${esc(a.address || b.address || "")}${loc ? ", " + loc : ""}`;
    const sub = cont
      ? `${asset} · Class A Comparables${loc ? " · " + loc : ""}`
      : `${asset} · Class A Comparables${loc ? " · " + loc : ""} · All ${n} Comps · Weighted Average Summary`;
    const meta = cont
      ? `<div>Scraped ${scraped} · Page ${opts.page} of ${opts.totalPages}</div>`
      : `<div>Scraped ${scraped} · Subject ${esc(a.name)} · Fitzrovia</div>
         <div>Comps ${n} total · Type ${esc(a.assetType || b.assetType || "—")} · Built ${a.yearBuilt || b.yearBuilt || "—"} · Units ${a.unitCount || b.unitCount || "—"}</div>
         <div><span class="rp-confidential">Internal &amp; Confidential</span></div>`;

    return `<div class="rp-head">
      <div class="rp-head-top">
        <div class="rp-eyebrow">${eyebrow}</div>
        <img class="rp-head-logo" src="fitzrovia-logo.png" alt="Fitzrovia" />
      </div>
      <div class="rp-head-row">
        <div class="rp-head-id">
          <div class="rp-title">${esc(a.name)} <span class="rp-title-sep">/</span> <span class="rp-title-ctx">${ctx}</span></div>
          <div class="rp-sub">${sub}</div>
        </div>
        <div class="rp-head-meta">${meta}</div>
      </div>
    </div>`;
  }

  function reportKpis(a, cols, snapDate) {
    const bw = (colSnap(a.benchmark, snapDate).cur || {}).weighted;
    const comps = cols.filter((c) => !c.bench).map((c) => (colSnap(c.b.id, snapDate).cur || {}).weighted).filter(Boolean);
    const n = comps.length;
    const medRent = median(comps.map((w) => w.avgRent));
    const medPsf = median(comps.map((w) => w.avgPsf));
    const sRent = bw ? bw.avgRent : null, sPsf = bw ? bw.avgPsf : null;
    const dRent = sRent != null && medRent != null ? sRent - medRent : null;
    const dPsf = sPsf != null && medPsf != null ? sPsf - medPsf : null;
    const annR = dRent == null ? "vs comp median" : `$${Math.abs(dRent).toFixed(1).replace(/\.0$/, "")} ${dRent < 0 ? "below" : "above"} comp median`;
    const annP = dPsf == null ? "vs comp median" : `$${Math.abs(dPsf).toFixed(2)} ${dPsf < 0 ? "below" : "above"} comp median`;
    const kpi = (l, v, unit, s, cls) => `<div class="rp-kpi"><div class="rp-kpi-l">${l}</div><div class="rp-kpi-v ${cls || ""}">${v}<span>${unit}</span></div><div class="rp-kpi-s">${s}</div></div>`;
    return `<div class="rp-kpis">
      ${kpi("Subject Wtd. Avg Rent", sRent != null ? fmtRent(sRent) : "—", "/mo", annR)}
      ${kpi("Subject Wtd. Avg PSF", sPsf != null ? fmtPsf(sPsf) : "—", "/sf", annP)}
      ${kpi("Comp Median Rent", medRent != null ? fmtRent(medRent) : "—", "/mo", `Across all ${n} comps`)}
      ${kpi("Comp Median PSF", medPsf != null ? fmtPsf(medPsf) : "—", "/sf", `Across all ${n} comps`)}
    </div>`;
  }

  function reportNarrative(a, cols, snapDate) {
    const bw = (colSnap(a.benchmark, snapDate).cur || {}).weighted;
    const comps = cols.filter((c) => !c.bench).map((c) => (colSnap(c.b.id, snapDate).cur || {}).weighted).filter(Boolean);
    if (!bw || !comps.length) return "";
    const medRent = median(comps.map((w) => w.avgRent)), medPsf = median(comps.map((w) => w.avgPsf));
    const dRent = bw.avgRent - medRent, dPsf = bw.avgPsf - medPsf;
    return `<div class="rp-narrative">${esc(a.name)} is priced <b>$${Math.abs(dRent).toFixed(1).replace(/\.0$/, "")}/mo ${dRent < 0 ? "below" : "above"}</b> the comp median of ${comps.length} properties. PSF is <b>${dPsf >= 0 ? "above" : "below"}</b> the cohort at <b>${fmtPsf(bw.avgPsf)}/sf</b>.</div>`;
  }

  // One column: buildings ranked descending by a unit-type metric, subject in orange.
  function rankedCol(cols, t, metric, snapDate) {
    const fmt = metric === "avgPsf" ? fmtPsf : fmtRent;
    const rows = cols.map((c) => {
      const bt = ((colSnap(c.b.id, snapDate).cur || { byType: {} }).byType || {})[t];
      return bt && bt[metric] != null ? { name: c.b.name, val: bt[metric], sub: c.bench } : null;
    }).filter(Boolean).sort((x, y) => y.val - x.val);
    const body = rows.length
      ? rows.map((r) => `<div class="rb-row">
          <div class="rb-name ${r.sub ? "sub-h" : ""}">${esc(r.name)}${r.sub ? " ★" : ""}</div>
          <div class="rb-bar-wrap"><span class="rb-bar ${r.sub ? "sub-h" : ""}" style="width:${Math.max(3, (r.val / rows[0].val) * 100)}%"></span></div>
          <div class="rb-val">${fmt(r.val)}</div>
        </div>`).join("")
      : '<div class="rp-empty">No data</div>';
    return `<div class="rp-col"><div class="rp-col-title">${TYPE_LABEL[t]}</div>${body}</div>`;
  }

  // One column: week-over-week Δ per building, diverging from centre (▲ green / ▼ red).
  function wowCol(cols, t, metric, snapDate) {
    const psfMode = metric === "avgPsf";
    const rows = cols.map((c) => {
      const sc = colSnap(c.b.id, snapDate);
      const cur = ((sc.cur || { byType: {} }).byType || {})[t];
      const prev = ((sc.prev || { byType: {} }).byType || {})[t];
      if (!cur || cur[metric] == null) return null;
      const rawd = prev && prev[metric] != null ? cur[metric] - prev[metric] : 0;
      const pctChg = prev && prev[metric] ? (rawd / prev[metric]) * 100 : null;
      return { name: c.b.name, d: psfMode ? +rawd.toFixed(2) : Math.round(rawd), pct: pctChg, sub: c.bench };
    }).filter(Boolean).sort((x, y) => y.d - x.d);
    if (!rows.length) return `<div class="rp-col"><div class="rp-col-title">${TYPE_LABEL[t]}</div><div class="rp-empty">No data</div></div>`;
    const max = Math.max(1, ...rows.map((r) => Math.abs(r.d)));
    const body = rows.map((r) => {
      const cls = r.d > 0 ? "pos" : r.d < 0 ? "neg" : "zero";
      const w = (Math.abs(r.d) / max) * 50;
      const style = r.d > 0 ? `left:50%;width:${w}%` : r.d < 0 ? `right:50%;width:${w}%` : "";
      const valMain = r.d === 0 ? "$0" : "$" + (psfMode ? Math.abs(r.d).toFixed(2) : Math.abs(Math.round(r.d)).toLocaleString());
      const pctStr = (r.d === 0 || r.pct == null) ? "" : `<span class="wb-pct">(${Math.abs(r.pct).toFixed(1)}%)</span>`;
      return `<div class="wb-row">
        <div class="wb-name ${r.sub ? "sub-h" : ""}">${esc(r.name)}${r.sub ? " ★" : ""}</div>
        <div class="wb-track"><span class="wb-center"></span><span class="wb-bar ${cls}" style="${style}"></span></div>
        <div class="wb-val ${cls}">${valMain}${pctStr}</div>
      </div>`;
    }).join("");
    return `<div class="rp-col"><div class="rp-col-title">${TYPE_LABEL[t]}</div>${body}</div>`;
  }

  const reportBand = (title, sub, badge) =>
    `<div class="rp-band"><div class="rp-band-l"><b>${title}</b> — ${sub}</div><div class="rp-band-badge">${badge}</div></div>`;
  const reportGrid = (cols, fn, metric, snapDate) => `<div class="rp-chartgrid">${REPORT_TYPES.map((t) => fn(cols, t, metric, snapDate)).join("")}</div>`;

  function closeReport() {
    const r = document.getElementById("report-root");
    if (r) r.remove();
    document.body.classList.remove("report-open");
    document.removeEventListener("keydown", reportKey);
  }
  function reportKey(e) { if (e.key === "Escape") closeReport(); }

  // Full benchmark-vs-comps data table, chunked to benchmark + <=4 comps so each
  // table fits the report width (mirrors the detailed table from the prior report).
  function reportTables(a, cols, snapDate) {
    const benchCol = cols.find((c) => c.bench);
    const compCols = cols.filter((c) => !c.bench);
    const types = presentTypes(cols);
    const CHUNK = 3; // benchmark + 3 comps = 4 cols → fits Letter width without clipping in print
    let out = "";
    if (!compCols.length) {
      out = benchCol ? `<div class="rp-tablewrap">${compTableHtml([benchCol], types, snapDate, undefined, true)}</div>` : "";
    } else {
      for (let i = 0; i < compCols.length; i += CHUNK) {
        const pageCols = benchCol ? [benchCol, ...compCols.slice(i, i + CHUNK)] : compCols.slice(i, i + CHUNK);
        const start = i + 1, end = Math.min(i + CHUNK, compCols.length);
        out += `<div class="rp-tablewrap" data-start="${start}" data-end="${end}" data-total="${compCols.length}">${compTableHtml(pageCols, types, snapDate, undefined, true)}</div>`;
      }
    }
    return out;
  }

  // Lay the report into explicit Letter pages with a fixed structure:
  //   • Page 1  — the full summary dashboard (KPIs + all four chart grids),
  //               uniformly scaled DOWN if needed so it always fits one page.
  //   • Page 2+ — the Detailed Comparables tables, each kept WHOLE (never split
  //               across a page); a table taller than a page is scaled to fit.
  // Heights are read from the live, rendered DOM. Returns false (keeping the
  // single flowing sheet) if nothing can be measured.
  function paginate(root, a, cols, snap) {
    const sheet = root.querySelector(".report-sheet");
    const head = sheet && sheet.querySelector(".rp-head");
    const body = sheet && sheet.querySelector(".rp-body");
    if (!sheet || !head || !body || typeof head.getBoundingClientRect !== "function") return false;
    const PAGE_H = 1056, PAD_TOP = 18, PAD_BOT = 28, SAFE = 6, FOOT_H = 30;
    const H = (el) => el.getBoundingClientRect().height;
    const headH = H(head);
    if (!headH) return false;

    // Split blocks into the chart dashboard vs the detail section.
    const detailSec = body.querySelector(".rp-section--flow");
    const chartBlocks = [];
    body.querySelectorAll(":scope > .rp-section").forEach((sec) => {
      if (sec !== detailSec) [...sec.children].forEach((c) => chartBlocks.push(c));
    });
    const detailKids = detailSec ? [...detailSec.children] : [];
    const detailBand = detailKids.find((c) => c.classList.contains("rp-band"));
    const detailTables = detailKids.filter((c) => c.classList.contains("rp-tablewrap"));
    if (!chartBlocks.length) return false;

    const pages = document.createElement("div");
    pages.className = "rp-pages";
    sheet.parentNode.insertBefore(pages, sheet); // live in the DOM so heights measure correctly

    // Every page reserves room for a header (added at the end with per-page
    // context) and the footer; content is packed into the remaining height.
    const newPage = () => {
      const pg = document.createElement("div"); pg.className = "rp-page";
      const content = document.createElement("div"); content.className = "rp-page-body";
      pg.appendChild(content); pages.appendChild(pg);
      return { content, avail: PAGE_H - headH - PAD_TOP - PAD_BOT - SAFE - FOOT_H };
    };

    // Shrink `inner` uniformly to fit a height (used for an oversized table).
    const fitToHeight = (inner, outer, avail) => {
      const nat = H(inner);
      if (nat > avail && nat > 0) {
        inner.style.transformOrigin = "top center";
        inner.style.transform = `scale(${(avail / nat).toFixed(4)})`;
        outer.style.height = avail + "px";
        outer.style.overflow = "hidden";
      }
    };

    // Fit `inner` to FILL the page box in BOTH dimensions: pick a layout width
    // whose scaled result fills the page width (W) AND the page height (availH).
    // Scales up short dashboards and down tall ones, so page 1 is always full.
    // Iterates with damping (height responds to width via wrapping); MAXUP keeps
    // a sparse comp set from blowing up.
    const fillBox = (inner, outer, W, availH) => {
      const MAXUP = 2.2;
      const sc = () => Math.min(MAXUP, availH / H(inner));
      let w = W;
      for (let i = 0; i < 8; i++) {
        inner.style.width = w + "px";
        const dispW = w * sc();
        if (Math.abs(dispW - W) < 2) break;     // converged: scaled width ≈ page width
        w *= Math.pow(W / dispW, 0.7);          // damped step toward filling W
      }
      inner.style.width = w + "px";
      const h0 = H(inner);                      // measure BEFORE transform (getBoundingClientRect
      const scale = Math.min(MAXUP, availH / h0); // returns the scaled box once transform is set)
      inner.style.transformOrigin = "top left";
      inner.style.transform = `scale(${scale.toFixed(4)})`;
      outer.style.width = W + "px";
      outer.style.height = h0 * scale + "px";   // displayed height = unscaled height × scale
      outer.style.overflow = "hidden";
    };

    // ---- Page 1: the whole dashboard, scaled to FILL one page -------------
    {
      const { content, avail } = newPage();
      const outer = document.createElement("div"); outer.className = "rp-fit";
      const inner = document.createElement("div"); inner.className = "rp-fit-in";
      chartBlocks.forEach((b) => inner.appendChild(b));
      outer.appendChild(inner); content.appendChild(outer);
      fillBox(inner, outer, outer.getBoundingClientRect().width, avail);
    }

    // ---- Pages 2+: whole comp tables, packed, never split -----------------
    if (detailTables.length) {
      let pg = newPage();
      if (detailBand) pg.content.appendChild(detailBand);
      let used = detailBand ? H(detailBand) : 0;
      detailTables.forEach((tw) => {
        const twH = H(tw);
        if (used > 0 && used + twH > pg.avail) { pg = newPage(); used = 0; }
        pg.content.appendChild(tw);
        if (twH > pg.avail) { // a single table taller than a page → scale it down
          const outer = document.createElement("div"); outer.className = "rp-fit";
          const inner = document.createElement("div"); inner.className = "rp-fit-in";
          pg.content.insertBefore(outer, tw); inner.appendChild(tw); outer.appendChild(inner);
          fitToHeight(inner, outer, pg.avail);
          used = pg.avail;
        } else {
          used += twH + 14; // gap between stacked tables
        }
      });
    }

    // Header (per-page context) + footer on every page.
    const pageEls = [...pages.children];
    const total = pageEls.length;
    pageEls.forEach((pg, i) => {
      let hd;
      if (i === 0) {
        hd = head; // the summary header built into the doc
      } else {
        const tws = [...pg.querySelectorAll(".rp-tablewrap[data-start]")];
        let range = null, totalComps = null;
        if (tws.length) {
          range = `${Math.min(...tws.map((t) => +t.dataset.start))}–${Math.max(...tws.map((t) => +t.dataset.end))}`;
          totalComps = tws[0].dataset.total;
        }
        const tmp = document.createElement("div");
        tmp.innerHTML = reportHeader(a, cols, snap, { variant: "continued", page: i + 1, totalPages: total, range, totalComps });
        hd = tmp.firstElementChild;
      }
      pg.insertBefore(hd, pg.firstChild);

      const label = i === 0 ? "Summary" : "Detailed Comparables";
      const foot = document.createElement("div");
      foot.className = "rp-foot";
      foot.innerHTML =
        `<div class="rp-foot-l"><span class="rp-foot-mark"></span>Page ${i + 1} of ${total} — ${label}</div>` +
        `<div class="rp-foot-r">Fitzrovia Real Estate · Confidential · Internal Use Only</div>`;
      pg.appendChild(foot);
    });

    sheet.remove();
    return true;
  }

  function openReport(a) {
    const cols = compSetBuildings(a);
    const n = cols.filter((c) => !c.bench).length;
    const snap = selectedSnap(a); // report reflects the same run selected in the Summary
    const doc = `<div class="report-sheet">
      ${reportHeader(a, cols, snap)}
      <div class="rp-body">
        <div class="rp-section">
          ${reportKpis(a, cols, snap)}
          ${reportNarrative(a, cols, snap)}
        </div>
        <div class="rp-section">
          ${reportBand("All-Cohort Summary", `All ${n} Comps · By Unit Type`, "SUMMARY")}
          <div class="rp-subtitle">Avg rent by unit type ($/mo) — all comps</div>
          ${reportGrid(cols, rankedCol, "avgRent", snap)}
          <div class="rp-subtitle">Avg PSF by unit type ($/sf) — all comps</div>
          ${reportGrid(cols, rankedCol, "avgPsf", snap)}
        </div>
        <div class="rp-section">
          ${reportBand("Week-over-Week Changes", "Rent &amp; PSF Δ vs prior scrape · By Unit Type", "WOW")}
          <div class="rp-legend">
            <span><span class="lg-sw inc"></span> Increase</span>
            <span><span class="lg-sw dec"></span> Decrease</span>
            <span><span class="lg-sw none"></span> No change</span>
            <span><span class="lg-sw subj"></span> Subject ★</span>
          </div>
          <div class="rp-subtitle">Rent — week-over-week ($/mo)</div>
          ${reportGrid(cols, wowCol, "avgRent", snap)}
          <div class="rp-subtitle">PSF — week-over-week ($/sf)</div>
          ${reportGrid(cols, wowCol, "avgPsf", snap)}
        </div>
        <div class="rp-section rp-section--flow">
          ${reportBand("Detailed Comparables", `Subject + ${n} comps · snapshot ${snap ? fmtDate(snap) : "latest"} · vs prior Δ`, "DETAIL")}
          ${reportTables(a, cols, snap)}
        </div>
      </div>
    </div>`;

    closeReport();
    const root = document.createElement("div");
    root.id = "report-root";
    root.innerHTML = `
      <div class="report-toolbar">
        <div class="rt-title">${icon("doc")} PDF Report — ${esc(a.name)}</div>
        <div class="rt-actions">
          <button class="btn" id="rp-close">Close</button>
          <button class="btn btn--accent" id="rp-print">${icon("download")} Save as PDF / Print</button>
        </div>
      </div>
      <div class="report-pages">${doc}</div>`;
    document.body.appendChild(root);
    document.body.classList.add("report-open");
    document.getElementById("rp-close").onclick = closeReport;
    document.getElementById("rp-print").onclick = () => window.print();
    document.addEventListener("keydown", reportKey);
    try { paginate(root, a, cols, snap); } catch (e) { /* measurement failed → keep single flowing sheet */ }
    root.scrollTop = 0;
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
      <div class="page-head">
        <div class="page-head__main">
          <div class="eyebrow"><a href="#/universe" style="color:var(--info)">${icon("chevron-left")} Building Universe</a></div>
        </div>
        ${b.custom ? `<div class="page-actions"><button class="btn" id="b-remove">Remove building</button></div>` : ""}
      </div>
      <div class="detail-head">
        ${ph}
        <div>
          <h1 class="page-title">${esc(b.name)}${b.custom ? ' <span class="nav-tag" style="margin-left:6px">added</span>' : ""}</h1>
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

    const brm = document.getElementById("b-remove");
    if (brm) brm.onclick = () => { if (confirm(`Remove the added building "${b.name}"? This only deletes the building you added in this app.`)) deleteBuilding(id); };

    $view.querySelectorAll("tr.qtotal").forEach((tr) => (tr.onclick = () => {
      tr.classList.toggle("open");
      $view.querySelectorAll(`tr.qsub[data-parent="${tr.dataset.q}"]`).forEach((r) => (r.style.display = r.style.display === "none" ? "table-row" : "none"));
    }));
  }

  // ============================================================== Router =====
  function route() {
    const h = location.hash || "#/universe";
    destroyMap();
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
  loadCustomBuildings();
  loadCustomAnalyses();
  route();
})();
