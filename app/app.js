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
    "pin": '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    "layout": '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
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
          <label for="na-name">Analysis name <span class="sub">(uses the benchmark name)</span></label>
          <input type="text" id="na-name" placeholder="Select a benchmark…" readonly/>
          <label class="na-custom"><input type="checkbox" id="na-custom"/> Use a custom name</label>
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
    const nameEl = $("#na-name"), customEl = $("#na-custom");
    const syncName = () => { const b = bld(benchSel.value); if (!customEl.checked) nameEl.value = b ? b.name : ""; };
    benchSel.onchange = () => {
      selected.delete(benchSel.value);
      $("#na-count").textContent = selected.size + " selected";
      syncName();  // name tracks the benchmark unless the user opted into a custom name
      renderList();
    };
    customEl.onchange = () => {
      nameEl.readOnly = !customEl.checked;
      if (customEl.checked) { nameEl.focus(); nameEl.select(); } else syncName();  // revert to benchmark name
    };

    function close() { overlay.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    overlay.querySelectorAll("[data-close]").forEach((b) => (b.onclick = close));
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    $("#na-create").onclick = () => {
      const benchmark = benchSel.value;
      const bb = bld(benchmark);
      const custom = $("#na-custom").checked;
      const name = custom ? $("#na-name").value.trim() : (bb ? bb.name : "");
      const compIds = [...selected];
      let bad = false;
      const setErr = (fid, msg) => {
        const f = $(fid), e = f.querySelector(".err");
        if (msg) { f.classList.add("invalid"); e.textContent = msg; e.style.display = "block"; bad = true; }
        else { f.classList.remove("invalid"); e.style.display = "none"; }
      };
      // error contract: validate on submit, say what to do, never lose input
      setErr("#f-name", (custom && !name) ? "Enter a custom name, or uncheck to use the benchmark." : "");
      setErr("#f-bench", benchmark ? "" : "Pick the benchmark building.");
      setErr("#f-comps", compIds.length ? "" : "Select at least one comparable building.");
      if (bad) return;
      close();
      createAnalysis({ name, benchmark, compIds });
    };
    setTimeout(() => benchSel.focus(), 0);
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
      lat: b.lat != null ? +b.lat : null, lng: b.lng != null ? +b.lng : null, photo: b.photo || null,
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
        <div class="field"><label for="ab-photo">Photo URL <span class="sub">(optional — paste an image link, e.g. the listing's hero photo)</span></label><input type="text" id="ab-photo" placeholder="https://…/building.jpg"/></div>
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
        photo: $("#ab-photo").value.trim(), lat: $("#ab-name")._lat, lng: $("#ab-name")._lng,
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
  function setUniverseMarkers(focusBench) {
    if (!uCluster) return;
    const { list, benchSet, anchor } = bucketBuildings();
    uCluster.clearLayers();
    if (uLines) uLines.clearLayers();
    const pts = [];
    let benchMarker = null;

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
      if (anchor && b.id === anchor.id) benchMarker = m;
      pts.push([b.lat, b.lng]);
    });
    if (pts.length) uMap.fitBounds(pts, { padding: [50, 50], maxZoom: 15 });
    else uMap.setView([43.7, -79.4], 11);
    // when a compare set is selected, open the benchmark popup to start
    // (de-cluster it first if needed); normal click/collapse rules apply after
    if (focusBench && benchMarker) {
      setTimeout(() => {
        try {
          const vis = uCluster.getVisibleParent ? uCluster.getVisibleParent(benchMarker) : benchMarker;
          if (vis && vis !== benchMarker && uCluster.zoomToShowLayer) uCluster.zoomToShowLayer(benchMarker, () => benchMarker.openPopup());
          else benchMarker.openPopup();
        } catch (e) {}
      }, 150);
    }
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
    setUniverseMarkers(true);  // focus the benchmark popup on (re)entry / bucket select
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
  const selectedSnap = (a) => {
    const ds = runDates(a);
    const sel = snapState[a.id];
    // ignore a remembered date that no longer exists (e.g., after a seed regen)
    return (sel && ds.includes(sel)) ? sel : (ds[0] || null);
  };

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
  function removeCompFromAnalysis(a, id) {
    const i = a.comps.findIndex((c) => c.building === id);
    if (i < 0) return;
    a.comps.splice(i, 1);
    a.removed = a.removed || [];                 // keep a history of dropped comps
    if (!a.removed.includes(id)) a.removed.push(id);
    a.edited = true;
    saveCustomAnalyses();
  }
  function readdComp(a, id) {
    a.removed = (a.removed || []).filter((x) => x !== id);
    addCompsToAnalysis(a, [id]);                  // adds back to comps + persists
  }
  function readdAllComps(a) {
    const ids = (a.removed || []).filter((id) => bld(id) && !a.comps.some((c) => c.building === id));
    a.removed = [];
    addCompsToAnalysis(a, ids);                   // adds all back + persists (also clears the bin)
  }
  // Dropped-comps bin (only rendered when there's removal history).
  function removedBinHtml(a) {
    const ids = (a.removed || []).filter((id) => bld(id) && !a.comps.some((c) => c.building === id));
    if (!ids.length) return "";
    const items = ids.map((id) => {
      const b = bld(id);
      return `<div class="dropbin__item"><span class="dropbin__name">${esc(b.name)}${b.city ? ` · ${esc(b.city)}` : ""}</span><button class="dropbin__readd" data-readd="${id}">${icon("plus")} Re-add</button></div>`;
    }).join("");
    return `<div class="dropbin">
      <div class="dropbin__head">${icon("clock")} Removed from this set <span class="dropbin__count">${ids.length}</span>
        ${ids.length > 1 ? `<button class="dropbin__readall">${icon("plus")} Re-add all</button>` : ""}</div>
      <div class="dropbin__items">${items}</div>
    </div>`;
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

  // ---- Excel export of the comp set (styled .xls, Fitzrovia palette) -------
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
    const ncomp = cols.filter((c) => !c.bench).length;

    // Institutional comp worksheet: a narrow COMPETITIVE POSITIONING table (the
    // scannable hero) over a secondary BUILDING DETAILS reference section. Metadata
    // (owner, asset, address, city, incentives) is demoted out of the primary view;
    // weighted-average rows are the visual focal point; positioning is made explicit
    // with a "vs Subject" premium/discount column and a rank. No calcs change.
    const NAVY = "#061031", ORANGE = "#FF4E31", TINT = "#EEF2FE", GREY = "#7F7F7F",
      BORDER = "#E6E6E1", GREEN = "#1F8A5B", RED = "#C0392B", LBLUE = "#D6DFFA",
      WARM = "#FAFAF7", SEP = "#C9CEDD";
    const F = "font-family:Poppins,Calibri,Arial,sans-serif;";

    // ---- snapshot helpers + headline figures
    const snapOf = (id) => colSnap(id, snap).cur;
    const benchCol = cols.find((c) => c.bench);
    const benchSum = benchCol ? snapOf(benchCol.b.id) : null;
    const bRent = benchSum && benchSum.weighted ? benchSum.weighted.avgRent : null;
    const bPsf = benchSum && benchSum.weighted ? benchSum.weighted.avgPsf : null;
    const compSums = cols.filter((c) => !c.bench).map((c) => snapOf(c.b.id)).filter(Boolean);
    const avgOf = (fn) => compSums.length ? compSums.reduce((s, x) => s + (fn(x) || 0), 0) / compSums.length : null;
    const mktRent = compSums.length ? Math.round(avgOf((x) => x.weighted && x.weighted.avgRent)) : null;
    const mktPsf = avgOf((x) => x.weighted && x.weighted.avgPsf);
    const posn = bRent != null && mktRent != null ? Math.round(((bRent - mktRent) / mktRent) * 100) : null;

    // ---- ranking by weighted avg rent (1 = highest, subject included)
    const rankable = cols.map((c) => { const s = snapOf(c.b.id); return { id: c.b.id, rent: s && s.weighted ? s.weighted.avgRent : null }; })
      .filter((x) => x.rent != null).sort((x, y) => y.rent - x.rent);
    const rankMap = {}; rankable.forEach((x, i) => (rankMap[x.id] = i + 1));
    const rankN = rankable.length;
    const subjRank = benchCol ? rankMap[benchCol.b.id] : null;
    const vsSubject = (rent) => (bRent && rent != null) ? Math.round(((rent - bRent) / bRent) * 100) : null;
    const pct = (v) => v == null ? "" : (v > 0 ? "+" : "") + v + "%";

    // ---- primary table geometry (narrow, positioning-focused)
    const PCOLS = ["Building", "Rank", "Unit type", "Avg rent ($/mo)", "Δ rent ($)", "Δ rent (%)", "Avg PSF ($/sf)", "Avg size (sf)", "Distance (m)", "vs Subject"];
    const PW = [160, 50, 92, 80, 60, 60, 76, 68, 72, 84];     // ~802px → one landscape page
    const NCOL = PCOLS.length;
    const colgroup = `<colgroup>${PW.map((w) => `<col style="width:${w}px"/>`).join("")}</colgroup>`;

    // ---- styles (minimal borders, intentional whitespace)
    const cst = (align, bg, extra) => `${F}font-size:11px;color:${NAVY};padding:6px 8px;text-align:${align};vertical-align:middle;background:${bg};${extra || ""}`;
    const sTitle = `${F}font-weight:600;font-size:15px;color:#fff;background:${NAVY};padding:12px 14px;`;
    const sMeta = `${F}font-size:11px;color:${GREY};background:${WARM};padding:7px 14px;`;
    const sHead = `${F}font-weight:600;font-size:10px;letter-spacing:0.02em;color:#fff;background:${NAVY};padding:8px;vertical-align:middle;`;
    const sBand = `${F}font-weight:600;font-size:10px;letter-spacing:0.06em;color:${NAVY};background:${LBLUE};padding:8px 10px;text-align:left;`;
    const sFoot = `${F}font-size:9px;color:${GREY};font-style:italic;padding:6px 10px;`;
    const kpiCard = (val, label, color, span) =>
      `<td colspan="${span}" style="${F}background:#fff;border:1px solid ${BORDER};padding:12px 8px;text-align:center;"><div style="font-size:17px;font-weight:700;color:${color};">${val}</div><div style="font-size:9px;color:${GREY};margin-top:4px;text-transform:uppercase;letter-spacing:0.04em;">${label}</div></td>`;

    // ---- PRIMARY rows: building blocks (merged name/rank/distance), weighted = focal
    let rowsHtml = "";
    let zeb = 0;
    cols.forEach((c) => {
      const { cur, prev } = colSnap(c.b.id, snap);
      if (!cur) return;
      const subj = c.bench;
      const dist = subj ? "Benchmark" : (c.distance != null ? c.distance : "");
      const rank = rankMap[c.b.id];

      const rws = [];
      types.forEach((t) => {
        const m = cur.byType && cur.byType[t];
        if (m && m.avgRent != null) rws.push({ label: TYPE_LABEL[t], m, p: prev && prev.byType && prev.byType[t] });
      });
      if (cur.weighted && cur.weighted.avgRent != null)
        rws.push({ label: "Weighted average", m: cur.weighted, p: prev && prev.weighted, wavg: true });
      if (!rws.length) return;
      const span = rws.length;

      const zebra = !subj && (zeb++ % 2 === 1);
      const blockBg = subj ? TINT : (zebra ? "#F6F8FD" : "#ffffff");
      const wBg = subj ? "#CFDAF2" : "#E7ECF7";        // weighted-row fill (pops while scrolling)
      const blkTop = `border-top:2px solid ${SEP};`;
      const wTop = `border-top:2px solid ${NAVY};`;
      const mc = (v, align, extra) => `<td rowspan="${span}" style="${cst(align || "center", blockBg, blkTop + (extra || ""))}">${v === "" || v == null ? "" : v}</td>`;

      rws.forEach((r, i) => {
        const m = r.m, p = r.p;
        const d = p && p.avgRent != null ? m.avgRent - p.avgRent : null;
        const dPct = d != null && p.avgRent ? +((d / p.avgRent) * 100).toFixed(1) : null;
        const dCol = d > 0 ? GREEN : d < 0 ? RED : GREY;
        const isW = r.wavg;
        const rbg = isW ? wBg : blockBg;
        // weighted rows: bold + larger + navy top rule; unit rows recede (smaller/grey)
        const rowStyle = isW ? `font-weight:700;font-size:11.5px;${wTop}` : "font-size:10px;color:#3a4256;";
        const topSep = (i === 0 && !isW) ? blkTop : "";
        const vc = (v, align, extra) => `<td style="${cst(align || "center", rbg, rowStyle + topSep + (extra || ""))}">${v === "" || v == null ? "" : v}</td>`;

        let tr = "<tr>";
        if (i === 0) {
          tr += `<td rowspan="${span}" style="${cst("left", blockBg, blkTop + (subj ? `color:${ORANGE};` : `color:${NAVY};`) + "font-weight:600;font-size:12px;")}">${esc(c.b.name)}${subj ? " ★" : ""}</td>`;
          tr += `<td rowspan="${span}" style="${cst("center", blockBg, blkTop + "font-weight:700;font-size:13px;" + (subj ? `color:${ORANGE};` : `color:${NAVY};`))}">${rank || ""}</td>`;
        }
        tr += vc(r.label, "left", isW ? "font-weight:700;" : "");
        tr += vc(Math.round(m.avgRent));
        tr += vc(d == null ? "" : Math.round(d), "center", `color:${dCol};`);
        tr += vc(dPct == null ? "" : dPct, "center", `color:${dCol};`);
        tr += vc(m.avgPsf != null ? +Number(m.avgPsf).toFixed(2) : "");
        tr += vc(m.avgSqft != null ? m.avgSqft : "");
        if (i === 0) tr += mc(dist);
        if (isW) {                                    // vs Subject only on the focal row
          const vs = subj ? null : vsSubject(m.avgRent);
          const vsCol = vs == null ? GREY : (vs > 0 ? GREEN : vs < 0 ? RED : GREY);
          tr += `<td style="${cst("center", wBg, `font-weight:700;font-size:11.5px;${wTop}color:${vsCol};`)}">${subj ? "—" : pct(vs)}</td>`;
        } else {
          tr += `<td style="${cst("center", rbg, rowStyle + topSep)}"></td>`;
        }
        tr += "</tr>";
        rowsHtml += tr;
      });
    });

    // ---- SECONDARY details (demoted metadata; incentives narrow + wrapped)
    const dHead = (txt, span, align) => `<td colspan="${span}" style="${F}font-weight:600;font-size:9px;letter-spacing:0.03em;color:${GREY};background:${WARM};padding:6px 8px;text-align:${align || "left"};text-transform:uppercase;border-bottom:1px solid ${BORDER};">${txt}</td>`;
    let detailHtml = "";
    let dz = 0;
    cols.forEach((c) => {
      const cur = snapOf(c.b.id);
      if (!cur) return;
      const subj = c.bench;
      const dbg = subj ? TINT : (dz++ % 2 === 1 ? "#F6F8FD" : "#ffffff");
      const dc = (v, span, align, extra) => `<td colspan="${span}" style="${F}font-size:10px;color:#3a4256;padding:6px 8px;text-align:${align || "left"};vertical-align:middle;background:${dbg};white-space:normal;${extra || ""}">${v === "" || v == null ? "" : v}</td>`;
      const addr = [c.b.address, c.b.city].filter(Boolean).map(esc).join(" · ");
      detailHtml += "<tr>" +
        dc(`${esc(c.b.name)}${subj ? " ★" : ""}`, 1, "left", subj ? `color:${ORANGE};font-weight:600;` : `font-weight:600;color:${NAVY};`) +
        dc(subj ? "Subject" : "Comp", 1) +
        dc(esc(c.b.owner || "—"), 2) +
        dc(esc(c.b.assetType || "—"), 1) +
        dc(c.b.yearBuilt || "—", 1, "center") +
        dc(c.b.unitCount || "—", 1, "center") +
        dc(addr || "—", 2) +
        dc(cur.incentives ? esc(cur.incentives) : "—", 1, "left", "font-size:9px;color:#7a4d0a;") +
        "</tr>";
    });

    // ---- assemble
    let body = "";
    body += `<tr><td colspan="${NCOL}" style="${sTitle}">Competitive Analysis — ${esc(a.name)}</td></tr>`;
    body += `<tr><td colspan="${NCOL}" style="${sMeta}">Benchmark: ${esc(bench ? bench.name : "—")} &nbsp;·&nbsp; Snapshot: ${esc(snap ? fmtDate(snap) : "Latest")} &nbsp;·&nbsp; ${ncomp} comparables${subjRank ? ` &nbsp;·&nbsp; Subject ranks #${subjRank} of ${rankN} by weighted rent` : ""} &nbsp;·&nbsp; Fitzrovia — Internal &amp; Confidential</td></tr>`;
    body += `<tr><td colspan="${NCOL}" style="height:10px"></td></tr>`;
    body += `<tr>` +
      kpiCard(money(bRent), "Benchmark gross rent", ORANGE, 2) +
      kpiCard(money(mktRent), `Comp-set avg rent (${ncomp})`, NAVY, 2) +
      kpiCard(bPsf != null ? psf(bPsf) + "/sf" : "—", `Benchmark PSF · mkt ${psf(mktPsf)}`, NAVY, 2) +
      kpiCard(posn == null ? "—" : (posn > 0 ? "+" : "") + posn + "%", "Subject vs market", posn != null && posn >= 0 ? GREEN : RED, 2) +
      kpiCard(subjRank ? `#${subjRank} / ${rankN}` : "—", "Subject rank by rent", NAVY, 2) +
      `</tr>`;
    body += `<tr><td colspan="${NCOL}" style="height:14px"></td></tr>`;
    body += `<tr><td colspan="${NCOL}" style="${sBand}">COMPETITIVE POSITIONING &nbsp;·&nbsp; weighted averages in bold</td></tr>`;
    body += `<tr>${PCOLS.map((h, i) => `<td style="${sHead}text-align:${i === 0 || i === 2 ? "left" : "center"};">${h}</td>`).join("")}</tr>`;
    body += rowsHtml;
    body += `<tr><td colspan="${NCOL}" style="${sFoot}">vs Subject = weighted-avg-rent premium / discount vs benchmark · Rank by weighted avg rent (1 = highest) · Δ vs prior scrape</td></tr>`;
    body += `<tr><td colspan="${NCOL}" style="height:18px"></td></tr>`;
    body += `<tr><td colspan="${NCOL}" style="${sBand}">BUILDING DETAILS</td></tr>`;
    body += `<tr>${dHead("Building", 1) + dHead("Role", 1) + dHead("Owner / manager", 2) + dHead("Asset", 1) + dHead("Year", 1, "center") + dHead("Units", 1, "center") + dHead("Address", 2) + dHead("Incentives", 1)}</tr>`;
    body += detailHtml;

    const wsOpts = `<x:WorksheetOptions><x:DoNotDisplayGridlines/><x:Print><x:ValidPrinterInfo/><x:PaperSizeIndex>1</x:PaperSizeIndex><x:Orientation>Landscape</x:Orientation><x:HorizontalResolution>600</x:HorizontalResolution><x:VerticalResolution>600</x:VerticalResolution><x:FitWidth>1</x:FitWidth><x:FitHeight>0</x:FitHeight></x:Print><x:FitToPage/></x:WorksheetOptions>`;
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">` +
      `<head><meta charset="utf-8"/>` +
      `<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Comp Analysis</x:Name>${wsOpts}</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->` +
      `</head><body style="margin:0;background:${WARM}"><table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:${WARM}">${colgroup}${body}</table></body></html>`;
    const safe = (a.name || "analysis").replace(/[^\w\- ]+/g, "").trim() || "analysis";
    downloadFile(`${safe} — comp analysis.xls`, html, "application/vnd.ms-excel");
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
            <button data-tab="summary" class="${tab === "summary" ? "active" : ""}">${icon("layout")} Summary</button>
            <button data-tab="trends" class="${tab === "trends" ? "active" : ""}">${icon("chart")} Rent Trends</button>
          </div>
          <button class="btn" id="a-map">${icon("pin")} Map</button>
          <button class="btn" id="a-xlsx">${icon("download")} Export Excel</button>
          <button class="btn" id="a-export">${icon("doc")} Export PDF</button>
          <button class="btn btn--accent" id="a-addcomp">${icon("plus")} Add building</button>
          ${a.custom ? `<button class="btn btn--accent" id="a-remove">Remove analysis</button>` : ""}
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
    const colHead = cols.map(({ b, bench }) => {
      const rm = !pdf && !bench;
      return `<th class="${bench ? "col-bench" : ""}${rm ? " col-rm" : ""}">${esc(b.name)}${bench ? " ★" : ""}${rm ? `<button class="th-rm" data-rm="${b.id}" title="Remove ${esc(b.name)} from this set" aria-label="Remove ${esc(b.name)}">×</button>` : ""}</th>`;
    }).join("");

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
    rows += `<tr class="group-row"><td class="rowlabel">Snapshot</td><td colspan="${cols.length}">As of ${fmtDate(labelDate)} · gross rent, $/sf, avg size, vs prior scrape Δ${snapHint}</td></tr>`;

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
  // Unit-backup modal: filter tabs by unit type, a sortable per-unit table, and
  // a summary-by-unit-type table — opened by clicking a cell in the comp table.
  function openUnitsModal(bid, type, snapDate) {
    const b = bld(bid); if (!b) return;
    const snap = snapshotAt(bid, snapDate).cur;
    const all = (snap && Array.isArray(snap.units)) ? snap.units.slice() : [];
    const typesPresent = UNIT_TYPES.filter((t) => all.some((u) => u.type === t));
    const st = {
      type: (type && type !== "__all" && all.some((u) => u.type === type)) ? type : "__all",
      sort: "rent", dir: -1,
    };
    const COLS = [
      { k: "type", label: "Unit Type", num: false },
      { k: "bath", label: "Bath", num: true },
      { k: "sqft", label: "SF", num: true },
      { k: "rent", label: "Rent", num: true },
      { k: "psf", label: "Rent PSF", num: true },
      { k: "note", label: "Notes", num: false },
    ];
    const numOf = (v) => (v == null || v === "" ? null : +v);

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `<div class="modal modal--units" role="dialog" aria-modal="true">
      <div class="um-head">
        <div class="um-head-id">
          <div class="um-title">${esc(b.name)} — Unit Backup</div>
          <div class="um-sub">Last scraped: ${snap && snap.date ? fmtDate(snap.date) : "—"}</div>
        </div>
        <div class="um-head-act">
          <button class="btn" id="um-xlsx">${icon("download")} Export Excel</button>
          <button class="modal__x" data-close aria-label="Close">&times;</button>
        </div>
      </div>
      <div class="um-body">
        <div class="um-block">
          <div class="um-label">Individual units <span class="um-count" id="um-count"></span></div>
          <div class="um-tabs" id="um-tabs"></div>
          <div id="um-table"></div>
        </div>
        <div class="um-block">
          <div class="um-label">Summary by unit type</div>
          <div id="um-summary"></div>
        </div>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    const $ = (s) => overlay.querySelector(s);

    const rowsForType = () => all.filter((u) => st.type === "__all" || u.type === st.type);
    const sortRows = (rows) => {
      const c = COLS.find((x) => x.k === st.sort) || COLS[3];
      return rows.slice().sort((x, y) => {
        let a, bb;
        if (c.num) { a = numOf(x[c.k]); bb = numOf(y[c.k]); a = a == null ? -Infinity : a; bb = bb == null ? -Infinity : bb; }
        else { a = (x[c.k] || "").toString().toLowerCase(); bb = (y[c.k] || "").toString().toLowerCase(); }
        return a < bb ? -st.dir : a > bb ? st.dir : 0;
      });
    };
    const arrow = (k) => (st.sort === k ? (st.dir < 0 ? " ↓" : " ↑") : "");
    const avg = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);

    function renderTabs() {
      const tab = (key, label, cnt) => `<button class="um-tab ${st.type === key ? "active" : ""}" data-t="${key}">${label} (${cnt})</button>`;
      let html = tab("__all", "All", all.length);
      typesPresent.forEach((t) => { html += tab(t, TYPE_LABEL[t] || t, all.filter((u) => u.type === t).length); });
      $("#um-tabs").innerHTML = html;
      $("#um-tabs").querySelectorAll(".um-tab").forEach((bn) => (bn.onclick = () => { st.type = bn.dataset.t; render(); }));
    }
    function renderTable() {
      const rows = sortRows(rowsForType());
      $("#um-count").textContent = `(${rows.length} of ${all.length})`;
      if (!rows.length) { $("#um-table").innerHTML = '<div class="empty">No individual listings recorded.</div>'; return; }
      const head = COLS.map((c) => `<th class="um-th" data-s="${c.k}">${c.label}<span class="um-sorti">${arrow(c.k)}</span></th>`).join("");
      const body = rows.map((u) => `<tr>
        <td>${TYPE_LABEL[u.type] || u.type}</td>
        <td class="tnum">${u.bath || "—"}</td>
        <td class="tnum">${u.sqft || "—"}</td>
        <td class="tnum"><b>${money(u.rent)}</b></td>
        <td class="tnum">${u.psf != null ? psf(u.psf) : "—"}</td>
        <td class="um-note" title="${esc(u.note || "")}">${esc(u.note || "—")}</td>
      </tr>`).join("");
      $("#um-table").innerHTML = `<table class="um-tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
      $("#um-table").querySelectorAll(".um-th").forEach((th) => (th.onclick = () => {
        const k = th.dataset.s;
        if (st.sort === k) st.dir *= -1; else { st.sort = k; st.dir = COLS.find((c) => c.k === k).num ? -1 : 1; }
        renderTable();
      }));
    }
    function renderSummary() {
      const sumRow = (label, us, bold) => {
        const sf = avg(us.filter((u) => u.sqft != null).map((u) => +u.sqft));
        const r = avg(us.map((u) => u.rent));
        const p = avg(us.filter((u) => u.psf != null).map((u) => +u.psf));
        return `<tr class="${bold ? "um-wavg" : ""}"><td>${label}</td><td class="tnum">${us.length}</td><td class="tnum">${sf != null ? Math.round(sf).toLocaleString() : "—"}</td><td class="tnum">${r != null ? money(r) : "—"}</td><td class="tnum">${p != null ? psf(p) : "—"}</td></tr>`;
      };
      let rows = "";
      typesPresent.forEach((t) => { rows += sumRow(TYPE_LABEL[t] || t, all.filter((u) => u.type === t), false); });
      rows += sumRow("Weighted Average", all, true);
      $("#um-summary").innerHTML = `<table class="um-tbl um-sum"><thead><tr><th>Unit Type</th><th># Units</th><th>Avg SF</th><th>Avg Rent</th><th>Avg PSF</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
    function render() { renderTabs(); renderTable(); renderSummary(); }
    render();

    $("#um-xlsx").onclick = () => exportUnitsExcel(b, snap, all);
    const close = () => { overlay.remove(); document.removeEventListener("keydown", k); };
    const k = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", k);
    overlay.querySelectorAll("[data-close]").forEach((x) => (x.onclick = close));
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
  }

  // Excel export for the unit-backup modal (individual units + summary by type).
  function exportUnitsExcel(b, snap, units) {
    const NAVY = "#061031", GREY = "#7F7F7F", BORDER = "#E6E6E1", LBLUE = "#D6DFFA";
    const F = "font-family:Poppins,Calibri,Arial,sans-serif;";
    const NCOL = 6;
    const sTitle = `background:${NAVY};color:#fff;${F}font-weight:600;font-size:14px;padding:10px 12px;`;
    const sMeta = `background:#FAFAF7;color:${GREY};${F}font-size:11px;padding:6px 12px;border-bottom:1px solid ${BORDER};`;
    const sHead = `background:${NAVY};color:#fff;${F}font-weight:600;font-size:10.5px;padding:7px 8px;border:1px solid ${BORDER};text-align:center;`;
    const sBand = `background:${LBLUE};color:${NAVY};${F}font-weight:600;font-size:10px;letter-spacing:.04em;padding:6px 8px;border:1px solid ${BORDER};`;
    const cell = (v, align, extra) => `<td style="${F}font-size:11px;color:${NAVY};padding:5px 8px;border:1px solid ${BORDER};text-align:${align || "center"};${extra || ""}">${v === null || v === undefined || v === "" ? "" : v}</td>`;
    const avg = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
    const types = UNIT_TYPES.filter((t) => units.some((u) => u.type === t));

    let body = `<tr><td colspan="${NCOL}" style="${sTitle}">${esc(b.name)} — Unit Backup</td></tr>`;
    body += `<tr><td colspan="${NCOL}" style="${sMeta}">Snapshot: ${snap && snap.date ? fmtDate(snap.date) : "—"} &nbsp;·&nbsp; ${units.length} individual units &nbsp;·&nbsp; Fitzrovia — Internal &amp; Confidential</td></tr>`;
    body += `<tr><td colspan="${NCOL}" style="height:6px;border:none"></td></tr>`;
    body += `<tr><td colspan="${NCOL}" style="${sBand}">INDIVIDUAL UNITS</td></tr>`;
    body += `<tr>${["Unit Type", "Bath", "SF", "Rent ($/mo)", "Rent PSF ($/sf)", "Notes"].map((h) => `<td style="${sHead}">${h}</td>`).join("")}</tr>`;
    units.forEach((u) => {
      body += "<tr>" + cell(TYPE_LABEL[u.type] || u.type, "left") + cell(u.bath || "") + cell(u.sqft != null ? u.sqft : "") +
        cell(u.rent != null ? Math.round(u.rent) : "") + cell(u.psf != null ? +Number(u.psf).toFixed(2) : "") +
        cell(esc(u.note || ""), "left", `font-size:10px;color:${GREY};white-space:normal;`) + "</tr>";
    });
    body += `<tr><td colspan="${NCOL}" style="height:10px;border:none"></td></tr>`;
    body += `<tr><td colspan="${NCOL}" style="${sBand}">SUMMARY BY UNIT TYPE</td></tr>`;
    body += `<tr>${["Unit Type", "# Units", "Avg SF", "Avg Rent ($/mo)", "Avg PSF ($/sf)", ""].map((h) => `<td style="${sHead}">${h}</td>`).join("")}</tr>`;
    const sumRow = (label, us, bold) => {
      const sf = avg(us.filter((u) => u.sqft != null).map((u) => +u.sqft));
      const r = avg(us.map((u) => u.rent));
      const p = avg(us.filter((u) => u.psf != null).map((u) => +u.psf));
      const bw = bold ? "font-weight:700;" : "";
      return `<tr>${cell(label, "left", bw)}${cell(us.length, "center", bw)}${cell(sf != null ? Math.round(sf) : "", "center", bw)}${cell(r != null ? Math.round(r) : "", "center", bw)}${cell(p != null ? +p.toFixed(2) : "", "center", bw)}${cell("")}</tr>`;
    };
    types.forEach((t) => { body += sumRow(TYPE_LABEL[t] || t, units.filter((u) => u.type === t), false); });
    body += sumRow("Weighted Average", units, true);

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"/></head>` +
      `<body><table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${body}</table></body></html>`;
    const safe = (b.name || "building").replace(/[^\w\- ]+/g, "").trim() || "building";
    downloadFile(`${safe} — unit backup.xls`, html, "application/vnd.ms-excel");
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
      picker + kpiStrip(a, cols, sel) + `<div class="comp-wrap">${compTableHtml(cols, undefined, sel, 160 + cols.length * 150)}</div>` + removedBinHtml(a);

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
      const rm = e.target.closest(".th-rm");
      if (rm) { e.stopPropagation(); removeCompFromAnalysis(a, rm.dataset.rm); route(); return; }
      const td = e.target.closest("td[data-bid]");
      if (td) openUnitsModal(td.dataset.bid, td.dataset.type, td.dataset.snap);
    };

    const bin = document.querySelector("#tabbody .dropbin");
    if (bin) bin.onclick = (e) => {
      if (e.target.closest(".dropbin__readall")) { readdAllComps(a); route(); return; }
      const btn = e.target.closest(".dropbin__readd");
      if (btn) { readdComp(a, btn.dataset.readd); route(); }
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
  function mean(arr) {
    const a = arr.filter((v) => v != null);
    return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
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
    const avgR = mean(comps.map((w) => w.avgRent));
    const avgP = mean(comps.map((w) => w.avgPsf));
    const sRent = bw ? bw.avgRent : null, sPsf = bw ? bw.avgPsf : null;
    const dRent = sRent != null && avgR != null ? sRent - avgR : null;
    const dPsf = sPsf != null && avgP != null ? sPsf - avgP : null;
    const annR = dRent == null ? "vs comp average" : `$${Math.abs(dRent).toFixed(1).replace(/\.0$/, "")} ${dRent < 0 ? "below" : "above"} comp average`;
    const annP = dPsf == null ? "vs comp average" : `$${Math.abs(dPsf).toFixed(2)} ${dPsf < 0 ? "below" : "above"} comp average`;
    const kpi = (l, v, unit, s, cls) => `<div class="rp-kpi"><div class="rp-kpi-l">${l}</div><div class="rp-kpi-v ${cls || ""}">${v}<span>${unit}</span></div><div class="rp-kpi-s">${s}</div></div>`;
    return `<div class="rp-kpis">
      ${kpi("Subject Wtd. Avg Rent", sRent != null ? fmtRent(sRent) : "—", "/mo", annR)}
      ${kpi("Subject Wtd. Avg PSF", sPsf != null ? fmtPsf(sPsf) : "—", "/sf", annP)}
      ${kpi("Comp Avg Rent", avgR != null ? fmtRent(avgR) : "—", "/mo", `Across all ${n} comps`)}
      ${kpi("Comp Avg PSF", avgP != null ? fmtPsf(avgP) : "—", "/sf", `Across all ${n} comps`)}
    </div>`;
  }

  function reportNarrative(a, cols, snapDate) {
    const bw = (colSnap(a.benchmark, snapDate).cur || {}).weighted;
    const comps = cols.filter((c) => !c.bench).map((c) => (colSnap(c.b.id, snapDate).cur || {}).weighted).filter(Boolean);
    if (!bw || !comps.length) return "";
    const avgR = mean(comps.map((w) => w.avgRent)), avgP = mean(comps.map((w) => w.avgPsf));
    const dRent = bw.avgRent - avgR, dPsf = bw.avgPsf - avgP;
    return `<div class="rp-narrative">${esc(a.name)} is priced <b>$${Math.abs(dRent).toFixed(1).replace(/\.0$/, "")}/mo ${dRent < 0 ? "below" : "above"}</b> the comp average of ${comps.length} properties. PSF is <b>${dPsf >= 0 ? "above" : "below"}</b> the cohort at <b>${fmtPsf(bw.avgPsf)}/sf</b>.</div>`;
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
    // The DETAIL band rides with the first table (placed only once we know which
    // page that table lands on) so it can't be stranded on an otherwise-empty
    // page — e.g. a comp with a very long incentive makes table 1 too tall to
    // follow the band, which would orphan the band and blank the rest of a page.
    if (detailTables.length) {
      const bandH = detailBand ? H(detailBand) : 0;
      let pg = newPage();
      let used = 0;
      detailTables.forEach((tw, idx) => {
        const lead = idx === 0 ? detailBand : null;
        const leadH = lead ? bandH : 0;
        const twH = H(tw);
        if (used > 0 && used + leadH + twH > pg.avail) { pg = newPage(); used = 0; }
        if (lead) { pg.content.appendChild(lead); used += leadH; }
        pg.content.appendChild(tw);
        const room = pg.avail - used; // height left on this page (after the band)
        if (twH > room) { // too tall → scale this table to fit the remaining room
          const outer = document.createElement("div"); outer.className = "rp-fit";
          const inner = document.createElement("div"); inner.className = "rp-fit-in";
          pg.content.insertBefore(outer, tw); inner.appendChild(tw); outer.appendChild(inner);
          fitToHeight(inner, outer, room);
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
  let trendDocClose = false;  // one-time document listeners that close the filter dropdowns
  function renderTrends(a, cols) {
    const key = a.id;
    if (!trendState[key]) trendState[key] = { metric: "avgPsf", types: null, bsel: null, from: null, to: null };
    const st = trendState[key];
    if (!st.bsel) st.bsel = new Set(cols.map((c) => c.b.id));

    // gather dates + which unit types have any history across the comp set
    const allDates = new Set();
    const typeSet = new Set();
    cols.forEach((c) => (D.trends[c.b.id] || []).forEach((p) => {
      allDates.add(p.date);
      if (p.byType) Object.keys(p.byType).forEach((t) => typeSet.add(t));
    }));
    const dates = [...allDates].sort();
    if (!dates.length) {
      document.getElementById("tabbody").innerHTML = `<div class="card"><div class="empty">No snapshot history available for this comp set.</div></div>`;
      return;
    }
    const minD = dates[0], maxD = dates[dates.length - 1];
    if (!st.from) st.from = minD;
    if (!st.to) st.to = maxD;
    const availTypes = UNIT_TYPES.filter((t) => typeSet.has(t));
    if (!st.types) st.types = availTypes.slice();  // default: all types → all-units weighted average
    st.avail = availTypes;

    const typeChecks = availTypes
      .map((t) => `<label class="tcheck"><input type="checkbox" data-t="${t}" ${st.types.includes(t) ? "checked" : ""}/> ${TYPE_LABEL[t]}</label>`).join("");
    const buildChecks = cols.map((c) =>
      `<label class="tcheck"><input type="checkbox" data-b="${c.b.id}" ${st.bsel.has(c.b.id) ? "checked" : ""}/> ${esc(c.b.name)}${c.bench ? " ★" : ""}</label>`).join("");

    // Concise closed-state summaries for the dropdowns.
    const typesSummary = () => {
      const n = st.types.length, tot = availTypes.length;
      if (!n) return "No unit types";
      if (n === tot) return "All unit types";
      if (n === 1) return esc(TYPE_LABEL[st.types[0]] || st.types[0]);
      return `${n} unit types`;
    };
    const buildsSummary = () => {
      const sel = cols.filter((c) => st.bsel.has(c.b.id));
      const n = sel.length, tot = cols.length;
      if (!n) return "No buildings";
      if (n === 1) return esc(sel[0].b.name) + (sel[0].bench ? " ★" : "");
      if (n === tot) {
        const bench = cols.find((c) => c.bench);
        const comps = tot - (bench ? 1 : 0);
        return bench ? `${esc(bench.b.name)} ★ + ${comps} comps` : `${tot} buildings`;
      }
      return `${n} buildings selected`;
    };

    document.getElementById("tabbody").innerHTML = `
      <div class="filters">
        <label>Metric</label>
        <select id="f-metric">
          <option value="avgPsf" ${st.metric === "avgPsf" ? "selected" : ""}>Average Rent PSF</option>
          <option value="avgRent" ${st.metric === "avgRent" ? "selected" : ""}>Average Gross Rent</option>
        </select>
        <label>From</label><input type="date" id="f-from" value="${st.from}" min="${minD}" max="${st.to}"/>
        <label>To</label><input type="date" id="f-to" value="${st.to}" min="${st.from}" max="${maxD}"/>
        <span class="date-err" id="trend-dateerr" role="alert"></span>
        <label>Unit types</label>
        <div class="msel" id="msel-t">
          <button type="button" class="msel__btn" id="mt-btn" aria-haspopup="true" aria-expanded="false"><span class="msel__sum" id="mt-sum">${typesSummary()}</span>${icon("chevron-down")}</button>
          <div class="msel__menu" id="mt-menu" hidden role="group" aria-label="Unit types">
            <div class="msel__bar"><button type="button" class="trend-link" data-grp="t" data-on="1">All</button><button type="button" class="trend-link" data-grp="t" data-on="0">None</button></div>
            <div class="msel__list" id="tc-types">${typeChecks}</div>
          </div>
        </div>
        <label>Buildings</label>
        <div class="msel" id="msel-b">
          <button type="button" class="msel__btn" id="mb-btn" aria-haspopup="true" aria-expanded="false"><span class="msel__sum" id="mb-sum">${buildsSummary()}</span>${icon("chevron-down")}</button>
          <div class="msel__menu" id="mb-menu" hidden role="group" aria-label="Buildings">
            <div class="msel__bar"><button type="button" class="trend-link" data-grp="b" data-on="1">All</button><button type="button" class="trend-link" data-grp="b" data-on="0">None</button></div>
            <div class="msel__list" id="tc-builds">${buildChecks}</div>
          </div>
        </div>
      </div>
      <div class="card chart-card">
        <h3 id="chart-title">${st.metric === "avgPsf" ? "Average Rent PSF" : "Average Gross Rent"}</h3>
        <div id="chart"></div>
        <div class="legend" id="legend"></div>
      </div>`;

    const draw = () => drawChart(a, cols, st);
    const upSums = () => { document.getElementById("mt-sum").innerHTML = typesSummary(); document.getElementById("mb-sum").innerHTML = buildsSummary(); };
    document.getElementById("f-metric").onchange = (e) => { st.metric = e.target.value; renderTrends(a, cols); };
    const dateErr = document.getElementById("trend-dateerr");
    const fromEl = document.getElementById("f-from"), toEl = document.getElementById("f-to");
    fromEl.onchange = (e) => {
      const v = e.target.value;
      if (!v) { e.target.value = st.from; return; }                 // ignore a cleared field
      if (v > st.to) { dateErr.textContent = "Start date can't be after the end date."; e.target.value = st.from; return; }
      dateErr.textContent = ""; st.from = v; toEl.min = v; draw();   // keep To's minimum in sync
    };
    toEl.onchange = (e) => {
      const v = e.target.value;
      if (!v) { e.target.value = st.to; return; }
      if (v < st.from) { dateErr.textContent = "End date can't be before the start date."; e.target.value = st.to; return; }
      dateErr.textContent = ""; st.to = v; fromEl.max = v; draw();   // keep From's maximum in sync
    };
    document.querySelectorAll("#tc-types input").forEach((cb) => (cb.onchange = () => {
      const t = cb.dataset.t;
      if (cb.checked) { if (!st.types.includes(t)) st.types.push(t); }
      else st.types = st.types.filter((x) => x !== t);
      upSums(); draw();
    }));
    document.querySelectorAll("#tc-builds input").forEach((cb) => (cb.onchange = () => {
      cb.checked ? st.bsel.add(cb.dataset.b) : st.bsel.delete(cb.dataset.b);
      upSums(); draw();
    }));
    document.querySelectorAll(".trend-link").forEach((bn) => (bn.onclick = (ev) => {
      ev.stopPropagation();
      const on = bn.dataset.on === "1";
      if (bn.dataset.grp === "t") {
        st.types = on ? availTypes.slice() : [];
        document.querySelectorAll("#tc-types input").forEach((cb) => { cb.checked = st.types.includes(cb.dataset.t); });
      } else {
        st.bsel = on ? new Set(cols.map((c) => c.b.id)) : new Set();
        document.querySelectorAll("#tc-builds input").forEach((cb) => { cb.checked = st.bsel.has(cb.dataset.b); });
      }
      upSums(); draw();  // morph in place — no remount, no legend reset
    }));

    // dropdown open/close — one open at a time, closes on outside click / Escape
    const menus = [["mt-btn", "mt-menu"], ["mb-btn", "mb-menu"]].map(([b, m]) => ({ btn: document.getElementById(b), menu: document.getElementById(m) }));
    menus.forEach((o) => {
      o.btn.onclick = (ev) => {
        ev.stopPropagation();
        const willOpen = o.menu.hidden;
        menus.forEach((x) => { x.menu.hidden = true; x.btn.setAttribute("aria-expanded", "false"); });
        o.menu.hidden = !willOpen;
        o.btn.setAttribute("aria-expanded", String(willOpen));
      };
      o.menu.onclick = (ev) => ev.stopPropagation();  // stay open while choosing
    });
    if (!trendDocClose) {
      trendDocClose = true;
      const closeAll = () => document.querySelectorAll(".msel__menu").forEach((m) => {
        m.hidden = true;
        const b = m.parentNode.querySelector(".msel__btn");
        if (b) b.setAttribute("aria-expanded", "false");
      });
      document.addEventListener("click", closeAll);
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });
    }
    draw();
  }

  // Weighted average of `metric` across the selected unit types at one snapshot,
  // weighted by each type's unit count — so each building's line dynamically
  // re-blends as type boxes are toggled (all types checked == all-units weighted).
  function weightedAt(point, metric, types) {
    let num = 0, den = 0;
    types.forEach((t) => {
      const bt = point.byType && point.byType[t];
      if (bt && bt[metric] != null && bt.count) { num += bt[metric] * bt.count; den += bt.count; }
    });
    return den ? num / den : null;
  }

  // Monotone cubic (Fritsch-Carlson) -> cubic Bézier. Smooth, but shape-preserving:
  // the curve passes exactly through every point and cannot overshoot between them
  // (X must be strictly increasing — true here, points are sorted scrape dates).
  function smoothPath(p) {
    const n = p.length;
    if (!n) return "";
    if (n === 1) return `M ${p[0].X.toFixed(1)} ${p[0].Y.toFixed(1)}`;
    if (n === 2) return `M ${p[0].X.toFixed(1)} ${p[0].Y.toFixed(1)} L ${p[1].X.toFixed(1)} ${p[1].Y.toFixed(1)}`;
    const dx = [], slope = [];
    for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1].X - p[i].X; slope[i] = dx[i] !== 0 ? (p[i + 1].Y - p[i].Y) / dx[i] : 0; }
    const m = new Array(n);
    m[0] = slope[0]; m[n - 1] = slope[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
    for (let i = 0; i < n - 1; i++) {                       // limiter → guarantees no overshoot
      if (slope[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / slope[i], b = m[i + 1] / slope[i], h = Math.hypot(a, b);
      if (h > 3) { const t = 3 / h; m[i] = t * a * slope[i]; m[i + 1] = t * b * slope[i]; }
    }
    let d = `M ${p[0].X.toFixed(1)} ${p[0].Y.toFixed(1)}`;
    for (let i = 0; i < n - 1; i++) {
      const c1x = p[i].X + dx[i] / 3, c1y = p[i].Y + m[i] * dx[i] / 3;
      const c2x = p[i + 1].X - dx[i] / 3, c2y = p[i + 1].Y - m[i + 1] * dx[i] / 3;
      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p[i + 1].X.toFixed(1)} ${p[i + 1].Y.toFixed(1)}`;
    }
    return d;
  }

  let chartCache = {};  // persistent SVG scaffold + per-building series elements (object constancy)
  let chartRaf = {};    // in-flight requestAnimationFrame id per analysis

  // Hover crosshair + comparison tooltip for the trend chart.
  function trendHoverMove(cache, ev) {
    const hv = cache.hover; if (!hv || !hv.series.length) return;
    const rect = cache.svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const svgX = (ev.clientX - rect.left) / rect.width * hv.W;
    const svgY = (ev.clientY - rect.top) / rect.height * hv.H;

    // nearest scrape date to the cursor
    let D = null, best = Infinity;
    hv.dates.forEach((d) => { const dd = Math.abs(hv.x(d) - svgX); if (dd < best) { best = dd; D = d; } });
    if (D == null) { trendHoverLeave(cache); return; }

    // value (and change vs the series' previous observation) for each visible series at D
    const rows = [];
    hv.series.forEach((s) => {
      const v = s.vmap[D];
      if (v == null) return;                       // no observation here → omit (no $0/NaN)
      const idx = s.pts.findIndex((p) => p.d === D);
      const prev = idx > 0 ? s.pts[idx - 1].v : null;
      rows.push({ id: s.id, name: s.name, bench: s.bench, color: s.color, v, change: prev != null ? v - prev : null, y: hv.y(v) });
    });
    if (!rows.length) { trendHoverLeave(cache); return; }
    rows.sort((a, b) => b.v - a.v);                // highest → lowest

    // nearest line to the cursor (highlight if close enough)
    let near = null, nd = Infinity;
    rows.forEach((r) => { const dd = Math.abs(r.y - svgY); if (dd < nd) { nd = dd; near = r.id; } });
    const hovered = nd <= 22 ? near : null;

    // crosshair + point markers
    const cx = hv.x(D);
    let g = `<line class="trend-cross" x1="${cx.toFixed(1)}" y1="${hv.padT}" x2="${cx.toFixed(1)}" y2="${hv.H - hv.padB}"/>`;
    rows.forEach((r) => { g += `<circle class="trend-cross-dot" cx="${cx.toFixed(1)}" cy="${r.y.toFixed(1)}" r="${r.id === hovered ? 5 : 3.5}" fill="${r.color}"/>`; });
    cache.hoverG.innerHTML = g;

    // dim non-hovered lines when near a specific one
    Object.keys(cache.series).forEach((bid) => {
      const rec = cache.series[bid];
      if (rec && rec.grp) rec.grp.style.opacity = hovered ? (bid === hovered ? "1" : "0.18") : "1";
    });

    // tooltip
    const psfMode = hv.metric === "avgPsf";
    const fmtV = psfMode ? (x) => "$" + x.toFixed(2) + "/sf" : (x) => "$" + Math.round(x).toLocaleString();
    const fmtC = (c) => c == null ? "" : ` <span class="tt-chg ${c > 0 ? "up" : c < 0 ? "down" : ""}">(${c > 0 ? "+" : c < 0 ? "−" : ""}${psfMode ? "$" + Math.abs(c).toFixed(2) : "$" + Math.abs(Math.round(c)).toLocaleString()})</span>`;
    let html = `<div class="tt-date">${fmtDate(D)}</div>`;
    rows.forEach((r) => { html += `<div class="tt-row ${r.id === hovered ? "tt-hi" : ""}"><span class="tt-dot" style="background:${r.color}"></span><span class="tt-name">${esc(r.name)}${r.bench ? " ★" : ""}</span><span class="tt-val">${fmtV(r.v)}${fmtC(r.change)}</span></div>`; });
    const tip = cache.tip;
    tip.innerHTML = html; tip.hidden = false;

    // position near cursor, clamped inside the chart container
    const host = cache.svg.parentNode;
    const hr = host.getBoundingClientRect();
    const px = ev.clientX - hr.left, py = ev.clientY - hr.top;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = px + 16; if (left + tw > host.clientWidth - 4) left = px - tw - 16; if (left < 4) left = 4;
    let top = py - th / 2; if (top < 4) top = 4; if (top + th > host.clientHeight - 4) top = host.clientHeight - th - 4;
    tip.style.left = left + "px"; tip.style.top = top + "px";
  }
  function trendHoverLeave(cache) {
    if (cache.hoverG) cache.hoverG.innerHTML = "";
    if (cache.tip) cache.tip.hidden = true;
    Object.keys(cache.series).forEach((bid) => { const rec = cache.series[bid]; if (rec && rec.grp) rec.grp.style.opacity = "1"; });
  }

  function drawChart(a, cols, st) {
    const chartEl = document.getElementById("chart");
    const legendEl = document.getElementById("legend");
    if (!chartEl) return;
    const NS = "http://www.w3.org/2000/svg";
    const key = a.id;
    const W = Math.max(720, (chartEl.clientWidth || 900));
    const H = 420, padL = 64, padR = 24, padT = 16, padB = 56;
    const dates = (() => {
      const s = new Set();
      cols.forEach((c) => (D.trends[c.b.id] || []).forEach((p) => { if (p.date >= st.from && p.date <= st.to) s.add(p.date); }));
      return [...s].sort();
    })();
    if (chartRaf[key]) cancelAnimationFrame(chartRaf[key]);
    if (!dates.length) { chartEl.innerHTML = `<div class="empty">No data in selected range.</div>`; legendEl.innerHTML = ""; chartCache[key] = null; return; }
    const xIdx = new Map(dates.map((d, i) => [d, i]));
    const x = (d) => padL + (dates.length === 1 ? (W - padL - padR) / 2 : (xIdx.get(d) / (dates.length - 1)) * (W - padL - padR));

    // target series, keyed by building id (stable identity for object constancy)
    const target = [];
    cols.forEach((c, i) => {
      if (!st.bsel.has(c.b.id)) return;
      const color = c.bench ? BENCH_COLOR : COMP_COLORS[i % COMP_COLORS.length];
      const pts = (D.trends[c.b.id] || [])
        .filter((p) => p.date >= st.from && p.date <= st.to)
        .map((p) => ({ d: p.date, v: weightedAt(p, st.metric, st.types) }))
        .filter((p) => p.v != null && xIdx.has(p.d));
      if (!pts.length) return;
      const vmap = {}; pts.forEach((p) => (vmap[p.d] = p.v));
      target.push({ bid: c.b.id, name: c.b.name, bench: c.bench, color, pts, vmap });
    });
    if (!target.length) { chartEl.innerHTML = `<div class="empty">Select at least one building and one unit type.</div>`; legendEl.innerHTML = ""; chartCache[key] = null; return; }

    // dynamic title
    const tt = document.getElementById("chart-title");
    if (tt) {
      const mName = st.metric === "avgPsf" ? "Average Rent PSF" : "Average Gross Rent";
      const scope = !st.types.length ? "—" : (st.avail && st.types.length === st.avail.length) ? "all units (weighted)" : st.types.map((t) => TYPE_LABEL[t] || t).join(" + ") + " (weighted)";
      tt.textContent = `${mName} · ${scope}`;
    }

    const allV = []; target.forEach((s) => s.pts.forEach((p) => allV.push(p.v)));
    const dMin = Math.min(...allV), dMax = Math.max(...allV);

    // reuse the SVG scaffold across changes (no remount) when the x-axis is unchanged
    const datesKey = dates.join("|");
    let cache = chartCache[key];
    const reuse = cache && cache.svg && cache.svg.parentNode === chartEl && cache.datesKey === datesKey;
    if (!reuse) {
      const svg = document.createElementNS(NS, "svg");
      svg.setAttribute("class", "linechart"); svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      const gridG = document.createElementNS(NS, "g"); gridG.setAttribute("class", "grid");
      const linesG = document.createElementNS(NS, "g"); linesG.setAttribute("class", "axis");
      const hoverG = document.createElementNS(NS, "g"); hoverG.setAttribute("class", "hoverlayer");
      const overlay = document.createElementNS(NS, "rect"); overlay.setAttribute("fill", "transparent"); overlay.style.cursor = "crosshair";
      svg.appendChild(gridG); svg.appendChild(linesG); svg.appendChild(hoverG); svg.appendChild(overlay);
      chartEl.style.position = "relative";
      chartEl.replaceChildren(svg);
      const tip = document.createElement("div"); tip.className = "trend-tip"; tip.hidden = true;
      chartEl.appendChild(tip);
      legendEl.replaceChildren();
      cache = chartCache[key] = { svg, gridG, linesG, hoverG, overlay, tip, series: {}, legend: {}, yMin: null, yMax: null, fitMin: null, fitMax: null, datesKey };
      overlay.addEventListener("mousemove", (ev) => trendHoverMove(cache, ev));
      overlay.addEventListener("mouseleave", () => trendHoverLeave(cache));
    }

    // Axis bounds — keep the current fit while the data still fits inside it, so a
    // toggle that doesn't change a line leaves it exactly in place (no rescale).
    let tYMin, tYMax;
    if (reuse && cache.fitMin != null && dMin >= cache.fitMin && dMax <= cache.fitMax) {
      tYMin = cache.fitMin; tYMax = cache.fitMax;
    } else {
      const padY = (dMax - dMin) * 0.12 || dMax * 0.1;
      tYMin = Math.max(0, dMin - padY); tYMax = dMax + padY;
    }
    cache.fitMin = tYMin; cache.fitMax = tYMax;
    if (cache.yMin == null) { cache.yMin = tYMin; cache.yMax = tYMax; }  // first paint: no axis morph

    // keep the hover overlay + data current (settled axis used for the crosshair/tooltip)
    cache.svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    cache.overlay.setAttribute("x", padL); cache.overlay.setAttribute("y", padT);
    cache.overlay.setAttribute("width", Math.max(0, W - padL - padR)); cache.overlay.setAttribute("height", Math.max(0, H - padT - padB));
    const ySettled = (v) => padT + (1 - (v - tYMin) / ((tYMax - tYMin) || 1)) * (H - padT - padB);
    cache.hover = {
      dates, x, y: ySettled, padT, padB, H, W, metric: st.metric,
      series: target.map((s) => ({ id: s.bid, name: s.name, bench: s.bench, color: s.color, pts: s.pts, vmap: s.vmap })),
    };

    const want = new Set(target.map((s) => s.bid));

    // legend diff — keep existing items, add new, remove gone (no full reset)
    Object.keys(cache.legend).forEach((bid) => { if (!want.has(bid)) { cache.legend[bid].remove(); delete cache.legend[bid]; } });
    target.forEach((s) => {
      let el = cache.legend[s.bid];
      if (!el) {
        el = document.createElement("span"); el.className = "lg";
        el.innerHTML = `<span class="dot"></span><span class="lgname"></span>`;
        legendEl.appendChild(el); cache.legend[s.bid] = el;
      }
      el.querySelector(".dot").style.background = s.color;
      el.querySelector(".lgname").textContent = s.name + (s.bench ? " ★" : "");
    });

    // series data-join: enter (new) / update (continuing) / exit (removed)
    const exits = [];
    Object.keys(cache.series).forEach((bid) => { if (!want.has(bid)) exits.push(cache.series[bid]); });
    const active = [];
    target.forEach((s) => {
      let rec = cache.series[s.bid];
      if (!rec) { // ENTER — create persistent path + dots group
        const path = document.createElementNS(NS, "path"); path.setAttribute("fill", "none");
        const dotsG = document.createElementNS(NS, "g");
        const grp = document.createElementNS(NS, "g");
        grp.appendChild(path); grp.appendChild(dotsG);
        cache.linesG.appendChild(grp);
        rec = { grp, path, dotsG, cur: null };
        cache.series[s.bid] = rec;
      }
      rec.enter = !rec.cur;          // brand-new series → fade in
      rec.from = rec.cur || s.vmap;  // continue from current display; new ones hold at target while fading in
      rec.s = s;
      // from-line interpolator: a point this series GAINS on a toggle starts on
      // the existing line (emerges) instead of snapping in (which caused spikes)
      const fkeys = Object.keys(rec.from).sort();
      rec.fromY = (d) => {
        if (rec.from[d] != null) return rec.from[d];
        if (!fkeys.length) return null;
        const xd = x(d);
        let lo = null, hi = null;
        for (const fd of fkeys) { if (x(fd) <= xd) lo = fd; else { hi = fd; break; } }
        if (lo == null) return rec.from[fkeys[0]];
        if (hi == null) return rec.from[fkeys[fkeys.length - 1]];
        return rec.from[lo] + (rec.from[hi] - rec.from[lo]) * ((xd - x(lo)) / (x(hi) - x(lo) || 1));
      };
      active.push(rec);
    });
    // benchmark drawn last so the Parker subject line stays emphasized (on top)
    active.slice().sort((p, q) => (p.s.bench === q.s.bench ? 0 : p.s.bench ? 1 : -1)).forEach((rec) => cache.linesG.appendChild(rec.grp));

    const fromYMin = cache.yMin, fromYMax = cache.yMax;
    const lerp = (p, q, e) => p + (q - p) * e;
    const ease = (t) => 1 - Math.pow(1 - t, 3);  // easeOut: glide off the current position, settle gently
    const DUR = 480;
    const fmtY = st.metric === "avgPsf" ? (v) => "$" + v.toFixed(2) + "/sf" : (v) => "$" + Math.round(v).toLocaleString();

    const renderFrame = (e) => {
      const yMin = lerp(fromYMin, tYMin, e), yMax = lerp(fromYMax, tYMax, e), span = (yMax - yMin) || 1;
      const y = (v) => padT + (1 - (v - yMin) / span) * (H - padT - padB);
      cache.yMin = yMin; cache.yMax = yMax;  // remember displayed axis so an interrupted morph continues

      let grid = "";
      const ticks = 5;
      for (let i = 0; i <= ticks; i++) { const v = yMin + (i / ticks) * (yMax - yMin), yy = y(v); grid += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}"/><text class="axis-label" x="${padL - 10}" y="${yy + 4}" text-anchor="end">${fmtY(v)}</text>`; }
      const step = Math.ceil(dates.length / 14);
      dates.forEach((d, i) => { if (i % step === 0 || i === dates.length - 1) grid += `<text class="axis-label" x="${x(d)}" y="${H - padB + 20}" text-anchor="middle">${shortDate(d)}</text>`; });
      cache.gridG.innerHTML = grid;

      active.forEach((rec) => {
        const s = rec.s, vmapNow = {};
        // One continuous monotone line through every valid observation — connect
        // consecutive points even if filtering to a bucket dropped dates between
        // them (same-date dupes are deduped upstream, so no vertical artifacts).
        const coords = s.pts.map((p) => { const fv = rec.fromY(p.d); const v = fv != null ? lerp(fv, p.v, e) : p.v; vmapNow[p.d] = v; return { X: x(p.d), Y: y(v) }; });
        rec.path.setAttribute("d", smoothPath(coords));
        rec.path.setAttribute("stroke", s.color);
        rec.path.setAttribute("stroke-width", s.bench ? 3 : 1.6);
        rec.path.setAttribute("stroke-linecap", "round");
        rec.path.setAttribute("stroke-linejoin", "round");
        rec.path.setAttribute("stroke-opacity", s.bench ? "1" : "0.9");
        let dots = "";
        s.pts.forEach((p) => { const cy = y(vmapNow[p.d]); dots += s.bench ? `<circle cx="${x(p.d)}" cy="${cy}" r="3.5" fill="${s.color}"/>` : `<circle cx="${x(p.d)}" cy="${cy}" r="2.6" fill="#fff" stroke="${s.color}" stroke-width="1.4"/>`; });
        rec.dotsG.innerHTML = dots;
        rec.grp.style.opacity = rec.enter ? String(e) : "1";
        rec.cur = vmapNow;
      });
      exits.forEach((rec) => { rec.grp.style.opacity = String(1 - e); });

      if (e >= 1) {  // finalize: drop exited series
        exits.forEach((rec) => rec.grp.remove());
        Object.keys(cache.series).forEach((bid) => { if (!want.has(bid)) delete cache.series[bid]; });
        active.forEach((rec) => (rec.enter = false));
      }
    };

    renderFrame(0);  // paint at the current position first (no flash)
    const t0 = performance.now();
    const tick = (now) => { const e = ease(Math.min(1, (now - t0) / DUR)); renderFrame(e); if (e < 1) chartRaf[key] = requestAnimationFrame(tick); };
    chartRaf[key] = requestAnimationFrame(tick);
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
