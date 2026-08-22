import React from 'react';

/* ══════════════════════════════════════════════════════════════════
   VOCAB-PRACTICE.JSX
   Convert từ vocab-tab.js (vanilla JS, bản index.html cũ) sang React,
   theo đúng convention của listening-practice.jsx:
     - Component tự chứa (IIFE), không phụ thuộc DOM ids cũ
     - Tự fetch dữ liệu qua window.supa (bảng vocab_courses/vocab_units/vocab_words
       — khớp với admin/JS/components/vocabulary-manager.jsx)
     - Progress lưu trực tiếp lên Supabase (bảng vocab_progress) thay vì
       gọi /api/save-vocab-progress (endpoint đó không tồn tại trong bản mới)
     - Nhận props {dark, student, onBack} từ app.jsx, y hệt ListeningPractice

   Luồng màn hình: Danh sách khóa học/unit → Học từ (thẻ lật) →
   Kiểm tra viết từ (tuỳ chọn) → Hoàn thành.

   Props:
     dark     — theme
     student  — {id, fullName, ...} học sinh đang đăng nhập (có thể null)
     onBack   — quay lại Dashboard
══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  try {
    const { useState, useEffect, useMemo, useRef, useCallback } = React;

    const escapeHtml = s => String(s ?? '');

    const POS_LABELS = {
      noun: 'Danh từ (n)', n: 'Danh từ (n)',
      verb: 'Động từ (v)', v: 'Động từ (v)',
      adjective: 'Tính từ (adj)', adj: 'Tính từ (adj)',
      adverb: 'Trạng từ (adv)', adv: 'Trạng từ (adv)',
      preposition: 'Giới từ (prep)', prep: 'Giới từ (prep)',
      conjunction: 'Liên từ (conj)', conj: 'Liên từ (conj)',
      pronoun: 'Đại từ (pron)', pron: 'Đại từ (pron)',
      interjection: 'Thán từ (intj)', intj: 'Thán từ (intj)',
      phrase: 'Cụm từ',
    };
    const getPosLabel = pos => POS_LABELS[pos] || pos || 'Từ vựng';

    // Levenshtein distance (typo tolerance khi kiểm tra viết)
    function levenshtein(a, b) {
      if (!a || !b) return Math.max((a || '').length, (b || '').length);
      const m = a.length, n = b.length;
      const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i ? (j ? 0 : i) : j)));
      for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
          dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      return dp[m][n];
    }

    function speak(word, rate = 1) {
      try {
        if (!word) return;
        const synth = window.speechSynthesis;
        if (!synth) {
          if (window.showToast) window.showToast('Trình duyệt này không hỗ trợ đọc từ vựng, thử dùng Chrome nhé!', 'warn');
          return;
        }
        synth.cancel();
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        utterance.rate = rate;
        utterance.onerror = (ev) => {
          if (ev.error !== 'canceled' && ev.error !== 'interrupted' && window.showToast) {
            window.showToast('Không phát được âm thanh, thử dùng Chrome nhé!', 'warn');
          }
        };
        const voices = synth.getVoices();
        if (voices.length === 0) {
          // Giọng đọc chưa nạp xong (thường gặp trên Opera Android) — thử lại khi có
          synth.onvoiceschanged = () => { synth.speak(utterance); };
        }
        synth.speak(utterance);
      } catch (e) {
        if (window.showToast) window.showToast('Không phát được âm thanh, thử dùng Chrome nhé!', 'warn');
      }
    }

    /* ─────────────────────── ICONS ─────────────────────── */
    const IconBook = ({ size = 16, color }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    );
    const IconTrophy = ({ size = 44, color = '#f59e0b' }) => (
      <svg width={size} height={size} viewBox="0 0 20 20" fill={color} stroke="none"><polygon points="10,2 12.5,7.5 18,8.2 14,12.1 15.1,17.5 10,14.8 4.9,17.5 6,12.1 2,8.2 7.5,7.5" /></svg>
    );
    const IconCheck = ({ size = 16, color = '#10B981' }) => (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 10 8 14 16 6" /></svg>
    );
    const IconSpeaker = ({ size = 18, waves = 2 }) => (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 7.2v5.6h3l4.3 3.6V3.6L5.5 7.2h-3z" fill="currentColor" stroke="none" />
        {waves >= 1 && <path d="M12.3 7c.9.75 1.4 1.83 1.4 3s-.5 2.25-1.4 3" />}
        {waves >= 2 && <path d="M14.7 4.7c1.7 1.4 2.65 3.4 2.65 5.3s-.95 3.9-2.65 5.3" />}
      </svg>
    );

    /* ─────────────────────── SKELETON ─────────────────────── */
    function SkeletonCard({ LC }) {
      return (
        <div style={{ height: 64, borderRadius: 18, background: LC.surfaceQ, border: `1.5px solid ${LC.borderQ}`, opacity: 0.55 }} />
      );
    }

    /* ═══════════════════════════════════════════════════════
       MÀN HÌNH HỌC TỪ (flashcard + kiểm tra viết)
       ═══════════════════════════════════════════════════════ */
    function LearningView({ unit, LC, dark, onExit, onProgressSaved }) {
      const allVocab = unit.vocab || [];
      const [learnedIdx, setLearnedIdx] = useState([]);      // index trong allVocab đã học xong
      const [unlearned, setUnlearned] = useState(() => allVocab.map((_, i) => i));
      const [cursor, setCursor] = useState(0);                // vị trí hiện tại trong unlearned
      const [isWriting, setIsWriting] = useState(false);
      const [inputVal, setInputVal] = useState('');
      const [feedback, setFeedback] = useState(null);          // {ok, exact, correctWord} | null
      const [done, setDone] = useState(false);
      const [savedOnce, setSavedOnce] = useState(false);
      const inputRef = useRef(null);

      const total = allVocab.length;
      const progressPct = total > 0 ? Math.round((learnedIdx.length / total) * 100) : 0;
      const currentVocabIdx = unlearned[cursor];
      const vocab = currentVocabIdx !== undefined ? allVocab[currentVocabIdx] : null;

      useEffect(() => {
        if (unlearned.length === 0 && learnedIdx.length === total && total > 0) {
          setDone(true);
        }
      }, [unlearned, learnedIdx, total]);

      useEffect(() => {
        if (isWriting) setTimeout(() => inputRef.current?.focus(), 80);
      }, [isWriting, cursor]);

      // Lưu tiến độ 1 lần khi hoàn thành (khớp hành vi cũ: mỗi ngày/unit chỉ lưu 1 lần)
      useEffect(() => {
        if (done && !savedOnce) {
          setSavedOnce(true);
          onProgressSaved && onProgressSaved(unit, learnedIdx.length);
        }
      }, [done, savedOnce, unit, learnedIdx.length, onProgressSaved]);

      function startWritingTest() { setIsWriting(true); setFeedback(null); setInputVal(''); }

      function checkWriting() {
        if (!vocab) return;
        const userAnswer = inputVal.trim().toLowerCase();
        const correctAnswer = (vocab.word || '').trim().toLowerCase();
        const ok = userAnswer === correctAnswer || levenshtein(userAnswer, correctAnswer) <= 1;
        const exact = userAnswer === correctAnswer;
        setFeedback({ ok, exact, correctWord: vocab.word });

        if (ok) {
          setLearnedIdx(prev => [...prev, currentVocabIdx]);
          const nextUnlearned = unlearned.filter((_, i) => i !== cursor);
          setTimeout(() => {
            setUnlearned(nextUnlearned);
            setCursor(prev => nextUnlearned.length > 0 ? prev % nextUnlearned.length : 0);
            setIsWriting(false);
            setFeedback(null);
            setInputVal('');
          }, 1500);
        } else {
          setTimeout(() => { setIsWriting(false); setFeedback(null); setInputVal(''); }, 2000);
        }
      }

      function skip() {
        if (unlearned.length === 0) return;
        setCursor(prev => (prev + 1) % unlearned.length);
        setIsWriting(false); setFeedback(null);
      }

      function restart() {
        setLearnedIdx([]);
        setUnlearned(allVocab.map((_, i) => i));
        setCursor(0);
        setIsWriting(false); setFeedback(null); setDone(false); setSavedOnce(false);
      }

      const btnPrimary = {
        padding: '12px 26px', borderRadius: 999, border: 'none', cursor: 'pointer',
        background: 'linear-gradient(135deg,#FF6B95,#A855F7)', color: '#fff',
        fontSize: 14, fontWeight: 900, fontFamily: "'Nunito',sans-serif",
        boxShadow: '0 4px 16px rgba(168,85,247,0.32)', display: 'inline-flex', alignItems: 'center', gap: 7,
      };
      const btnGhost = {
        padding: '12px 26px', borderRadius: 999, cursor: 'pointer', fontFamily: "'Nunito',sans-serif",
        background: LC.navBtn, color: LC.navBtnText, border: `1.5px solid ${LC.navBtnBorder}`,
        fontSize: 14, fontWeight: 800,
      };

      if (total === 0) {
        return (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: LC.textMid }}>
            Unit này chưa có từ vựng nào.
          </div>
        );
      }

      if (done) {
        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center', gap: 6 }}>
            <div style={{ animation: 'vp-float 2s ease-in-out infinite', marginBottom: 8 }}><IconTrophy size={80} /></div>
            <div style={{ fontSize: 24, fontWeight: 900, color: LC.text }}>Hoàn thành!</div>
            <div style={{ fontSize: 14, color: LC.text2, fontWeight: 600, marginBottom: 20 }}>
              Bạn đã học xong tất cả {total} từ vựng trong bài này!
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button style={btnPrimary} onClick={restart}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3.5A7.5 7.5 0 1 0 17.5 10" /><path d="M17.5 3.5v4h-4" /></svg>
                Học lại
              </button>
              <button style={btnGhost} onClick={onExit}>← Bài khác</button>
            </div>
          </div>
        );
      }

      if (!vocab) {
        // Trạng thái chuyển tiếp: vừa học xong từ cuối, chờ useEffect chuyển sang màn "Hoàn thành"
        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
            <div style={{ animation: 'vp-float 2s ease-in-out infinite' }}><IconTrophy size={64} /></div>
          </div>
        );
      }

      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Progress bar */}
          <div style={{ padding: '10px 16px 0' }}>
            <div style={{ height: 8, borderRadius: 99, background: LC.border, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg,#10B981,#38BDF8)', borderRadius: 99, transition: 'width .4s' }} />
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: LC.textMid, marginTop: 6, textAlign: 'center' }}>
              {learnedIdx.length} / {total} từ đã học
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 20px 30px' }}>
            {!isWriting ? (
              <div key={currentVocabIdx} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                width: '100%', maxWidth: 480, padding: '32px 24px',
                background: dark ? 'rgba(30,13,21,0.6)' : '#fff',
                border: `1.5px solid ${LC.border}`, borderRadius: 24,
                boxShadow: dark ? '0 10px 34px rgba(0,0,0,.28)' : '0 10px 34px rgba(168,85,247,0.12)',
                animation: 'bb-pop .3s cubic-bezier(.34,1.56,.64,1) both',
              }}>
                <div style={{ fontSize: 44, fontWeight: 900, color: '#E8547A', marginBottom: 10 }}>{vocab.word}</div>
                <div style={{ display: 'inline-block', background: '#FEF3C7', color: '#78350f', padding: '5px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 800, marginBottom: 12 }}>
                  {getPosLabel(vocab.pos)}
                </div>
                {vocab.ipa && <div style={{ fontSize: 18, color: LC.textMid, fontStyle: 'italic', marginBottom: 20 }}>/{vocab.ipa.replace(/^\/|\/$/g, '')}/</div>}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4, marginBottom: 24,
                  padding: 6, borderRadius: 999,
                  background: dark ? 'rgba(196,181,253,0.08)' : 'rgba(168,85,247,0.07)',
                  border: `1.5px solid ${dark ? 'rgba(196,181,253,0.18)' : 'rgba(168,85,247,0.16)'}`,
                }}>
                  {[{ rate: 0.6, label: '0.5x', waves: 1 }, { rate: 1, label: '1x', waves: 2 }, { rate: 1.4, label: '2x', waves: 2 }].map(({ rate, label, waves }) => (
                    <button key={rate} onClick={() => speak(vocab.word, rate)}
                      title={rate < 1 ? 'Nghe chậm' : rate > 1 ? 'Nghe nhanh' : 'Nghe bình thường'}
                      style={{ width: 58, height: 46, borderRadius: 999, border: 'none', background: 'linear-gradient(135deg,#FF6B95,#A855F7)', color: '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, boxShadow: '0 4px 14px rgba(155,114,239,0.3)', transition: 'transform .15s ease, box-shadow .15s ease' }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(155,114,239,0.42)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(155,114,239,0.3)'; }}>
                      <IconSpeaker size={15} waves={waves} />
                      <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.2px', opacity: 0.92 }}>{label}</span>
                    </button>
                  ))}
                </div>
                {vocab.meaning && <div style={{ fontSize: 16, color: LC.text, marginBottom: 14, lineHeight: 1.6 }}>{vocab.meaning}</div>}
                {vocab.example && (
                  <div style={{ fontSize: 13.5, color: LC.text2, fontStyle: 'italic', padding: 14, width: '100%', boxSizing: 'border-box', background: dark ? 'rgba(196,181,253,0.08)' : 'rgba(168,85,247,0.06)', borderRadius: 14, borderLeft: '3.5px solid #A855F7', marginBottom: 24 }}>
                    "{vocab.example}"
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button style={btnPrimary} onClick={startWritingTest}>
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2.5l3 3-10 10H4.5v-3l10-10z" /></svg>
                    Kiểm tra viết từ
                  </button>
                  <button style={{ ...btnGhost, background: '#FEF3C7', color: '#92400e', border: '1.5px solid #FDE68A' }} onClick={skip}>→ Bỏ qua</button>
                </div>
              </div>
            ) : (
              <div key={`w-${currentVocabIdx}`} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                width: '100%', maxWidth: 480, padding: '32px 24px',
                background: dark ? 'rgba(30,13,21,0.6)' : '#fff',
                border: `1.5px solid ${LC.border}`, borderRadius: 24,
                boxShadow: dark ? '0 10px 34px rgba(0,0,0,.28)' : '0 10px 34px rgba(168,85,247,0.12)',
                animation: 'bb-pop .3s cubic-bezier(.34,1.56,.64,1) both',
              }}>
                {vocab.ipa && <div style={{ fontSize: 18, color: LC.textMid, fontStyle: 'italic', marginBottom: 22 }}>/{vocab.ipa.replace(/^\/|\/$/g, '')}/</div>}
                <button onClick={() => speak(vocab.word, 1)} style={{ width: 46, height: 46, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg,#FF6B95,#A855F7)', color: '#fff', cursor: 'pointer', marginBottom: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform .15s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
                  <IconSpeaker size={16} />
                </button>
                <input ref={inputRef} type="text" value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') checkWriting(); }}
                  placeholder="Viết từ bạn vừa nghe..." autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
                  style={{ width: '100%', maxWidth: 380, padding: '13px 16px', borderRadius: 14, border: `2px solid ${feedback ? (feedback.ok ? '#10B981' : '#EF4444') : LC.inputBorder}`, fontSize: 17, textAlign: 'center', fontFamily: 'inherit', color: LC.inputColor, background: LC.inputBg, outline: 'none', marginBottom: 18 }} />
                {feedback && (
                  <div style={{
                    fontSize: 14.5, fontWeight: 800, padding: '11px 18px', borderRadius: 12, marginBottom: 16,
                    color: feedback.ok ? '#10B981' : '#EF4444',
                    background: feedback.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.08)',
                    border: `1.5px solid ${feedback.ok ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
                  }}>
                    {feedback.ok
                      ? `${feedback.exact ? 'Chính xác!' : 'Gần đúng!'} "${feedback.correctWord}"`
                      : `Sai! Đáp án đúng: "${feedback.correctWord}"`}
                  </div>
                )}
                <button style={btnPrimary} onClick={checkWriting}>
                  <IconCheck size={14} color="#fff" /> Kiểm tra
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    /* ═══════════════════════════════════════════════════════
       MÀN HÌNH CHỌN UNIT (trong 1 khóa học)
       ═══════════════════════════════════════════════════════ */
    function UnitPicker({ course, LC, dark, onPickUnit, onBack, masteryOf }) {
      const units = course.units || [];
      return (
        <div style={{ flex: 1, padding: '16px 14px 100px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {units.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: LC.textMid, fontSize: 13, fontWeight: 700, borderRadius: 16, border: `1.5px solid ${LC.borderQ}` }}>
              Chưa có bài học nào trong khóa học này.
            </div>
          ) : units.map((u, uIdx) => {
            const total = u.vocab ? u.vocab.length : 0;
            const mastered = masteryOf(u.id, total);
            const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;
            return (
              <button key={u.id || uIdx} onClick={() => onPickUnit(u)}
                style={{
                  textAlign: 'left', padding: '14px 16px', borderRadius: 18,
                  border: `1.5px solid ${LC.borderQ}`, background: LC.surfaceQ, boxShadow: LC.cardShadow,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                  transition: 'transform .18s ease, box-shadow .18s ease',
                  animation: `fadeUp .22s ease ${Math.min(uIdx * 0.04, 0.3)}s both`,
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 22px rgba(168,85,247,0.16)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = LC.cardShadow; }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: 'rgba(176,124,240,0.18)', color: '#B07CF0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconBook size={17} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: LC.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.title}</div>
                  <div style={{ fontSize: 11.5, color: LC.textMid, marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                    {u.level && <span>Level {u.level} · </span>}
                    <IconBook size={11} /> {total} từ
                    {pct > 0 && <span style={{ color: '#10B981', fontWeight: 800 }}>· {pct}%</span>}
                  </div>
                  {total > 0 && (
                    <div style={{ marginTop: 5, height: 4, background: LC.border, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#10B981,#38BDF8)', borderRadius: 4 }} />
                    </div>
                  )}
                </div>
                <div style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 800, color: pct === 100 ? '#10B981' : '#B07CF0' }}>
                  {pct === 100 ? <IconCheck size={17} /> : 'Học ngay →'}
                </div>
              </button>
            );
          })}
        </div>
      );
    }

    /* ═══════════════════════════════════════════════════════
       VOCAB PRACTICE — main export
       ═══════════════════════════════════════════════════════ */
    function VocabPractice({ dark, student, onBack }) {
      const [courses, setCourses] = useState([]);
      const [loading, setLoading] = useState(true);
      const [loadError, setLoadError] = useState(false);
      const [openCourseId, setOpenCourseId] = useState(null);
      const [activeUnit, setActiveUnit] = useState(null);   // unit đang học (LearningView) hoặc null
      const [activeCourse, setActiveCourse] = useState(null);
      const [mastery, setMastery] = useState({});           // { unitId: masteredCount } — cục bộ (localStorage)

      const LC = useMemo(() => ({
        text: dark ? '#F2EAFF' : '#2D1245',
        text2: dark ? '#DDD0F8' : '#4A1860',
        textMid: dark ? '#9B7FC0' : '#8060A0',
        surfaceQ: dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.92)',
        border: dark ? 'rgba(196,181,253,0.13)' : 'rgba(180,100,255,0.13)',
        borderQ: dark ? 'rgba(196,181,253,0.18)' : 'rgba(180,100,255,0.18)',
        navBtn: dark ? 'rgba(255,150,200,0.07)' : 'rgba(255,107,149,0.06)',
        navBtnBorder: dark ? 'rgba(255,150,200,0.28)' : 'rgba(255,107,149,0.28)',
        navBtnText: dark ? '#FBAFCE' : '#E8547A',
        inputBg: dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.92)',
        inputColor: dark ? '#F2EAFF' : '#2D1245',
        inputBorder: dark ? 'rgba(196,181,253,0.28)' : 'rgba(180,100,255,0.28)',
        cardShadow: dark ? '0 2px 16px rgba(0,0,0,0.35)' : '0 2px 16px rgba(168,85,247,0.08)',
      }), [dark]);

      // ── Load courses > units > vocab (khớp bảng của admin/vocabulary-manager.jsx) ──
      useEffect(() => {
        const supa = window.supa;
        if (!supa) { setLoading(false); setLoadError(true); return; }
        (async () => {
          try {
            const [{ data: cs, error: e1 }, { data: us, error: e2 }, { data: ws, error: e3 }] = await Promise.all([
              supa.from('vocab_courses').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false }),
              supa.from('vocab_units').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
              supa.from('vocab_words').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
            ]);
            if (e1 || e2 || e3) throw (e1 || e2 || e3);
            const wordsByUnit = {};
            (ws || []).forEach(w => { (wordsByUnit[w.unit_id] ||= []).push(w); });
            const unitsByCourse = {};
            (us || []).forEach(u => { (unitsByCourse[u.course_id] ||= []).push({ ...u, vocab: wordsByUnit[u.id] || [] }); });
            setCourses((cs || []).map(c => ({ ...c, units: unitsByCourse[c.id] || [] })));
          } catch (e) {
            console.error('[VocabPractice] load error:', e);
            setLoadError(true);
          } finally {
            setLoading(false);
          }
        })();
      }, []);

      // ── Mastery: đọc từ localStorage (tương thích hành vi cũ: 1 số nguyên/unit) ──
      const masteryOf = useCallback((unitId, total) => {
        if (mastery[unitId] !== undefined) return mastery[unitId];
        try {
          const v = parseInt(localStorage.getItem(`vmaster_${unitId}`) || '0', 10);
          return Number.isFinite(v) ? Math.min(v, total) : 0;
        } catch { return 0; }
      }, [mastery]);

      const saveMastery = useCallback((unitId, count) => {
        setMastery(prev => ({ ...prev, [unitId]: count }));
        try { localStorage.setItem(`vmaster_${unitId}`, String(count)); } catch { }
      }, []);

      // ── Lưu tiến độ lên Supabase (bảng vocab_progress) khi hoàn thành 1 unit ──
      const saveProgress = useCallback(async (unit, learnedCount) => {
        saveMastery(unit.id, learnedCount);
        if (!student?.id || !window.supa) return;
        const today = new Date().toISOString().split('T')[0];
        const saveKey = `vocabsave_${today}_${unit.id}`;
        try {
          if (localStorage.getItem(saveKey)) return; // mỗi ngày/unit chỉ lưu 1 lần, khớp hành vi cũ
          const { error } = await window.supa.from('vocab_progress').insert({
            id: crypto.randomUUID(), student_id: student.id, unit_id: unit.id,
            date: today, vocab_count: learnedCount,
          });
          if (error) throw error;
          localStorage.setItem(saveKey, '1');
        } catch (e) {
          console.error('[VocabPractice] save progress error:', e);
        }
      }, [student?.id, saveMastery]);

      function pickUnit(course, unit) {
        setActiveCourse(course);
        setActiveUnit(unit);
      }
      function exitLearning() { setActiveUnit(null); setActiveCourse(null); }

      const header = (title, onBackFn) => (
        <div style={{ padding: '11px 15px 10px', background: LC.surfaceQ, borderBottom: `1px solid ${LC.border}`, position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(20px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {onBackFn ? (
              <button onClick={onBackFn} style={{ padding: '6px 14px', borderRadius: 999, border: `1.5px solid ${LC.navBtnBorder}`, background: LC.navBtn, color: LC.navBtnText, fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                Quay lại
              </button>
            ) : <div style={{ width: 70 }} />}
            <div style={{ fontSize: 14, fontWeight: 900, color: LC.text, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconBook size={15} color={LC.text} /> {title}
            </div>
            <div style={{ width: 70 }} />
          </div>
        </div>
      );

      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
          <style>{`
            @keyframes vp-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
          `}</style>

          {/* ── Đang học 1 unit ── */}
          {activeUnit ? (
            <>
              {header(activeUnit.title, exitLearning)}
              <LearningView unit={activeUnit} LC={LC} dark={dark} onExit={exitLearning} onProgressSaved={saveProgress} />
            </>
          ) : openCourseId ? (
            /* ── Đang xem danh sách unit của 1 khóa học ── */
            (() => {
              const course = courses.find(c => c.id === openCourseId);
              if (!course) return null;
              return (
                <>
                  {header(course.title, () => setOpenCourseId(null))}
                  <UnitPicker course={course} LC={LC} dark={dark} onBack={() => setOpenCourseId(null)}
                    onPickUnit={u => pickUnit(course, u)} masteryOf={masteryOf} />
                </>
              );
            })()
          ) : (
            /* ── Danh sách khóa học ── */
            <>
              {header('Từ vựng', onBack)}
              <div style={{ flex: 1, padding: '16px 14px 100px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {loadError && (
                  <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: 12.5, fontWeight: 700 }}>
                    Không tải được danh sách từ vựng. Thử lại sau nhé!
                  </div>
                )}
                {loading ? (
                  <>
                    <SkeletonCard LC={LC} /><SkeletonCard LC={LC} /><SkeletonCard LC={LC} />
                  </>
                ) : courses.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '34vh', gap: 12, padding: '32px 20px', textAlign: 'center', animation: 'fadeUp .3s ease both', borderRadius: 18, border: `1.5px solid ${LC.borderQ}` }}>
                    <span style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: '50%',
                      background: dark ? 'rgba(196,181,253,0.1)' : 'rgba(168,85,247,0.08)', color: LC.textMid,
                      animation: 'bb-float 3s ease-in-out infinite',
                    }}><IconBook size={28} /></span>
                    <div style={{ fontSize: 14.5, fontWeight: 900, color: LC.text, fontFamily: "'Baloo 2',cursive" }}>Chưa có khóa học nào</div>
                    <div style={{ fontSize: 12.5, color: LC.textMid }}>Quay lại sau nhé, giáo viên sẽ đăng bài sớm thôi!</div>
                  </div>
                ) : courses.map((course, cIdx) => {
                  const unitCount = (course.units || []).length;
                  const wordCount = (course.units || []).reduce((n, u) => n + (u.vocab ? u.vocab.length : 0), 0);
                  return (
                    <button key={course.id} onClick={() => setOpenCourseId(course.id)}
                      style={{
                        textAlign: 'left', padding: '14px 16px', borderRadius: 18, border: `1.5px solid ${LC.borderQ}`,
                        background: LC.surfaceQ, boxShadow: LC.cardShadow, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                        transition: 'transform .18s ease, box-shadow .18s ease',
                        animation: `fadeUp .22s ease ${Math.min(cIdx * 0.04, 0.3)}s both`,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 22px rgba(168,85,247,0.16)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = LC.cardShadow; }}>
                      <div style={{ width: 42, height: 42, borderRadius: 14, flexShrink: 0, background: 'linear-gradient(135deg,#F472B6,#A855F7)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 12px rgba(168,85,247,0.32)' }}>
                        <IconBook size={19} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 800, color: LC.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{course.title}</div>
                        <div style={{ fontSize: 12, color: LC.textMid, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {course.description || `${unitCount} unit · ${wordCount} từ`}
                        </div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={LC.textMid} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      );
    }

    window.VocabPractice = VocabPractice;
  } catch (e) {
    console.error('[vocab-practice] INIT ERROR:', e);
  }
})();
