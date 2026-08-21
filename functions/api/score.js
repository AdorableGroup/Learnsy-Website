/**
 * ══════════════════════════════════════════════════════════════════
 *  /functions/api/score.js  —  Learnsy Score Service
 *  Cloudflare Pages Function
 *
 *  POST /api/score          ← index gọi khi học sinh nộp bài
 *  GET  /api/score?lessonId=xxx
 *  GET  /api/score?studentId=xxx
 *  GET  /api/score?lessonId=xxx&summary=1
 *
 *  Env vars: SUPA_URL, SUPA_KEY
 * ══════════════════════════════════════════════════════════════════
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ── Rate limit: tối đa 5 POST / studentId / 60s ──────────────────
const _rateLimitMap = new Map(); // key: studentId → { count, resetAt }

function checkRateLimit(studentId) {
  if (!studentId) return true; // anon không giới hạn
  const now = Date.now();
  const entry = _rateLimitMap.get(studentId);
  if (!entry || now > entry.resetAt) {
    _rateLimitMap.set(studentId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

// ── Helpers ──────────────────────────────────────────────────────

function calcDiem10(score, total) {
  if (!total || total <= 0) return 0;
  return Math.round((score / total) * 100) / 10; // thang 10, 1 chữ số
}

function xepLoai(diem10) {
  if (diem10 >= 9)   return { label: 'Xuất sắc',   emoji: '🏆', color: '#10b981' };
  if (diem10 >= 8)   return { label: 'Giỏi',       emoji: '🥇', color: '#f59e0b' };
  if (diem10 >= 6.5) return { label: 'Khá',        emoji: '🥈', color: '#a855f7' };
  if (diem10 >= 5)   return { label: 'Trung bình', emoji: '👍', color: '#f472b6' };
  return               { label: 'Cần cố gắng', emoji: '📚', color: '#ef4444' };
}

function sanitizeStr(val, maxLen = 200, fallback = '') {
  if (val == null) return fallback;
  return String(val).trim().slice(0, maxLen) || fallback;
}

/**
 * Gọi Supabase REST API
 * prefer: override hoàn toàn header Prefer nếu cần
 */
async function supaFetch(env, path, method = 'GET', body = null, prefer = null) {
  const url = `${env.SUPA_URL}/rest/v1${path}`;

  const defaultPrefer = method === 'POST'
    ? 'return=representation,resolution=merge-duplicates'
    : 'return=minimal';

  const headers = {
    'apikey':        env.SUPA_KEY,
    'Authorization': `Bearer ${env.SUPA_KEY}`,
    'Content-Type':  'application/json',
    'Prefer':        prefer ?? defaultPrefer,
  };

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res  = await fetch(url, opts);
  const text = await res.text();

  let data;
  try { data = JSON.parse(text); }
  catch { data = text; }

  return { ok: res.ok, status: res.status, data };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ════════════════════════════════════════════════════════════════
//  POST /api/score  —  Học sinh nộp bài (upsert)
// ════════════════════════════════════════════════════════════════
async function handlePost(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'Body không hợp lệ (cần JSON)' }, 400); }

  const {
    lessonId,
    lessonTitle,
    studentName = 'Ẩn danh',
    studentId   = null,
    score,
    total,
    perQ          = [],
    questionCount = null,
  } = body;

  // ── Validate ────────────────────────────────────────────────
  const errs = [];
  if (!lessonId)                       errs.push('lessonId');
  if (score  == null || isNaN(+score)) errs.push('score');
  if (!total || +total <= 0)           errs.push('total');
  if (errs.length) {
    return json({ ok: false, error: `Thiếu hoặc sai trường: ${errs.join(', ')}` }, 400);
  }

  // ── Rate limit ───────────────────────────────────────────────
  if (!checkRateLimit(studentId)) {
    return json({ ok: false, error: 'Nộp bài quá nhanh, vui lòng thử lại sau.' }, 429);
  }

  const scoreInt = Math.round(Number(score));
  const totalInt = Math.round(Number(total));
  const diem10   = calcDiem10(scoreInt, totalInt);
  const pct      = Math.round((scoreInt / totalInt) * 100);
  const rank     = xepLoai(diem10);
  const submittedAt = new Date().toISOString();

  // ── Payload ──────────────────────────────────────────────────
  const payload = {
    student_name:   sanitizeStr(studentName, 100, 'Ẩn danh'),
    student_id:     studentId ? String(studentId) : null,
    lesson_id:      sanitizeStr(lessonId, 200),
    lesson_title:   sanitizeStr(lessonTitle, 200, 'Không rõ'),
    score:          scoreInt,
    total:          totalInt,
    diem10,
    pct,
    xep_loai:       rank.label,
    per_q:          Array.isArray(perQ) ? perQ : [],
    question_count: questionCount ? Math.round(Number(questionCount)) : totalInt,
    submitted_at:   submittedAt,
  };

  // ── Upsert Supabase ──────────────────────────────────────────
  // Yêu cầu UNIQUE constraint: (student_id, lesson_id)
  const { ok, data, status } = await supaFetch(
    env,
    '/quiz_results?on_conflict=student_id,lesson_id',
    'POST',
    payload,
  );

  if (!ok) {
    console.error('[score] Supabase upsert error:', status, JSON.stringify(data));
    return json({
      ok:     false,
      error:  'Lưu kết quả thất bại',
      detail: typeof data === 'object' ? data?.message ?? data : data,
    }, 502);
  }

  const savedRow = Array.isArray(data) ? data[0] : data;

  return json({
    ok:          true,
    id:          savedRow?.id ?? null,
    diem10,
    pct,
    score:       scoreInt,
    total:       totalInt,
    rank,
    submittedAt,
    message:     `${rank.emoji} ${diem10}/10 — ${rank.label}`,
  });
}

