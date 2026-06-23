/**
 * ══════════════════════════════════════════════════════════════════
 *  /functions/api/score.js  —  Learnsy Score Service
 *  Cloudflare Pages Function
 *
 *  Vai trò trung gian xử lý điểm số giữa index (học sinh) và admin:
 *
 *  POST /api/score          ← index gọi khi học sinh nộp bài
 *    Body: { lessonId, lessonTitle, studentName, studentId,
 *            score, total, perQ[], questionCount }
 *    → Tính điểm thang 10, lưu Supabase, trả kết quả về index
 *
 *  GET  /api/score?lessonId=xxx          ← admin lấy KQ theo bài
 *  GET  /api/score?studentId=xxx         ← lấy KQ theo học sinh
 *  GET  /api/score?lessonId=xxx&summary=1 ← thống kê tổng hợp
 *
 *  Biến môi trường cần khai báo trong Cloudflare Pages:
 *    SUPA_URL   — Supabase project URL
 *    SUPA_KEY   — Supabase service_role key (KHÔNG dùng anon key)
 * ══════════════════════════════════════════════════════════════════
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/* ── Helpers ── */

/** Tính điểm thang 10, làm tròn 1 chữ số thập phân */
function calcDiem10(score, total) {
  if (!total || total <= 0) return 0;
  const raw = (score / total) * 10;
  return Math.round(raw * 10) / 10;   // làm tròn 0.1
}

/** Xếp loại theo thang 10 */
function xepLoai(diem10) {
  if (diem10 >= 9)   return { label: 'Xuất sắc',   emoji: '🏆', color: '#10b981' };
  if (diem10 >= 8)   return { label: 'Giỏi',       emoji: '🥇', color: '#f59e0b' };
  if (diem10 >= 6.5) return { label: 'Khá',        emoji: '🥈', color: '#a855f7' };
  if (diem10 >= 5)   return { label: 'Trung bình', emoji: '👍', color: '#f472b6' };
  return               { label: 'Cần cố gắng', emoji: '📚', color: '#ef4444' };
}

/** Gọi Supabase REST API */
async function supaFetch(env, path, method = 'GET', body = null) {
  const url = `${env.SUPA_URL}/rest/v1${path}`;
  const headers = {
    'apikey':        env.SUPA_KEY,
    'Authorization': `Bearer ${env.SUPA_KEY}`,
    'Content-Type':  'application/json',
    'Prefer':        method === 'POST' ? 'return=representation' : 'return=minimal',
  };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/* ════════════════════════════════════════════════════════════════
   POST /api/score  —  Học sinh nộp bài
   ════════════════════════════════════════════════════════════════ */
async function handlePost(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }

  const {
    lessonId, lessonTitle,
    studentName = 'Ẩn danh', studentId = null,
    score, total, perQ = [], questionCount,
  } = body;

  /* ── Validate ── */
  if (!lessonId)            return json({ ok: false, error: 'Thiếu lessonId' }, 400);
  if (score == null)        return json({ ok: false, error: 'Thiếu score' }, 400);
  if (!total || total <= 0) return json({ ok: false, error: 'Thiếu total' }, 400);

  const scoreInt = Math.round(Number(score));
  const totalInt = Math.round(Number(total));

  /* ── Tính điểm ── */
  const diem10   = calcDiem10(scoreInt, totalInt);
  const pct      = Math.round((scoreInt / totalInt) * 100);
  const rank     = xepLoai(diem10);
  const submittedAt = new Date().toISOString();

  /* ── Lưu vào Supabase ── */
  const payload = {
    student_name:   String(studentName).trim().slice(0, 100),
    student_id:     studentId || null,
    lesson_id:      String(lessonId),
    lesson_title:   String(lessonTitle || 'Không rõ').slice(0, 200),
    score:          scoreInt,          // số câu đúng
    total:          totalInt,          // tổng số câu
    diem10,                            // điểm thang 10
    pct,                               // % để tương thích dashboard cũ
    xep_loai:       rank.label,
    per_q:          perQ,
    question_count: questionCount || totalInt,
    submitted_at:   submittedAt,
  };

  const { ok, data, status } = await supaFetch(
    env,
    '/quiz_results',
    'POST',
    payload,
  );

  if (!ok) {
    console.error('[score] Supabase error:', status, data);
    return json({ ok: false, error: 'Lưu kết quả thất bại', detail: data }, 500);
  }

  const savedId = Array.isArray(data) ? data[0]?.id : data?.id;

  /* ── Trả về cho index ── */
  return json({
    ok:      true,
    id:      savedId,
    diem10,
    pct,
    score:   scoreInt,
    total:   totalInt,
    rank,                              // { label, emoji, color }
    submittedAt,
    message: `${rank.emoji} ${diem10}/10 — ${rank.label}`,
  });
}

