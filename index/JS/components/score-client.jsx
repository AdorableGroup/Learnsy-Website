import React from 'react';

/**
 * ══════════════════════════════════════════════════════════════════
 *  SCORE-CLIENT.JSX  ·  Learnsy Score Client
 *  Exports (window globals):
 *    window.ScoreService.submitScore      — Học sinh nộp bài
 *    window.ScoreService.fetchScores      — Admin lấy danh sách kết quả
 *    window.ScoreService.watchScores      — Admin lắng nghe realtime
 *    window.ScoreService.flushPendingScores — Flush kết quả pending
 *    window.saveQuizResult                — Tương thích ngược với bản cũ
 *
 *  Phụ thuộc:
 *    - window.supa (Supabase client) — cho watchScores
 *    - sessionStorage/localStorage
 *    - /api/score endpoint
 * ══════════════════════════════════════════════════════════════════
 */
(function () {
  'use strict';
  try {
    const SCORE_API = '/api/score';

    /* ════════════════════════════════════════════════════════════════
       INDEX — Học sinh nộp bài
       Thay thế window.saveQuizResult cũ
       ════════════════════════════════════════════════════════════════ */

    /**
     * submitScore(opts) → { ok, diem10, pct, rank, id, message }
     *
     * Gọi sau khi học sinh hoàn thành quiz.
     * score-service sẽ tính điểm thang 10 và lưu Supabase.
     *
     * @param {object} opts
     *   - lessonId     {string}   ID bài học
     *   - lessonTitle  {string}   Tên bài học
     *   - score        {number}   Số câu đúng
     *   - total        {number}   Tổng số câu
     *   - perQ         {Array}    Chi tiết từng câu (optional)
     *   - questionCount{number}   Tổng câu (fallback = total)
     */
    async function submitScore(opts) {
      const {
        lessonId,
        lessonTitle,
        score,
        total,
        perQ = [],
        questionCount,      } = opts || {};

      /* Lấy thông tin học sinh từ storage */
      let _ss = null;
      try { _ss = JSON.parse(sessionStorage.getItem('ls_student') || 'null'); } catch { }

      const studentName = (
        _ss?.displayName || _ss?.username ||
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

      try {
        const res = await fetch(SCORE_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lessonId,
            lessonTitle,
            studentName,
            studentId,
            score,
            total,
            perQ,
            questionCount: questionCount || total,
          }),
        });

        const data = await res.json();

        if (!data.ok) {
          console.warn('[submitScore] Server error:', data.error);
          _fallbackSave({ lessonId, lessonTitle, studentName, studentId, score, total, perQ });
          return { ok: false, error: data.error };
        }

        console.log('[submitScore] ✅', data.message);
        return data; // { ok, diem10, pct, score, total, rank, id, message }

      } catch (err) {
        console.warn('[submitScore] Network error:', err);
        _fallbackSave({ lessonId, lessonTitle, studentName, studentId, score, total, perQ });
        return { ok: false, error: String(err) };
      }
    }

    /* Fallback offline — flush tự động khi có mạng lại */    function _fallbackSave(payload) {
      try {
        const KEY = 'learnsy_pending_scores';
        const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
        arr.push({ ...payload, saved_at: new Date().toISOString() });
        if (arr.length > 30) arr.splice(0, arr.length - 30);
        localStorage.setItem(KEY, JSON.stringify(arr));
      } catch { /* ignore */ }
    }

    async function flushPendingScores() {
      try {
        const KEY = 'learnsy_pending_scores';
        const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
        if (!arr.length) return;

        const results = await Promise.allSettled(
          arr.map(p => fetch(SCORE_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(p),
          }))
        );

        const allOk = results.every(r => r.status === 'fulfilled' && r.value.ok);
        if (allOk) {
          localStorage.removeItem(KEY);
          console.log('[submitScore] Flushed', arr.length, 'pending scores');
        }
      } catch { /* ignore */ }
    }

    window.addEventListener('load', () => setTimeout(flushPendingScores, 4000));
    window.addEventListener('online', flushPendingScores);

    /* ════════════════════════════════════════════════════════════════
       ADMIN — Lấy kết quả & realtime
       ════════════════════════════════════════════════════════════════ */

    /**
     * fetchScores(opts) → { ok, count, rows, [summary fields...] }
     *
     * Dùng ở admin panel để lấy danh sách kết quả.
     *
     * @param {object} opts
     *   - lessonId   {string}   Lọc theo bài học
     *   - studentId  {string}   Lọc theo học sinh
     *   - summary    {boolean}  true → trả thêm thống kê tổng hợp
     *   - limit      {number}   Số lượng tối đa (mặc định 100)
     *   - offset     {number}   Phân trang     */
    async function fetchScores(opts = {}) {
      const {
        lessonId,
        studentId,
        summary = false,
        limit = 100,
        offset = 0
      } = opts;

      const params = new URLSearchParams();
      if (lessonId) params.set('lessonId', lessonId);
      if (studentId) params.set('studentId', studentId);
      if (summary) params.set('summary', '1');
      params.set('limit', limit);
      params.set('offset', offset);

      try {
        const res = await fetch(`${SCORE_API}?${params}`);
        const data = await res.json();
        return data;
      } catch (err) {
        console.warn('[fetchScores] Error:', err);
        return { ok: false, error: String(err), rows: [] };
      }
    }

    /**
     * watchScores(lessonId, callback) → unsubscribe()
     *
     * Lắng nghe kết quả mới realtime qua Supabase Realtime.
     * Dùng ở admin để cập nhật bảng điểm live khi học sinh nộp bài.
     *
     * @param {string}   lessonId  — Bài học cần theo dõi
     * @param {function} callback  — fn({ row, diem10, rank }) khi có kết quả mới
     * @returns {function} unsubscribe — gọi để dừng lắng nghe
     *
     * Yêu cầu: window.supa đã được khởi tạo (từ index.html)
     */
    function watchScores(lessonId, callback) {
      if (!window.supa) {
        console.warn('[watchScores] window.supa chưa sẵn sàng');
        return () => { };
      }
      if (!lessonId) {
        console.warn('[watchScores] Cần lessonId');
        return () => { };
      }

      const channel = window.supa        .channel(`scores:${lessonId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'quiz_results',
            filter: `lesson_id=eq.${lessonId}`,
          },
          (payload) => {
            const row = payload.new;
            /* Đảm bảo luôn có diem10 (data cũ có thể không có) */
            const diem10 = row.diem10 ?? (row.total > 0 ? Math.round(row.score / row.total * 100) / 10 : 0);
            const rank = _xepLoai(diem10);
            callback({ row: { ...row, diem10, rank }, diem10, rank });
          }
        )
        .subscribe((status) => {
          console.log(`[watchScores] ${lessonId} →`, status);
        });

      /* Trả về hàm unsubscribe */
      return () => window.supa.removeChannel(channel);
    }

    /* Xếp loại dùng nội bộ (mirror server-side) */
    function _xepLoai(diem10) {
      if (diem10 >= 9) return { label: 'Xuất sắc', emoji: '🏆', color: '#10b981' };
      if (diem10 >= 8) return { label: 'Giỏi', emoji: '🥇', color: '#f59e0b' };
      if (diem10 >= 6.5) return { label: 'Khá', emoji: '🥈', color: '#a855f7' };
      if (diem10 >= 5) return { label: 'Trung bình', emoji: '👍', color: '#f472b6' };
      return { label: 'Cần cố gắng', emoji: '📚', color: '#ef4444' };
    }

    /* ── Expose ── */
    window.ScoreService = {
      submitScore,
      fetchScores,
      watchScores,
      flushPendingScores
    };

    /* Tương thích ngược với saveQuizResult cũ */
    window.saveQuizResult = async function (opts) {
      const {
        lessonId,
        lessonTitle,
        score,
        total,
        questions = [],        answers = [],
        perQ
      } = opts || {};

      return submitScore({
        lessonId,
        lessonTitle,
        score,
        total: total || questions.length || 1,
        perQ,
      });
    };

    console.log('[score-client] ✅ loaded');
  } catch (e) {
    console.error('[score-client] INIT ERROR:', e);
  }
})();
