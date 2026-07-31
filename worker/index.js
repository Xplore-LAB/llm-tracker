/**
 * Cloudflare Worker — API proxy for 大模型情报局 (LLM Papers Tracker)
 *
 * Proxies paginated data chunks from GitHub Pages with:
 * - Referer whitelist (only xplore-lab.github.io + localhost)
 * - IP-based rate limiting
 * - CORS headers
 * - Cache at edge
 *
 * Deploy: npx wrangler deploy
 */

// ── Config ──────────────────────────────────────────────
const GITHUB_PAGES_BASE = "https://xplore-lab.github.io/llm-tracker";
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
const RATE_LIMIT = 60; // requests per minute per IP
const RATE_WINDOW_MS = 60_000;

// ── Rate limiter (in-memory Map) ─────────────────────────
// Note: resets on Worker cold start; for production use KV
const ipHits = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const record = ipHits.get(ip);
  if (!record || now - record.resetAt > RATE_WINDOW_MS) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  record.count++;
  return record.count > RATE_LIMIT;
}

// ── CORS ────────────────────────────────────────────────
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

// ── Helpers ──────────────────────────────────────────────
function isRefererAllowed(request) {
  const referer = request.headers.get("Referer") || "";
  return ALLOWED_REFERERS.some((r) => referer.startsWith(r));
}

function jsonResponse(data, status, extraHeaders) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      ...extraHeaders,
    },
  });
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

    // Only GET
    if (request.method !== "GET") {
      return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders(origin));
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

    // Rate limit
    if (isRateLimited(clientIP)) {
      return jsonResponse(
        {
          error: "Too Many Requests",
          message: `Rate limit: ${RATE_LIMIT} requests per minute. Please slow down.`,
          retryAfter: "60 seconds",
        },
        429,
        {
          ...corsHeaders(origin),
          "Retry-After": "60",
        }
      );
    }

    // Proxy to GitHub Pages
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

    // Forward the response with CORS
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
