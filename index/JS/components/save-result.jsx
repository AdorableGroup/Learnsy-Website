import React from 'react';

// ══════════════════════════════════════════════════════════════════
//  SAVE-RESULT.JSX  ·  Learnsy · Lưu & load kết quả quiz
//  Exports: window.saveQuizResult, window.flushPendingResults,
//           window.loadQuizHistory
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  try {

    // ── Guard chống double-save ───────────────────────────────────
    const _inFlight = new Set();

    // ── Lấy thông tin học sinh từ session/localStorage ────────────
    function _getStudent() {
      try {
        const ss = JSON.parse(sessionStorage.getItem('ls_student') || 'null');
        const name = (
          ss?.display_name || ss?.username ||
          sessionStorage.getItem('learnsy_student_name') ||
          localStorage.getItem('learnsy_student_name') ||
          'Ẩn danh'
        ).trim();
        const id = (
          ss?.id ||
          sessionStorage.getItem('learnsy_student_id') ||
          localStorage.getItem('learnsy_student_id') ||
          null
        );
        return { name, id };
      } catch {
        return { name: 'Ẩn danh', id: null };
      }
    }

    // ── Kiểm tra window.supa sẵn sàng ────────────────────────────
    function _supaReady() {
      if (!window.supa) {
        console.warn('[save-result] window.supa chưa init');
        return false;
      }
      return true;
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

    // ── Fallback localStorage khi Supabase lỗi ────────────────────
    function _fallbackSave(payload) {
      try {
        const key = 'learnsy_pending_results';
        const arr = JSON.parse(localStorage.getItem(key) || '[]');
        const idx = arr.findIndex(r =>
          r.student_id === payload.student_id && r.lesson_id === payload.lesson_id);
        const entry = { ...payload, saved_at: new Date().toISOString() };
        if (idx >= 0) arr[idx] = entry;
        else arr.push(entry);
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

      // Guard double-save
      const flightKey = `${studentId || 'anon'}_${lessonId}`;
      if (_inFlight.has(flightKey)) {
        console.warn('[saveQuizResult] Bỏ qua, đang lưu:', flightKey);
        return { ok: false, error: 'duplicate' };
      }
      _inFlight.add(flightKey);

      try {
        const perQArr = perQ ?? (questions.length ? _buildPerQ(questions, answers) : []);

        const payload = {
          student_name: studentName,
          student_id:   studentId,
          lesson_id:    String(lessonId || lessonTitle || 'unknown'),
          lesson_title: String(lessonTitle || 'Không rõ'),
          score:        Math.round((Number(score) || 0) * 100) / 100,
          total:        Math.round(Number(totalOpt || questions.length) || 1),
          per_q:        perQArr,
        };

        if (!_supaReady()) {
          _fallbackSave(payload);
          return { ok: false, error: 'supa_not_ready' };
        }

        const { data, error } = await window.supa
          .from('quiz_results')
          .upsert(payload, { onConflict: 'student_id,lesson_id', ignoreDuplicates: false })
          .select('id')
          .single();

        if (error) {
          console.warn('[saveQuizResult] Supabase error:', error.code, error.message, error.details);
          _fallbackSave(payload);
          return { ok: false, error: error.message };
        }

        console.log('[saveQuizResult] ✅ Upserted id:', data?.id);
        return { ok: true, id: data?.id };

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
      if (!_supaReady()) return;
      try {
        const key = 'learnsy_pending_results';
        const arr = JSON.parse(localStorage.getItem(key) || '[]');
        if (!arr.length) return;

        const { error } = await window.supa
          .from('quiz_results')
          .upsert(arr, { onConflict: 'student_id,lesson_id', ignoreDuplicates: false });

        if (error) {
          console.warn('[flushPendingResults] Lỗi flush:', error.code, error.message);
          return;
        }

        localStorage.removeItem(key);
        console.log('[flushPendingResults] ✅ Flushed', arr.length, 'kết quả pending');
      } catch (e) {
        console.warn('[flushPendingResults] Exception:', e?.message ?? e);
      }
    }

    // ════════════════════════════════════════════════════════════
    //  loadQuizHistory(studentId)
    // ════════════════════════════════════════════════════════════
    async function loadQuizHistory(studentId) {
      if (!studentId) return [];
      if (!_supaReady()) return [];

      try {
        const { data, error } = await window.supa
          .from('quiz_results')
          .select('id, lesson_title, score, total, per_q, created_at, submitted_at')
          .eq('student_id', String(studentId))
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          console.warn('[loadQuizHistory] Supabase error:',
            error.code, error.message, error.details, error.hint ?? '');
          return [];
        }

        if (!data || !data.length) return [];

        return data.map(r => ({
          id:          r.id,
          ts:          r.submitted_at || r.created_at,
          lessonTitle: r.lesson_title,
          score:       r.score,
          total:       r.total,
          pct:         r.total > 0 ? Math.round(r.score / r.total * 100) : 0,
          qCount:      r.total,
          perQ:        r.per_q || [],
        }));

      } catch (e) {
        console.warn('[loadQuizHistory] Exception:', e?.message ?? e, e?.stack ?? '');
        return [];
      }
    }

    // ── Flush pending khi load xong trang ────────────────────────
    window.addEventListener('load', () => setTimeout(flushPendingResults, 3000));

    // ── Export globals ────────────────────────────────────────────
    window.saveQuizResult      = saveQuizResult;
    window.flushPendingResults = flushPendingResults;
    window.loadQuizHistory     = loadQuizHistory;

    console.log('[save-result] ✓ loaded');
  } catch (e) {
    console.error('[save-result] INIT ERROR:', e);
  }
})();
