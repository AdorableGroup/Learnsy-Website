import React from 'react';

// ══════════════════════════════════════════════════════════════════
//  SAVE-RESULT.JSX  ·  Learnsy · Lưu & load kết quả quiz qua Supabase
//  Exports (window globals):
//    window.saveQuizResult       — Lưu kết quả quiz (upsert)
//    window.flushPendingResults  — Flush kết quả pending từ localStorage
//    window.loadQuizHistory      — Load lịch sử quiz theo studentId
//
//  Phụ thuộc:
//    - window.supa (Supabase client)
//    - sessionStorage/localStorage (ls_student, learnsy_student_name, ...)
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  try {
    // Guard chống double-save trong cùng 1 session
    const _inFlight = new Set();

    /**
     * saveQuizResult(opts)
     * Gọi sau khi học sinh nộp bài.
     * Dùng upsert — nếu cùng student_id + lesson_id thì ghi đè, không tạo bản mới.
     */
    async function saveQuizResult(opts) {
      const {
        lessonId,
        lessonTitle,
        score,
        total: totalOpt,
        questions = [],
        answers = [],
        perQ = null
      } = opts || {};

      // ── 1. Lấy thông tin học sinh từ ls_student (app.js) ──────────
      const _ss = (() => {
        try {
          return JSON.parse(sessionStorage.getItem('ls_student') || 'null');
        } catch {
          return null;
        }
      })();

      const studentName = (
        _ss?.display_name || _ss?.username ||
        sessionStorage.getItem('learnsy_student_name') ||
        localStorage.getItem('learnsy_student_name') ||
        'Ẩn danh'
      ).trim();
      const studentId = (
        _ss?.id ||
        sessionStorage.getItem('learnsy_student_id') ||
        localStorage.getItem('learnsy_student_id') ||
        null
      );

      // ── Guard: tránh gọi 2 lần cùng lúc cho cùng 1 bài ───────────
      const flightKey = `${studentId || 'anon'}_${lessonId}`;
      if (_inFlight.has(flightKey)) {
        console.warn('[saveQuizResult] Bỏ qua, đang lưu:', flightKey);
        return { ok: false, error: 'duplicate' };
      }
      _inFlight.add(flightKey);

      // ── 2. Build per-question array nếu chưa có ───────────────────
      let perQArr = perQ;
      if (!perQArr && questions.length) {
        perQArr = questions.map((q, i) => {
          const ans = answers[i];
          let ok = false, partial = false, correctAns = '', qText = '';
          qText = (q.question || q.passage || q.content || '').replace(/<[^>]*>/g, '').slice(0, 120);

          if (q.type === 'true_false') {
            const items = q.items || [];
            const userArr = Array.isArray(ans) ? ans : [];
            const correctCount = items.filter((it, ii) => userArr[ii] === it.answer).length;
            ok = correctCount === items.length;
            partial = !ok && correctCount > 0;
            correctAns = items.map((it, ii) => `${String.fromCharCode(97 + ii)}: ${it.answer ? 'Đ' : 'S'}`).join(', ');
          } else if (q.type === 'multiple') {
            ok = ans === q.correct;
            correctAns = q.options?.[q.correct] || String(q.correct);
          } else if (q.type === 'multi_select') {
            const cArr = [...(q.correct || [])].sort();
            const uArr = [...(Array.isArray(ans) ? ans : [])].sort();
            ok = JSON.stringify(cArr) === JSON.stringify(uArr);
            partial = !ok && uArr.some(x => cArr.includes(x));
            correctAns = (q.correct || []).map(i => q.options?.[i] || i).join(', ');
          } else if (q.type === 'fill_blank') {
            const norm = s => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
            ok = norm(ans) === norm(q.answer);
            correctAns = q.answer || '';
          }
          return { ok, partial, type: q.type, qText, correctAns };
        });
      }

      // ── 3. Upsert vào Supabase (ghi đè nếu đã tồn tại) ───────────      // Yêu cầu: bảng quiz_results phải có UNIQUE constraint trên (student_id, lesson_id)
      // SQL: ALTER TABLE quiz_results ADD CONSTRAINT uq_student_lesson UNIQUE (student_id, lesson_id);
      try {
        const payload = {
          student_name: studentName,
          student_id: studentId,
          lesson_id: String(lessonId || lessonTitle || 'unknown'), // tránh key rỗng
          lesson_title: String(lessonTitle || 'Không rõ'),
          score: Math.round((Number(score) || 0) * 100) / 100,  // giữ tối đa 2 chữ số thập phân
          total: Math.round(Number(totalOpt || questions.length) || 1),
          per_q: perQArr || [],
        };

        const { data, error } = await window.supa
          .from('quiz_results')
          .upsert(payload, {
            onConflict: 'student_id,lesson_id', // ghi đè khi trùng
            ignoreDuplicates: false,
          })
          .select('id')
          .single();

        if (error) {
          console.warn('[saveQuizResult] Supabase error:', error.message);
          _fallbackSave(payload);
          return { ok: false, error: error.message };
        }

        console.log('[saveQuizResult] ✅ Upserted id:', data?.id);
        return { ok: true, id: data?.id };

      } catch (e) {
        console.warn('[saveQuizResult] Exception:', e);
        return { ok: false, error: String(e) };
      } finally {
        // Xoá flag sau 3s — cho phép làm lại bài sau
        setTimeout(() => _inFlight.delete(flightKey), 3000);
      }
    }

    // ── Fallback localStorage khi Supabase lỗi ────────────────────────
    function _fallbackSave(payload) {
      try {
        const key = 'learnsy_pending_results';
        const arr = JSON.parse(localStorage.getItem(key) || '[]');
        // Dedup: thay thế nếu đã có cùng student + lesson
        const idx = arr.findIndex(r => r.student_id === payload.student_id && r.lesson_id === payload.lesson_id);
        if (idx >= 0) arr[idx] = { ...payload, saved_at: new Date().toISOString() };
        else arr.push({ ...payload, saved_at: new Date().toISOString() });
        if (arr.length > 20) arr.splice(0, arr.length - 20);        localStorage.setItem(key, JSON.stringify(arr));
      } catch { }
    }

    // ── Flush pending results ─────────────────────────────────────────
    async function flushPendingResults() {
      try {
        const key = 'learnsy_pending_results';
        const arr = JSON.parse(localStorage.getItem(key) || '[]');
        if (!arr.length) return;
        const { error } = await window.supa
          .from('quiz_results')
          .upsert(arr, { onConflict: 'student_id,lesson_id', ignoreDuplicates: false });
        if (!error) {
          localStorage.removeItem(key);
          console.log('[saveQuizResult] Flushed', arr.length, 'pending results');
        }
      } catch { }
    }

    // ── Load history từ Supabase theo studentId ───────────────────────
    async function loadQuizHistory(studentId) {
      if (!studentId) return [];
      try {
        const { data, error } = await window.supa
          .from('quiz_results')
          .select('id, lesson_title, score, total, per_q, created_at')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error || !data) return [];

        return data.map(r => ({
          id: r.id,
          ts: r.created_at,
          lessonTitle: r.lesson_title,
          score: r.score,
          total: r.total,
          pct: r.total > 0 ? Math.round(r.score / r.total * 100) : 0,  // 0–100 (integer)
          qCount: r.total,
          perQ: r.per_q || [],
        }));
      } catch (e) {
        console.warn('[loadQuizHistory] Error:', e);
        return [];
      }
    }

    window.addEventListener('load', () => {      setTimeout(flushPendingResults, 3000);
    });

    // ══ EXPORT GLOBALS ══
    window.saveQuizResult = saveQuizResult;
    window.flushPendingResults = flushPendingResults;
    window.loadQuizHistory = loadQuizHistory;

    console.log('[save-result] ✓ loaded');
  } catch (e) {
    console.error('[save-result] INIT ERROR:', e);
  }
})();