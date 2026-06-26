// =============================================================================
// Supabase-backed scrape orchestration for the frontend.
// =============================================================================
// This is the REAL agent loop seen from the browser. The user clicks "Run via
// Agent"; we enqueue a job into Supabase (enqueue_scrape_job), then poll
// scrape_jobs for progress. A Fitzrovia Agent running on some machine claims the
// job, scrapes, and calls job_complete — which writes scrape_snapshots + unit_data.
// When the job hits 'done' we read those rows straight back (both have an
// authenticated SELECT policy) and hand them to the UI.
//
//   window.SBScrape = {
//     configured(), session(), signIn(email,pw), signOut(),
//     enqueue({url, comp_building_id, building_name, config, priority}) -> job id,
//     getJob(id), watchJob(id, onUpdate, opts) -> final job,
//     requestCancel(id), snapshotUnits(snapshotId)
//   }
//
// supabase-js is loaded lazily from CDN on first use, so the app still opens from
// file:// / offline (the agent card just falls back to its mock preview).
// Requires window.COMP_CONFIG.supabaseUrl + supabaseAnonKey, and a logged-in
// Supabase Auth session (enqueue + reads need the `authenticated` role per RLS).
// =============================================================================
(function () {
  "use strict";

  // Pinned UMD build. Bump deliberately; add SRI once a hash is vendored.
  var CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
  var TERMINAL = { done: 1, error: 1, cancelled: 1 };

  function cfg() { return window.COMP_CONFIG || {}; }
  function url() { return cfg().supabaseUrl || ""; }
  function anon() { return cfg().supabaseAnonKey || ""; }
  function configured() { return !!(url() && anon()); }

  var _libPromise = null;
  function loadLib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve(window.supabase);
    if (_libPromise) return _libPromise;
    _libPromise = new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = CDN; s.async = true;
      s.onload = function () {
        if (window.supabase && window.supabase.createClient) res(window.supabase);
        else rej(new Error("supabase-js loaded but createClient missing"));
      };
      s.onerror = function () { rej(new Error("failed to load supabase-js from CDN")); };
      document.head.appendChild(s);
    });
    return _libPromise;
  }

  var _client = null;
  function client() {
    if (_client) return Promise.resolve(_client);
    if (!configured()) return Promise.reject(new Error("Supabase not configured (set supabaseUrl + supabaseAnonKey in config.js)"));
    return loadLib().then(function (lib) {
      _client = lib.createClient(url(), anon(), {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: "fitz_comp_auth" },
      });
      return _client;
    });
  }

  // --- auth -----------------------------------------------------------------
  function session() {
    return client().then(function (sb) { return sb.auth.getSession(); })
      .then(function (r) { return (r.data && r.data.session) || null; });
  }
  function signIn(email, password) {
    return client().then(function (sb) { return sb.auth.signInWithPassword({ email: email, password: password }); })
      .then(function (r) { if (r.error) throw r.error; return r.data.session; });
  }
  function signOut() { return client().then(function (sb) { return sb.auth.signOut(); }); }

  // Device pairing: mint a scoped scrape_worker token for an agent (Edge Function
  // holds the JWT secret; we just pass the user's session, which invoke() attaches).
  function issueWorkerToken() {
    return client().then(function (sb) { return sb.functions.invoke("issue_worker_token", { body: {} }); })
      .then(function (r) {
        if (r.error) throw r.error;
        if (!r.data || !r.data.token) throw new Error("no token returned");
        return r.data;   // { token, role, expires_at }
      });
  }

  // --- jobs -----------------------------------------------------------------
  function enqueue(opts) {
    opts = opts || {};
    return client().then(function (sb) {
      return sb.rpc("enqueue_scrape_job", {
        p_url: opts.url,
        p_comp_building_id: opts.comp_building_id || null,
        p_building_name: opts.building_name || null,
        p_config: opts.config || {},
        p_priority: opts.priority || 0,
      });
    }).then(function (r) { if (r.error) throw r.error; return r.data; });   // job id (uuid)
  }

  function getJob(id) {
    return client().then(function (sb) {
      return sb.from("scrape_jobs").select("*").eq("id", id).single();
    }).then(function (r) { if (r.error) throw r.error; return r.data; });
  }

  // Poll until the job reaches a terminal state. onUpdate(job) fires each tick.
  function watchJob(id, onUpdate, opts) {
    opts = opts || {};
    var intervalMs = opts.intervalMs || 1500;
    var timeoutMs = opts.timeoutMs || 300000;   // 5 min hard cap
    var t0 = Date.now();
    return new Promise(function (resolve, reject) {
      (function tick() {
        getJob(id).then(function (j) {
          if (onUpdate) { try { onUpdate(j); } catch (e) {} }
          if (TERMINAL[j.status]) return resolve(j);
          if (Date.now() - t0 > timeoutMs) return reject(new Error("timed out waiting for the agent"));
          setTimeout(tick, intervalMs);
        }).catch(reject);
      })();
    });
  }

  function requestCancel(id) {
    return client().then(function (sb) {
      return sb.rpc("request_scrape_cancel", { p_job_id: id });
    }).then(function (r) { if (r.error) throw r.error; return r.data; });
  }

  function snapshotUnits(snapshotId) {
    return client().then(function (sb) {
      return sb.from("comp_units").select("*").eq("snapshot_id", snapshotId);
    }).then(function (r) { if (r.error) throw r.error; return r.data || []; });
  }

  function snapshotMeta(snapshotId) {
    return client().then(function (sb) {
      return sb.from("comp_snapshots").select("*").eq("id", snapshotId).single();
    }).then(function (r) { if (r.error) throw r.error; return r.data; });
  }

  // Latest agent seen heartbeating within `withinSec` → treat the fleet as online.
  function agentOnline(withinSec) {
    withinSec = withinSec || 120;
    return client().then(function (sb) {
      return sb.from("scrape_workers").select("last_heartbeat,status").order("last_heartbeat", { ascending: false }).limit(1);
    }).then(function (r) {
      if (r.error) throw r.error;
      var w = (r.data || [])[0];
      if (!w || !w.last_heartbeat) return false;
      return (Date.now() - new Date(w.last_heartbeat).getTime()) < withinSec * 1000;
    });
  }

  window.SBScrape = {
    configured: configured, session: session, signIn: signIn, signOut: signOut,
    issueWorkerToken: issueWorkerToken,
    enqueue: enqueue, getJob: getJob, watchJob: watchJob,
    requestCancel: requestCancel, snapshotUnits: snapshotUnits,
    snapshotMeta: snapshotMeta, agentOnline: agentOnline,
  };
})();
