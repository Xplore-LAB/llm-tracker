/**
 * Cloudflare Worker — API proxy for 大模型情报局 (LLM Papers Tracker)
 *
 * - GET proxy: streams paginated data chunks from GitHub Pages with
 *   referer whitelist, IP rate limiting, CORS, edge cache.
 * - POST/GET /api/favorites: persists the user's starred paper IDs to
 *   favorites.json in the GitHub repo (via GitHub Contents API).
 *   Requires the GITHUB_TOKEN secret (a fine-grained PAT with "Contents"
 *   read/write on Xplore-LAB/llm-tracker).
 *
 * Deploy: npx wrangler deploy
 * Set secret: npx wrangler secret put GITHUB_TOKEN
 */

// ── Config ──────────────────────────────────────────────
const GITHUB_PAGES_BASE = "https://xplore-lab.github.io/llm-tracker";
const REPO = "Xplore-LAB/llm-tracker";
const FAV_PATH = "favorites.json";
const ALLOWED_ORIGINS = [
  "https://xplore-lab.github.io",
  "http://localhost:8080",
  "http://localhost:3000",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:3000",
  "https://127.0.0.1:8080",
  "https://127.0.0.1:3000",
];
const ALLOWED_REFERERS = [
  "https://xplore-lab.github.io/",
  "http://localhost:8080/",
  "http://localhost:3000/",
  "http://127.0.0.1:8080/",
  "http://127.0.0.1:3000/",
];
// Data proxy is cache-friendly (a page load fires ~6 GETs); be generous.
// Favorites writes hit the GitHub API, so throttle those harder.
const DATA_LIMIT = 600;   // GET proxy: requests per minute per IP
const FAV_LIMIT = 30;     // favorites POST: per minute per IP
const RATE_WINDOW_MS = 60_000;

// ── Rate limiter (in-memory Map) ─────────────────────────
// Separate buckets for data GETs vs favorites writes.
// Note: resets on Worker cold start; for production use KV.
const ipBuckets = new Map();

function hit(ip, bucketKey, limit) {
  const now = Date.now();
  const key = ip + "|" + bucketKey;
  const record = ipBuckets.get(key);
  if (!record || now - record.resetAt > RATE_WINDOW_MS) {
    ipBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  record.count++;
  return record.count > limit;
}

// ── CORS ────────────────────────────────────────────────
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

// ── Helpers ──────────────────────────────────────────────
function isRefererAllowed(request) {
  const referer = request.headers.get("Referer") || "";
  return ALLOWED_REFERERS.some((r) => referer.startsWith(r));
}

function jsonResponse(data, status, extraHeaders, cacheable = false) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders,
  };
  if (cacheable) headers["Cache-Control"] = "public, max-age=3600";
  else headers["Cache-Control"] = "no-store";
  return new Response(JSON.stringify(data, null, 2), { status, headers });
}

// ── GitHub API helpers ───────────────────────────────────
async function githubGet(token, path) {
  const url = `https://api.github.com/repos/${REPO}/contents/${path}`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "llm-tracker-worker",
    },
  });
  return resp;
}

async function githubPut(token, path, contentBase64, message) {
  // Read current file SHA first (required by Contents API for updates)
  const current = await githubGet(token, path);
  let sha = null;
  if (current.ok) {
    const meta = await current.json();
    sha = meta.sha;
  } else if (current.status !== 404) {
    return current;
  }
  const url = `https://api.github.com/repos/${REPO}/contents/${path}`;
  const resp = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "llm-tracker-worker",
    },
    body: JSON.stringify({
      message,
      content: contentBase64,
      ...(sha ? { sha } : {}),
    }),
  });
  return resp;
}

// ── Favorites handlers ───────────────────────────────────
async function handleFavoritesGET(env, origin) {
  const cors = corsHeaders(origin);
  if (!env.GITHUB_TOKEN) {
    return jsonResponse({ error: "Server not configured (no GITHUB_TOKEN)" }, 500, cors, false);
  }
  const resp = await githubGet(env.GITHUB_TOKEN, FAV_PATH);
  if (resp.status === 404) {
    return jsonResponse([], 200, cors, false); // never starred yet
  }
  if (!resp.ok) {
    return jsonResponse({ error: "GitHub API error", status: resp.status }, 502, cors, false);
  }
  const meta = await resp.json();
  let content = meta.content || "";
  // GitHub returns base64 that may include newlines; strip them.
  content = content.replace(/\s+/g, "");
  try {
    const ids = JSON.parse(atob(content));
    return jsonResponse(Array.isArray(ids) ? ids : [], 200, cors, false);
  } catch {
    return jsonResponse([], 200, cors, false);
  }
}

