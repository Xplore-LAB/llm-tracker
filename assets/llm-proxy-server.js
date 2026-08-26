/**
 * LLM API 中转（自托管 Node 版，零依赖，Node >= 18）
 * 用途：给 llm-tracker 静态站的 AI 助手做代理，隐藏真实的 LLM API Key
 * 与 assets/llm-proxy-worker.js（Cloudflare 版）逻辑等价，二选一部署。
 *
 * 启动（密钥只存在于你自己的服务器环境变量里，不写进任何文件、不发任何人）：
 *   MINIMAX_API_KEY=你的真实key PROXY_KEY=自编口令 PORT=8787 node llm-proxy-server.js
 *
 * 环境变量：
 *   MINIMAX_API_KEY  真实 LLM API Key（必填）
 *   PROXY_KEY        浏览器端需携带的口令，随便编一串（必填）
 *   BASE_URL         上游 API 根地址（默认 https://api.minimaxi.com）
 *   PORT             监听端口（默认 8787）
 *
 * 公网暴露（任选其一）：
 *   cpolar:  cpolar http 8787           （得到 https 公网域名）
 *   Caddy:   caddy reverse-proxy --from 你的域名 --to localhost:8787
 *
 * 部署完成后，把公网地址和 PROXY_KEY 填进 assets/ai-assistant.js 顶部的 AI_CONFIG：
 *   endpoint: 'https://你的公网域名/v1/chat/completions'
 *   apiKey:   '你设置的 PROXY_KEY'
 */

'use strict';

const http = require('http');

const API_KEY = process.env.MINIMAX_API_KEY || '';
const PROXY_KEY = process.env.PROXY_KEY || '';
const BASE_URL = (process.env.BASE_URL || 'https://api.minimaxi.com').replace(/\/+$/, '');
const PORT = parseInt(process.env.PORT || '8787', 10);

if (!API_KEY || !PROXY_KEY) {
  console.error('[llm-proxy] 缺少 MINIMAX_API_KEY 或 PROXY_KEY 环境变量，拒绝启动');
  process.exit(1);
}

const ALLOWED_ORIGINS = [
  'https://xplore-lab.github.io',
  'http://localhost:8080', // 本地调试用，可删
  'http://localhost:8891',
];

// 简易限流：每个 IP 每分钟最多 10 次
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000;
const hits = new Map();

function allowOrigin(req) {
  const origin = req.headers.origin || '';
  return ALLOWED_ORIGINS.includes(origin) ? origin : '';
}

function corsHeaders(req) {
  return {
    'Access-Control-Allow-Origin': allowOrigin(req),
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  };
}

function sendJson(res, req, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { ...corsHeaders(req), 'Content-Type': 'application/json' });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req));
    res.end();
    return;
  }

  // 健康检查：验证公网隧道是否通
  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, req, 200, { ok: true, upstream: BASE_URL });
    return;
  }

  if (req.method !== 'POST' || url.pathname !== '/v1/chat/completions') {
    sendJson(res, req, 404, { error: 'not found' });
    return;
  }

  // 1) 来源检查：只允许你的站点
  if (!allowOrigin(req)) {
    sendJson(res, req, 403, { error: 'forbidden origin' });
    return;
  }

  // 2) 口令检查
  const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (auth !== PROXY_KEY) {
    sendJson(res, req, 401, { error: 'unauthorized' });
    return;
  }

  // 3) 限流
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW);
  if (list.length >= RATE_LIMIT) {
    sendJson(res, req, 429, { error: 'too many requests, slow down' });
    return;
  }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();

  // 4) 读请求体
  let raw = '';
  req.on('data', (c) => {
    raw += c;
    if (raw.length > 1024 * 1024) req.destroy(); // 1MB 上限
  });
  req.on('end', async () => {
    let body;
    try {
      body = JSON.parse(raw);
    } catch (e) {
      sendJson(res, req, 400, { error: 'invalid json' });
      return;
    }
    if (!body.model) body.model = 'MiniMax-M2.5';

    // 5) 转发到上游并透传响应（流式原样管道）
    try {
      const upstream = await fetch(BASE_URL + '/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + API_KEY,
        },
        body: JSON.stringify(body),
      });
      res.writeHead(upstream.status, {
        ...corsHeaders(req),
        'Content-Type': upstream.headers.get('content-type') || 'application/json',
      });
      if (upstream.body) {
        const { Readable } = require('stream');
        Readable.fromWeb(upstream.body).pipe(res);
      } else {
        res.end();
      }
    } catch (e) {
      sendJson(res, req, 502, { error: 'upstream unreachable: ' + e.message });
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('[llm-proxy] listening on 127.0.0.1:' + PORT + ' -> upstream ' + BASE_URL);
  console.log('[llm-proxy] 再用 cpolar/Caddy 把本端口暴露成 https 公网域名即可');
});
