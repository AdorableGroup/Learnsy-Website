/**
 * Cloudflare Pages Function — /api/ai-chat
 * Engine: @cf/meta/llama-3.1-8b-instruct
 * Rate limit: 10 req/IP/giờ via Upstash Redis
 *
 * Bindings cần trong Pages dashboard:
 *   Workers AI  → Variable name: "AI"
 *   Environment → UPSTASH_URL, UPSTASH_TOKEN
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MODEL   = '@cf/meta/llama-3.1-8b-instruct';
const LIMIT   = 10;
const TTL_SEC = 60 * 60;

async function redis(url, token, ...args) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  return (await r.json()).result;
}

function getIP(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export async function onRequest(ctx) {
  const { request, env } = ctx;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS });
  }

  const ip  = getIP(request);
  const key = `learnsy_ai_rl:${ip}`;
  const url = new URL(request.url);

  let body = {};
  try { body = await request.json(); } catch {}

  const checkOnly = url.searchParams.has('check') || body.checkOnly === true;

  /* ── Upstash: lấy count hiện tại ── */
  let currentCount = 0, ttl = TTL_SEC;
  if (env.UPSTASH_URL && env.UPSTASH_TOKEN) {
    try {
      const raw = await redis(env.UPSTASH_URL, env.UPSTASH_TOKEN, 'GET', key);
      currentCount = parseInt(raw) || 0;
      const t = await redis(env.UPSTASH_URL, env.UPSTASH_TOKEN, 'TTL', key);
      if (t > 0) ttl = t;
    } catch {}
  }

  const resetAt   = Date.now() + ttl * 1000;
  const remaining = Math.max(0, LIMIT - currentCount);

  /* ── checkOnly: trả thông tin, không tốn lượt ── */
  if (checkOnly) {
    return new Response(JSON.stringify({ remaining, resetAt }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  /* ── Hết lượt ── */
  if (currentCount >= LIMIT) {
    return new Response(JSON.stringify({
      error: `Đã hết lượt hỏi. Reset sau ~${Math.ceil(ttl / 60)} phút.`,
      remaining: 0, resetAt,
    }), { status: 429, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  if (!env.AI) {
    return new Response(JSON.stringify({ error: 'AI binding chưa được thiết lập' }), {
      status: 503, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  /* ── Tăng counter ── */
  if (env.UPSTASH_URL && env.UPSTASH_TOKEN) {
    try {
      const newCount = await redis(env.UPSTASH_URL, env.UPSTASH_TOKEN, 'INCR', key);
      if (newCount === 1) {
        await redis(env.UPSTASH_URL, env.UPSTASH_TOKEN, 'EXPIRE', key, TTL_SEC);
      }
    } catch {}
  }

  const newRemaining = Math.max(0, LIMIT - (currentCount + 1));
  const newTtl = env.UPSTASH_URL ? await redis(env.UPSTASH_URL, env.UPSTASH_TOKEN, 'TTL', key).catch(() => TTL_SEC) : TTL_SEC;
  const newResetAt = Date.now() + (newTtl > 0 ? newTtl : TTL_SEC) * 1000;

  /* ── Chuẩn bị messages ── */
  const { messages = [] } = body;

  // Tách system prompt và các message còn lại
  const systemMsg = messages.find(m => m.role === 'system');
  const chatMsgs  = messages.filter(m => m.role !== 'system')
    .filter(m => m && typeof m.content === 'string' && m.content.trim())
    .map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content.trim(),
    }));

  if (!chatMsgs.length) {
    return new Response(JSON.stringify({ error: 'Không có tin nhắn hợp lệ', remaining: newRemaining, resetAt: newResetAt }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Merge system vào user message đầu tiên (llama-3.1-8b hỗ trợ tốt nhất theo cách này)
  if (systemMsg && systemMsg.content) {
    chatMsgs[0] = {
      role: 'user',
      content: `[Hướng dẫn: ${systemMsg.content}]\n\n${chatMsgs[0].content}`,
    };
  }

  /* ── Gọi AI ── */
  try {
    const result = await env.AI.run(MODEL, {
      messages: chatMsgs,
      max_tokens: 512,
    });

    const response = (result?.response || '').trim();

    if (!response) {
      return new Response(JSON.stringify({
        error: 'AI không trả lời được, thử lại nhé!',
        remaining: newRemaining, resetAt: newResetAt,
      }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ response, remaining: newRemaining, resetAt: newResetAt }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(JSON.stringify({
      error: e.message || 'Lỗi không xác định',
      remaining: newRemaining, resetAt: newResetAt,
    }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
}
