/**
 * LLM API 中转（Cloudflare Worker）
 * 用途：给 llm-tracker 静态站的 AI 助手做代理，隐藏真实的 LLM API Key
 *
 * 部署后把下面 4 个变量配置到 Worker 的 Settings → Variables：
 *   API_KEY      你的真实 LLM API Key（如 DeepSeek / 硅基流动 / OpenAI 的 key）
 *   BASE_URL     上游 API 根地址（见下方示例）
 *   MODEL        默认模型名（浏览器端不传 model 时用它）
 *   PROXY_KEY    （可选）浏览器端需携带的口令，随便编一串，防止别人拿你的 Worker 白嫖
 *
 * BASE_URL 示例：
 *   DeepSeek   官方   https://api.deepseek.com
 *   硅基流动          https://api.siliconflow.cn
 *   OpenAI           https://api.openai.com
 *   Moonshot(Kimi)   https://api.moonshot.cn
 *   智谱 GLM          https://open.bigmodel.cn
 *   OpenRouter       https://openrouter.ai
 *
 * 部署完成后，把 Worker 地址填进 assets/ai-assistant.js 顶部的 AI_CONFIG：
 *   endpoint: 'https://你的worker名.你的子域.workers.dev/v1/chat/completions'
 *   apiKey:   '你设置的 PROXY_KEY'（没设就留空）
 *   model:    'deepseek-chat' 等模型名
 */

const ALLOWED_ORIGINS = [
  'https://xplore-lab.github.io',
  'http://localhost:8080', // 本地调试用，可删
];

// 简易限流：每个 IP 每分钟最多 10 次（防白嫖/防刷）
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000;
const hits = new Map(); // Map<ip, timestamps[]>

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': allowOrigin(request),
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    if (request.method !== 'POST') {
      return json({ error: 'method not allowed' }, 405, cors);
    }

    // 1) 来源检查：只允许你的站点
    if (!allowOrigin(request)) {
      return json({ error: 'forbidden origin' }, 403, cors);
    }

    // 2) 口令检查（如果配置了 PROXY_KEY）
    if (env.PROXY_KEY) {
      const auth = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      if (auth !== env.PROXY_KEY) {
        return json({ error: 'unauthorized' }, 401, cors);
      }
    }

    // 3) 限流
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const now = Date.now();
    const list = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW);
    if (list.length >= RATE_LIMIT) {
      return json({ error: 'too many requests, slow down' }, 429, cors);
    }
    list.push(now);
    hits.set(ip, list);
    if (hits.size > 5000) hits.clear(); // 防内存膨胀

    // 4) 转发到上游
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: 'invalid json' }, 400, cors);
    }
    if (env.MODEL && !body.model) body.model = env.MODEL;
    if (!body.model) return json({ error: 'missing model' }, 400, cors);

    const upstream = (env.BASE_URL || '').replace(/\/+$/, '') + '/v1/chat/completions';
    const upstreamRes = await fetch(upstream, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + env.API_KEY,
      },
      body: JSON.stringify(body),
    });

    // 5) 透传响应（流式也原样透传）
    const headers = new Headers(cors);
    headers.set('Content-Type', upstreamRes.headers.get('Content-Type') || 'application/json');
    return new Response(upstreamRes.body, { status: upstreamRes.status, headers });
  },
};

function allowOrigin(request) {
  const origin = request.headers.get('Origin') || '';
  return ALLOWED_ORIGINS.includes(origin) ? origin : '';
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
