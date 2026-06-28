/* ══════════════════════════════════════════════════════════════════
   functions/api/tts.js — Cloudflare Pages Function
   Proxy gọi sang Worker Edge TTS (DIYgod/cloudflare-edge-tts) để tránh
   CORS — browser chỉ cần gọi cùng-origin '/api/tts'.
   Cấu hình: vào Cloudflare Pages → Settings → Environment variables,
   thêm EDGE_TTS_WORKER_URL = https://<tên-worker-của-em>.workers.dev
   (URL này có được sau khi `wrangler deploy` repo cloudflare-edge-tts.)
══════════════════════════════════════════════════════════════════ */

const DEFAULT_VOICE = 'en-US-AvaMultilingualNeural'; // giọng nữ AI, tự nhiên
const MAX_CHARS = 4000; // chặn text quá dài (đoạn nghe thường < 1000 ký tự)

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const text = (body?.text || '').toString().trim();
  if (!text) return new Response('Missing "text"', { status: 400 });
  if (text.length > MAX_CHARS) {
    return new Response(`Text quá dài (>${MAX_CHARS} ký tự)`, { status: 400 });
  }

  const voice = (body?.voice || DEFAULT_VOICE).toString();
  const upstream = env.EDGE_TTS_WORKER_URL;
  if (!upstream) {
    return new Response(
      'Chưa cấu hình EDGE_TTS_WORKER_URL trong Cloudflare Pages env vars',
      { status: 500 }
    );
  }

  let res;
  try {
    res = await fetch(`${upstream.replace(/\/$/, '')}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    });
  } catch (e) {
    return new Response('Không gọi được Edge TTS worker: ' + (e?.message || e), { status: 502 });
  }

  if (!res.ok || !res.body) {
    return new Response('Edge TTS worker lỗi: ' + res.status, { status: 502 });
  }

  return new Response(res.body, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=86400', // cache 1 ngày, audio không đổi theo text+voice cố định
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