// ════════════════════════════════════════════════════════════════
//  GET /api/score  —  Admin / học sinh lấy kết quả
// ════════════════════════════════════════════════════════════════
async function handleGet(request, env) {
  const url       = new URL(request.url);
  const lessonId  = url.searchParams.get('lessonId')  || '';
  const studentId = url.searchParams.get('studentId') || '';
  const summary   = url.searchParams.get('summary') === '1';
  const limit     = Math.min(Number(url.searchParams.get('limit')  || 100), 500);
  const offset    = Math.max(Number(url.searchParams.get('offset') || 0),   0);

  if (!lessonId && !studentId) {
    return json({ ok: false, error: 'Cần lessonId hoặc studentId' }, 400);
  }

  let path = '/quiz_results?select=*';
  if (lessonId)  path += `&lesson_id=eq.${encodeURIComponent(lessonId)}`;
  if (studentId) path += `&student_id=eq.${encodeURIComponent(studentId)}`;
  path += `&order=submitted_at.desc&limit=${limit}&offset=${offset}`;

  const { ok, data, status } = await supaFetch(env, path);

  if (!ok) {
    console.error('[score] Supabase GET error:', status, data);
    return json({ ok: false, error: 'Truy vấn thất bại', detail: data }, status);
  }

  const rows = Array.isArray(data) ? data : [];

  // Đảm bảo mỗi row luôn có diem10 + rank (kể cả data cũ)
  const normalizedRows = rows.map(r => {
    const d10  = r.diem10 ?? calcDiem10(r.score, r.total);
    return { ...r, diem10: d10, rank: xepLoai(d10) };
  });

  // ── Summary mode ─────────────────────────────────────────────
  if (summary && normalizedRows.length > 0) {
    const diem10s = normalizedRows.map(r => r.diem10);
    const avg     = Math.round((diem10s.reduce((a, b) => a + b, 0) / diem10s.length) * 10) / 10;

    const dist = { '9-10': 0, '7-8.9': 0, '5-6.9': 0, '<5': 0 };
    diem10s.forEach(d => {
      if      (d >= 9) dist['9-10']++;
      else if (d >= 7) dist['7-8.9']++;
      else if (d >= 5) dist['5-6.9']++;
      else             dist['<5']++;
    });

    const top5 = [...normalizedRows]
      .sort((a, b) => b.diem10 - a.diem10)
      .slice(0, 5)
      .map(({ student_name, diem10, score, total, submitted_at }) =>
        ({ student_name, diem10, score, total, submitted_at }));

    return json({
      ok: true,
      lessonId,
      count:    normalizedRows.length,
      avgDiem10: avg,
      maxDiem10: Math.max(...diem10s),
      minDiem10: Math.min(...diem10s),
      dist,
      top5,
      rows: normalizedRows,
    });
  }

  return json({ ok: true, count: normalizedRows.length, rows: normalizedRows });
}

// ════════════════════════════════════════════════════════════════
//  Entry point
// ════════════════════════════════════════════════════════════════
export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (!env.SUPA_URL || !env.SUPA_KEY) {
    console.error('[score] Thiếu env SUPA_URL / SUPA_KEY');
    return json({ ok: false, error: 'Cấu hình server chưa đầy đủ' }, 500);
  }

  try {
    if (method === 'POST') return await handlePost(request, env);
    if (method === 'GET')  return await handleGet(request, env);
    return json({ ok: false, error: `Method ${method} không hỗ trợ` }, 405);
  } catch (err) {
    console.error('[score] Unhandled exception:', err?.message ?? err);
    return json({ ok: false, error: 'Lỗi server nội bộ' }, 500);
  }
}
