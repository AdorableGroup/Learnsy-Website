import React from 'react';

/* ══════════════════════════════════════════════════════════════════
   LISTENING-PRACTICE.JSX - v2.3 (fix + improvement)
   - Sửa rò rỉ timeout trong handleRateChange
   - Tối ưu splitPassage dùng split capturing group, loại bỏ infinite loop
   - Thêm trạng thái pulse khi phát lại
   [v2.2]
   - splitPassage: trim chunk trước khi test regex → không bỏ sót blank có khoảng trắng thừa
   - Fallback blank: dùng capturing group giữ dấu câu gốc (.!?), sửa câu bị dính nhau ở nhánh else
   - useEffect: ép kiểu Array.isArray() an toàn cho answers/wordBox/statements
   - isBad: hiển thị đỏ + tooltip khi ô trống (val === '')
   - speak: regex ▁{3,} trong TTS plain text
   [v2.3]
   - Fix: tooltip z-index, aria-label cho inputs, shimmer dùng chung
   - Fix: chặn double‑speak khi bấm play liên tục nhờ speakPendingRef
   - Tối ưu key cho passage parts
══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';
  try {
    const { useState, useEffect, useMemo, useRef, useCallback } = React;

    const stripHTML = s => (s || '').replace(/<[^>]*>/g, '');
    const norm = s => (s || '').trim().toLowerCase();

    /* ── Helper: tách đoạn văn – dùng split với capturing group ── */
    function splitPassage(text, blankCount) {
      const raw = stripHTML(text);
      // Dùng split để tách và giữ lại các delimiter (___ hoặc ▁▁▁)
      const parts = raw.split(/(_{3,}|▁{3,})/);
      const result = [];
      let blankIndex = 0;
      for (let i = 0; i < parts.length; i++) {
        const chunk = parts[i];
        if (!chunk) continue;
        const trimmed = chunk.trim();
        // Nếu chunk khớp với blank pattern (sau khi trim khoảng trắng thừa)
        if (/^_{3,}$/.test(trimmed) || /^▁{3,}$/.test(trimmed)) {
          if (blankIndex < blankCount) {
            result.push({ type: 'blank', index: blankIndex++ });
          } else {
            result.push({ type: 'text', content: chunk });
          }
        } else {
          result.push({ type: 'text', content: chunk });
        }
      }
      if (blankIndex === 0 && blankCount > 0) {
        const sentParts = raw.split(/([.!?]\s+)/);
        const newResult = [];
        let cnt = 0;
        for (let i = 0; i < sentParts.length; i++) {
          const chunk = sentParts[i];
          if (!chunk) continue;
          if (/^[.!?]\s+$/.test(chunk)) {
            newResult.push({ type: 'text', content: chunk });
            continue;
          }
          if (cnt < blankCount) {
            const words = chunk.trim().split(' ').filter(Boolean);
            if (words.length > 4) {
              const mid = Math.floor(words.length / 2);
              newResult.push({ type: 'text', content: words.slice(0, mid).join(' ') + ' ' });
              newResult.push({ type: 'blank', index: cnt++ });
              newResult.push({ type: 'text', content: ' ' + words.slice(mid).join(' ') });
            } else {
              newResult.push({ type: 'text', content: chunk + ' ' });
              newResult.push({ type: 'blank', index: cnt++ });
            }
          } else {
            newResult.push({ type: 'text', content: chunk });
          }
        }
        return newResult.filter(p => p.content !== undefined || p.type === 'blank');
      }
      return result;
    }

    /* ── Skeleton Loading (dùng chung keyframes) ── */
    function SkeletonCard({ dark }) {
      const bg = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
      const shimmer = dark
        ? 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)'
        : 'linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.07) 50%, rgba(0,0,0,0.04) 75%)';
      return (
        <div style={{
          padding: '14px 16px',
          borderRadius: 18,
          background: bg,
          border: `1.5px solid ${dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
          position: 'relative',
          overflow: 'hidden',
          height: 72,
        }}>
          <div
            className="skeleton-shimmer"
            style={{
              position: 'absolute',
              inset: 0,
              background: shimmer,
              backgroundSize: '200% 100%',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: bg, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 14, width: '75%', borderRadius: 6, background: bg }} />
              <div style={{ height: 12, width: '45%', borderRadius: 6, background: bg, marginTop: 8 }} />
            </div>
          </div>
        </div>
      );
    }

    /* ── Icon set (thay emoji) ── */
    function IconHeadphones({ size = 14, color = 'currentColor' }) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z" />
          <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z" />
        </svg>
      );
    }

    function IconBook({ size = 11, color = 'currentColor' }) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M2 4.5C2 3.67 2.67 3 3.5 3H10a2 2 0 0 1 2 2v15a1.5 1.5 0 0 0-1.5-1.5H2v-14z" />
          <path d="M22 4.5c0-.83-.67-1.5-1.5-1.5H14a2 2 0 0 0-2 2v15a1.5 1.5 0 0 1 1.5-1.5H22v-14z" />
        </svg>
      );
    }

    function IconBox({ size = 11, color = 'currentColor' }) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M21 8a1 1 0 0 0-.5-.87l-8-4.6a1 1 0 0 0-1 0l-8 4.6A1 1 0 0 0 3 8v8a1 1 0 0 0 .5.87l8 4.6a1 1 0 0 0 1 0l8-4.6A1 1 0 0 0 21 16V8z" />
          <path d="M3.27 7.13 12 12l8.73-4.87" />
          <path d="M12 22.5V12" />
        </svg>
      );
    }

    function IconCheck({ size = 13, color = 'currentColor' }) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    }

    function IconRedo({ size = 13, color = 'currentColor' }) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <polyline points="3 3 3 6.5 6.5 6.5" />
        </svg>
      );
    }

    function IconRefresh({ size = 12, color = 'currentColor', spin = false }) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, animation: spin ? 'spin 0.9s linear infinite' : 'none' }}>
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <polyline points="21 3 21 9 15 9" />
        </svg>
      );
    }

    /* ── Component chính ── */
    function ListeningPractice({ dark, onBack }) {
      const [items, setItems] = useState([]);
      const [loading, setLoading] = useState(true);
      const [loadError, setLoadError] = useState(false);

      const [selected, setSelected] = useState(null);
      const [blanks, setBlanks] = useState([]);
      const [stmtSel, setStmtSel] = useState([]);
      const [submitted, setSubmitted] = useState(false);

      const [isPlaying, setIsPlaying] = useState(false);
      const [speechRate, setSpeechRate] = useState(1.0);
      const [isRestarting, setIsRestarting] = useState(false);

      const utteranceRef = useRef(null);
      const synthRef = useRef(null);
      const timerRef = useRef(null);
      const speakPendingRef = useRef(false); // tránh double‑speak

      const inputRefs = useRef([]);
      const inputRefCallbacks = useRef({});

      // Khởi tạo tham chiếu Web Speech API trong useEffect riêng — tránh
      // đụng vào `window` ngay trong thân render.
      useEffect(() => {
        synthRef.current = window.speechSynthesis || null;
      }, []);

      // Callback ref ổn định cho từng input theo index. Tránh anti-pattern
      // `ref={el => ...}` (arrow function inline bị tạo lại mỗi lần render,
      // khiến React gọi ref cũ với null rồi gọi ref mới với node ở mỗi update).
      const getInputRef = useCallback((bi) => {
        let cb = inputRefCallbacks.current[bi];
        if (!cb) {
          cb = (el) => {
            if (el) inputRefs.current[bi] = el;
            else delete inputRefs.current[bi];
          };
          inputRefCallbacks.current[bi] = cb;
        }
        return cb;
      }, []);

      const LC = useMemo(() => ({
        text: dark ? '#F2EAFF' : '#2D1245',
        text2: dark ? '#DDD0F8' : '#4A1860',
        textMid: dark ? '#9B7FC0' : '#8060A0',
        surface: dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.82)',
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

      // Load dữ liệu
      useEffect(() => {
        const supa = window.supa;
        if (!supa) {
          setLoading(false);
          setLoadError(true);
          return;
        }
        supa.from('listening_items').select('*').order('created_at').then(({ data, error }) => {
          if (error) {
            console.error('[ListeningPractice] load error:', error);
            setLoadError(true);
          } else {
            setItems((data || []).map(r => ({
              id: r.id,
              text: r.text || '',
              wordBox: Array.isArray(r.word_box) ? r.word_box : [],
              answers: Array.isArray(r.answers) ? r.answers : [],
              statements: Array.isArray(r.statements) ? r.statements : [],
            })));
          }
          setLoading(false);
        });
      }, []);

      // Mở bài
      const openItem = useCallback((it) => {
        if (synthRef.current) {
          synthRef.current.cancel();
          setIsPlaying(false);
        }
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        speakPendingRef.current = false;
        setIsRestarting(false);
        setSelected(it);
        setBlanks(it.answers.map(() => ''));
        setStmtSel(it.statements.map(() => null));
        setSubmitted(false);
        inputRefs.current = [];
      }, []);

      // ── Audio Controls ──
      // Handler sự kiện của utterance khai báo ổn định bằng useCallback
      // (deps rỗng) — tránh tạo closure mới mỗi lần gọi speak().
      const handleSpeechStart = useCallback(() => {
        setIsPlaying(true);
        setIsRestarting(false);
        speakPendingRef.current = false;
      }, []);

      const handleSpeechEnd = useCallback(() => {
        setIsPlaying(false);
        setIsRestarting(false);
        speakPendingRef.current = false;
      }, []);

      const handleSpeechError = useCallback(() => {
        setIsPlaying(false);
        setIsRestarting(false);
        speakPendingRef.current = false;
      }, []);

      const speak = useCallback((raw, rate = speechRate) => {
        if (!raw || !raw.trim()) return;
        if (!window.speechSynthesis) return;
        try {
          window.speechSynthesis.cancel();
          const plain = stripHTML(raw).replace(/_{3,}|▁{3,}/g, ' blank ').replace(/\s+/g, ' ').trim();
          const u = new SpeechSynthesisUtterance(plain);
          u.lang = 'en-US';
          u.rate = rate;
          utteranceRef.current = u;
          speakPendingRef.current = true; // đánh dấu đang chờ phát
          u.onstart = handleSpeechStart;
          u.onend = handleSpeechEnd;
          u.onerror = handleSpeechError;
          window.speechSynthesis.speak(u);
        } catch (e) {
          setIsPlaying(false);
          setIsRestarting(false);
          speakPendingRef.current = false;
        }
      }, [speechRate, handleSpeechStart, handleSpeechEnd, handleSpeechError]);

      const togglePlayPause = useCallback(() => {
        const synth = synthRef.current;
        if (!synth) return;
        if (speakPendingRef.current) return; // tránh gọi speak thêm lần nữa
        if (synth.speaking && !synth.paused) {
          synth.pause();
          setIsPlaying(false);
        } else if (synth.paused) {
          synth.resume();
          setIsPlaying(true);
        } else {
          if (selected) speak(selected.text);
        }
      }, [selected, speak]);

      const handleRateChange = useCallback((e) => {
        const val = parseFloat(e.target.value);
        setSpeechRate(val);
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        if (synthRef.current && (synthRef.current.speaking || synthRef.current.paused)) {
          synthRef.current.cancel();
          setIsPlaying(false);
          if (selected) {
            setIsRestarting(true);
            timerRef.current = setTimeout(() => {
              speak(selected.text, val);
              timerRef.current = null;
            }, 50);
          }
        }
      }, [selected, speak]);

      const handleRestart = useCallback(() => {
        if (selected) {
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          if (synthRef.current) {
            synthRef.current.cancel();
          }
          setIsPlaying(false);
          setIsRestarting(true);
          speak(selected.text, speechRate);
        }
      }, [selected, speak, speechRate]);

      useEffect(() => {
        return () => {
          if (synthRef.current) synthRef.current.cancel();
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          speakPendingRef.current = false;
        };
      }, []);

      // ── Handlers ──
      const setBlank = (i, v) => setBlanks(p => p.map((b, idx) => idx === i ? v : b));
      const setStmt = (i, v) => setStmtSel(p => p.map((s, idx) => idx === i ? v : s));

      const score = useMemo(() => {
        if (!selected) return { correct: 0, total: 0 };
        let correct = 0, total = 0;
        selected.answers.forEach((ans, i) => {
          total++;
          if (norm(blanks[i]) === norm(ans)) correct++;
        });
        selected.statements.forEach((st, i) => {
          total++;
          if (stmtSel[i] === st.answer) correct++;
        });
        return { correct, total };
      }, [selected, blanks, stmtSel]);

      // Màu khớp với panel admin (listening-panel) để đồng bộ giao diện
      const ANS_COLOR = {
        'True': { c: '#16a34a', bg: 'rgba(22,163,74,.1)', bd: 'rgba(22,163,74,.35)', label: 'Đúng' },
        'False': { c: '#dc2626', bg: 'rgba(220,38,38,.08)', bd: 'rgba(220,38,38,.32)', label: 'Sai' },
        'Not Mentioned': { c: '#6366f1', bg: 'rgba(99,102,241,.08)', bd: 'rgba(99,102,241,.32)', label: 'NM' },
      };
      // Màu chỗ trống (điền từ) khớp với khối "Đáp án đúng" trong admin
      const BLANK_OK = '#059669';
      const BLANK_BAD = '#dc2626';

      // ── Render Passage với Inline Inputs ──
      const renderPassage = useCallback(() => {
        if (!selected) return null;
        const parts = splitPassage(selected.text, selected.answers.length);
        const blankCount = selected.answers.length;

        return parts.map((part, idx) => {
          if (part.type === 'text') {
            return <span key={`text-${idx}`} style={{ color: LC.text2, lineHeight: 1.75 }}>{part.content}</span>;
          }
          if (part.type === 'blank') {
            const bi = part.index;
            if (bi >= blankCount) return <span key={`blank-over-${idx}`} style={{ color: LC.textMid }}>___</span>;
            const val = blanks[bi] || '';
            const isOk = submitted && norm(val) === norm(selected.answers[bi]);
            const isBad = submitted && !isOk;

            return (
              <span key={`blank-${bi}-${idx}`} style={{ display: 'inline-block', position: 'relative', margin: '0 2px' }}>
                <input
                  ref={getInputRef(bi)}
                  value={val}
                  disabled={submitted}
                  onChange={e => setBlank(bi, e.target.value)}
                  onFocus={e => e.target.select()}
                  placeholder="..."
                  aria-label={`Blank ${bi + 1}`}
                  style={{
                    width: Math.max(60, (selected.answers[bi]?.length || 4) * 12 + 20),
                    padding: '4px 8px',
                    borderRadius: 8,
                    fontSize: 13.5,
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    color: isOk ? BLANK_OK : isBad ? BLANK_BAD : LC.inputColor,
                    background: isOk ? 'rgba(5,150,105,0.10)' : isBad ? 'rgba(220,38,38,0.08)' : LC.inputBg,
                    border: '1.5px solid ' + (isOk ? BLANK_OK : isBad ? BLANK_BAD : LC.inputBorder),
                    outline: 'none',
                    textAlign: 'center',
                    transition: 'border-color 0.15s, background 0.15s, transform 0.1s',
                    transform: 'scale(1)',
                  }}
                  className="inline-blank"
                />
                {submitted && isBad && (
                  <span style={{
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 9,
                    fontWeight: 800,
                    color: '#FCA5A5',
                    whiteSpace: 'nowrap',
                    background: dark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.95)',
                    padding: '1px 6px',
                    borderRadius: 4,
                    marginTop: 1,
                    pointerEvents: 'none',
                    zIndex: 10, // đảm bảo hiển thị trên các phần tử khác
                  }}>
                    {selected.answers[bi]}
                  </span>
                )}
              </span>
            );
          }
          return null;
        });
      }, [selected, blanks, submitted, LC, dark]);

      /* ════════════════════════════════════════
         DANH SÁCH
         ════════════════════════════════════════ */
      if (!selected) {
        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
            {/* Shimmer animation dùng chung */}
            <style>{`
              .skeleton-shimmer {
                animation: shimmer 1.8s infinite;
              }
              @keyframes shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
              }
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
            {/* Header */}
            <div style={{
              padding: '11px 15px 10px',
              background: LC.surfaceQ,
              borderBottom: `1px solid ${LC.border}`,
              position: 'sticky',
              top: 0,
              zIndex: 50,
              backdropFilter: 'blur(20px)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {onBack ? (
                  <button onClick={onBack}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 999,
                      border: `1.5px solid ${LC.navBtnBorder}`,
                      background: LC.navBtn,
                      color: LC.navBtnText,
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'transform 0.1s',
                    }}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.96)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    Quay lại
                  </button>
                ) : <div style={{ width: 70 }} />}
                <div style={{ fontSize: 14, fontWeight: 900, color: LC.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconHeadphones size={15} color={LC.text} />
                  Listening
                </div>
                <div style={{ width: 70 }} />
              </div>
            </div>

            {/* Nội dung danh sách */}
            <div style={{ flex: 1, padding: '16px 14px 100px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {loadError && (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: 14,
                  background: 'rgba(239,68,68,0.08)',
                  border: '1.5px solid rgba(239,68,68,0.25)',
                  color: '#EF4444',
                  fontSize: 12.5,
                  fontWeight: 700,
                }}>
                  Không tải được danh sách Listening. Thử lại sau nhé!
                </div>
              )}

              {loading ? (
                <>
                  <SkeletonCard dark={dark} />
                  <SkeletonCard dark={dark} />
                  <SkeletonCard dark={dark} />
                  <SkeletonCard dark={dark} />
                </>
              ) : items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: LC.textMid, fontSize: 13, fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <IconHeadphones size={20} color={LC.textMid} />
                  Chưa có bài Listening nào. Quay lại sau nhé!
                </div>
              ) : (
                items.map((it, idx) => (
                  <button key={it.id} onClick={() => openItem(it)}
                    style={{
                      textAlign: 'left',
                      padding: '14px 16px',
                      borderRadius: 18,
                      border: `1.5px solid ${LC.borderQ}`,
                      background: LC.surfaceQ,
                      boxShadow: LC.cardShadow,
                      cursor: 'pointer',
                      transition: 'transform 0.12s, box-shadow 0.2s',
                    }}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        background: 'rgba(176,124,240,0.18)',
                        color: '#B07CF0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 900,
                        flexShrink: 0,
                      }}>{idx + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13.5,
                          fontWeight: 700,
                          color: LC.text,
                          lineHeight: 1.55,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}>
                          {stripHTML(it.text)}
                        </div>
                        <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                          {it.answers.length > 0 && (
                            <span style={{
                              fontSize: 10,
                              fontWeight: 800,
                              color: '#059669',
                              background: 'rgba(16,185,129,.1)',
                              border: '1px solid rgba(16,185,129,.3)',
                              borderRadius: 99,
                              padding: '2px 7px',
                            }}>{it.answers.length} chỗ trống</span>
                          )}
                          {it.statements.length > 0 && (
                            <span style={{
                              fontSize: 10,
                              fontWeight: 800,
                              color: '#dc2626',
                              background: 'rgba(220,38,38,.08)',
                              border: '1px solid rgba(220,38,38,.28)',
                              borderRadius: 99,
                              padding: '2px 7px',
                            }}>{it.statements.length} nhận định T/F/NM</span>
                          )}
                        </div>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={LC.textMid} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 6 }}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        );
      }

      /* ════════════════════════════════════════
         LUYỆN TẬP CHI TIẾT
         ════════════════════════════════════════ */
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
          {/* Shimmer animation dùng chung (có thể bỏ nếu không dùng skeleton ở đây) */}
          <style>{`
            .skeleton-shimmer {
              animation: shimmer 1.8s infinite;
            }
            @keyframes shimmer {
              0% { background-position: -200% 0; }
              100% { background-position: 200% 0; }
            }
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
          {/* Header */}
          <div style={{
            padding: '11px 15px 10px',
            background: LC.surfaceQ,
            borderBottom: `1px solid ${LC.border}`,
            position: 'sticky',
            top: 0,
            zIndex: 50,
            backdropFilter: 'blur(20px)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => {
                if (synthRef.current) synthRef.current.cancel();
                if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
                speakPendingRef.current = false;
                setIsPlaying(false);
                setIsRestarting(false);
                setSelected(null);
                setSubmitted(false);
              }}
                style={{
                  padding: '6px 14px',
                  borderRadius: 999,
                  border: `1.5px solid ${LC.navBtnBorder}`,
                  background: LC.navBtn,
                  color: LC.navBtnText,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'transform 0.1s',
                }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.96)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Danh sách
              </button>
              <div style={{ fontSize: 13, fontWeight: 900, color: LC.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconHeadphones size={14} color={LC.text} />
                Listening
              </div>
              {submitted ? (
                <div style={{
                  padding: '5px 13px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 900,
                  color: '#fff',
                  background: 'linear-gradient(135deg,#10B981,#34D399)',
                }}>{score.correct}/{score.total}</div>
              ) : <div style={{ width: 80 }} />}
            </div>
          </div>

          {/* Nội dung */}
          <div style={{ flex: 1, padding: '16px 14px 100px', display: 'flex', flexDirection: 'column', gap: 13 }}>

            {/* ── Audio Controls ── */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              background: LC.surfaceQ,
              border: `1.5px solid ${isRestarting ? '#F59E0B' : LC.borderQ}`,
              borderRadius: 18,
              padding: '10px 14px',
              boxShadow: LC.cardShadow,
              transition: 'border-color 0.3s, box-shadow 0.3s',
              ...(isRestarting && { boxShadow: '0 0 0 3px rgba(245,158,11,0.3)' }),
            }}>
              <button onClick={togglePlayPause}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  border: 'none',
                  background: isPlaying ? 'linear-gradient(135deg,#F59E0B,#F97316)' : 'linear-gradient(135deg,#10B981,#34D399)',
                  color: '#fff',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'transform 0.1s',
                }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                {isPlaying ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              <div style={{ flex: 1, minWidth: 80 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: LC.textMid, marginBottom: 2 }}>
                  <span>0.8x</span>
                  <span style={{ color: LC.text }}>{speechRate.toFixed(1)}x</span>
                  <span>1.2x</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="1.2"
                  step="0.05"
                  value={speechRate}
                  onChange={handleRateChange}
                  style={{
                    width: '100%',
                    height: 4,
                    borderRadius: 2,
                    background: `linear-gradient(to right, #B07CF0 0%, #B07CF0 ${((speechRate - 0.8) / 0.4) * 100}%, ${dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'} ${((speechRate - 0.8) / 0.4) * 100}%)`,
                    outline: 'none',
                    cursor: 'pointer',
                    accentColor: '#B07CF0',
                  }}
                />
              </div>

              <button onClick={handleRestart}
                style={{
                  padding: '6px 14px',
                  borderRadius: 999,
                  border: `1.5px solid ${isRestarting ? '#F59E0B' : LC.borderQ}`,
                  background: isRestarting ? 'rgba(245,158,11,0.15)' : 'transparent',
                  color: isRestarting ? '#F59E0B' : LC.text2,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'transform 0.1s, background 0.2s, border-color 0.2s, color 0.2s',
                  flexShrink: 0,
                }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.96)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {isRestarting ? (
                    <><IconRefresh size={11} color="#F59E0B" spin /> Đang tải...</>
                  ) : (
                    <><IconRedo size={11} color={LC.text2} /> Phát lại</>
                  )}
                </span>
              </button>
            </div>

            {/* ── Đoạn văn với Inline Inputs ── */}
            <div style={{
              background: LC.surfaceQ,
              border: `1.5px solid ${LC.borderQ}`,
              borderRadius: 18,
              padding: '15px 17px',
              boxShadow: LC.cardShadow,
            }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: '#B07CF0', letterSpacing: 1.2, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <IconBook size={11} color="#B07CF0" />
                ĐOẠN VĂN
              </div>
              <div style={{ fontSize: 13.5, lineHeight: 2.1, color: LC.text2 }}>
                {renderPassage()}
              </div>
            </div>

            {/* ── Word Box ── */}
            {selected.wordBox.length > 0 && (
              <div style={{
                background: 'rgba(99,102,241,.06)',
                border: '1.5px solid rgba(99,102,241,.22)',
                borderRadius: 16,
                padding: '12px 14px',
              }}>
                <div style={{ fontSize: 10, fontWeight: 900, color: '#6366f1', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <IconBox size={11} color="#6366f1" />
                  WORD BOX
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {selected.wordBox.map((w, i) => (
                    <span key={i} style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: '#4338ca',
                      background: 'rgba(99,102,241,.12)',
                      borderRadius: 99,
                      padding: '5px 12px',
                    }}>{w}</span>
                  ))}
                </div>
              </div>
            )}

            {/* ── True/False/Not Mentioned ── */}
            {selected.statements.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {selected.statements.map((st, i) => {
                  const sel = stmtSel[i];
                  const ok = submitted && sel === st.answer;
                  const bad = submitted && sel !== st.answer && sel !== null;
                  return (
                    <div key={i} style={{
                      background: ok ? 'rgba(22,163,74,0.1)' : bad ? 'rgba(220,38,38,0.08)' : LC.surfaceQ,
                      border: '1.5px solid ' + (ok ? '#16a34a' : bad ? '#dc2626' : LC.borderQ),
                      borderRadius: 16,
                      padding: '13px 14px',
                      transition: 'border-color 0.2s, background 0.2s',
                    }}>
                      <div style={{ display: 'flex', gap: 9, marginBottom: 10 }}>
                        <span style={{
                          minWidth: 22,
                          height: 22,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 900,
                          background: 'rgba(176,124,240,0.18)',
                          color: '#B07CF0',
                          flexShrink: 0,
                        }}>{i + 1}</span>
                        <p style={{ margin: 0, color: LC.text2, lineHeight: 1.65, fontWeight: 600, fontSize: 13 }}>
                          {st.statement}
                        </p>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                        {['True', 'False', 'Not Mentioned'].map(key => {
                          const isSel = sel === key;
                          const ac = ANS_COLOR[key];
                          return (
                            <button key={key} disabled={submitted} onClick={() => setStmt(i, key)}
                              style={{
                                padding: '8px 0',
                                borderRadius: 11,
                                fontSize: 11.5,
                                fontWeight: 800,
                                cursor: submitted ? 'default' : 'pointer',
                                background: isSel ? ac.c : ac.bg,
                                color: isSel ? '#fff' : ac.c,
                                border: '1.5px solid ' + (isSel ? ac.c : ac.bd),
                                transition: 'transform 0.08s, background 0.15s, border-color 0.15s',
                              }}
                              onMouseDown={!submitted ? e => e.currentTarget.style.transform = 'scale(0.95)' : undefined}
                              onMouseUp={!submitted ? e => e.currentTarget.style.transform = 'scale(1)' : undefined}
                              onMouseLeave={!submitted ? e => e.currentTarget.style.transform = 'scale(1)' : undefined}
                            >
                              {ac.label}
                            </button>
                          );
                        })}
                      </div>
                      {submitted && bad && (
                        <div style={{ marginTop: 7, textAlign: 'right' }}>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: '#C084FC',
                            background: 'rgba(196,181,253,0.15)',
                            padding: '2px 9px',
                            borderRadius: 999,
                          }}>
                            Đáp án: {ANS_COLOR[st.answer].label}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Nút Nộp bài / Làm lại ── */}
            {!submitted ? (
              <button onClick={() => {
                setSubmitted(true);
                if (navigator.vibrate) navigator.vibrate(10);
              }}
                style={{
                  padding: '14px',
                  borderRadius: 999,
                  border: 'none',
                  background: 'linear-gradient(135deg,#F472B6,#A855F7)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(168,85,247,0.3)',
                  transition: 'transform 0.1s',
                }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconCheck size={13} color="#fff" />
                  Nộp bài
                </span>
              </button>
            ) : (
              <button onClick={() => {
                openItem(selected);
                if (navigator.vibrate) navigator.vibrate(5);
              }}
                style={{
                  padding: '14px',
                  borderRadius: 999,
                  border: `1.5px solid ${LC.navBtnBorder}`,
                  background: LC.navBtn,
                  color: LC.navBtnText,
                  fontSize: 14,
                  fontWeight: 900,
                  cursor: 'pointer',
                  transition: 'transform 0.1s',
                }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconRedo size={13} color={LC.navBtnText} />
                  Làm lại
                </span>
              </button>
            )}
          </div>
        </div>
      );
    }

    window.ListeningPractice = ListeningPractice;

  } catch (e) {
    console.error('[ListeningPractice] initialization error:', e);
  }
})();