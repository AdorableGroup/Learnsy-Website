/**
 * GET /api/config
 * Trả Supabase anon config đã mã hóa AES-256-GCM.
 * Client dùng window.__ENC_KEY (hex 64 ký tự) để giải mã.
 *
 * Cloudflare Pages → Settings → Environment variables:
 *   SUPA_URL       = https://xxxx.supabase.co
 *   SUPA_KEY       = sb_publishable_...
 *   CONFIG_SECRET  = <64 ký tự hex — chạy: openssl rand -hex 32>
 *   ADMIN_API_KEY  = <PHẢI trùng với APP_SECRET đang đặt ở
 *                     Supabase Edge Functions → Secrets, vì
 *                     student-set-password so khớp header
 *                     "x-admin-secret" với APP_SECRET đó>
 */

/** hex string → Uint8Array */
function hexToBytes(hex) {
  if (hex.length % 2 !== 0) throw new Error('hex length must be even');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2)
    out[i >> 1] = parseInt(hex.slice(i, i + 2), 16);
  return out;
}

/** Uint8Array → base64 */
function toB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export async function onRequest({ env, request }) {
  /* ── Kiểm tra same-origin ───────────────────────────── */
  const host    = request.headers.get('Host')    || '';
  const origin  = request.headers.get('Origin')  || '';
  const referer = request.headers.get('Referer') || '';
  if (origin && !origin.includes(host) && !referer.includes(host)) {
    return new Response('Forbidden', { status: 403 });
  }

  /* ── Kiểm tra key hợp lệ ────────────────────────────── */
  const secret = (env.CONFIG_SECRET || '').trim();
  if (secret.length !== 64) {
    console.error('[config] CONFIG_SECRET phải là 64 ký tự hex (32 bytes)');
    return new Response('Server misconfigured', { status: 500 });
  }

  /* ── Mã hóa AES-256-GCM ─────────────────────────────── */
  const payload  = JSON.stringify({
    supaUrl: env.SUPA_URL ?? '',
    supaKey: env.SUPA_KEY ?? '',
    adminApiKey: env.ADMIN_API_KEY ?? '',
  });
  const plain    = new TextEncoder().encode(payload);
  const keyBytes = hexToBytes(secret);

  const key = await crypto.subtle.importKey(
    'raw', keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const iv         = crypto.getRandomValues(new Uint8Array(12)); // 96-bit nonce
  const cipherBuf  = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key, plain
  );

  return new Response(
    JSON.stringify({ iv: toB64(iv), data: toB64(cipherBuf) }),
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
  );
}
