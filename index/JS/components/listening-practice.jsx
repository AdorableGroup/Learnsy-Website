import React from 'react';

/* ══════════════════════════════════════════════════════════════════
   LISTENING-PRACTICE.JSX
   Trang luyện tập Listening độc lập cho học sinh — KHÔNG thuộc bài học nào.
   Đọc dữ liệu trực tiếp từ bảng Supabase: listening_items
   (cùng cấu trúc với bên admin: text + wordBox + answers + statements)

   Exports (window globals):
     window.ListeningPractice — Component: Trang luyện Listening

   Phụ thuộc:
     - React (window.React)
     - window.supa (Supabase client)
══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  try {
    const { useState, useEffect, useMemo } = React;

    const stripHTML = s => (s || '').replace(/<[^>]*>/g, '');
    const norm = s => (s || '').trim().toLowerCase();

    function ListeningPractice({ dark, onBack }) {
      const [items, setItems] = useState([]);
      const [loading, setLoading] = useState(true);
      const [loadError, setLoadError] = useState(false);

      const [selected, setSelected] = useState(null); // item đang luyện tập
      const [blanks, setBlanks] = useState([]);        // câu trả lời điền từ
      const [stmtSel, setStmtSel] = useState([]);      // lựa chọn True/False/NM
      const [submitted, setSubmitted] = useState(false);

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
              wordBox: r.word_box || [],
              answers: r.answers || [],              statements: r.statements || []
            })));
          }
          setLoading(false);
        });
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

      const openItem = (it) => {
        setSelected(it);
        setBlanks(it.answers.map(() => ''));
        setStmtSel(it.statements.map(() => null));
        setSubmitted(false);
      };

      const backToList = () => {
        setSelected(null);
        setSubmitted(false);
      };

      const speak = (raw) => {
        if (!raw || !raw.trim()) return;
        if (!window.speechSynthesis) return;
        try {
          window.speechSynthesis.cancel();
          const plain = stripHTML(raw).replace(/_{3,}/g, ' blank ').replace(/\s+/g, ' ').trim();
          const u = new SpeechSynthesisUtterance(plain);
          u.lang = 'en-US';
          window.speechSynthesis.speak(u);
        } catch (e) { }
      };

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

      const ANS_LABEL = { 'True': 'Đúng', 'False': 'Sai', 'Not Mentioned': 'NM' };
      const ANS_COLOR = { 'True': '#10B981', 'False': '#EF4444', 'Not Mentioned': '#818CF8' };

      /* ══════════ DANH SÁCH ══════════ */
      if (!selected) {
        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
            <div style={{
              padding: '11px 15px 10px', background: LC.surfaceQ,
              borderBottom: `1px solid ${LC.border}`,
              position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(20px)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {onBack ? (
                  <button onClick={onBack}
                    style={{
                      padding: '6px 14px', borderRadius: 999,
                      border: `1.5px solid ${LC.navBtnBorder}`,
                      background: LC.navBtn, color: LC.navBtnText,
                      fontSize: 12, fontWeight: 800, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 4
                    }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    Quay lại
                  </button>
                ) : <div style={{ width: 70 }} />}
                <div style={{ fontSize: 14, fontWeight: 900, color: LC.text }}>🎧 Listening</div>
                <div style={{ width: 70 }} />
              </div>
            </div>

            <div style={{ flex: 1, padding: '16px 14px 100px', display: 'flex', flexDirection: 'column', gap: 10 }} className="fade-up">
              {loadError && (                <div style={{
                  padding: '12px 14px', borderRadius: 14,
                  background: 'rgba(239,68,68,0.08)',
                  border: '1.5px solid rgba(239,68,68,0.25)',
                  color: '#EF4444', fontSize: 12.5, fontWeight: 700
                }}>
                  Không tải được danh sách Listening. Thử lại sau nhé!
                </div>
              )}
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: LC.textMid, fontSize: 13, fontWeight: 700 }}>
                  Đang tải...
                </div>
              ) : items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: LC.textMid, fontSize: 13, fontWeight: 700 }}>
                  Chưa có bài Listening nào. Quay lại sau nhé! 🎧
                </div>
              ) : items.map((it, idx) => (
                <button key={it.id} onClick={() => openItem(it)}
                  style={{
                    textAlign: 'left', padding: '14px 16px', borderRadius: 18,
                    border: `1.5px solid ${LC.borderQ}`,
                    background: LC.surfaceQ, boxShadow: LC.cardShadow, cursor: 'pointer'
                  }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: 'rgba(176,124,240,0.18)', color: '#B07CF0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 900, flexShrink: 0
                    }}>{idx + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13.5, fontWeight: 700, color: LC.text, lineHeight: 1.55,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                      }}>
                        {stripHTML(it.text)}
                      </div>
                      <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                        {it.answers.length > 0 && (
                          <span style={{
                            fontSize: 10, fontWeight: 800, color: '#10B981',
                            background: 'rgba(16,185,129,.1)',
                            border: '1px solid rgba(16,185,129,.3)',
                            borderRadius: 99, padding: '2px 7px'
                          }}>{it.answers.length} chỗ trống</span>
                        )}
                        {it.statements.length > 0 && (
                          <span style={{
                            fontSize: 10, fontWeight: 800, color: '#818CF8',                            background: 'rgba(129,140,248,.1)',
                            border: '1px solid rgba(129,140,248,.3)',
                            borderRadius: 99, padding: '2px 7px'
                          }}>{it.statements.length} câu T/F/NM</span>
                        )}
                      </div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={LC.textMid} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 6 }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      }

      /* ══════════ LUYỆN TẬP 1 CÂU ══════════ */
      const passageDisplay = stripHTML(selected.text).replace(/_{3,}/g, '▁▁▁▁');

      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
          <div style={{
            padding: '11px 15px 10px', background: LC.surfaceQ,
            borderBottom: `1px solid ${LC.border}`,
            position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(20px)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={backToList}
                style={{
                  padding: '6px 14px', borderRadius: 999,
                  border: `1.5px solid ${LC.navBtnBorder}`,
                  background: LC.navBtn, color: LC.navBtnText,
                  fontSize: 12, fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4
                }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Danh sách
              </button>
              <div style={{ fontSize: 13, fontWeight: 900, color: LC.text }}>🎧 Listening</div>
              {submitted ? (
                <div style={{
                  padding: '5px 13px', borderRadius: 999, fontSize: 12, fontWeight: 900,
                  color: '#fff', background: 'linear-gradient(135deg,#10B981,#34D399)'
                }}>{score.correct}/{score.total}</div>
              ) : <div style={{ width: 80 }} />}
            </div>          </div>

          <div style={{ flex: 1, padding: '16px 14px 100px', display: 'flex', flexDirection: 'column', gap: 13 }} className="fade-up">

            {/* Nút nghe */}
            <button onClick={() => speak(selected.text)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '14px', borderRadius: 18, border: 'none',
                background: 'linear-gradient(135deg,#10B981,#34D399)',
                color: '#fff', fontSize: 14, fontWeight: 900, cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(16,185,129,0.3)'
              }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <path d="M8 5v14l11-7z" />
              </svg>
              Nghe đoạn văn
            </button>

            {/* Đoạn văn (chỗ trống hiện ▁▁▁▁) */}
            <div style={{
              background: LC.surfaceQ, border: `1.5px solid ${LC.borderQ}`,
              borderRadius: 18, padding: '15px 17px', boxShadow: LC.cardShadow
            }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: '#B07CF0', letterSpacing: 1.2, marginBottom: 8 }}>
                ĐOẠN VĂN
              </div>
              <p style={{ fontStyle: 'italic', color: LC.text2, lineHeight: 1.75, margin: 0 }}>
                {passageDisplay}
              </p>
            </div>

            {/* Word Box */}
            {selected.wordBox.length > 0 && (
              <div style={{
                background: 'rgba(99,102,241,.06)',
                border: '1.5px solid rgba(99,102,241,.22)',
                borderRadius: 16, padding: '12px 14px'
              }}>
                <div style={{ fontSize: 10, fontWeight: 900, color: '#6366f1', letterSpacing: 1, marginBottom: 8 }}>
                  WORD BOX
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {selected.wordBox.map((w, i) => (
                    <span key={i} style={{
                      fontSize: 12.5, fontWeight: 700, color: '#4338ca',
                      background: 'rgba(99,102,241,.12)',
                      borderRadius: 99, padding: '5px 12px'
                    }}>{w}</span>
                  ))}                </div>
              </div>
            )}

            {/* Chỗ trống — điền theo thứ tự */}
            {selected.answers.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selected.answers.map((ans, i) => {
                  const ok = submitted && norm(blanks[i]) === norm(ans);
                  const bad = submitted && norm(blanks[i]) !== norm(ans);
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 900, color: '#B07CF0', minWidth: 22 }}>({i + 1})</span>
                        <input
                          value={blanks[i]}
                          disabled={submitted}
                          onChange={e => setBlank(i, e.target.value)}
                          placeholder={`Chỗ trống ${i + 1}`}
                          style={{
                            flex: 1, padding: '11px 14px', borderRadius: 14,
                            fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
                            color: ok ? '#10B981' : bad ? '#EF4444' : LC.inputColor,
                            background: ok ? 'rgba(16,185,129,0.1)' : bad ? 'rgba(239,68,68,0.08)' : LC.inputBg,
                            border: '1.5px solid ' + (ok ? '#10B981' : bad ? '#EF4444' : LC.inputBorder),
                            outline: 'none'
                          }}
                        />
                      </div>
                      {bad && (
                        <div style={{ marginTop: 4, marginLeft: 30, fontSize: 11.5, fontWeight: 800, color: '#FCA5A5' }}>
                          Đáp án đúng: {ans}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* True/False/Not Mentioned */}
            {selected.statements.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {selected.statements.map((st, i) => {
                  const sel = stmtSel[i];
                  const ok = submitted && sel === st.answer;
                  const bad = submitted && sel !== st.answer;
                  return (
                    <div key={i} style={{
                      background: ok ? 'rgba(16,185,129,0.1)' : bad ? 'rgba(239,68,68,0.08)' : LC.surfaceQ,                      border: '1.5px solid ' + (ok ? '#10B981' : bad ? '#EF4444' : LC.borderQ),
                      borderRadius: 16, padding: '13px 14px'
                    }}>
                      <div style={{ display: 'flex', gap: 9, marginBottom: 10 }}>
                        <span style={{
                          minWidth: 22, height: 22, borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 900,
                          background: 'rgba(176,124,240,0.18)', color: '#B07CF0', flexShrink: 0
                        }}>{i + 1}</span>
                        <p style={{ margin: 0, color: LC.text2, lineHeight: 1.65, fontWeight: 600, fontSize: 13 }}>
                          {st.statement}
                        </p>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                        {['True', 'False', 'Not Mentioned'].map(key => {
                          const isSel = sel === key;
                          const col = ANS_COLOR[key];
                          return (
                            <button key={key} disabled={submitted} onClick={() => setStmt(i, key)}
                              style={{
                                padding: '8px 0', borderRadius: 11,
                                fontSize: 11.5, fontWeight: 800,
                                cursor: submitted ? 'default' : 'pointer',
                                background: isSel ? col + '2a' : 'transparent',
                                color: isSel ? col : LC.textMid,
                                border: '1.5px solid ' + (isSel ? col : LC.borderQ)
                              }}>
                              {ANS_LABEL[key]}
                            </button>
                          );
                        })}
                      </div>
                      {bad && (
                        <div style={{ marginTop: 7, textAlign: 'right' }}>
                          <span style={{
                            fontSize: 11, fontWeight: 800, color: '#C084FC',
                            background: 'rgba(196,181,253,0.15)',
                            padding: '2px 9px', borderRadius: 999
                          }}>
                            Đáp án: {ANS_LABEL[st.answer]}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {/* Nộp / Làm lại */}
            {!submitted ? (
              <button onClick={() => setSubmitted(true)}
                style={{
                  padding: '14px', borderRadius: 999, border: 'none',
                  background: 'linear-gradient(135deg,#F472B6,#A855F7)',
                  color: '#fff', fontSize: 14, fontWeight: 900, cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(168,85,247,0.3)'
                }}>
                Nộp bài
              </button>
            ) : (
              <button onClick={() => openItem(selected)}
                style={{
                  padding: '14px', borderRadius: 999,
                  border: `1.5px solid ${LC.navBtnBorder}`,
                  background: LC.navBtn, color: LC.navBtnText,
                  fontSize: 14, fontWeight: 900, cursor: 'pointer'
                }}>
                Làm lại
              </button>
            )}
          </div>
        </div>
      );
    }

    /* ══ EXPORT GLOBALS ══ */
    window.ListeningPractice = ListeningPractice;
    console.log('[listening-practice] ✓ loaded');
  } catch (e) {
    console.error('[listening-practice] INIT ERROR:', e);
  }
})();