/**
 * Cloudflare Pages Function — /api/chat
 * Binding cần tạo trong Pages dashboard:
 *   Workers AI → Variable name: "AI"
 *
 * POST /api/chat   { messages: [{role, content}], context? }
 * → trả về { reply: "..." }
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequest(ctx) {
  const { request, env } = ctx;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS });
  }

  if (!env.AI) {
    return new Response('AI not bound', { status: 503, headers: CORS });
  }

  try {
    const { messages = [] } = await request.json();

    // Giới hạn lịch sử gửi lên tối đa 10 tin (tránh vượt token)
    const trimmed = messages.slice(-10);

    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: trimmed,
      max_tokens: 512,
    });

    const reply = response.response || '(Không có phản hồi)';

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
}
