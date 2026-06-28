// ══════════════════════════════════════════════════════════════════
//  SAVE-RESULT.JSX  ·  Learnsy · Lưu & load kết quả quiz
//  Exports: window.saveQuizResult, window.flushPendingResults,
//           window.loadQuizHistory
//
//  v6 — Gọi /api/score (Cloudflare Function), không dùng Supabase client
// ══════════════════════════════════════════════════════════════════

;(function () {
  'use strict';

  const _inFlight = new Set();

  // ── Lấy thông tin học sinh ────────────────────────────────────
  function _getStudent() {
    try {
      const ss = JSON.parse(sessionStorage.getItem('ls_student') || 'null');
      const name = (
        ss?.display_name || ss?.username ||
        sessionStorage.getItem('learnsy_student_name') ||
        localStorage.getItem('learnsy_student_name') ||
        'Ẩn danh'
      ).trim();
      const id = ss?.id ||
        sessionStorage.getItem('learnsy_student_id') ||
        localStorage.getItem('learnsy_student_id') ||
        null;
      return { name, id };
    } catch {
      return { name: 'Ẩn danh', id: null };
    }
  }

  // ── Build per-question array ──────────────────────────────────
  function _buildPerQ(questions, answers) {
    return questions.map((q, i) => {
      const ans = answers[i];
      let ok = false, partial = false, correctAns = '';
      const qText = (q.question || q.passage || q.content || '')
        .replace(/<[^>]*>/g, '').slice(0, 120);

      if (q.type === 'true_false') {
        const items = q.items || [];
        const userArr = Array.isArray(ans) ? ans : [];
        const correctCount = items.filter((it, ii) => userArr[ii] === it.answer).length;
        ok = correctCount === items.length;
        partial = !ok && correctCount > 0;
        correctAns = items.map((it, ii) =>
          `${String.fromCharCode(97 + ii)}: ${it.answer ? 'Đ' : 'S'}`).join(', ');
      } else if (q.type === 'multiple') {
        ok = ans === q.correct;
        correctAns = q.options?.[q.correct] ?? String(q.correct);
      } else if (q.type === 'multi_select') {
        const cArr = [...(q.correct || [])].sort();
        const uArr = [...(Array.isArray(ans) ? ans : [])].sort();
        ok = JSON.stringify(cArr) === JSON.stringify(uArr);
        partial = !ok && uArr.some(x => cArr.includes(x));
        correctAns = (q.correct || []).map(i => q.options?.[i] ?? i).join(', ');
      } else if (q.type === 'fill_blank') {
        const norm = s => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
        ok = norm(ans) === norm(q.answer);
        correctAns = q.answer || '';
      }

      return { ok, partial, type: q.type, qText, correctAns };
    });
  }

  // ── Fallback localStorage ─────────────────────────────────────
  function _fallbackSave(payload) {
    try {
      const key = 'learnsy_pending_results';
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      const idx = arr.findIndex(r =>
        r.studentId === payload.studentId &&
        r.lessonId  === payload.lessonId);
      const entry = { ...payload, saved_at: new Date().toISOString() };
      if (idx >= 0) arr[idx] = entry; else arr.push(entry);
      if (arr.length > 20) arr.splice(0, arr.length - 20);
      localStorage.setItem(key, JSON.stringify(arr));
      console.log('[save-result] Đã lưu fallback localStorage');
    } catch { }
  }

  // ════════════════════════════════════════════════════════════
  //  saveQuizResult(opts)
  // ════════════════════════════════════════════════════════════
  async function saveQuizResult(opts) {
    const {
      lessonId,
      lessonTitle,
      score,
      total: totalOpt,
      questions = [],
      answers   = [],
      perQ      = null,
    } = opts || {};

    const { name: studentName, id: studentId } = _getStudent();

    const flightKey = `${studentId || 'anon'}_${lessonId || lessonTitle}`;
    if (_inFlight.has(flightKey)) {
      console.warn('[saveQuizResult] Bỏ qua duplicate:', flightKey);
      return { ok: false, error: 'duplicate' };
    }
    _inFlight.add(flightKey);

    try {
      const perQArr  = perQ ?? (questions.length ? _buildPerQ(questions, answers) : []);
      const scoreNum = Math.round((Number(score) || 0) * 100) / 100;
      const totalNum = Math.round(Number(totalOpt || questions.length) || 1);

      const payload = {
        lessonId:      lessonId ? String(lessonId) : null,
        lessonTitle:   String(lessonTitle || 'Không rõ'),
        studentName,
        studentId,
        score:         scoreNum,
        total:         totalNum,
        questionCount: totalNum,
        perQ:          perQArr,
      };

      const res = await fetch('/api/score', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        console.warn('[saveQuizResult] API error:', res.status, data.error, data.detail ?? '');
        _fallbackSave(payload);
        return { ok: false, error: data.error || `HTTP ${res.status}` };
      }

      console.log(
        '[saveQuizResult] ✅ id:', data.id,
        '| diem10:', data.diem10,
        '| xep_loai:', data.rank?.label,
      );
      return {
        ok:     true,
        id:     data.id,
        diem10: data.diem10,
        pct:    data.pct,
        rank:   data.rank,
        message: data.message,
      };

    } catch (e) {
      console.warn('[saveQuizResult] Exception:', e?.message ?? e);
      return { ok: false, error: String(e?.message ?? e) };
    } finally {
      setTimeout(() => _inFlight.delete(flightKey), 3000);
    }
  }

  // ════════════════════════════════════════════════════════════
  //  flushPendingResults()
  // ════════════════════════════════════════════════════════════
  async function flushPendingResults() {
    try {
      const key = 'learnsy_pending_results';
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      if (!arr.length) return;

      let flushed = 0;
      for (const payload of arr) {
        try {
          const res  = await fetch('/api/score', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.ok) flushed++;
        } catch { }
      }

      if (flushed > 0) {
        localStorage.removeItem(key);
        console.log('[flushPendingResults] ✅ Flushed', flushed, '/', arr.length, 'pending');
      }
    } catch (e) {
      console.warn('[flushPendingResults] Exception:', e?.message ?? e);
    }
  }

  // ════════════════════════════════════════════════════════════
  //  loadQuizHistory(studentId)
  // ════════════════════════════════════════════════════════════
  async function loadQuizHistory(studentId) {
    if (!studentId) return [];
    try {
      const res  = await fetch(`/api/score?studentId=${encodeURIComponent(studentId)}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        console.warn('[loadQuizHistory] API error:', res.status, data.error);
        return [];
      }

      return (data.rows || []).map(r => ({
        id:          r.id,
        ts:          r.submitted_at || r.created_at,
        lessonTitle: r.lesson_title,
        score:       r.score,
        total:       r.total,
        pct:         r.total > 0 ? Math.round(r.score / r.total * 100) : 0,
        diem10:      r.diem10,
        xepLoai:     r.xep_loai,
        qCount:      r.total,
        perQ:        r.per_q || [],
        rank:        r.rank,
      }));

    } catch (e) {
      console.warn('[loadQuizHistory] Exception:', e?.message ?? e);
      return [];
    }
  }

  // ── Flush pending khi load xong trang ────────────────────────
  window.addEventListener('load', () => setTimeout(flushPendingResults, 3000));

  // ── Export globals ────────────────────────────────────────────
  window.saveQuizResult      = saveQuizResult;
  window.flushPendingResults = flushPendingResults;
  window.loadQuizHistory     = loadQuizHistory;

  console.log('[save-result] ✅ v6 loaded (via /api/score)');
})();
