/* =============================================================================
   Comp Tracker SPA — recreation of the screenshot views, reskinned under the
   Fitzrovia AI Studio design system, populated from window.COMP_DATA (seed).
   No build step, no framework, no network: hand-rolled router + SVG charts.
============================================================================= */
(function () {
  "use strict";
  let D = null;   // the dataset — populated by loadData() at boot (inline data.js or a backend URL)
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
    "settings": '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    "chart": '<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "check": '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
    "edit": '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    "doc": '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
    "star": '<path d="M12 2l2.9 6.3 6.9.6-5.2 4.5 1.6 6.8L12 17.3 5.8 20.7l1.6-6.8L2.2 8.9l6.9-.6z"/>',
    "calendar": '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/>',
    "chevron-down": '<path d="M6 9l6 6 6-6"/>',
    "alert": '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
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
    const up = d > 0;
    const pct = prev ? (Math.abs(d / prev) * 100).toFixed(1) : "0.0";
    return `<span class="delta ${up ? "up" : "down"}"><span class="delta__arr">${up ? "▲" : "▼"}</span>$${Math.abs(Math.round(d)).toLocaleString()} (${pct}%)</span>`;
  }
  // PSF delta — cents precision (rent's whole-dollar rounding would read as "$0"), $ + %.
  function deltaPsf(cur, prev) {
    if (cur == null || prev == null) return "";
    const d = cur - prev;
    if (Math.abs(d) < 0.005) return `<span class="delta flat">$0.00 (0.0%)</span>`;
    const up = d > 0;
    const pct = prev ? (Math.abs(d / prev) * 100).toFixed(1) : "0.0";
    return `<span class="delta ${up ? "up" : "down"}"><span class="delta__arr">${up ? "▲" : "▼"}</span>$${Math.abs(d).toFixed(2)} (${pct}%)</span>`;
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

  // Branded toast (bottom-right). opts: { action, onAction, duration }. `msg` is HTML
  // (caller escapes dynamic text). Stacks; auto-dismisses; click action to act.
  function toast(msg, opts) {
    opts = opts || {};
    let host = document.getElementById("toasts");
    if (!host) { host = document.createElement("div"); host.id = "toasts"; document.body.appendChild(host); }
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `<span class="toast__msg">${msg}</span>`;
    const dismiss = () => { clearTimeout(timer); if (!el.parentNode) return; el.classList.add("out"); setTimeout(() => el.remove(), 200); };
    if (opts.action && opts.onAction) {
      const btn = document.createElement("button");
      btn.className = "toast__action"; btn.textContent = opts.action;
      btn.onclick = () => { dismiss(); try { opts.onAction(); } catch (e) {} };
      el.appendChild(btn);
    }
    host.appendChild(el);
    const timer = setTimeout(dismiss, opts.duration || (opts.action ? 6000 : 3200));
    return dismiss;
  }

  // Branded confirm dialog — replaces native confirm(). Returns Promise<boolean>.
  // `body` may contain HTML (caller escapes any dynamic text).
  function confirmModal(o) {
    o = o || {};
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.innerHTML = `<div class="modal modal--confirm" role="dialog" aria-modal="true" aria-label="${esc(o.title || "Confirm")}">
        <div class="modal__head">
          <div class="modal__chip modal__chip--danger">${icon("alert")}</div>
          <div class="modal__title">${esc(o.title || "Are you sure?")}</div>
          <button class="modal__x" data-cancel aria-label="Close">&times;</button>
        </div>
        <div class="modal__body"><p class="confirm-text">${o.body || ""}</p></div>
        <div class="modal__foot">
          <button class="btn" data-cancel>${esc(o.cancelLabel || "Cancel")}</button>
          <button class="btn btn--accent" data-confirm>${esc(o.confirmLabel || "Confirm")}</button>
        </div>
      </div>`;
      document.body.appendChild(overlay);
      let done = false;
      const finish = (v) => { if (done) return; done = true; overlay.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
      const onKey = (e) => { if (e.key === "Escape") finish(false); else if (e.key === "Enter") finish(true); };
      document.addEventListener("keydown", onKey);
      overlay.querySelectorAll("[data-cancel]").forEach((b) => (b.onclick = () => finish(false)));
      overlay.querySelector("[data-confirm]").onclick = () => finish(true);
      overlay.onclick = (e) => { if (e.target === overlay) finish(false); };
      const cf = overlay.querySelector("[data-confirm]"); if (cf) cf.focus();
    });
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
  // Scrape strategies — the `value` is the technical key the scraper config needs;
  // the `label` + `desc` are plain-English so a non-technical user can pick one.
  const STRATEGY_INFO = [
    { value: "playwright_render", label: "Standard — renders the page (recommended)", desc: "Loads the page in a real browser so JavaScript-built listings appear. The safe default — start here if you're unsure." },
    { value: "static_html", label: "Simple page — no JavaScript", desc: "For plain HTML pages where the listings are already in the page source. Fast, but won't capture content that loads via JavaScript." },
    { value: "tricon_api", label: "Direct data feed (API)", desc: "Pulls listings straight from the site's underlying data feed. The most reliable option when a site exposes one." },
    { value: "modal_iterate", label: "Click-through pop-ups", desc: "For sites where each unit opens in a pop-up that must be clicked to read its price and details." },
    { value: "iframe_extract", label: "Embedded widget (iframe)", desc: "For listings shown inside an embedded third-party widget or frame rather than the page itself." },
    { value: "filter_iterate", label: "Filtered results — step through options", desc: "For pages that only reveal units after you apply filters (e.g., pick a bedroom type, then read the results)." },
    { value: "akamai_stealth", label: "Bot-protected site (stealth)", desc: "For sites behind heavy bot protection. Slower — use only if the standard option gets blocked." },
  ];

  function loadCustomBuildings() {
    try {
      const arr = JSON.parse(localStorage.getItem(CUSTOM_B_KEY) || "[]");
      arr.forEach((b) => { if (!D.buildings[b.id]) D.buildings[b.id] = b; });
    } catch (e) {}
  }
  function saveCustomBuildings() {
    try { localStorage.setItem(CUSTOM_B_KEY, JSON.stringify(Object.values(D.buildings).filter((b) => b.custom))); } catch (e) {}
  }
  // Scrape-setting edits on SEED buildings persist as a small overrides map (custom buildings
  // already round-trip in full via saveCustomBuildings).
  const SCRAPE_OVR_KEY = "comp_scrape_overrides_v1";
  function loadScrapeOverrides() {
    try {
      const m = JSON.parse(localStorage.getItem(SCRAPE_OVR_KEY) || "{}");
      Object.entries(m).forEach(([id, o]) => { const b = D.buildings[id]; if (b) Object.assign(b, o); });
    } catch (e) {}
  }
  function saveScrapeSettings(b) {
    if (b.custom) { saveCustomBuildings(); return; }   // full object already persisted
    try {
      const m = JSON.parse(localStorage.getItem(SCRAPE_OVR_KEY) || "{}");
      m[b.id] = { scrapeUrl: b.scrapeUrl || null, strategy: b.strategy || null, initialWaitMs: b.initialWaitMs != null ? b.initialWaitMs : null, scroll: b.scroll != null ? b.scroll : null };
      localStorage.setItem(SCRAPE_OVR_KEY, JSON.stringify(m));
    } catch (e) {}
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
    toast(`Added <b>${esc(b.name)}</b>`, { action: "Undo", onAction: () => deleteBuilding(id) });
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
    const stratOpts = STRATEGY_INFO.map((s) => `<option value="${s.value}">${esc(s.label)}</option>`).join("");
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
        <div class="field"><label for="ab-strat">How should we read this site? <span class="sub">(scrape strategy)</span></label>
          <select id="ab-strat">${stratOpts}</select>
          <div class="strat-desc" id="ab-strat-desc">${esc(STRATEGY_INFO[0].desc)}</div>
          <div class="geo-note">Not sure? Leave it on <b>Standard</b>. The scraper's onboarding (debug_url.py + new-site skill) confirms and auto-tunes this once API keys are configured — auto-detection can't run in the browser.</div>
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

    // live plain-English description of the selected scrape strategy
    const stratDescMap = Object.fromEntries(STRATEGY_INFO.map((s) => [s.value, s.desc]));
    $("#ab-strat").onchange = () => { $("#ab-strat-desc").textContent = stratDescMap[$("#ab-strat").value] || ""; };

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
    const inAnalysis = route.includes("/analysis/");
    let html = `<button class="nav-item ${route.startsWith("#/universe") ? "active" : ""}" data-go="#/universe" title="Building Universe">
        ${icon("globe")}<span class="nav-item__label">Building Universe</span></button>`;
    // collapsed rail shows ONE "Analyses" icon (not every analysis) — clicking it
    // expands the sidebar to reveal the full list. Hidden when expanded.
    html += `<button class="nav-item nav-collapsed-only ${inAnalysis ? "active" : ""}" data-action="expand-sidebar" title="Analyses">
        ${icon("list")}<span class="nav-item__label">Analyses</span></button>`;
    html += `<div class="sidebar__section">Analyses</div>`;
    for (const a of D.analyses) {
      const active = route.includes("/analysis/" + a.id);
      html += `<button class="nav-item nav-expanded-only ${active ? "active" : ""}" data-go="#/analysis/${a.id}" title="${esc(a.name)}">
          ${icon("building")}<span class="nav-item__label">${esc(a.name)}</span>${a.custom ? '<span class="nav-tag">custom</span>' : ""}</button>`;
    }
    html += `<button class="nav-item nav-expanded-only" data-action="new-analysis" title="New Analysis">${icon("plus")}<span class="nav-item__label">New Analysis</span></button>`;
    $nav.innerHTML = html;
    positionNavRail(navRailReady); navRailReady = true;   // glide the orange bar to the active item
    $nav.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => (location.hash = b.dataset.go)));
    $nav.querySelectorAll('[data-action="new-analysis"]').forEach((b) => (b.onclick = openNewAnalysisModal));
    $nav.querySelectorAll('[data-action="expand-sidebar"]').forEach((b) => (b.onclick = () => {
      setSidebarOpen(true);
      // snap to the first analysis when expanding from the collapsed rail
      // (unless you're already viewing one — then just reveal the list)
      if (!location.hash.includes("/analysis/") && D.analyses[0]) location.hash = `#/analysis/${D.analyses[0].id}`;
    }));
  }
  // Collapse/expand the sidebar (in-memory; not persisted — always open on load).
  function setSidebarOpen(open) {
    const sb = document.getElementById("sidebar");
    if (!sb) return;
    sb.classList.toggle("collapsed", !open);
    const tg = document.getElementById("sb-toggle");
    if (tg) { tg.title = open ? "Collapse sidebar" : "Expand sidebar"; tg.setAttribute("aria-label", tg.title); }
    if (uMap) setTimeout(() => { try { uMap.invalidateSize(); } catch (e) {} }, 200); // map fills new width
    positionNavRail(false);                                    // item positions shift; re-place instantly…
    setTimeout(() => positionNavRail(false), 220);             // …and again once the width settles
  }

  // Single persistent orange active-bar that glides to the active nav item. The
  // bar lives outside #nav (which is rebuilt each route) so it survives re-renders.
  let navRailReady = false;
  function positionNavRail(animate) {
    const sb = document.getElementById("sidebar");
    if (!sb) return;
    let rail = sb.querySelector(".nav-rail");
    if (!rail) { rail = document.createElement("div"); rail.className = "nav-rail"; sb.appendChild(rail); }
    const actives = [...sb.querySelectorAll("#nav .nav-item.active")];
    const active = actives.find((el) => el.offsetParent !== null) || actives[0];  // the VISIBLE active (collapsed vs expanded)
    if (!active) { rail.style.opacity = "0"; return; }
    const sr = sb.getBoundingClientRect(), ar = active.getBoundingClientRect();
    const place = () => {
      rail.style.left = (ar.left - sr.left) + "px";
      rail.style.top = (ar.top - sr.top + 8) + "px";
      rail.style.height = Math.max(12, ar.height - 16) + "px";
      rail.style.opacity = "1";
    };
    if (animate && !prefersReduced) { place(); }
    else { rail.style.transition = "none"; place(); void rail.offsetWidth; rail.style.transition = ""; }
  }

  // ===================================================== Building Universe ===
  let buState = { q: "", view: "list", city: "__all", bucket: "__all", assetType: "__all", owner: "__all", era: "__all", rentBand: "__all", psfBand: "__all", sort: "name" };
  let uMap = null, uCluster = null, uLines = null, uBenchMarker = null, uCompMarkers = [], mkAnimTimer = null;
  let mapRestoreView = null;   // {center, zoom, spider} to restore on a back-arrow return (vs the default fit)
  let uMarkerById = {};        // bid -> marker for the current render (used to re-find a cluster to spiderfy)
  let uSpiderfied = null;      // the currently spiderfied (fanned-out) cluster, tracked via cluster events
  let uOpenPopupBid = null;    // bid of the marker whose popup card is currently open
  let uIntroTimers = [];   // pending batched-intro timers, cleared before any re-render so a
                           // mid-intro search/filter/toggle cancels cleanly and renders the final state.
  function clearIntroTimers() { uIntroTimers.forEach((t) => clearTimeout(t)); uIntroTimers = []; }
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

  // ---- Universe advanced filters + sort (list view) ------------------------
  // A building's latest weighted rent / PSF (from the building_summary rollup).
  const rentOf = (b) => { const s = D.summary[b.id]; return s && s.weighted ? s.weighted.avgRent : null; };
  const psfOf = (b) => { const s = D.summary[b.id]; return s && s.weighted ? s.weighted.avgPsf : null; };
  // Non-numeric keys: JS reorders integer-like object keys ascending, which would
  // flip this dropdown to oldest-first. Prefixed keys keep insertion (newest→oldest).
  const ERAS = {
    e2020: { label: "2020 or newer", test: (y) => y >= 2020 },
    e2010: { label: "2010–2019", test: (y) => y >= 2010 && y < 2020 },
    e2000: { label: "2000–2009", test: (y) => y >= 2000 && y < 2010 },
    older: { label: "Before 2000", test: (y) => y < 2000 },
  };
  const RENT_BANDS = {
    lt2000: { label: "Under $2,000", test: (v) => v < 2000 },
    "2to3": { label: "$2,000–3,000", test: (v) => v >= 2000 && v < 3000 },
    "3to4": { label: "$3,000–4,000", test: (v) => v >= 3000 && v < 4000 },
    gte4: { label: "$4,000+", test: (v) => v >= 4000 },
  };
  const PSF_BANDS = {
    lt3: { label: "Under $3/sf", test: (v) => v < 3 },
    "3to4": { label: "$3–4/sf", test: (v) => v >= 3 && v < 4 },
    "4to5": { label: "$4–5/sf", test: (v) => v >= 4 && v < 5 },
    gte5: { label: "$5+/sf", test: (v) => v >= 5 },
  };
  const _nl = (v) => v == null || Number.isNaN(v);                  // null/NaN → sort last
  const _byNum = (fn, dir) => (a, b) => {
    const va = fn(a), vb = fn(b);
    if (_nl(va) && _nl(vb)) return a.name.localeCompare(b.name);
    if (_nl(va)) return 1;
    if (_nl(vb)) return -1;
    return dir === "asc" ? va - vb : vb - va;
  };
  const SORTERS = {
    name: (a, b) => a.name.localeCompare(b.name),
    name_desc: (a, b) => b.name.localeCompare(a.name),
    rent_desc: _byNum(rentOf, "desc"),
    rent_asc: _byNum(rentOf, "asc"),
    psf_desc: _byNum(psfOf, "desc"),
    psf_asc: _byNum(psfOf, "asc"),
    year_desc: _byNum((b) => b.yearBuilt, "desc"),
    year_asc: _byNum((b) => b.yearBuilt, "asc"),
    units_desc: _byNum((b) => b.unitCount, "desc"),
    units_asc: _byNum((b) => b.unitCount, "asc"),
    recent: (a, b) => (b.lastScrape || "").localeCompare(a.lastScrape || "") || a.name.localeCompare(b.name),
    recent_asc: (a, b) => {
      // never-scraped sort last in both orientations; otherwise oldest scrape first
      if (!a.lastScrape && !b.lastScrape) return a.name.localeCompare(b.name);
      if (!a.lastScrape) return 1;
      if (!b.lastScrape) return -1;
      return a.lastScrape.localeCompare(b.lastScrape) || a.name.localeCompare(b.name);
    },
  };
  function distinctVals(key) {
    const set = new Set();
    Object.values(D.buildings).forEach((b) => { if (b.isActive !== false && b[key]) set.add(b[key]); });
    return [...set].sort((a, b) => String(a).localeCompare(String(b)));
  }
  // The fully-filtered + sorted list that backs the universe grid.
  function universeFiltered() {
    const q = (buState.q || "").trim().toLowerCase();
    let list = Object.values(D.buildings).filter((b) => b.isActive !== false);
    if (q) list = list.filter((b) => (b.name + " " + (b.address || "") + " " + (b.city || "") + " " + (b.owner || "")).toLowerCase().includes(q));
    if (buState.city !== "__all") list = list.filter((b) => b.city === buState.city);
    if (buState.assetType !== "__all") list = list.filter((b) => (b.assetType || "") === buState.assetType);
    if (buState.owner !== "__all") list = list.filter((b) => (b.owner || "") === buState.owner);
    if (buState.era !== "__all") list = list.filter((b) => b.yearBuilt != null && ERAS[buState.era].test(b.yearBuilt));
    if (buState.rentBand !== "__all") list = list.filter((b) => { const v = rentOf(b); return v != null && RENT_BANDS[buState.rentBand].test(v); });
    if (buState.psfBand !== "__all") list = list.filter((b) => { const v = psfOf(b); return v != null && PSF_BANDS[buState.psfBand].test(v); });
    return list.sort(SORTERS[buState.sort] || SORTERS.name);
  }
  // any filter / sort / search away from defaults? (drives the Reset button state)
  function buDirty() {
    return !!(buState.q || buState.sort !== "name" ||
      ["city", "assetType", "owner", "era", "rentBand", "psfBand"].some((k) => buState[k] !== "__all"));
  }
  function universeFilterBar() {
    const opt = (pairs, sel) => pairs.map(([v, l]) => `<option value="${esc(v)}" ${sel === v ? "selected" : ""}>${esc(l)}</option>`).join("");
    const fromVals = (head, key) => [["__all", head]].concat(distinctVals(key).map((v) => [v, v]));
    const fromMap = (head, map) => [["__all", head]].concat(Object.entries(map).map(([k, v]) => [k, v.label]));
    const sortOpts = [
      ["name", "Name (A–Z)"], ["name_desc", "Name (Z–A)"], ["rent_desc", "Avg rent (high→low)"], ["rent_asc", "Avg rent (low→high)"],
      ["psf_desc", "Avg PSF (high→low)"], ["psf_asc", "Avg PSF (low→high)"],
      ["year_desc", "Year built (newest)"], ["year_asc", "Year built (oldest)"],
      ["units_desc", "Units (most)"], ["units_asc", "Units (fewest)"],
      ["recent", "Recently scraped"], ["recent_asc", "Least recently scraped"],
    ];
    const dirty = buDirty();
    return `<div class="bu-filters">
      <select id="f-city" class="fsel">${opt(fromVals("All cities", "city"), buState.city)}</select>
      <select id="f-asset" class="fsel">${opt(fromVals("All types", "assetType"), buState.assetType)}</select>
      <select id="f-owner" class="fsel">${opt(fromVals("All owners", "owner"), buState.owner)}</select>
      <select id="f-era" class="fsel">${opt(fromMap("Any era", ERAS), buState.era)}</select>
      <select id="f-rent" class="fsel">${opt(fromMap("Any rent", RENT_BANDS), buState.rentBand)}</select>
      <select id="f-psf" class="fsel">${opt(fromMap("Any PSF", PSF_BANDS), buState.psfBand)}</select>
      <span class="bu-filters__spacer"></span>
      <label class="bu-sort">Sort <select id="f-sort" class="fsel">${opt(sortOpts, buState.sort)}</select></label>
      <button class="btn bu-reset" id="f-clear"${dirty ? "" : " disabled"}>Reset filters</button>
    </div>
    <div class="bu-count" id="bu-count"></div>`;
  }

  function destroyMap() {
    clearIntroTimers();
    if (uMap) { try { uMap.remove(); } catch (e) {} }
    uMap = null; uCluster = null; uLines = null; uSpiderfied = null; uMarkerById = {}; uOpenPopupBid = null;
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
      body = universeFilterBar() + `<div class="bu-grid bu-grid--enter"></div>`;
    }

    $view.innerHTML = `
      <div class="page-head">
        <div class="page-head__main">
          <h1 class="page-title">Building Universe</h1>
          <div class="page-sub">${universeList("").length} buildings tracked · ${D.analyses.length} analyses · seed exported ${esc(D.generatedAt)}</div>
        </div>
        <div class="page-actions">
          <div class="search">${icon("search")}<input id="bu-search" placeholder="Search buildings, address, city, etc." value="${esc(buState.q)}"/></div>
          <div class="segmented" data-seg="universe-view">
            <button data-v="list" class="${buState.view === "list" ? "active" : ""}">List</button>
            <button data-v="map" class="${buState.view === "map" ? "active" : ""}">Map</button>
          </div>
          <button class="btn btn--accent" id="bu-add">${icon("plus")} Add Building</button>
        </div>
      </div>
      ${body}`;

    const refreshGrid = (animate) => {
      const items = universeFiltered();
      const g = $view.querySelector(".bu-grid");
      if (g) {
        g.classList.toggle("bu-grid--enter", !!animate);   // stagger only on full renders
        g.innerHTML = items.length ? items.map((b, i) => buCard(b, i)).join("") : `<div class="card" style="grid-column:1/-1"><div class="empty">${icon("search")}<br/>No buildings match these filters.</div></div>`;
      }
      const c = $view.querySelector("#bu-count");
      if (c) c.textContent = `Showing ${items.length} of ${universeList("").length} buildings`;
      const rb = $view.querySelector("#f-clear");      // keep the Reset button's state live
      if (rb) rb.disabled = !buDirty();
    };

    const s = document.getElementById("bu-search");
    s.oninput = () => {
      buState.q = s.value;
      if (buState.view === "map" && uCluster) setUniverseMarkers();
      else refreshGrid(false);
    };
    $view.querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => { buState.view = b.dataset.v; renderUniverse(); }));
    const addBtn = document.getElementById("bu-add");
    if (addBtn) addBtn.onclick = openAddBuildingModal;

    // list-view advanced filters + sort (stagger the cards in on each change;
    // search stays instant so typing isn't jittery)
    const bindSel = (id, key) => { const el = document.getElementById(id); if (el) el.onchange = () => { buState[key] = el.value; refreshGrid(true); }; };
    bindSel("f-city", "city"); bindSel("f-asset", "assetType"); bindSel("f-owner", "owner");
    bindSel("f-era", "era"); bindSel("f-rent", "rentBand"); bindSel("f-psf", "psfBand"); bindSel("f-sort", "sort");
    const clrBtn = document.getElementById("f-clear");
    if (clrBtn) clrBtn.onclick = () => {
      Object.assign(buState, { q: "", city: "__all", assetType: "__all", owner: "__all", era: "__all", rentBand: "__all", psfBand: "__all", sort: "name" });
      renderUniverse();
    };
    if (buState.view === "list") refreshGrid(!universeInstant);   // stagger in, unless this is a back-arrow restore

    if (buState.view === "map" && hasLeaflet) wireMap(filtered);
    initSegmenteds($view);   // glide the List/Map pill on direct re-renders
    updateToTop();           // hide the back-to-top button when flipping to map / re-filtering
  }

  // ---- Map (Leaflet + CartoDB Positron, branded markers) -------------------
  function mapCities() {
    const counts = {};
    universeList("").forEach((b) => { if (b.lat != null && b.city) counts[b.city] = (counts[b.city] || 0) + 1; });
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  }
  // Toolbar contents (compare-set picker + city chips + legend). Extracted so a
  // bucket change can re-render it in place without remounting the Leaflet map.
  function mapToolbarInner() {
    const cityBtns = ['<button class="city-btn ' + (buState.city === "__all" ? "active" : "") + '" data-city="__all">All</button>']
      .concat(mapCities().map((c) => `<button class="city-btn ${buState.city === c ? "active" : ""}" data-city="${esc(c)}">${esc(c)}</button>`)).join("");
    const bucketOpts = ['<option value="__all">All buildings</option>']
      .concat(D.analyses.map((a) => `<option value="${a.id}" ${buState.bucket === a.id ? "selected" : ""}>${esc(a.name)} (${a.comps.length} comps)</option>`)).join("");
    const inBucket = buState.bucket && buState.bucket !== "__all";
    return `<div class="bucket-pick">
        <label for="bu-bucket">Compare set</label>
        <select id="bu-bucket">${bucketOpts}</select>
      </div>
      <div class="city-btns" ${inBucket ? 'style="opacity:.5;pointer-events:none"' : ""}>${cityBtns}</div>
      <div class="map-legend">
        <span class="lg"><span class="swatch bench"></span> ${inBucket ? "Benchmark" : "Fitzrovia benchmark"}</span>
        <span class="lg"><span class="swatch comp"></span> ${inBucket ? "Comp in set" : "Competitor"}</span>
        ${inBucket ? '<span class="lg"><span class="swatch line"></span> Compared to</span>' : ""}
      </div>`;
  }
  function mapShellHtml(list) {
    return `<div class="map-shell">
      <div class="map-toolbar">${mapToolbarInner()}</div>
      <div id="bu-map"></div>
    </div>`;
  }
  function markerIcon(isBench, i) {
    const glyph = isBench ? ICONS.star : ICONS.building;
    const delay = Math.min(i || 0, 16) * 30;   // staggered fade/drop-in
    return window.L.divIcon({
      className: "",
      html: `<div class="mk ${isBench ? "mk--bench" : "mk--comp"}" style="animation-delay:${delay}ms"><svg viewBox="0 0 24 24">${glyph}</svg></div>`,
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
    const photo = `<div class="pop-media"><span class="ph">${icon("building")}</span>${b.photo ? `<img src="${esc(b.photo)}" loading="lazy" onerror="this.style.display='none'"/>` : ""}</div>`;
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
  function setUniverseMarkers(focusBench, fly, intro) {
    if (!uCluster) return;
    const mapEl = document.getElementById("bu-map");
    clearIntroTimers();   // cancel any in-flight intro so this render wins cleanly
    // Intro only on the full universe view (no compare set anchored) — a bucket entry
    // is about surfacing its benchmark, not a blank-map populate.
    const doIntro = !!(intro && mapEl && !prefersReduced && (!buState.bucket || buState.bucket === "__all"));
    // Back-arrow return to the map: restore the exact pan/zoom and show markers with NO
    // entrance animation — the user was just here, so any fade reads as a needless redraw.
    const restoringMap = !!(mapRestoreView && uMap);
    if (mapEl) {
      // mk-animate = the light one-time fade for in-place updates. mk-intro = hold the
      // markers invisible until playMapIntro grows the bubbles in + ticks their counts.
      // Both only present during an intentional load window, never on zoom split/merge.
      mapEl.classList.remove("mk-animate", "mk-intro"); clearTimeout(mkAnimTimer);
      if (doIntro) mapEl.classList.add("mk-intro");
      else if (!restoringMap) { mapEl.classList.add("mk-animate"); mkAnimTimer = setTimeout(() => mapEl.classList.remove("mk-animate"), 900); }
    }
    const { list, benchSet, anchor } = bucketBuildings();
    uCluster.clearLayers();
    if (uLines) uLines.clearLayers();
    const pts = [];
    let benchMarker = null;
    const compMarkers = [];
    const made = [];   // built-but-not-yet-added markers (so the intro can populate in batches)
    uMarkerById = {};

    list.forEach((b, i) => {
      if (b.lat == null || b.lng == null) return;
      const m = window.L.marker([b.lat, b.lng], { icon: markerIcon(benchSet.has(b.id), i) });
      m._bid = b.id;                 // tag so a back-arrow restore can re-find a marker → its cluster
      uMarkerById[b.id] = m;
      m.bindTooltip(tipHtml(b), { direction: "top", offset: [0, -16], className: "mk-tip", opacity: 1 });
      m.bindPopup(popupHtml(b), {
        className: "mk-pop", closeButton: true, closeOnClick: false, autoClose: true,
        minWidth: 232, maxWidth: 264, offset: [0, -12],
      });
      // hide the hover hint while the persistent popup is open; track which card is open
      // so a back-arrow return to the map can reopen it.
      m.on("popupopen", () => { m.closeTooltip(); uOpenPopupBid = b.id; });
      m.on("popupclose", () => { if (uOpenPopupBid === b.id) uOpenPopupBid = null; });
      if (anchor && b.id === anchor.id) benchMarker = m;
      else if (anchor) compMarkers.push(m);
      pts.push([b.lat, b.lng]);
      made.push({ m, city: b.city || "" });
    });
    uBenchMarker = benchMarker; uCompMarkers = compMarkers;   // for cluster-aware connector lines
    // Back-arrow restore: drop straight onto the exact pan/zoom the user left, skipping
    // the default fit, the populate intro, and the benchmark auto-focus (all of which
    // would move the map). Otherwise frame the view normally.
    let restoreSpider = null, restorePopupBid = null;
    if (restoringMap) {
      uMap.setView(mapRestoreView.center, mapRestoreView.zoom, { animate: false });
      restoreSpider = mapRestoreView.spider || null;   // re-open the cluster that was fanned out
      restorePopupBid = mapRestoreView.popup || null;  // reopen the popup card that was open
      mapRestoreView = null;
    } else if (pts.length) {
      if (fly) uMap.flyToBounds(pts, { padding: [50, 50], maxZoom: 15, duration: 0.6 });   // glide to the new set
      else uMap.fitBounds(pts, { padding: [50, 50], maxZoom: 15, animate: !doIntro });
    } else uMap.setView([43.7, -79.4], 11);
    uCluster.addLayers(made.map((x) => x.m));                 // add all at once
    if (restoreSpider || restorePopupBid) setTimeout(() => restoreMapState(restoreSpider, restorePopupBid), 60);
    if (doIntro && !restoringMap) requestAnimationFrame(() => requestAnimationFrame(() => playMapIntro(mapEl)));   // then grow bubbles + tick counts
    // when a compare set is selected, open the benchmark popup to start
    // (de-cluster it first if needed); normal click/collapse rules apply after
    if (focusBench && benchMarker && !restoringMap) {
      // A marker hidden inside a cluster can't show a popup — openPopup() is a no-op
      // until it's exposed. With animate:true both the fly-zoom and the spiderfy are
      // animated, so any single fixed delay races them and the popup silently drops.
      // Poll instead: each tick, if the benchmark is de-clustered open it directly,
      // otherwise spiderfy the cluster it's in; also open the moment a spiderfy lands.
      // Keeps the whole set framed (no extra zoom) while reliably surfacing the key prop.
      const isOpen = () => !!(benchMarker.isPopupOpen && benchMarker.isPopupOpen());
      const reveal = () => {
        if (isOpen()) return true;
        let parent = benchMarker;
        try { parent = uCluster.getVisibleParent ? uCluster.getVisibleParent(benchMarker) : benchMarker; } catch (e) {}
        if (!parent || parent === benchMarker) { try { benchMarker.openPopup(); } catch (e) {} return isOpen(); }
        if (parent.spiderfy) { try { parent.spiderfy(); } catch (e) {} }   // exposes it; popup opens via onShown / next tick
        return false;
      };
      const onShown = () => { try { benchMarker.openPopup(); } catch (e) {} };
      uCluster.on("spiderfied", onShown);
      let tries = 0, reopened = 0, revealActive = true;
      const tick = () => { if (reveal() || tries++ > 10) { uCluster.off("spiderfied", onShown); return; } setTimeout(tick, 200); };
      // Backstop: if the card auto-collapses right after opening (a trailing zoom from the
      // glide can unspiderfy the cluster and drop the spider-leg marker's popup — seen on
      // Quartier des Spectacles / Cabbagetown), reveal it once more. Bounded to the snap
      // window so a genuine user close afterwards is still honoured.
      const onClose = () => { if (revealActive && reopened++ < 1) { tries = 0; setTimeout(tick, 140); } };
      benchMarker.on("popupclose", onClose);
      setTimeout(() => { revealActive = false; benchMarker.off("popupclose", onClose); }, 1800);
      let started = false;
      const start = () => { if (started) return; started = true; setTimeout(tick, fly ? 180 : 150); };
      // Prefer to poll once the glide settles, but flyToBounds emits no moveend when the
      // target bounds ~= the current view (e.g. hopping between two nearby Toronto sets),
      // which left the benchmark popup unopened. Fall back to a timer so it always runs.
      if (fly && uMap) { uMap.once("moveend", start); setTimeout(start, 800); }
      else start();
    }
    setTimeout(drawLines, fly ? 650 : 0);   // draw connector lines once the cluster settles
  }
  // Back-arrow return to the map: re-create the interactive state the user left — the
  // fanned-out (spiderfied) cluster and the open popup card. Each finds its marker via
  // uMarkerById, exposes it (spiderfy if still clustered), and opens; a short poll rides
  // out the spiderfy animation. No-ops cleanly if a marker is gone or already individual.
  function restoreMapState(spiderBids, popupBid) {
    if (spiderBids && spiderBids.length) {
      try {
        const bid = spiderBids.find((id) => uMarkerById[id]);
        const m = bid && uMarkerById[bid];
        const p = (m && uCluster && uCluster.getVisibleParent) ? uCluster.getVisibleParent(m) : null;
        if (p && p !== m && p.spiderfy) p.spiderfy();
      } catch (e) {}
    }
    const pm = popupBid && uMarkerById[popupBid];
    if (pm) {
      let tries = 0;
      const open = () => {
        if (!uCluster || (pm.isPopupOpen && pm.isPopupOpen())) return;
        let p = pm;
        try { p = uCluster.getVisibleParent ? uCluster.getVisibleParent(pm) : pm; } catch (e) {}
        if (!p || p === pm) { try { pm.openPopup(); } catch (e) {} return; }   // exposed → open the card
        if (p.spiderfy) { try { p.spiderfy(); } catch (e) {} }                 // still clustered → fan out, retry
        if (tries++ < 8) setTimeout(open, 150);
      };
      open();
    }
  }
  // View-entry intro: hold the layer invisible (mk-intro), then grow each cluster
  // bubble up to size while its number ticks up (0 → final count, easeOutCubic);
  // standalone markers simply grow/fade in. Ends in the normal interactive state.
  // Count timers are tracked (uIntroTimers) so a search / filter / toggle mid-intro
  // cancels cleanly; the hold is released after the longest animation lands.
  function playMapIntro(mapEl) {
    if (!mapEl) return;
    const clusters = Array.prototype.slice.call(mapEl.querySelectorAll(".mk-cluster"));
    const singles = Array.prototype.slice.call(mapEl.querySelectorAll(".leaflet-marker-icon .mk"));
    if (!clusters.length && !singles.length) { mapEl.classList.remove("mk-intro"); return; }
    const GROW = 720;
    const cd = (els) => { const r = mapEl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      els.sort((a, b) => { const A = a.getBoundingClientRect(), B = b.getBoundingClientRect();
        return Math.hypot(A.left - cx, A.top - cy) - Math.hypot(B.left - cx, B.top - cy); }); };
    cd(clusters); cd(singles);                                  // centre-out reveal order
    // both-fill keeps each bubble at its final state once it lands (early ones don't snap
    // back to the mk-intro hold); the inline anim is cleared at settle, restoring :hover.
    singles.forEach((el, i) => { el.style.animation = `mkGrow 460ms var(--ease) ${Math.min(i, 12) * 40}ms both`; });
    let maxDelay = 0;
    clusters.forEach((el, i) => {
      const delay = Math.min(i, 12) * 55; maxDelay = Math.max(maxDelay, delay);
      el.style.animation = `mkGrow ${GROW}ms var(--ease) ${delay}ms both`;
      const numEl = el.querySelector("div");
      const target = numEl ? (parseInt(numEl.textContent, 10) || 0) : 0;
      if (numEl && target > 0) {
        numEl.textContent = "0";
        const t = setTimeout(() => {                            // start ticking when this bubble begins to grow
          const t0 = performance.now();
          const tick = (now) => {
            const p = Math.min(1, (now - t0) / GROW);
            const e = 1 - Math.pow(1 - p, 3);                   // easeOutCubic
            numEl.textContent = String(Math.round(target * e));
            if (p < 1) requestAnimationFrame(tick); else numEl.textContent = String(target);
          };
          requestAnimationFrame(tick);
        }, delay);
        uIntroTimers.push(t);
      }
    });
    clearTimeout(mkAnimTimer);
    mkAnimTimer = setTimeout(() => {                            // settle: drop the hold first, then inline anims
      mapEl.classList.remove("mk-intro");
      clusters.concat(singles).forEach((el) => { el.style.animation = ""; });
    }, maxDelay + GROW + 80);
  }
  // Connector lines: benchmark → each VISIBLE comp target. Comps hidden inside a
  // cluster collapse to a single line to that cluster (and fan out as it expands).
  function drawLines() {
    if (!uLines || !uCluster) return;
    uLines.clearLayers();
    if (!uBenchMarker) return;                       // only in compare-set (anchored) mode
    const gvp = (m) => (uCluster.getVisibleParent && uCluster.getVisibleParent(m)) || m;
    const aParent = gvp(uBenchMarker);
    if (!aParent || !aParent.getLatLng) return;
    const aLL = aParent.getLatLng();
    const seen = new Set();
    uCompMarkers.forEach((m) => {
      const vp = gvp(m);
      if (!vp || vp === aParent || !vp.getLatLng) return;   // same cluster as benchmark → no line
      const ll = vp.getLatLng();
      const key = ll.lat.toFixed(5) + "," + ll.lng.toFixed(5);
      if (seen.has(key)) return;                            // one line per visible cluster/marker
      seen.add(key);
      window.L.polyline([aLL, ll], { color: "#1F2750", weight: 1.5, opacity: 0.35, dashArray: "4 5", interactive: false }).addTo(uLines);
    });
  }
  function wireMap(list) {
    const L = window.L;
    uMap = L.map("bu-map", { zoomControl: true, scrollWheelZoom: true, attributionControl: true });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd", maxZoom: 19, attribution: "&copy; OpenStreetMap, &copy; CARTO",
    }).addTo(uMap);
    uLines = L.layerGroup().addTo(uMap);
    uCluster = L.markerClusterGroup
      // removeOutsideVisibleBounds:false keeps all markers in the DOM (no perf cost
      // at our scale) so none vanish mid-zoom. animate:true gives the slide-out when
      // a cluster splits — safe now that the marker fade is gated to load only and no
      // longer fights the split animation.
      ? L.markerClusterGroup({ iconCreateFunction: clusterIcon, maxClusterRadius: 48, showCoverageOnHover: false, spiderfyOnMaxZoom: true, removeOutsideVisibleBounds: false, animate: true })
      : L.layerGroup();
    uMap.addLayer(uCluster);
    // re-aim connector lines as clusters form/break — deferred a tick so
    // markercluster has recomputed visible parents before we read them.
    const redraw = () => setTimeout(drawLines, 0);
    uMap.on("zoomend moveend", redraw);
    uCluster.on("spiderfied unspiderfied animationend", redraw);
    // remember which cluster is fanned out so a back-arrow return can re-open it
    uCluster.on("spiderfied", (e) => { uSpiderfied = e.cluster; });
    uCluster.on("unspiderfied", () => { uSpiderfied = null; });
    setUniverseMarkers(true, false, !universeInstant);  // view entry: populate intro (skipped on back-arrow restore)
    setTimeout(() => uMap && uMap.invalidateSize(), 60);
    wireMapToolbar();
  }
  function wireMapToolbar() {
    const bucketSel = document.getElementById("bu-bucket");
    if (bucketSel) bucketSel.onchange = () => {
      buState.bucket = bucketSel.value;
      buState.city = "__all";
      const tb = $view.querySelector(".map-toolbar");
      if (tb) { tb.innerHTML = mapToolbarInner(); wireMapToolbar(); }   // refresh legend / city-lock in place
      setUniverseMarkers(true, true);   // rebuild markers + GLIDE to the new set (no map remount)
    };

    $view.querySelectorAll("[data-city]").forEach((btn) => (btn.onclick = () => {
      buState.city = btn.dataset.city;
      $view.querySelectorAll("[data-city]").forEach((x) => x.classList.toggle("active", x === btn));
      const subset = bucketBuildings().list.filter((b) => b.lat != null && (buState.city === "__all" || b.city === buState.city)).map((b) => [b.lat, b.lng]);
      if (subset.length && uMap) uMap.flyToBounds(subset, { padding: [40, 40], maxZoom: buState.city === "__all" ? 14 : 13, duration: 0.6 });   // smooth pan/zoom
    }));
  }
  function buCard(b, i) {
    const sum = D.summary[b.id];
    const delay = `style="animation-delay:${Math.min(i || 0, 16) * 32}ms"`;   // staggered entrance (capped)
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
    return `<div class="bcard" ${delay} data-go="#/building/${b.id}" onclick="location.hash='#/building/${b.id}'">
      <div class="bcard__photo">
        ${photo}
        <div class="bcard__overlay">
          <div class="bcard__name">${esc(b.name)}</div>
          ${b.city ? `<div class="bcard__city">${esc(b.city)}${b.province ? ", " + esc(b.province) : ""}</div>` : ""}
        </div>
      </div>
      <div class="bcard__body">
        <div class="bcard__addr">${esc(b.address || "—")}</div>
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

  // Run dates offered in the picker = the benchmark's stored snapshot dates (newest
  // first); fall back to the union of comp dates if no benchmark history. Show all stored
  // (≤15) so the earliest scrape is selectable — and correctly has no older baseline.
  function runDates(a) {
    const snaps = D.snapshots || {};
    if (a.benchmark && snaps[a.benchmark] && snaps[a.benchmark].length) return snaps[a.benchmark].map((s) => s.date).slice(0, 15);
    const set = new Set();
    a.comps.forEach((c) => (snaps[c.building] || []).forEach((s) => set.add(s.date)));
    return [...set].sort().reverse().slice(0, 15);
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
  // The user picks the PRIMARY snapshot (selectedSnap, default latest) and an OLDER snapshot
  // as the comparison baseline (the Δ and the faint "was" value are measured against it).
  // Baseline options are whatever is older than the chosen primary; default = the next older.
  const cmpState = {};   // analysisId -> chosen baseline snapshot date
  const baselineOpts = (a) => {
    const ds = runDates(a), pi = ds.indexOf(selectedSnap(a));
    return pi >= 0 ? ds.slice(pi + 1) : ds.slice(1);
  };
  const compareBaseline = (a) => {
    const opts = baselineOpts(a), sel = cmpState[a.id];
    return (sel && opts.includes(sel)) ? sel : (opts[0] || null);
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
      const ids = [...selected];
      if (ids.length) addCompsToAnalysis(a, ids);
      close();
      route(); // re-render the current analysis page with the new comps
      if (ids.length) toast(`Added ${ids.length} building${ids.length === 1 ? "" : "s"} to the set`, { action: "Undo", onAction: () => { ids.forEach((id) => removeCompFromAnalysis(a, id)); route(); } });
    };
  }

  // ---- file download helpers (exports build real .xlsx via XlsxLite) -------
  function downloadFile(name, content, mime) {
    downloadBlob(name, new Blob([content], { type: mime + ";charset=utf-8" }));
  }
  function downloadBlob(name, blob) {
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
    const vsSubjectPsf = (p) => (bPsf && p != null) ? Math.round(((p - bPsf) / bPsf) * 100) : null;

    // ---- build a REAL .xlsx (Open XML / PK-zip) so Excel opens it with no
    // format/extension warning. Two tabs: Comp Analysis + Building Details.
    const wb = XlsxLite.createWorkbook();
    const reg = wb.style;                        // styles shared across both sheets
    const WHITE = "#FFFFFF";
    const NF_INT = "#,##0", NF_DEC = "0.00", NF_YEAR = "0", NF_PCT1 = "0.0", NF_VS = '+0"%";-0"%";0"%"';

    // style helper: cell with optional fill / font / numFmt / top border
    const cs = (o) => reg({
      font: { sz: o.sz || 11, bold: o.bold, italic: o.italic, color: o.color || NAVY },
      fill: o.fill || null,
      align: { h: o.h || "center", v: "center", wrap: o.wrap },
      numFmt: o.nf || null,
      border: o.top ? { top: { style: o.topW || "thin", color: o.topC || SEP } } : null,
    });
    const sTitle = cs({ sz: 13, bold: true, color: WHITE, fill: NAVY, h: "left" });
    const sMeta = cs({ sz: 10, color: GREY, fill: WARM, h: "left", wrap: true });
    const sBand = cs({ sz: 9, bold: true, color: NAVY, fill: LBLUE, h: "left" });
    const sFoot = cs({ sz: 8, italic: true, color: GREY, h: "left", wrap: true });
    const sHeadL = reg({ font: { sz: 9, bold: true, color: WHITE }, fill: NAVY, align: { h: "left", v: "center", wrap: true } });
    const sHeadC = reg({ font: { sz: 9, bold: true, color: WHITE }, fill: NAVY, align: { h: "center", v: "center", wrap: true } });
    // KPI cards span two columns; put left-edge borders on the anchor and right-
    // edge borders on the covered cell so the box is closed on BOTH sides (a single
    // merged style would draw the right border at the interior column boundary).
    const kpiValA = (color) => reg({ font: { sz: 13, bold: true, color }, fill: WHITE, align: { h: "center", v: "center" }, border: { top: { color: BORDER }, left: { color: BORDER } } });
    const kpiValC = reg({ fill: WHITE, border: { top: { color: BORDER }, right: { color: BORDER } } });
    const kpiLabA = reg({ font: { sz: 8, color: GREY }, fill: WHITE, align: { h: "center", v: "center", wrap: true }, border: { bottom: { color: BORDER }, left: { color: BORDER } } });
    const kpiLabC = reg({ fill: WHITE, border: { bottom: { color: BORDER }, right: { color: BORDER } } });
    const metaLine = `Benchmark: ${bench ? bench.name : "—"}  ·  ${snap ? fmtDate(snap) : "Latest"}  ·  ${ncomp} comps` +
      (subjRank ? `  ·  Subject #${subjRank} / ${rankN}` : "") + `  ·  Fitzrovia · Confidential`;

    // buildings pre-sorted by rank (highest weighted rent first); unranked last
    const ordered = cols.slice().sort((x, y) => (rankMap[x.b.id] || 9999) - (rankMap[y.b.id] || 9999));

    // ---- auto-fit helpers: size columns to their content (and header tokens) so
    // nothing clips and nothing is over-wide. px ≈ chars × per-char width + padding.
    const charW = (sz, bold) => (sz <= 9 ? 6.0 : sz <= 10 ? 6.6 : sz <= 11 ? 7.1 : 7.7) * (bold ? 1.05 : 1);
    const rawPx = (text, sz, bold) => String(text == null ? "" : text).length * charW(sz, bold || false);
    const wpx = (text, sz, bold) => (text == null || text === "") ? 0 : Math.ceil(rawPx(text, sz, bold)) + 14;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    // headers wrap, so a column only needs to fit the header's longest token
    const headerW = (h) => Math.ceil(h.split(/[\s/]+/).reduce((a, w) => Math.max(a, w.length), 0) * charW(9, true)) + 14;
    const fmtN = (n) => Math.round(n).toLocaleString();
    // row height that fits `text` wrapped across width `w` at font size `sz`
    const fitH = (text, w, sz, lh) => Math.max(18, Math.ceil(rawPx(text, sz, false) / Math.max(40, w - 14)) * (lh || 13) + 6);

    // ======================= SHEET 1 — COMP ANALYSIS =======================
    const s1 = wb.addSheet("Comp Analysis");
    // Distance lives at the far right, formatted like the vs-Subject column.
    const PCOLS = ["Building", "Rank", "Unit Type", "Avg Rent ($/mo)", "Δ Rent ($)", "Δ Rent (%)", "Avg PSF ($/sf)", "Avg Size (sf)", "vs Subject (Rent)", "vs Subject ($/sf)", "Distance (m)"];
    const NCOL = PCOLS.length;

    // measure the widest content per column
    let wBuild = 0, wRank = 0, wUnit = wpx("Weighted average", 11, true), wRent = 0, wD = 0, wDp = 0, wPsf = 0, wSize = 0, wVs = 0, wVsP = 0, wDist = 0;
    types.forEach((t) => (wUnit = Math.max(wUnit, wpx(TYPE_LABEL[t], 10, false))));
    ordered.forEach((c) => {
      const { cur, prev } = colSnap(c.b.id, snap);
      if (!cur) return;
      const subj = c.bench, rank = rankMap[c.b.id];
      wBuild = Math.max(wBuild, wpx(c.b.name + (subj ? " ★" : ""), 12, true));
      if (rank) wRank = Math.max(wRank, wpx(String(rank), 13, true));
      const num = (m, isW) => {
        if (!m || m.avgRent == null) return;
        wRent = Math.max(wRent, wpx(fmtN(m.avgRent), 11, isW));
        if (m.avgPsf != null) wPsf = Math.max(wPsf, wpx((+Number(m.avgPsf).toFixed(2)), 11, isW));
        if (m.avgSqft != null) wSize = Math.max(wSize, wpx(fmtN(m.avgSqft), 11, isW));
      };
      types.forEach((t) => {
        const m = cur.byType && cur.byType[t], p = prev && prev.byType && prev.byType[t];
        if (!m || m.avgRent == null) return;
        num(m, false);
        if (p && p.avgRent != null) { const d = Math.round(m.avgRent - p.avgRent); wD = Math.max(wD, wpx((d < 0 ? "−" : "") + Math.abs(d), 10, false)); if (p.avgRent) wDp = Math.max(wDp, wpx(((m.avgRent - p.avgRent) / p.avgRent * 100).toFixed(1), 10, false)); }
      });
      if (cur.weighted && cur.weighted.avgRent != null) {
        num(cur.weighted, true);
        if (!subj) {
          const vs = vsSubject(cur.weighted.avgRent); if (vs != null) wVs = Math.max(wVs, wpx((vs > 0 ? "+" : "") + vs + "%", 11, true));
          const vsP = vsSubjectPsf(cur.weighted.avgPsf); if (vsP != null) wVsP = Math.max(wVsP, wpx((vsP > 0 ? "+" : "") + vsP + "%", 11, true));
        }
        wDist = Math.max(wDist, wpx(subj ? "Benchmark" : (c.distance != null ? fmtN(c.distance) : ""), 11, true));
      }
    });
    const PW = [
      clamp(Math.max(wBuild, headerW("Building")), 110, 240),
      clamp(Math.max(wRank, headerW("Rank")), 42, 70),
      clamp(Math.max(wUnit, headerW("Unit type")), 84, 150),
      clamp(Math.max(wRent, headerW("Avg rent")), 64, 120),
      clamp(Math.max(wD, headerW("rent ($)")), 54, 110),
      clamp(Math.max(wDp, headerW("rent (%)")), 54, 110),
      clamp(Math.max(wPsf, headerW("Avg PSF")), 60, 120),
      clamp(Math.max(wSize, headerW("Avg size")), 58, 120),
      clamp(Math.max(wVs, headerW("Subject")), 64, 120),
      clamp(Math.max(wVsP, headerW("Subject")), 64, 120),
      clamp(Math.max(wDist, headerW("Distance")), 66, 120),
    ];
    PW.forEach((w, i) => s1.setCol(i, w));
    const totalW1 = PW.reduce((x, y) => x + y, 0);

    s1.row(28); s1.cell("Competitive Analysis — " + a.name, { colspan: NCOL, s: sTitle });
    s1.row(fitH(metaLine, totalW1, 10)); s1.cell(metaLine, { colspan: NCOL, s: sMeta });
    s1.row(8);

    const kpis = [
      [money(bRent), "Benchmark rent", ORANGE],
      [money(mktRent), `Comp-set rent (${ncomp})`, NAVY],
      [bPsf != null ? psf(bPsf) + "/sf" : "—", `PSF · mkt ${psf(mktPsf)}`, NAVY],
      [posn == null ? "—" : (posn > 0 ? "+" : "") + posn + "%", "Subject vs market", posn != null && posn >= 0 ? GREEN : RED],
      [subjRank ? `#${subjRank} / ${rankN}` : "—", "Subject rank", NAVY],
    ];
    // distribute the NCOL columns across the KPI cards (handles an odd column count —
    // the first cards take the remainder so the strip always spans the full table width)
    const kbase = Math.floor(NCOL / kpis.length), krem = NCOL % kpis.length;
    const kSpan = kpis.map((_, i) => kbase + (i < krem ? 1 : 0));
    let kStart = 0; const kStarts = kSpan.map((s) => { const v = kStart; kStart += s; return v; });
    const kWidth = (i) => PW.slice(kStarts[i], kStarts[i] + kSpan[i]).reduce((a, b) => a + b, 0);
    const kpiLabH = kpis.reduce((h, k, i) => Math.max(h, fitH(k[1], kWidth(i), 8, 11)), 16);
    s1.row(26); kpis.forEach((k, i) => s1.cell(k[0], { colspan: kSpan[i], s: kpiValA(k[2]), coverS: kpiValC }));
    s1.row(kpiLabH); kpis.forEach((k, i) => s1.cell(k[1], { colspan: kSpan[i], s: kpiLabA, coverS: kpiLabC }));
    s1.row(8);

    s1.row(20); s1.cell("COMPETITIVE POSITIONING  ·  ranked by weighted rent  ·  weighted averages in bold", { colspan: NCOL, s: sBand });
    s1.row(32); PCOLS.forEach((h, i) => s1.cell(h, { s: (i === 0 || i === 2) ? sHeadL : sHeadC }));

    let zeb = 0;
    ordered.forEach((c) => {
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
      const blockBg = subj ? TINT : (zebra ? "#F6F8FD" : WHITE);
      const wBg = subj ? "#CFDAF2" : "#E7ECF7";

      rws.forEach((r, i) => {
        s1.row(18);
        const m = r.m, p = r.p;
        const d = p && p.avgRent != null ? m.avgRent - p.avgRent : null;
        const dPct = d != null && p.avgRent ? +((d / p.avgRent) * 100).toFixed(1) : null;
        const dCol = d > 0 ? GREEN : d < 0 ? RED : GREY;
        const isW = r.wavg;
        const rbg = isW ? wBg : blockBg;
        const sz = isW ? 11 : 10, col = isW ? NAVY : "#3A4256", bold = !!isW;
        // weighted rows: bold, navy top rule; first unit row of a block: thin sep rule
        const cellStyle = (extra) => cs(Object.assign(
          { sz, bold, fill: rbg, color: col },
          isW ? { top: true, topW: "medium", topC: NAVY } : (i === 0 ? { top: true, topC: SEP } : {}),
          extra || {}));
        // shared style for the two far-right summary columns (vs Subject + Distance)
        const farStyle = (extra) => cs(Object.assign({ sz: 11, bold: true, fill: wBg, top: true, topW: "medium", topC: NAVY }, extra || {}));
        if (i === 0) {
          s1.cell(c.b.name + (subj ? " ★" : ""), { rowspan: span, s: cs({ h: "left", sz: 12, bold: true, color: subj ? ORANGE : NAVY, fill: blockBg, top: true, topW: "medium", topC: SEP }) });
          s1.cell(rank || "", { rowspan: span, t: rank ? "n" : "s", s: cs({ sz: 13, bold: true, color: subj ? ORANGE : NAVY, fill: blockBg, top: true, topW: "medium", topC: SEP }) });
        }
        s1.cell(r.label, { s: cellStyle({ h: "left" }) });
        s1.cell(Math.round(m.avgRent), { t: "n", s: cellStyle({ nf: NF_INT }) });
        s1.cell(d == null ? "" : Math.round(d), { t: d == null ? "s" : "n", s: cellStyle({ nf: NF_INT, color: d == null ? col : dCol }) });
        s1.cell(dPct == null ? "" : dPct, { t: dPct == null ? "s" : "n", s: cellStyle({ nf: NF_PCT1, color: dPct == null ? col : dCol }) });
        s1.cell(m.avgPsf != null ? +Number(m.avgPsf).toFixed(2) : "", { t: m.avgPsf != null ? "n" : "s", s: cellStyle({ nf: NF_DEC }) });
        s1.cell(m.avgSqft != null ? m.avgSqft : "", { t: m.avgSqft != null ? "n" : "s", s: cellStyle({ nf: NF_INT }) });
        if (isW) {                                   // vs Subject (rent + $/sf) + Distance: focal weighted row only
          const vsCell = (v) => {
            const col = v == null ? GREY : (v > 0 ? GREEN : v < 0 ? RED : GREY);
            s1.cell(subj || v == null ? "—" : v, { t: (subj || v == null) ? "s" : "n", s: farStyle({ color: col, nf: (subj || v == null) ? null : NF_VS }) });
          };
          vsCell(subj ? null : vsSubject(m.avgRent));
          vsCell(subj ? null : vsSubjectPsf(m.avgPsf));
          s1.cell(dist, { t: typeof dist === "number" ? "n" : "s", s: farStyle({ color: NAVY, nf: typeof dist === "number" ? NF_INT : null }) });
        } else {
          s1.cell("", { s: cellStyle({}) });
          s1.cell("", { s: cellStyle({}) });
          s1.cell("", { s: cellStyle({}) });
        }
      });
    });

    s1.row(6);
    s1.row(); s1.cell("vs Subj = weighted-avg premium / discount vs benchmark (rent and $/sf) · Rank by weighted avg rent (1 = highest) · Distance to subject (m) · Δ vs prior scrape", { colspan: NCOL, s: sFoot });

    // ===================== SHEET 2 — BUILDING DETAILS ======================
    const s2 = wb.addSheet("Building Details");
    const DCOLS = ["Building", "Role", "Owner / manager", "Asset", "Year", "Units", "Address", "City", "Incentives"];
    const NCOL2 = DCOLS.length;

    // measure content; wide free-text columns (owner/address/incentives) are
    // capped and wrap, with row heights computed to fit the wrapped lines.
    let dB = 0, dO = 0, dA = 0, dAd = 0, dC = 0, dI = 0;
    ordered.forEach((c) => {
      const cur = snapOf(c.b.id);
      if (!cur) return;
      dB = Math.max(dB, wpx(c.b.name + (c.bench ? " ★" : ""), 10, true));
      dO = Math.max(dO, wpx(c.b.owner || "—", 10, false));
      dA = Math.max(dA, wpx(c.b.assetType || "—", 10, false));
      dAd = Math.max(dAd, wpx(c.b.address || "—", 10, false));
      dC = Math.max(dC, wpx(c.b.city || "—", 10, false));
      dI = Math.max(dI, wpx(cur.incentives || "—", 9, false));
    });
    const DW = [
      clamp(Math.max(dB, headerW("Building")), 120, 240),
      clamp(headerW("Role") + 14, 56, 80),
      clamp(Math.max(dO, headerW("Owner")), 120, 220),
      clamp(Math.max(dA, headerW("Asset")), 60, 130),
      clamp(headerW("Year") + 10, 48, 64),
      clamp(headerW("Units") + 10, 48, 70),
      clamp(Math.max(dAd, headerW("Address")), 120, 220),
      clamp(Math.max(dC, headerW("City")), 70, 130),
      clamp(Math.min(dI, 300), 170, 300),
    ];
    DW.forEach((w, i) => s2.setCol(i, w));
    const totalW2 = DW.reduce((x, y) => x + y, 0);

    s2.row(28); s2.cell("Building Details — " + a.name, { colspan: NCOL2, s: sTitle });
    s2.row(fitH(metaLine, totalW2, 10)); s2.cell(metaLine, { colspan: NCOL2, s: sMeta });
    s2.row(10);
    s2.row(24); DCOLS.forEach((h, i) => s2.cell(h, { s: (i === 4 || i === 5) ? sHeadC : sHeadL }));

    // lines a string needs at a given column width (wrap), and the resulting row height
    const linesAt = (text, colW, sz) => Math.max(1, Math.ceil(rawPx(text, sz, false) / Math.max(20, colW - 8)));
    let dz = 0;
    ordered.forEach((c) => {
      const cur = snapOf(c.b.id);
      if (!cur) return;
      const subj = c.bench;
      const dbg = subj ? TINT : (dz++ % 2 === 1 ? "#F6F8FD" : WHITE);
      const dcs = (o) => cs(Object.assign({ sz: 10, color: "#3A4256", fill: dbg, wrap: true, h: "left" }, o));
      const lines = Math.max(
        linesAt(c.b.owner || "—", DW[2], 10),
        linesAt(c.b.address || "—", DW[6], 10),
        linesAt(cur.incentives || "—", DW[8], 9));
      s2.row(Math.max(18, lines * 13 + 6));
      s2.cell(c.b.name + (subj ? " ★" : ""), { s: dcs({ bold: true, color: subj ? ORANGE : NAVY }) });
      s2.cell(subj ? "Subject" : "Comp", { s: dcs({}) });
      s2.cell(c.b.owner || "—", { s: dcs({}) });
      s2.cell(c.b.assetType || "—", { s: dcs({}) });
      s2.cell(c.b.yearBuilt || "—", { t: c.b.yearBuilt ? "n" : "s", s: dcs({ h: "center", nf: c.b.yearBuilt ? NF_YEAR : null }) });
      s2.cell(c.b.unitCount || "—", { t: c.b.unitCount ? "n" : "s", s: dcs({ h: "center", nf: c.b.unitCount ? NF_INT : null }) });
      s2.cell(c.b.address || "—", { s: dcs({}) });
      s2.cell(c.b.city || "—", { s: dcs({}) });
      s2.cell(cur.incentives || "—", { s: dcs({ sz: 9, color: "#7A4D0A" }) });
    });

    const safe = (a.name || "analysis").replace(/[^\w\- ]+/g, "").trim() || "analysis";
    downloadBlob(`${safe} — comp analysis.xlsx`, wb.blob());
    toast("Comp analysis exported to Excel");
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
          <div class="segmented" data-seg="analysis-tab">
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
    if (rm) rm.onclick = () => confirmModal({
      title: "Remove analysis?",
      body: `Remove the <b>${esc(a.name)}</b> analysis? This only deletes your custom analysis — no building data is affected.`,
      confirmLabel: "Remove analysis",
    }).then((ok) => {
      if (!ok) return;
      const saved = a;
      deleteAnalysis(id);
      toast(`Removed the <b>${esc(saved.name)}</b> analysis`, { action: "Undo", onAction: () => { D.analyses.push(saved); saveCustomAnalyses(); location.hash = "#/analysis/" + id; } });
    });
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
    const bPsfV = benchSum && benchSum.weighted ? benchSum.weighted.avgPsf : null;
    const num = (v, fmt, txt) => v == null ? "—" : `<span data-count="${v}" data-fmt="${fmt}">${txt}</span>`;
    return `<div class="kpis">
      <div class="kpi"><div class="kpi__val accent tnum">${num(bRent, "money", money(bRent))}</div><div class="kpi__label">Benchmark avg gross rent</div></div>
      <div class="kpi"><div class="kpi__val tnum">${num(mktRent, "money", money(mktRent))}</div><div class="kpi__label">Comp-set avg rent (${compSums.length})</div></div>
      <div class="kpi"><div class="kpi__val tnum">${bPsfV == null ? "—" : `${num(bPsfV, "psf", psf(bPsfV))}<span style="font-size:14px">/sf</span>`}</div><div class="kpi__label">Benchmark avg PSF · mkt ${psf(mktPsf)}</div></div>
      <div class="kpi"><div class="kpi__val ${posn != null && posn >= 0 ? "success" : ""} tnum">${num(posn, "pct", posn == null ? "—" : (posn > 0 ? "+" : "") + posn + "%")}</div><div class="kpi__label">Benchmark vs market</div></div>
    </div>`;
  }

  // Shared comp-table markup (used by the on-screen Summary and the PDF report).
  // snapDate = the primary run to show. baselineDate = the run the Δ compares against.
  // Deltas are shown ONLY against an explicit baseline — with no baseline (e.g. the earliest
  // selectable snapshot) prev is null, so the inaugural run correctly shows no Δ.
  function compTableHtml(cols, types, snapDate, minWidth, pdf, baselineDate) {
    types = types || presentTypes(cols);
    const sm = {};
    cols.forEach((c) => {
      sm[c.b.id] = { cur: colSnap(c.b.id, snapDate).cur, prev: baselineDate ? snapshotAt(c.b.id, baselineDate).cur : null };
    });
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
      const ph = `<div class="prop-media"><span class="ph">${icon("building")}</span>${b.photo ? `<img src="${esc(b.photo)}" onerror="this.style.display='none'"/>` : ""}</div>`;
      return `${ph}<div class="prop-name ${c.bench ? "bench" : ""}">${esc(b.name)}</div>`;
    });
    rows += rowMeta("Address", (c) => `<span class="sub">${esc(c.b.address || "—")}${c.b.city ? "<br/>" + esc(c.b.city) + ", " + esc(c.b.province || "") : ""}</span>`);
    rows += rowMeta("Year built", (c) => c.b.yearBuilt || "—");
    rows += rowMeta("Units", (c) => c.b.unitCount || "—");
    rows += rowMeta("Owner / manager", (c) => esc(c.b.owner || "—"));
    rows += rowMeta("Asset type", (c) => esc(c.b.assetType || "—"));
    rows += rowMeta("Distance to site", (c) => (c.bench ? "Benchmark" : c.distance != null ? c.distance + " m" : "—"));

    // snapshot group: the primary run; Δ measured vs the baseline (shown in full below).
    // Incentives sit just under this band (with the run they belong to), not up in Property.
    const labelDate = snapDate || cols.map((c) => D.summary[c.b.id] && D.summary[c.b.id].date).filter(Boolean).sort().reverse()[0];
    const baseLabel = baselineDate ? fmtDate(baselineDate) : "prior scrape";
    const snapHint = pdf ? "" : " · click a cell to see its listings";
    const latestBand = pdf
      ? `As of ${fmtDate(labelDate)} · Δ vs ${baseLabel}`
      : `<button class="snap-btn band-btn" id="snap-btn" aria-haspopup="true">${icon("calendar")}<span>${fmtDate(labelDate)}</span>${icon("chevron-down")}</button><span class="band-note">${baselineDate ? "Δ vs previous scrape · " : ""}click a cell to see its listings</span>`;
    rows += `<tr class="group-row"><td class="rowlabel">${baselineDate ? "Latest scrape" : "Snapshot"}</td><td colspan="${cols.length}">${latestBand}</td></tr>`;
    rows += `<tr class="incentive-row"><td class="rowlabel">Incentives</td>${cols.map((c) => {
      const s = sm[c.b.id].cur;
      return `<td class="${c.bench ? "col-bench" : ""}">${s && s.incentives ? esc(s.incentives) : '<span class="sub">None advertised</span>'}</td>`;
    }).join("")}</tr>`;

    // one metric cell — clickable to drill into the individual listings behind the average.
    // Three slash-paired lines: rent / $/sf  →  Δrent / Δ$sf  →  size / units.
    const metricCell = (c, cur, prev, type, snapForDrill) => {
      if (!cur) return `<td class="${c.bench ? "col-bench" : ""}"><span class="sub">—</span></td>`;
      const slash = '<span class="m-slash">/</span>';
      const dParts = [delta(cur.avgRent, prev && prev.avgRent), deltaPsf(cur.avgPsf, prev && prev.avgPsf)].filter(Boolean);
      const deltaLine = dParts.length ? `<div class="metric-delta">${dParts.join(slash)}</div>` : "";
      // units on the left (under rent), size on the right (under $/sf — they pair naturally)
      const sizeParts = [];
      if (cur.count != null) sizeParts.push(`${cur.count} unit${cur.count === 1 ? "" : "s"}`);
      if (cur.avgSqft) sizeParts.push(`${cur.avgSqft.toLocaleString()} sf`);
      const sizeLine = sizeParts.length ? `<div class="metric-size tnum">${sizeParts.join(slash)}</div>` : "";
      return `<td class="${c.bench ? "col-bench" : ""} td-click" data-bid="${c.b.id}" data-type="${type}" data-snap="${snapForDrill || labelDate || ""}">
        <div class="metric tnum">${money(cur.avgRent)}${slash}${psf(cur.avgPsf)}<span class="m-sf">/sf</span></div>
        ${deltaLine}
        ${sizeLine}
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

    // Previous-scrape section — the baseline run, same columns, NO deltas (it IS the
    // baseline). On-screen only (keeps the PDF compact); appended as rows in the same table
    // so columns align exactly. Cells use prev=null → rent / $sf + size / units, no Δ.
    if (!pdf && baselineDate) {
      const prevBand = pdf
        ? `As of ${fmtDate(baselineDate)} · baseline for the Δ above`
        : `<button class="snap-btn band-btn" id="cmp-btn" aria-haspopup="true">${icon("calendar")}<span>${fmtDate(baselineDate)}</span>${icon("chevron-down")}</button><span class="band-note">baseline for the Δ above</span>`;
      rows += `<tr class="group-row group-row--prev"><td class="rowlabel">Previous scrape</td><td colspan="${cols.length}">${prevBand}</td></tr>`;
      rows += `<tr class="incentive-row"><td class="rowlabel">Incentives</td>${cols.map((c) => {
        const s = sm[c.b.id].prev;
        return `<td class="${c.bench ? "col-bench" : ""}">${s && s.incentives ? esc(s.incentives) : '<span class="sub">None advertised</span>'}</td>`;
      }).join("")}</tr>`;
      for (const t of types) {
        rows += `<tr><td class="rowlabel">${TYPE_LABEL[t]}</td>${cols.map((c) =>
          metricCell(c, sm[c.b.id].prev && sm[c.b.id].prev.byType[t], null, t, baselineDate)
        ).join("")}</tr>`;
      }
      rows += `<tr class="wavg"><td class="rowlabel">Weighted average</td>${cols.map((c) =>
        metricCell(c, sm[c.b.id].prev && sm[c.b.id].prev.weighted, null, "__all", baselineDate)
      ).join("")}</tr>`;
    }

    const colGroup = `<colgroup><col class="c-label"/>${cols.map(() => '<col class="c-data"/>').join("")}</colgroup>`;
    const style = minWidth ? ` style="min-width:${minWidth}px"` : "";
    return `<table class="comp"${style}>${colGroup}<thead><tr><th class="rowlabel">Metric</th>${colHead}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  // ---- Comp table: floating building-name header --------------------------------
  // The single-scroll layout can't keep the thead sticky in pure CSS (the horizontal-
  // scroll wrapper isn't the page's vertical scroll container), so we clone the header
  // into a fixed bar that appears once the real one scrolls above the viewport. Its
  // horizontal scroll is synced to the table (incl. grab-drag) and the sticky left
  // metric column is preserved for free since the clone is a .comp table too.
  let compStickyHead = null, compStickyWrap = null;
  function teardownCompSticky() {
    if (compStickyHead && compStickyHead.parentNode) compStickyHead.parentNode.removeChild(compStickyHead);
    compStickyHead = null; compStickyWrap = null;
  }
  function buildCompSticky(wrap) {
    teardownCompSticky();
    const table = wrap && wrap.querySelector("table.comp");
    const thead = table && table.querySelector("thead");
    if (!thead) return;
    const cg = table.querySelector("colgroup");
    const host = document.createElement("div");
    host.id = "comp-stickyhead";
    host.innerHTML = `<table class="comp" style="margin:0;table-layout:fixed">${cg ? cg.outerHTML : ""}${thead.outerHTML}</table>`;
    document.body.appendChild(host);
    // Lock each column to the live header cell's measured width via the <col> elements —
    // authoritative under table-layout:fixed — so the clone's columns match the body exactly
    // and the header text wraps the same way (col widths drive; th content wraps within).
    const realThs = thead.querySelectorAll("th"), cloneCols = host.querySelectorAll("colgroup col");
    let total = 0;
    realThs.forEach((th, i) => { const w = th.getBoundingClientRect().width; total += w; if (cloneCols[i]) cloneCols[i].style.width = w + "px"; });
    const ct = host.querySelector("table.comp");
    if (ct && total) ct.style.width = total + "px";
    host.addEventListener("click", (e) => {   // forward the × remove to the real button's handler
      const rm = e.target.closest(".th-rm");
      if (!rm) return;
      e.stopPropagation();
      const realRm = wrap.querySelector(`.th-rm[data-rm="${rm.dataset.rm}"]`);
      if (realRm) realRm.click();
    });
    compStickyHead = host; compStickyWrap = wrap;
    updateCompSticky();
  }
  function updateCompSticky() {
    if (!compStickyHead) return;
    if (!compStickyWrap || !compStickyWrap.isConnected) { teardownCompSticky(); return; }
    const r = compStickyWrap.getBoundingClientRect();
    const hh = compStickyHead.offsetHeight || 44;
    const show = r.top < 0 && r.bottom > hh + 8;   // real header scrolled off, table still in view
    compStickyHead.style.display = show ? "block" : "none";
    if (!show) return;
    compStickyHead.style.left = r.left + "px";
    compStickyHead.style.width = r.width + "px";
    compStickyHead.scrollLeft = compStickyWrap.scrollLeft;
  }

  // Drill-down: the individual listings that rolled up into a clicked cell.
  // Per-building unit rows are lazy-loaded (data/units/<bid>.json) and cached, so the
  // initial payload stays lean. Resolves to { date: [unit rows] }; on any failure
  // (offline / file:// / 404) it resolves to {} so the UI degrades gracefully.
  const _unitsCache = {};
  function loadUnits(bid) {
    if (_unitsCache[bid]) return _unitsCache[bid];
    const cfg = window.COMP_CONFIG || {};
    const base = cfg.unitsBase || "data/units";
    _unitsCache[bid] = fetch(`${base}/${encodeURIComponent(bid)}.json`, { headers: { Accept: "application/json" }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
    return _unitsCache[bid];
  }
  // Individual-listings table for the scrape-history detail panels.
  function unitsTableHtml(rows) {
    const us = rows.slice().sort((a, b) => (UNIT_TYPES.indexOf(a.type) - UNIT_TYPES.indexOf(b.type)) || ((b.rent || 0) - (a.rent || 0)));
    const uRows = us.map((u) => `<tr>
      <td class="sh-type">${TYPE_LABEL[u.type] || esc(u.type)}</td>
      <td class="tnum">${u.bath != null ? u.bath : "—"}</td>
      <td class="tnum">${u.sqft != null ? u.sqft.toLocaleString() : "—"}</td>
      <td class="tnum">${money(u.rent)}</td>
      <td class="tnum">${u.psf != null ? psf(u.psf) : "—"}</td>
      <td class="sh-note">${u.note ? esc(u.note) : "—"}</td></tr>`).join("");
    return `<div class="sh-subhead">Individual listings <span>${us.length}</span></div>
      <table class="sh-tbl sh-units"><colgroup><col/><col/><col/><col/><col/><col/></colgroup>
      <thead><tr><th>Unit type</th><th>Bath</th><th>SF</th><th>Rent</th><th>PSF</th><th>Notes</th></tr></thead>
      <tbody>${uRows}</tbody></table>`;
  }

  // Unit-backup modal: filter tabs by unit type, a sortable per-unit table, and
  // a summary-by-unit-type table — opened by clicking a cell in the comp table.
  async function openUnitsModal(bid, type, snapDate) {
    const b = bld(bid); if (!b) return;
    const snap = snapshotAt(bid, snapDate).cur;
    const map = snap ? await loadUnits(bid) : {};
    const all = (snap && map[snap.date]) ? map[snap.date].slice() : [];
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
      if (!rows.length) { $("#um-table").innerHTML = `<div class="empty">${icon("list")}<br/>No individual listings in this snapshot.</div>`; return; }
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

  // Excel export for the unit-backup modal — same framework as the comp export:
  // a real .xlsx with two tabs (Summary: KPI strip + by-type aggregate; All Units:
  // individual backup), navy headers, light-blue bands, weighted-row emphasis,
  // zebra banding, gridlines off, balanced cards and an even row-height rhythm.
  function exportUnitsExcel(b, snap, units) {
    const NAVY = "#061031", ORANGE = "#FF4E31", GREY = "#7F7F7F", BORDER = "#E6E6E1",
      LBLUE = "#D6DFFA", WARM = "#FAFAF7", WHITE = "#FFFFFF", SEP = "#C9CEDD";
    const NF_INT = "#,##0", NF_DEC = "0.00";
    const avg = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
    const types = UNIT_TYPES.filter((t) => units.some((u) => u.type === t));

    const wb = XlsxLite.createWorkbook();
    const reg = wb.style;
    const cs = (o) => reg({
      font: { sz: o.sz || 11, bold: o.bold, italic: o.italic, color: o.color || NAVY },
      fill: o.fill || null,
      align: { h: o.h || "center", v: "center", wrap: o.wrap },
      numFmt: o.nf || null,
      border: o.top ? { top: { style: o.topW || "thin", color: o.topC || SEP } } : null,
    });
    const sTitle = cs({ sz: 13, bold: true, color: WHITE, fill: NAVY, h: "left" });
    const sMeta = cs({ sz: 10, color: GREY, fill: WARM, h: "left", wrap: true });
    const sBand = cs({ sz: 9, bold: true, color: NAVY, fill: LBLUE, h: "left" });
    const sFoot = cs({ sz: 8, italic: true, color: GREY, h: "left", wrap: true });
    const hL = reg({ font: { sz: 9, bold: true, color: WHITE }, fill: NAVY, align: { h: "left", v: "center", wrap: true } });
    const hC = reg({ font: { sz: 9, bold: true, color: WHITE }, fill: NAVY, align: { h: "center", v: "center", wrap: true } });
    const kpiVal = (color) => reg({ font: { sz: 13, bold: true, color }, fill: WHITE, align: { h: "center", v: "center" }, border: { top: { color: BORDER }, left: { color: BORDER }, right: { color: BORDER } } });
    const kpiLab = reg({ font: { sz: 8, color: GREY }, fill: WHITE, align: { h: "center", v: "center", wrap: true }, border: { bottom: { color: BORDER }, left: { color: BORDER }, right: { color: BORDER } } });
    const metaLine = `Snapshot: ${snap && snap.date ? fmtDate(snap.date) : "—"}  ·  ${units.length} units  ·  ${types.length} unit type${types.length === 1 ? "" : "s"}  ·  Fitzrovia — Internal & Confidential`;
    // row height that fits the meta line wrapped across the sheet width
    const fitH = (text, w) => Math.max(18, Math.ceil((String(text).length * 6.6) / Math.max(40, w - 14)) * 13 + 6);

    // overall blended metrics
    const oRent = avg(units.map((u) => u.rent));
    const oPsf = avg(units.filter((u) => u.psf != null).map((u) => +u.psf));
    const oSf = avg(units.filter((u) => u.sqft != null).map((u) => +u.sqft));

    // ======================= SHEET 1 — SUMMARY =============================
    const s1 = wb.addSheet("Summary");
    const SW = [132, 92, 96, 104, 104];                 // KPI cards: hero + 4 even
    const NCOL = SW.length;
    SW.forEach((w, i) => s1.setCol(i, w));

    s1.row(28); s1.cell(b.name + " — Unit Backup", { colspan: NCOL, s: sTitle });
    s1.row(fitH(metaLine, SW.reduce((x, y) => x + y, 0))); s1.cell(metaLine, { colspan: NCOL, s: sMeta });
    s1.row(10);

    const kpis = [
      [oRent != null ? money(oRent) : "—", "Avg gross rent", ORANGE],
      [oPsf != null ? psf(oPsf) + "/sf" : "—", "Avg PSF", NAVY],
      [oSf != null ? Math.round(oSf).toLocaleString() : "—", "Avg size (sf)", NAVY],
      [String(units.length), "Units", NAVY],
      [String(types.length), "Unit types", NAVY],
    ];
    s1.row(28); kpis.forEach((k) => s1.cell(k[0], { s: kpiVal(k[2]) }));
    s1.row(18); kpis.forEach((k) => s1.cell(k[1], { s: kpiLab }));
    s1.row(14);

    s1.row(20); s1.cell("SUMMARY BY UNIT TYPE  ·  weighted average in bold", { colspan: NCOL, s: sBand });
    s1.row(24); ["Unit Type", "Units", "Avg SF", "Avg Rent ($/mo)", "Avg PSF ($/sf)"].forEach((h, i) => s1.cell(h, { s: i === 0 ? hL : hC }));
    let sz = 0;
    const sumRow = (label, us, wavg) => {
      const sf = avg(us.filter((u) => u.sqft != null).map((u) => +u.sqft));
      const r = avg(us.map((u) => u.rent));
      const p = avg(us.filter((u) => u.psf != null).map((u) => +u.psf));
      const bg = wavg ? "#E7ECF7" : (sz++ % 2 === 1 ? "#F6F8FD" : WHITE);
      const sc = (o) => cs(Object.assign({ sz: wavg ? 11 : 10, bold: !!wavg, fill: bg, color: wavg ? NAVY : "#3A4256" }, wavg ? { top: true, topW: "medium", topC: NAVY } : {}, o));
      s1.row(18);
      s1.cell(label, { s: sc({ h: "left" }) });
      s1.cell(us.length, { t: "n", s: sc({ nf: NF_INT }) });
      s1.cell(sf != null ? Math.round(sf) : "", { t: sf != null ? "n" : "s", s: sc({ nf: NF_INT }) });
      s1.cell(r != null ? Math.round(r) : "", { t: r != null ? "n" : "s", s: sc({ nf: NF_INT }) });
      s1.cell(p != null ? +p.toFixed(2) : "", { t: p != null ? "n" : "s", s: sc({ nf: NF_DEC }) });
    };
    types.forEach((t) => sumRow(TYPE_LABEL[t] || t, units.filter((u) => u.type === t), false));
    sumRow("Weighted Average", units, true);
    s1.row(6);
    s1.row(); s1.cell("Averages computed across all scraped units for the snapshot.", { colspan: NCOL, s: sFoot });

    // ======================= SHEET 2 — ALL UNITS ===========================
    const s2 = wb.addSheet("All Units");
    const UCOLS = ["Unit Type", "Bath", "SF", "Rent ($/mo)", "Rent PSF ($/sf)", "Notes"];
    const UW = [120, 60, 64, 100, 104, 240];
    const NCOL2 = UCOLS.length;
    UW.forEach((w, i) => s2.setCol(i, w));

    s2.row(28); s2.cell(b.name + " — Individual Units", { colspan: NCOL2, s: sTitle });
    s2.row(fitH(metaLine, UW.reduce((x, y) => x + y, 0))); s2.cell(metaLine, { colspan: NCOL2, s: sMeta });
    s2.row(10);
    s2.row(24); UCOLS.forEach((h, i) => s2.cell(h, { s: (i === 0 || i === 5) ? hL : hC }));

    // group by unit type, then rent desc, for a clean read
    const ordered = units.slice().sort((x, y) =>
      (UNIT_TYPES.indexOf(x.type) - UNIT_TYPES.indexOf(y.type)) || ((y.rent || 0) - (x.rent || 0)));
    let uz = 0;
    ordered.forEach((u) => {
      const bg = uz++ % 2 === 1 ? "#F6F8FD" : WHITE;
      const uc = (o) => cs(Object.assign({ sz: 10, color: "#3A4256", fill: bg }, o));
      s2.row();
      s2.cell(TYPE_LABEL[u.type] || u.type, { s: uc({ h: "left" }) });
      s2.cell(u.bath != null ? u.bath : "", { t: u.bath != null ? "n" : "s", s: uc({}) });
      s2.cell(u.sqft != null ? u.sqft : "", { t: u.sqft != null ? "n" : "s", s: uc({ nf: NF_INT }) });
      s2.cell(u.rent != null ? Math.round(u.rent) : "", { t: u.rent != null ? "n" : "s", s: uc({ nf: NF_INT }) });
      s2.cell(u.psf != null ? +Number(u.psf).toFixed(2) : "", { t: u.psf != null ? "n" : "s", s: uc({ nf: NF_DEC }) });
      s2.cell(u.note || "", { s: uc({ h: "left", color: GREY, wrap: true }) });
    });

    const safe = (b.name || "building").replace(/[^\w\- ]+/g, "").trim() || "building";
    downloadBlob(`${safe} — unit backup.xlsx`, wb.blob());
    toast("Unit backup exported to Excel");
  }

  // Date-picker popup for the band buttons. Rendered at body level + fixed-positioned so
  // it escapes the comp table's overflow clipping. opts = [{d, label}]; calls onPick(date).
  function openDateMenu(btn, opts, current, onPick) {
    document.querySelectorAll(".snap-menu--float").forEach((m) => m.remove());
    const menu = document.createElement("div");
    menu.className = "snap-menu snap-menu--float";
    menu.innerHTML = opts.map((o) => `<button class="snap-opt ${o.d === current ? "active" : ""}" data-d="${o.d}">${o.label}</button>`).join("");
    document.body.appendChild(menu);
    // Stay open until a date is picked (or the user clicks away). On scroll/resize we
    // REPOSITION to track the button rather than close — so it never "flies" off or vanishes.
    const place = () => { const r = btn.getBoundingClientRect(); menu.style.left = Math.min(r.left, window.innerWidth - menu.offsetWidth - 12) + "px"; menu.style.top = (r.bottom + 4) + "px"; };
    place();
    let onScroll;
    const close = () => { menu.remove(); document.removeEventListener("click", close); window.removeEventListener("scroll", onScroll, true); window.removeEventListener("resize", place); };
    onScroll = (e) => { if (!menu.contains(e.target)) place(); };   // follow the button; do NOT close
    menu.querySelectorAll(".snap-opt").forEach((o) => (o.onclick = (e) => { e.stopPropagation(); onPick(o.dataset.d); close(); }));
    setTimeout(() => {
      document.addEventListener("click", close);                   // click away to dismiss
      window.addEventListener("scroll", onScroll, true);           // capture → reposition on any scroll
      window.addEventListener("resize", place);
    }, 0);
  }

  function renderSummary(a, cols) {
    const dates = runDates(a);              // newest first
    const primary = selectedSnap(a);        // chosen primary snapshot (default: latest)
    const base = compareBaseline(a);        // chosen baseline (default: next older than primary)
    const bOpts = baselineOpts(a);          // snapshots older than the primary
    // The date pickers live inline in the table's section bands (rendered by compTableHtml):
    // primary on the "Latest scrape" band, baseline on the "Previous scrape" band.
    document.getElementById("tabbody").innerHTML =
      kpiStrip(a, cols, primary) + `<div class="comp-wrap">${compTableHtml(cols, undefined, primary, 168 + cols.length * 178, false, base)}</div>` + removedBinHtml(a);

    const snapBtn = document.getElementById("snap-btn");
    if (snapBtn && dates.length > 1) snapBtn.onclick = (e) => { e.stopPropagation(); openDateMenu(snapBtn,
      dates.map((d, i) => ({ d, label: fmtDate(d) + (i === 0 ? " · latest" : "") })), primary,
      (d) => { snapState[a.id] = d; renderSummary(a, cols); animateCounts(document.getElementById("tabbody")); });   // primary change re-ticks KPIs
    };
    const cmpBtn = document.getElementById("cmp-btn");
    if (cmpBtn && bOpts.length) cmpBtn.onclick = (e) => { e.stopPropagation(); openDateMenu(cmpBtn,
      bOpts.map((d, i) => ({ d, label: fmtDate(d) + (i === 0 ? " · prior" : "") })), base,
      (d) => { cmpState[a.id] = d; renderSummary(a, cols); });   // baseline change leaves KPIs as-is
    };

    const wrap = document.querySelector("#tabbody .comp-wrap");
    if (wrap) {
      // grab-and-drag to pan the wide table horizontally (mouse only — touch keeps native
      // swipe scrolling). A small threshold distinguishes a drag from a click so cell
      // clicks (drill-in) and the remove-× still fire on a real click.
      let dragging = false, moved = false, sx = 0, sl = 0;
      wrap.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 || (e.pointerType && e.pointerType !== "mouse")) return;
        dragging = true; moved = false; sx = e.clientX; sl = wrap.scrollLeft;
      });
      wrap.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        const dx = e.clientX - sx;
        if (!moved && Math.abs(dx) > 4) { moved = true; wrap.classList.add("dragging"); try { wrap.setPointerCapture(e.pointerId); } catch (_) {} }
        if (moved) wrap.scrollLeft = sl - dx;
      });
      const endDrag = () => { dragging = false; wrap.classList.remove("dragging"); };
      wrap.addEventListener("pointerup", endDrag);
      wrap.addEventListener("pointercancel", endDrag);
      wrap.onclick = (e) => {
        if (moved) { moved = false; return; }   // swallow the click that ends a drag
        const rm = e.target.closest(".th-rm");
        if (rm) {
          e.stopPropagation();
          const rid = rm.dataset.rm, rb = bld(rid);
          removeCompFromAnalysis(a, rid); route();
          toast(`Removed <b>${esc(rb ? rb.name : "comp")}</b> from the set`, { action: "Undo", onAction: () => { readdComp(a, rid); route(); } });
          return;
        }
        const td = e.target.closest("td[data-bid]");
        if (td) openUnitsModal(td.dataset.bid, td.dataset.type, td.dataset.snap);
      };
      // keep the floating header's horizontal position locked to the table (covers the
      // scrollbar, trackpad, and grab-drag, which all move wrap.scrollLeft)
      wrap.addEventListener("scroll", () => { if (compStickyHead) compStickyHead.scrollLeft = wrap.scrollLeft; });
      buildCompSticky(wrap);   // floating building-name header once the real one scrolls off
    }

    const bin = document.querySelector("#tabbody .dropbin");
    if (bin) bin.onclick = (e) => {
      if (e.target.closest(".dropbin__readall")) {
        const n = (a.removed || []).filter((id) => bld(id) && !a.comps.some((c) => c.building === id)).length;
        readdAllComps(a); route();
        toast(`Restored ${n} comp${n === 1 ? "" : "s"}`);
        return;
      }
      const btn = e.target.closest(".dropbin__readd");
      if (btn) {
        const rid = btn.dataset.readd, rb = bld(rid);
        readdComp(a, rid); route();
        toast(`Restored <b>${esc(rb ? rb.name : "comp")}</b>`, { action: "Undo", onAction: () => { removeCompFromAnalysis(a, rid); route(); } });
      }
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
    const baseDate = compareBaseline(a);   // deltas in the report match the chosen baseline (no Δ if none)
    const CHUNK = 3; // benchmark + 3 comps = 4 cols → fits Letter width without clipping in print
    let out = "";
    if (!compCols.length) {
      out = benchCol ? `<div class="rp-tablewrap">${compTableHtml([benchCol], types, snapDate, undefined, true, baseDate)}</div>` : "";
    } else {
      for (let i = 0; i < compCols.length; i += CHUNK) {
        const pageCols = benchCol ? [benchCol, ...compCols.slice(i, i + CHUNK)] : compCols.slice(i, i + CHUNK);
        const start = i + 1, end = Math.min(i + CHUNK, compCols.length);
        out += `<div class="rp-tablewrap" data-start="${start}" data-end="${end}" data-total="${compCols.length}">${compTableHtml(pageCols, types, snapDate, undefined, true, baseDate)}</div>`;
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
    if (!trendState[key]) trendState[key] = { metric: "avgRent", types: null, bsel: null, from: null, to: null };
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
          <option value="activeListings" ${st.metric === "activeListings" ? "selected" : ""}>Active listings</option>
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
        <h3 id="chart-title">${trendMetricName(st.metric)}</h3>
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

  function trendMetricName(metric) {
    if (metric === "avgPsf") return "Average Rent PSF";
    if (metric === "activeListings") return "Active listings";
    return "Average Gross Rent";
  }

  function trendMetricIsCount(metric) {
    return metric === "activeListings";
  }

  function trendScopeLabel(st) {
    if (!st.types.length) return "—";
    const names = (st.avail && st.types.length === st.avail.length)
      ? "all units"
      : st.types.map((t) => TYPE_LABEL[t] || t).join(" + ");
    return trendMetricIsCount(st.metric) ? names : `${names} (weighted)`;
  }

  function fmtTrendValue(metric, v, withUnit) {
    if (trendMetricIsCount(metric)) return Math.round(v).toLocaleString();
    if (metric === "avgPsf") return "$" + v.toFixed(2) + (withUnit ? "/sf" : "");
    return "$" + Math.round(v).toLocaleString();
  }

  // Sum active listing counts across the selected unit types at one snapshot.
  function activeListingsAt(point, types) {
    let total = 0, seen = false;
    types.forEach((t) => {
      const bt = point.byType && point.byType[t];
      if (bt && bt.count != null) { total += bt.count; seen = true; }
    });
    return seen ? total : null;
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

  function trendValueAt(point, metric, types) {
    return trendMetricIsCount(metric) ? activeListingsAt(point, types) : weightedAt(point, metric, types);
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

    const countMode = trendMetricIsCount(hv.metric);

    // value + comparison vs the subject (★) at D, for each visible series.
    // If the subject wasn't scraped at D, carry forward its last observed value.
    const benchS = hv.series.find((s) => s.bench);
    let subjV = benchS ? benchS.vmap[D] : null;
    let subjCarried = false;
    if (benchS && subjV == null) {
      for (let i = benchS.pts.length - 1; i >= 0; i--) {
        if (benchS.pts[i].d <= D && benchS.pts[i].v != null) { subjV = benchS.pts[i].v; subjCarried = true; break; }
      }
    }
    const rows = [];
    hv.series.forEach((s) => {
      const v = s.vmap[D];
      if (v == null) return;                       // no observation here → omit (no $0/NaN)
      const vs = (!s.bench && subjV)
        ? (countMode ? Math.round(v - subjV) : Math.round(((v - subjV) / subjV) * 100))
        : null;
      rows.push({ id: s.id, name: s.name, bench: s.bench, color: s.color, v, vs, y: hv.y(v) });
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
    // bring the hovered line's end-of-line price label to the front + emphasize it
    if (cache.labelsG) cache.labelsG.querySelectorAll(".end-label").forEach((t) => {
      const hi = hovered && t.dataset.bid === hovered;
      t.style.opacity = hovered ? (hi ? "1" : "0.2") : "1";
      t.classList.toggle("end-label--hi", !!hi);
      if (hi) cache.labelsG.appendChild(t);   // render last → on top of any overlap
    });

    // tooltip
    const fmtV = (x) => fmtTrendValue(hv.metric, x, true);
    const fmtVs = (r) => {
      if (r.bench) return ` <span class="tt-chg tt-subj">(subject)</span>`;
      if (r.vs == null) return "";
      const val = countMode ? Math.abs(r.vs).toLocaleString() : Math.abs(r.vs) + "%";
      return ` <span class="tt-chg ${r.vs > 0 ? "up" : r.vs < 0 ? "down" : ""}">(${r.vs > 0 ? "+" : r.vs < 0 ? "−" : ""}${val})</span>`;
    };
    let html = `<div class="tt-date">${fmtDate(D)}</div>`;
    rows.forEach((r) => { html += `<div class="tt-row ${r.id === hovered ? "tt-hi" : ""}"><span class="tt-dot" style="background:${r.color}"></span><span class="tt-name">${esc(r.name)}${r.bench ? " ★" : ""}</span><span class="tt-val">${fmtV(r.v)}${fmtVs(r)}</span></div>`; });
    if (subjV) html += `<div class="tt-note">( ) = ${countMode ? "listing count delta" : "premium / discount"} vs subject${subjCarried ? " (last obs.)" : ""}</div>`;
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
    if (cache.labelsG) cache.labelsG.querySelectorAll(".end-label").forEach((t) => { t.style.opacity = "1"; t.classList.remove("end-label--hi"); });
  }

  function drawChart(a, cols, st) {
    const chartEl = document.getElementById("chart");
    const legendEl = document.getElementById("legend");
    if (!chartEl) return;
    const NS = "http://www.w3.org/2000/svg";
    const key = a.id;
    const W = Math.max(720, (chartEl.clientWidth || 900));
    const H = 420, padL = 64, padR = 64, padT = 16, padB = 56;   // padR widened for end-of-line value labels
    const dates = (() => {
      const s = new Set();
      cols.forEach((c) => (D.trends[c.b.id] || []).forEach((p) => { if (p.date >= st.from && p.date <= st.to) s.add(p.date); }));
      return [...s].sort();
    })();
    if (chartRaf[key]) cancelAnimationFrame(chartRaf[key]);
    if (!dates.length) { chartEl.innerHTML = `<div class="empty">No data in selected range.</div>`; legendEl.innerHTML = ""; chartCache[key] = null; return; }
    const xIdx = new Map(dates.map((d, i) => [d, i]));
    const x = (d) => padL + (dates.length === 1 ? (W - padL - padR) / 2 : (xIdx.get(d) / (dates.length - 1)) * (W - padL - padR));

    // Every series with data in range, keyed by building id (stable identity). legendAll
    // powers the clickable legend — series toggled off persist as dimmed chips; target is
    // the on subset that actually gets drawn, scaled, and hover-tracked. Colour is by col
    // index so it's stable per building regardless of what's selected (matches the line).
    const legendAll = [];
    cols.forEach((c, i) => {
      const color = c.bench ? BENCH_COLOR : COMP_COLORS[i % COMP_COLORS.length];
      const pts = (D.trends[c.b.id] || [])
        .filter((p) => p.date >= st.from && p.date <= st.to)
        .map((p) => ({ d: p.date, v: trendValueAt(p, st.metric, st.types) }))
        .filter((p) => p.v != null && xIdx.has(p.d));
      if (!pts.length) return;
      const vmap = {}; pts.forEach((p) => (vmap[p.d] = p.v));
      legendAll.push({ bid: c.b.id, name: c.b.name, bench: c.bench, color, pts, vmap, on: st.bsel.has(c.b.id) });
    });
    const target = legendAll.filter((s) => s.on);
    if (!target.length) { chartEl.innerHTML = `<div class="empty">Select at least one building and one unit type.</div>`; legendEl.innerHTML = ""; chartCache[key] = null; return; }

    // dynamic title
    const tt = document.getElementById("chart-title");
    if (tt) {
      tt.textContent = `${trendMetricName(st.metric)} · ${trendScopeLabel(st)}`;
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
      const defs = document.createElementNS(NS, "defs");
      const clip = document.createElementNS(NS, "clipPath"); clip.setAttribute("id", "chartclip-" + key);
      const clipRect = document.createElementNS(NS, "rect");
      clipRect.setAttribute("x", "0"); clipRect.setAttribute("y", "0"); clipRect.setAttribute("width", String(W)); clipRect.setAttribute("height", String(H));
      clip.appendChild(clipRect); defs.appendChild(clip);
      const gridG = document.createElementNS(NS, "g"); gridG.setAttribute("class", "grid");
      const linesG = document.createElementNS(NS, "g"); linesG.setAttribute("class", "axis"); linesG.setAttribute("clip-path", "url(#chartclip-" + key + ")");
      const labelsG = document.createElementNS(NS, "g"); labelsG.setAttribute("class", "endlabels");
      const hoverG = document.createElementNS(NS, "g"); hoverG.setAttribute("class", "hoverlayer");
      const overlay = document.createElementNS(NS, "rect"); overlay.setAttribute("fill", "transparent"); overlay.style.cursor = "crosshair";
      svg.appendChild(defs); svg.appendChild(gridG); svg.appendChild(linesG); svg.appendChild(labelsG); svg.appendChild(hoverG); svg.appendChild(overlay);
      chartEl.style.position = "relative";
      chartEl.replaceChildren(svg);
      const tip = document.createElement("div"); tip.className = "trend-tip"; tip.hidden = true;
      chartEl.appendChild(tip);
      legendEl.replaceChildren();
      cache = chartCache[key] = { svg, gridG, linesG, labelsG, clipRect, drawn: false, hoverG, overlay, tip, series: {}, legend: {}, yMin: null, yMax: null, fitMin: null, fitMax: null, datesKey };
      overlay.addEventListener("mousemove", (ev) => trendHoverMove(cache, ev));
      overlay.addEventListener("mouseleave", () => trendHoverLeave(cache));
    }

    // Axis bounds — fit tightly to the *visible* series so they fill the plot. We keep
    // the current fit when the data still fits inside it (a toggle that doesn't move an
    // extreme leaves the axis exactly in place — no distracting micro-rescale), BUT if
    // the visible data would now occupy under ~80% of the current span — e.g. you hide an
    // outlier like a far-above-cluster benchmark — we rescale tighter to reclaim the empty
    // space. The axis morph animates the zoom smoothly either way.
    let tYMin, tYMax;
    const padY = (dMax - dMin) * 0.12 || dMax * 0.1;
    const fitLo = Math.max(0, dMin - padY), fitHi = dMax + padY;
    if (reuse && cache.fitMin != null && dMin >= cache.fitMin && dMax <= cache.fitMax
        && (fitHi - fitLo) >= (cache.fitMax - cache.fitMin) * 0.8) {
      tYMin = cache.fitMin; tYMax = cache.fitMax;
    } else {
      tYMin = fitLo; tYMax = fitHi;
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

    const want = new Set(target.map((s) => s.bid));   // drawn lines = the on subset

    // Legend — one chip per in-range series (off ones persist dimmed). Clicking a chip
    // toggles that series through its dropdown checkbox, reusing the full path (bsel +
    // summary + redraw); it never hides the last visible line. Diff keeps chips stable.
    const legendWant = new Set(legendAll.map((s) => s.bid));
    Object.keys(cache.legend).forEach((bid) => { if (!legendWant.has(bid)) { cache.legend[bid].remove(); delete cache.legend[bid]; } });
    legendAll.forEach((s) => {
      let el = cache.legend[s.bid];
      if (!el) {
        el = document.createElement("span"); el.className = "lg";
        el.innerHTML = `<span class="dot"></span><span class="lgname"></span>`;
        legendEl.appendChild(el); cache.legend[s.bid] = el;
      }
      el.classList.toggle("off", !s.on);
      el.title = s.on ? "Click to hide this series" : "Click to show this series";
      el.querySelector(".dot").style.background = s.color;
      el.querySelector(".lgname").textContent = s.name + (s.bench ? " ★" : "");
      el.onclick = () => {
        const cb = document.querySelector(`#tc-builds input[data-b="${s.bid}"]`);
        if (!cb) return;
        // keep at least one line on the chart — ignore a click that would hide the last
        if (!el.classList.contains("off") && legendEl.querySelectorAll(".lg:not(.off)").length <= 1) return;
        cb.checked = !cb.checked;
        if (cb.onchange) cb.onchange();
      };
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
    const DUR = prefersReduced ? 0 : (cache.drawn ? 480 : 760);   // first paint = cinematic left-to-right draw-on
    const fmtY = (v) => fmtTrendValue(st.metric, v, true);
    const labelFmt = (v) => fmtTrendValue(st.metric, v, false);

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

      let endLabels = "";
      active.forEach((rec) => {
        const s = rec.s, vmapNow = {};
        // One continuous monotone line through every valid observation — connect
        // consecutive points even if filtering to a bucket dropped dates between
        // them (same-date dupes are deduped upstream, so no vertical artifacts).
        const coords = s.pts.map((p) => { const fv = rec.fromY(p.d); const v = fv != null ? lerp(fv, p.v, e) : p.v; vmapNow[p.d] = v; return { X: x(p.d), Y: y(v) }; });
        const dpath = smoothPath(coords);
        rec.path.setAttribute("d", dpath);
        rec.path.setAttribute("stroke", s.color);
        rec.path.setAttribute("stroke-width", s.bench ? 3 : 1.6);
        rec.path.setAttribute("stroke-linecap", "round");
        rec.path.setAttribute("stroke-linejoin", "round");
        rec.path.setAttribute("stroke-opacity", s.bench ? "1" : "0.9");
        let dots = "";
        s.pts.forEach((p) => { const cy = y(vmapNow[p.d]); dots += s.bench ? `<circle cx="${x(p.d)}" cy="${cy}" r="3.5" fill="${s.color}"/>` : `<circle cx="${x(p.d)}" cy="${cy}" r="2.6" fill="#fff" stroke="${s.color}" stroke-width="1.4"/>`; });
        rec.dotsG.innerHTML = dots;
        rec.grp.style.opacity = cache.drawn ? (rec.enter ? String(e) : "1") : "1";   // first paint reveals via clip, not opacity
        rec.cur = vmapNow;
        if (coords.length) { const lc = coords[coords.length - 1]; endLabels += `<text class="end-label${s.bench ? " end-label--bench" : ""}" data-bid="${s.bid}" x="${(lc.X + 8).toFixed(1)}" y="${(lc.Y + 3.5).toFixed(1)}" fill="${s.color}">${labelFmt(vmapNow[s.pts[s.pts.length - 1].d])}</text>`; }
      });
      cache.labelsG.innerHTML = endLabels;
      cache.labelsG.style.opacity = cache.drawn ? "1" : String(Math.max(0, (e - 0.6) / 0.4));   // labels fade in as the draw-on finishes
      cache.clipRect.setAttribute("width", String(cache.drawn ? W : Math.max(0, e * W)));         // left-to-right reveal on first paint
      exits.forEach((rec) => { rec.grp.style.opacity = String(1 - e); });

      if (e >= 1) {  // finalize: drop exited series, lock in the full reveal
        exits.forEach((rec) => rec.grp.remove());
        Object.keys(cache.series).forEach((bid) => { if (!want.has(bid)) delete cache.series[bid]; });
        active.forEach((rec) => (rec.enter = false));
        cache.drawn = true; cache.clipRect.setAttribute("width", String(W)); cache.labelsG.style.opacity = "1";
      }
    };

    renderFrame(0);  // paint at the current position first (no flash)
    const t0 = performance.now();
    const tick = (now) => { const e = ease(Math.min(1, (now - t0) / DUR)); renderFrame(e); if (e < 1) chartRaf[key] = requestAnimationFrame(tick); };
    chartRaf[key] = requestAnimationFrame(tick);
  }

  // Edit a building's scrape configuration (URL / strategy / initial wait / scroll).
  function openScrapeSettingsModal(b) {
    const stratOpts = STRATEGY_INFO.map((s) => `<option value="${s.value}" ${b.strategy === s.value ? "selected" : ""}>${esc(s.label)}</option>`).join("");
    const stratDescMap = Object.fromEntries(STRATEGY_INFO.map((s) => [s.value, s.desc]));
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="Scrape Settings">
      <div class="modal__head">
        <div class="modal__chip">${icon("settings")}</div>
        <div class="modal__title">Scrape Settings — ${esc(b.name)}</div>
        <button class="modal__x" data-close aria-label="Close">&times;</button>
      </div>
      <div class="modal__body">
        <div class="field"><label for="ss-url">Scrape URL <span class="sub">(the page that lists available units)</span></label><input type="text" id="ss-url" placeholder="https://…/floorplans" value="${esc(b.scrapeUrl || "")}"/></div>
        <div class="field"><label for="ss-strat">How should we read this site? <span class="sub">(scrape strategy)</span></label>
          <select id="ss-strat">${stratOpts}</select>
          <div class="strat-desc" id="ss-strat-desc">${esc(stratDescMap[b.strategy] || STRATEGY_INFO[0].desc)}</div>
        </div>
        <div class="field-row">
          <div class="field"><label for="ss-wait">Initial wait (ms) <span class="sub">(let the page settle)</span></label><input type="text" id="ss-wait" inputmode="numeric" value="${b.initialWaitMs != null ? b.initialWaitMs : ""}"/></div>
          <div class="field"><label for="ss-scroll">Scroll the page?</label><select id="ss-scroll"><option value="">—</option><option value="yes" ${b.scroll === true ? "selected" : ""}>Yes</option><option value="no" ${b.scroll === false ? "selected" : ""}>No</option></select></div>
        </div>
        <div class="geo-note">Saved in this browser only. Actual scraping runs server-side once API keys are configured; these settings drive the next run.</div>
      </div>
      <div class="modal__foot">
        <button class="btn" data-close>Cancel</button>
        <button class="btn btn--primary" id="ss-save">Save settings</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    const $ = (s) => overlay.querySelector(s);
    $("#ss-strat").onchange = () => { $("#ss-strat-desc").textContent = stratDescMap[$("#ss-strat").value] || ""; };
    function close() { overlay.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    overlay.querySelectorAll("[data-close]").forEach((x) => (x.onclick = close));
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    $("#ss-save").onclick = () => {
      const wait = parseInt(String($("#ss-wait").value).replace(/[^\d]/g, ""), 10);
      b.scrapeUrl = $("#ss-url").value.trim() || null;
      b.strategy = b.scrapeUrl ? $("#ss-strat").value : null;
      b.initialWaitMs = isNaN(wait) ? null : wait;
      b.scroll = { yes: true, no: false }[$("#ss-scroll").value] ?? null;
      saveScrapeSettings(b);
      close();
      route();                       // re-render the Scrape Configuration card
      toast(`Scrape settings updated for <b>${esc(b.name)}</b>`);
    };
    setTimeout(() => $("#ss-url").focus(), 0);
  }

  // Add this building (as a comp) to one or more existing analyses.
  function openAddToAnalysisModal(b) {
    const rows = D.analyses.map((a) => {
      const inSet = a.benchmark === b.id || a.comps.some((c) => c.building === b.id);
      const role = a.benchmark === b.id ? "benchmark" : "comp";
      return `<label class="ci"><input type="checkbox" data-aid="${a.id}" ${inSet ? "checked disabled" : ""}/> <span>${esc(a.name)}</span><span class="city">${inSet ? "already a " + role : ""}</span></label>`;
    }).join("") || '<div class="empty">No analyses yet — create one from the sidebar.</div>';
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="Add to Analysis">
      <div class="modal__head">
        <div class="modal__chip">${icon("plus")}</div>
        <div class="modal__title">Add to Analysis — ${esc(b.name)}</div>
        <button class="modal__x" data-close aria-label="Close">&times;</button>
      </div>
      <div class="modal__body">
        <div class="field"><label>Add <b>${esc(b.name)}</b> as a comparable to:</label>
          <div class="checklist" id="ata-list">${rows}</div>
        </div>
      </div>
      <div class="modal__foot">
        <button class="btn" data-close>Cancel</button>
        <button class="btn btn--accent" id="ata-add">Add to selected</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    const $ = (s) => overlay.querySelector(s);
    function close() { overlay.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    overlay.querySelectorAll("[data-close]").forEach((x) => (x.onclick = close));
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    $("#ata-add").onclick = () => {
      const picks = [...overlay.querySelectorAll("#ata-list input:checked:not(:disabled)")].map((cb) => cb.dataset.aid);
      if (!picks.length) { close(); return; }
      picks.forEach((aid) => { const a = analysisById(aid); if (a) addCompsToAnalysis(a, [b.id]); });
      close();
      const n = picks.length;
      const last = analysisById(picks[n - 1]);
      toast(`Added <b>${esc(b.name)}</b> to ${n === 1 ? `<b>${esc(last.name)}</b>` : n + " analyses"}`, n === 1 ? { action: "Open", onAction: () => { location.hash = "#/analysis/" + last.id; } } : {});
    };
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
        <div class="s"><b class="tnum" data-count="${total}" data-fmt="int">${total}</b><span>Total scrapes</span></div>
        <div class="s ok"><b class="tnum" data-count="${ok}" data-fmt="int">${ok}</b><span>Successful</span></div>
        <div class="s err"><b class="tnum" data-count="${err}" data-fmt="int">${err}</b><span>Errors</span></div>
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
      ${q.length ? `<table class="hist"><thead><tr><th>Quarter</th><th>Active listings</th><th>Avg size (sf)</th><th>Avg rent</th><th>Avg PSF</th></tr></thead><tbody>${qrows}</tbody></table>` : `<div class="empty">${icon("chart")}<br/>No quarterly history yet.</div>`}
    </div>`;

    // per-snapshot detail (by date) for expanding each scrape-history row
    const snapByDate = {};
    (D.snapshots[id] || []).forEach((s) => (snapByDate[s.date] = s));
    const scrapeDetail = (h, det) => {
      let html = `<div class="sh-detail">`;
      html += `<div class="sh-inc"><span class="sh-lbl">Incentive</span>${h.incentives ? esc(h.incentives) : '<span class="sub">None advertised</span>'}</div>`;
      if (det && det.weighted) {
        const w = det.weighted;
        html += `<div class="sh-stats"><span><b class="tnum">${w.count}</b> units</span><span><b class="tnum">${money(w.avgRent)}</b> avg rent</span><span><b class="tnum">${psf(w.avgPsf)}</b> avg PSF</span><span><b class="tnum">${w.avgSqft ? w.avgSqft.toLocaleString() : "—"}</b> avg sf</span></div>`;
        if (det.hasUnits) {
          // listings live in a lazy per-building file — slot is filled by loadUnits() below
          html += `<div class="sh-uslot" data-date="${det.date}"><div class="sub" style="margin-top:4px">${icon("clock")} Loading listings…</div></div>`;
        } else {
          html += `<div class="sub" style="margin-top:4px">Individual listings retained for the 8 most recent scrapes.</div>`;
        }
      } else {
        html += `<div class="sub" style="margin-top:4px">No unit-level detail${h.status !== "success" ? " — this scrape errored" : " retained for this scrape"}.</div>`;
      }
      return html + `</div>`;
    };
    const scrapeHist = `<div class="card"><div class="card__title">${icon("clock")} Scrape History <span class="sub" style="font-weight:400">· click a row for detail</span></div>
      <div class="scrape-hist">${hist.slice(0, 15).map((h, i) => {
        const det = snapByDate[(h.date || "").slice(0, 10)];
        return `<div class="row sh-row" data-i="${i}">
          <span class="${h.status === "success" ? "dot-ok" : "dot-err"}">${icon(h.status === "success" ? "check" : "edit")}</span>
          <span class="when">${fmtDate(h.date)}</span>
          <span class="tnum" style="width:64px">${h.units} units</span>
          ${h.incentives ? '<span class="sh-tag">incentive</span>' : ""}
          <span class="sh-caret">${icon("chevron-down")}</span>
        </div>
        <div class="sh-panel" data-panel="${i}">${scrapeDetail(h, det)}</div>`;
      }).join("") || `<div class="empty">${icon("clock")}<br/>No scrapes recorded yet.</div>`}
      </div></div>`;

    $view.innerHTML = `
      <div class="page-head">
        <div class="page-head__main">
          <div class="eyebrow"><a href="#/universe" id="b-back" style="color:var(--info)">${icon("chevron-left")} Building Universe</a></div>
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
          <div class="detail-actions">
            <button class="btn" id="b-scrape">${icon("settings")} Scrape Settings</button>
            <button class="btn btn--accent" id="b-addto">${icon("plus")} Add to Analysis</button>
          </div>
        </div>
      </div>
      <div class="detail-grid">${cfg}${stats}</div>
      ${histTable}
      <div style="height:24px"></div>
      ${scrapeHist}`;

    // Back arrow: flag a scroll-restore so returning to the universe lands exactly where
    // the user left it (only this arrow — sidebar / other nav stays a fresh top render).
    const bk = document.getElementById("b-back");
    if (bk) bk.onclick = () => { wantUniverseRestore = true; };   // href still navigates to #/universe

    const bScrape = document.getElementById("b-scrape");
    if (bScrape) bScrape.onclick = () => openScrapeSettingsModal(b);
    const bAddTo = document.getElementById("b-addto");
    if (bAddTo) bAddTo.onclick = () => openAddToAnalysisModal(b);

    const brm = document.getElementById("b-remove");
    if (brm) brm.onclick = () => confirmModal({
      title: "Remove building?",
      body: `Remove the added building <b>${esc(b.name)}</b>? This only deletes the building you added in this app.`,
      confirmLabel: "Remove building",
    }).then((ok) => {
      if (!ok) return;
      const saved = D.buildings[id];
      deleteBuilding(id);
      toast(`Removed <b>${esc(saved.name)}</b>`, { action: "Undo", onAction: () => { D.buildings[id] = saved; saveCustomBuildings(); location.hash = "#/building/" + id; } });
    });

    $view.querySelectorAll("tr.qtotal").forEach((tr) => (tr.onclick = () => {
      tr.classList.toggle("open");
      $view.querySelectorAll(`tr.qsub[data-parent="${tr.dataset.q}"]`).forEach((r) => (r.style.display = r.style.display === "none" ? "table-row" : "none"));
    }));

    $view.querySelectorAll(".sh-row").forEach((r) => (r.onclick = () => {
      const panel = $view.querySelector(`.sh-panel[data-panel="${r.dataset.i}"]`);
      if (!panel) return;
      r.classList.toggle("open", panel.classList.toggle("open"));   // smooth grid-row accordion (CSS)
    }));
    // fill the lazy individual-listing slots once this building's unit file loads
    const slots = $view.querySelectorAll(".sh-uslot");
    if (slots.length) loadUnits(id).then((map) => {
      $view.querySelectorAll(".sh-uslot").forEach((slot) => {
        const rows = map[slot.dataset.date];
        slot.innerHTML = (rows && rows.length) ? unitsTableHtml(rows)
          : `<div class="sub" style="margin-top:4px">Individual listings unavailable.</div>`;
      });
    });
  }

  // ============================================================== Router =====
  // ---- motion / micro-interactions -----------------------------------------
  const prefersReduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  function fmtCount(v, fmt) {
    if (fmt === "psf") return "$" + v.toFixed(2);
    if (fmt === "pct") return (v > 0 ? "+" : "") + Math.round(v) + "%";
    if (fmt === "money") return "$" + Math.round(v).toLocaleString();
    return Math.round(v).toLocaleString();                 // int
  }
  // Count [data-count] numbers up from 0 → target on mount (tabular nums keep them
  // from jittering). Honors reduced-motion.
  function animateCounts(root) {
    if (!root) return;
    root.querySelectorAll("[data-count]").forEach((el) => {
      const target = parseFloat(el.dataset.count);
      if (!isFinite(target)) return;
      const fmt = el.dataset.fmt || "int";
      if (prefersReduced) { el.textContent = fmtCount(target, fmt); return; }
      const dur = 650, t0 = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3);                  // easeOutCubic
        el.textContent = fmtCount(target * e, fmt);
        if (p < 1) requestAnimationFrame(tick); else el.textContent = fmtCount(target, fmt);
      };
      requestAnimationFrame(tick);
    });
  }

  // Sliding pill for segmented controls. The thumb is recreated each render, but
  // we remember the last-active index per control (segLast) so it glides from
  // where it was to the new active tab even across re-renders.
  const segLast = {};
  function placeThumb(seg) {
    const key = seg.dataset.seg || "seg";
    const btns = [...seg.querySelectorAll("button")];
    if (!btns.length) return;
    let thumb = seg.querySelector(".seg-thumb");
    if (!thumb) { thumb = document.createElement("span"); thumb.className = "seg-thumb"; seg.insertBefore(thumb, seg.firstChild); }
    const activeIdx = Math.max(0, btns.findIndex((b) => b.classList.contains("active")));
    const at = (i) => { const b = btns[i]; thumb.style.width = b.offsetWidth + "px"; thumb.style.transform = `translateX(${b.offsetLeft}px)`; };
    const fromIdx = segLast[key];
    if (prefersReduced || fromIdx == null || fromIdx === activeIdx) {
      thumb.style.transition = "none"; at(activeIdx);
    } else {
      thumb.style.transition = "none"; at(fromIdx); void thumb.offsetWidth;
      thumb.style.transition = ""; requestAnimationFrame(() => at(activeIdx));
    }
    segLast[key] = activeIdx;
  }
  function initSegmenteds(root) { if (root) root.querySelectorAll(".segmented[data-seg]").forEach(placeThumb); }

  // Re-trigger the page fade+rise entrance on the content container.
  function playViewEnter() {
    if (prefersReduced || !$view) return;
    $view.classList.remove("view-enter"); void $view.offsetWidth; $view.classList.add("view-enter");
  }

  // Back-to-top: a floating button on the Building Universe *list* that appears once you've
  // scrolled past the first screen and glides you back to the top.
  let toTopBtn = null;
  function updateToTop() {
    const onListUniverse = (location.hash || "#/universe").startsWith("#/universe") && buState.view === "list";
    const show = onListUniverse && window.scrollY > window.innerHeight * 0.75;
    if (show && !toTopBtn) {
      toTopBtn = document.createElement("button");
      toTopBtn.className = "to-top"; toTopBtn.setAttribute("aria-label", "Back to top"); toTopBtn.title = "Back to top";
      toTopBtn.innerHTML = icon("chevron-left");
      toTopBtn.onclick = () => window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
      document.body.appendChild(toTopBtn);
      requestAnimationFrame(() => toTopBtn && toTopBtn.classList.add("show"));
    } else if (toTopBtn) {
      toTopBtn.classList.toggle("show", show);
    }
  }
  window.addEventListener("scroll", updateToTop, { passive: true });
  window.addEventListener("scroll", updateCompSticky, { passive: true });
  window.addEventListener("resize", () => { if (compStickyWrap && compStickyWrap.isConnected) buildCompSticky(compStickyWrap); });

  let routeCur = null, savedUniverseScroll = null, savedMapView = null, wantUniverseRestore = false, universeInstant = false;
  function route() {
    if (!D) return;   // ignore navigation until the dataset has loaded
    const h = location.hash || "#/universe";
    const prev = routeCur;
    // Detect a tab switch within the same analysis so we can crossfade just the tab
    // body (and keep scroll), instead of re-fading the whole page including the header.
    const am = h.match(/^#\/analysis\/([^/]+)(?:\/(\w+))?/);
    const pm = (prev || "").match(/^#\/analysis\/([^/]+)/);
    const tabSwitch = !!(am && pm && am[1] === pm[1] && prev !== h);
    // Universe → building: stash the universe's scroll, and (if on the map) its exact
    // pan/zoom — both read here while the outgoing page is still live, before destroyMap.
    // Reaching a building any other way clears them, so a restore only ever applies to a
    // building opened directly from the universe.
    if (h.startsWith("#/building/")) {
      const fromU = !!(prev && prev.startsWith("#/universe"));
      savedUniverseScroll = fromU ? window.scrollY : null;
      savedMapView = (fromU && uMap && buState.view === "map")
        ? { center: uMap.getCenter(), zoom: uMap.getZoom(), spider: uSpiderfied ? uSpiderfied.getAllChildMarkers().map((m) => m._bid).filter(Boolean) : null, popup: uOpenPopupBid }
        : null;
    }
    // Restore only when the building's back arrow brought us here (not sidebar/other nav).
    const restoreScroll = (h.startsWith("#/universe") && wantUniverseRestore && savedUniverseScroll != null) ? savedUniverseScroll : null;
    wantUniverseRestore = false;
    // On a back-arrow restore, render the universe statically (no card stagger, no map
    // intro, no page fade) so it reappears instantly at the saved spot — feels like you
    // never left, instead of re-animating for a beat. On the map, also drop onto the saved
    // pan/zoom (mapRestoreView, consumed by setUniverseMarkers) instead of the default fit.
    universeInstant = restoreScroll != null;
    if (universeInstant && savedMapView && buState.view === "map") mapRestoreView = savedMapView;
    routeCur = h;
    destroyMap();
    teardownCompSticky();   // renderSummary rebuilds it for the comp tab; other pages stay clear
    renderNav();
    if (!tabSwitch && restoreScroll == null) window.scrollTo(0, 0);
    if (h.startsWith("#/universe")) renderUniverse();
    else if (am) renderAnalysis(am[1], am[2]);
    else if (h.startsWith("#/building/")) renderBuilding(h.split("/")[2]);
    else renderUniverse();
    if (restoreScroll != null) { window.scrollTo(0, restoreScroll); savedUniverseScroll = null; savedMapView = null; mapRestoreView = null; }   // back to the exact spot
    if (tabSwitch) {
      const tb = document.getElementById("tabbody");
      if (tb && !prefersReduced) { tb.classList.remove("tab-fade"); void tb.offsetWidth; tb.classList.add("tab-fade"); }
    } else if (!universeInstant) playViewEnter();
    universeInstant = false;   // one render only
    initSegmenteds($view);
    animateCounts($view);
    updateToTop();   // show/hide the back-to-top button for this page + scroll position
  }
  window.addEventListener("hashchange", route);
  window.addEventListener("resize", () => { if ((location.hash || "").includes("/trends")) route(); else positionNavRail(false); });
  $nav.addEventListener("scroll", () => positionNavRail(false));   // keep the rail aligned if the nav scrolls

  // Collapsible sidebar (data-independent) — wired immediately so the toggle works even
  // while the dataset is loading. Always starts OPEN (in-memory only, not persisted).
  (function wireSidebar() {
    const sb = document.getElementById("sidebar"), tg = document.getElementById("sb-toggle");
    if (!sb || !tg) return;
    tg.innerHTML = icon("chevron-left");
    tg.onclick = () => setSidebarOpen(sb.classList.contains("collapsed"));
    setSidebarOpen(true);
  })();

  // ---- Data source + boot ---------------------------------------------------
  // ONE seam for where the dataset comes from, configured in config.js (window.COMP_CONFIG):
  //   dataSource "inline" → window.COMP_DATA (the generated data.js; default, offline-friendly)
  //   dataSource "url"    → fetch the SAME rollup JSON from a backend at dataUrl
  // Everything downstream reads through `D`, so swapping the source needs no view changes —
  // a live backend just has to return the shape build_data.py emits.
  function loadData() {
    const cfg = window.COMP_CONFIG || {};
    if (cfg.dataSource === "url" && cfg.dataUrl) {
      return fetch(cfg.dataUrl, { headers: { Accept: "application/json" }, cache: "no-store" })
        .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
    }
    return Promise.resolve(window.COMP_DATA || null);   // inline (default)
  }
  function dataState(html) { if ($view) $view.innerHTML = `<div class="card" style="max-width:520px;margin:48px auto"><div class="empty">${html}</div></div>`; }
  function boot() {
    loadCustomBuildings();
    loadScrapeOverrides();
    loadCustomAnalyses();
    // Always land on Building Universe on open/refresh, regardless of a persisted hash.
    if (location.hash && location.hash !== "#/universe") history.replaceState(null, "", "#/universe");
    route();
  }
  function start() {
    dataState(`${icon("clock")}<br/>Loading comp data…`);
    loadData().then((data) => {
      if (!data) throw new Error("No dataset found (check config.js / data.js).");
      D = data;
      boot();
    }).catch((err) => {
      dataState(`${icon("globe")}<br/>Couldn't load comp data.<br/><span class="sub">${esc(String((err && err.message) || err))}</span><div style="margin-top:14px"><button class="btn btn--accent" id="data-retry">Retry</button></div>`);
      const rb = document.getElementById("data-retry");
      if (rb) rb.onclick = start;
    });
  }
  start();
})();