/* ════════════════════════════════════════════════════════════════
   GET /api/score  —  Admin lấy kết quả
   ════════════════════════════════════════════════════════════════ */
async function handleGet(request, env) {
  const url      = new URL(request.url);
  const lessonId = url.searchParams.get('lessonId');
  const studentId= url.searchParams.get('studentId');
  const summary  = url.searchParams.get('summary') === '1';
  const limit    = Math.min(Number(url.searchParams.get('limit') || 100), 500);
  const offset   = Number(url.searchParams.get('offset') || 0);

  if (!lessonId && !studentId) {
    return json({ ok: false, error: 'Cần lessonId hoặc studentId' }, 400);
  }

  /* ── Build query ── */
  let path = '/quiz_results?select=*';
  if (lessonId)  path += `&lesson_id=eq.${encodeURIComponent(lessonId)}`;
  if (studentId) path += `&student_id=eq.${encodeURIComponent(studentId)}`;
  path += `&order=submitted_at.desc&limit=${limit}&offset=${offset}`;

  const { ok, data, status } = await supaFetch(env, path);

  if (!ok) {
    return json({ ok: false, error: 'Truy vấn thất bại', detail: data }, status);
  }

  const rows = Array.isArray(data) ? data : [];

  /* ── Summary mode: thống kê tổng hợp cho admin ── */
  if (summary && rows.length > 0) {
    const diem10s  = rows.map(r => r.diem10 ?? calcDiem10(r.score, r.total));
    const avgDiem10= Math.round((diem10s.reduce((a, b) => a + b, 0) / diem10s.length) * 10) / 10;
    const maxDiem10= Math.max(...diem10s);
    const minDiem10= Math.min(...diem10s);

    /* Phân phối điểm */
    const dist = { '9-10': 0, '7-8.9': 0, '5-6.9': 0, '<5': 0 };
    diem10s.forEach(d => {
      if (d >= 9)   dist['9-10']++;
      else if (d >= 7) dist['7-8.9']++;
      else if (d >= 5) dist['5-6.9']++;
      else          dist['<5']++;
    });

    /* Top 5 học sinh */
    const top5 = [...rows]
      .sort((a, b) => (b.diem10 ?? 0) - (a.diem10 ?? 0))
      .slice(0, 5)
      .map(r => ({
        studentName: r.student_name,
        diem10:      r.diem10 ?? calcDiem10(r.score, r.total),
        score:       r.score,
        total:       r.total,
        submittedAt: r.submitted_at,
      }));

    return json({
      ok: true,
      lessonId,
      count:   rows.length,
      avgDiem10,
      maxDiem10,
      minDiem10,
      dist,
      top5,
      rows,    // vẫn trả full rows để admin tự render
    });
  }

  /* ── Normal mode: trả danh sách kết quả ── */
  return json({
    ok:    true,
    count: rows.length,
    rows:  rows.map(r => ({
      ...r,
      // Đảm bảo luôn có diem10 kể cả data cũ không có field này
      diem10: r.diem10 ?? calcDiem10(r.score, r.total),
      rank:   xepLoai(r.diem10 ?? calcDiem10(r.score, r.total)),
    })),
  });
}

/* ════════════════════════════════════════════════════════════════
   Entry point
   ════════════════════════════════════════════════════════════════ */
export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  /* Preflight CORS */
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  /* Kiểm tra env */
  if (!env.SUPA_URL || !env.SUPA_KEY) {
    return json({ ok: false, error: 'Thiếu cấu hình SUPA_URL / SUPA_KEY' }, 500);
  }

  try {
    if (method === 'POST') return await handlePost(request, env);
    if (method === 'GET')  return await handleGet(request, env);
    return json({ ok: false, error: `Method ${method} không hỗ trợ` }, 405);
  } catch (err) {
    console.error('[score] Unhandled:', err);
    return json({ ok: false, error: 'Internal server error' }, 500);
  }
}