async function handleFavoritesPOST(request, env, origin) {
  const cors = corsHeaders(origin);
  if (!env.GITHUB_TOKEN) {
    return jsonResponse({ error: "Server not configured (no GITHUB_TOKEN)" }, 500, cors, false);
  }
  let ids;
  try {
    const body = await request.json();
    if (!Array.isArray(body) && !Array.isArray(body?.ids)) {
      return jsonResponse({ error: "Expected an array of paper IDs" }, 400, cors, false);
    }
    ids = (Array.isArray(body) ? body : body.ids).filter(
      (x) => typeof x === "string" && x.length > 0
    );
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, cors, false);
  }
  const dedup = [...new Set(ids)];
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(dedup))));
  const resp = await githubPut(
    env.GITHUB_TOKEN,
    FAV_PATH,
    content,
    `chore: update favorites (${dedup.length} papers)`
  );
  if (!resp.ok) {
    return jsonResponse(
      { error: "GitHub write failed", status: resp.status },
      resp.status === 409 ? 409 : 502,
      cors,
      false
    );
  }
  return jsonResponse({ ok: true, count: dedup.length }, 200, cors, false);
}

// ── Main handler ─────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const origin = request.headers.get("Origin") || ALLOWED_ORIGINS[0];
    const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";

    // OPTIONS (CORS preflight)
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Referer check (skip for local dev)
    if (!isRefererAllowed(request)) {
      return jsonResponse(
        {
          error: "Forbidden",
          message: "Direct access is not allowed. Please visit xplore-lab.github.io/llm-tracker.",
          docs: "https://xplore-lab.github.io/llm-tracker/",
        },
        403,
        corsHeaders(origin)
      );
    }

    // ── Favorites endpoints ─────────────────────────────
    const isFav = path === "/api/favorites" || path === "/favorites";
    if (isFav) {
      const limit = request.method === "POST" ? FAV_LIMIT : DATA_LIMIT;
      if (hit(clientIP, "fav", limit)) {
        return jsonResponse(
          {
            error: "Too Many Requests",
            message: `Favorites rate limit reached. Please slow down.`,
            retryAfter: "60 seconds",
          },
          429,
          { ...corsHeaders(origin), "Retry-After": "60" }
        );
      }
      if (request.method === "GET") {
        return handleFavoritesGET(env, origin);
      }
      if (request.method === "POST") {
        return handleFavoritesPOST(request, env, origin);
      }
      return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders(origin));
    }

    // Rate limit (data proxy)
    if (hit(clientIP, "data", DATA_LIMIT)) {
      return jsonResponse(
        {
          error: "Too Many Requests",
          message: `Rate limit: ${DATA_LIMIT} requests per minute. Please slow down.`,
          retryAfter: "60 seconds",
        },
        429,
        {
          ...corsHeaders(origin),
          "Retry-After": "60",
        }
      );
    }

    // ── Data proxy (GET only) ───────────────────────────
    if (request.method !== "GET") {
      return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders(origin));
    }

    const upstreamURL = GITHUB_PAGES_BASE + path;
    let upstreamResp;
    try {
      upstreamResp = await fetch(upstreamURL, {
        cf: { cacheTtl: 3600 }, // edge-cache for 1 hour
      });
    } catch (err) {
      return jsonResponse({ error: "Upstream fetch failed" }, 502, corsHeaders(origin));
    }

    if (!upstreamResp.ok) {
      return jsonResponse(
        { error: "Not found", path },
        upstreamResp.status,
        corsHeaders(origin)
      );
    }

    const body = await upstreamResp.text();
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": upstreamResp.headers.get("Content-Type") || "application/json",
        "Cache-Control": "public, max-age=3600",
        ...corsHeaders(origin),
      },
    });
  },
};
