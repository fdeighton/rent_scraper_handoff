// =============================================================================
// issue_worker_token — mint a scoped `scrape_worker` JWT for a paired agent.
// =============================================================================
// This is the ONLY place the JWT secret lives outside the Supabase dashboard.
// The browser (authorize.html, where the user is logged in) calls this with the
// user's auth token; we verify that user, then sign a short-to-medium-lived JWT
// whose `role` claim is `scrape_worker` — the scoped role that can ONLY execute
// the worker RPCs (claim_next_job / job_complete / ...). That token is handed to
// the desktop agent and stored in its OS keychain. The agent never sees the JWT
// secret or the service_role key.
//
// It also hands back the comps Anthropic key (option 2: deliver-via-pairing) so the
// agent's extractor can call Claude — neither secret is ever baked into the installer.
//
// Deploy:   supabase functions deploy issue_worker_token
// Secrets:  supabase secrets set WORKER_JWT_SECRET="<project JWT secret>"
//           (Dashboard → Settings → API → JWT Settings → JWT Secret.
//            Name can't start with SUPABASE_, so we use WORKER_JWT_SECRET.)
//           supabase secrets set RENT_COMPS_ANTHROPIC_KEY="<sk-ant-...>"
// Optional: supabase secrets set WORKER_TOKEN_TTL_DAYS=180
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const JWT_SECRET = Deno.env.get("WORKER_JWT_SECRET");
  if (!JWT_SECRET) return json({ error: "server misconfigured: WORKER_JWT_SECRET not set" }, 500);

  // 1. Verify the CALLER is a logged-in user (their token rides in Authorization).
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "missing bearer token" }, 401);

  const sb = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await sb.auth.getUser();
  if (error || !user) return json({ error: "not authenticated" }, 401);

  // (Optional hardening: gate on admin_users / an allowlist here.)

  // 2. Mint a scoped scrape_worker JWT, signed with the project JWT secret (HS256).
  const ttlDays = Number(Deno.env.get("WORKER_TOKEN_TTL_DAYS") ?? "180");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const exp = getNumericDate(60 * 60 * 24 * ttlDays);
  const token = await create(
    { alg: "HS256", typ: "JWT" },
    {
      role: "scrape_worker",   // <- PostgREST switches into this scoped role
      iss: "supabase",
      sub: user.id,            // who paired this agent (for audit)
      paired_by: user.email ?? null,
      iat: getNumericDate(0),
      exp,
    },
    key,
  );

  // Deliver the comps Anthropic key alongside the scoped token (option 2). Optional —
  // omit the secret and extraction simply won't run on the agent.
  const anthropicKey = Deno.env.get("RENT_COMPS_ANTHROPIC_KEY") ?? null;

  return json({ token, role: "scrape_worker", expires_at: exp, anthropic_key: anthropicKey });
});
