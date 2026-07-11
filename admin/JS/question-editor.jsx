import React from 'react';

/* ══ QUESTION EDITOR ══════════════════════════════════════════════════ */
(function(){
const {useState, useEffect} = React;

function QEditor({q, qi, onUp, onUpItem, onAddItem, onRemItem, onUpOpt, onAddOpt, onRemOpt, onRemove, canRemove, autoAI, onAIAnswer, dark}){
  const [open, setOpen] = useState(true);
  const [cardBlur, setCardBlur] = useState(() => {
    try { return localStorage.getItem('learnsy_card_blur') || 'off'; }
    catch { return 'off'; }
  });

  useEffect(() => {
    const handler = (e) => { if (e.detail?.value) setCardBlur(e.detail.value); };
    window.addEventListener('learnsy:card-blur', handler);
    return () => window.removeEventListener('learnsy:card-blur', handler);
  }, []);

  const blurStyle = cardBlur === 'off' ? {} : {
    backdropFilter: `blur(${cardBlur === '85' ? '22px' : '10px'})`,
    WebkitBackdropFilter: `blur(${cardBlur === '85' ? '22px' : '10px'})`,
    background: cardBlur === '85'
      ? (dark ? 'rgba(30,13,21,0.55)' : 'rgba(255,255,255,0.5)')
      : (dark ? 'rgba(30,13,21,0.75)' : 'rgba(255,255,255,0.72)'),
  };

  const C = window.C;
  const {LETTERS, stripHTML} = window;
  const {Inp, RichInp, MiniRichInp, Fld} = window;
  const info = window.getTypes()[q.type] || window.getTypes().true_false;
  const accentColor = info.color;

  return (
    <div className="fade-up" style={{background: C.surface, ...blurStyle, border:`1.5px solid ${C.border}`, borderRadius: 18, overflow:'hidden', boxShadow:'0 3px 16px rgba(255,100,150,0.06)', borderTop:`3px solid ${accentColor}`}}>
      {/* Header row */}
      <div onClick={() => setOpen(p => !p)}
        style={{display:'flex', alignItems:'center', gap:9, padding:'11px 13px', cursor:'pointer', background: open ? C.surface : C.bg, transition:'background .16s'}}>
        <div style={{width:26, height:26, borderRadius:9, flexShrink:0, background:'linear-gradient(135deg,#F472B6,#A855F7)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:900, color:'#fff', boxShadow:'0 2px 8px rgba(168,85,247,0.25)'}}>
          {qi + 1}
        </div>
        {/* Loại câu hỏi — gộp icon + nhãn vào 1 pill duy nhất thay vì 2 khối rời */}
        <div style={{display:'flex', alignItems:'center', gap:4, flexShrink:0, padding:'3px 8px 3px 4px', borderRadius:999, background: info.bg, border:`1px solid ${info.border}`}}>
          <span style={{width:15, height:15, display:'flex', alignItems:'center', justifyContent:'center', color: info.color}}>{info.icon}</span>
          <span style={{fontSize:10, fontWeight:900, color: info.color}}>{info.short}</span>
        </div>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:12, fontWeight:700, color: C.text2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
            {q.type === 'true_false' ? (stripHTML(q.passage).slice(0, 52) || '(Chưa nhập đoạn tư liệu...') : (stripHTML(q.question || '').slice(0, 52) || '(Chưa nhập câu hỏi...)')}
          </div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:5, flexShrink:0}}>
          {autoAI && (
            <button onClick={e => { e.stopPropagation(); onAIAnswer?.(); }}
              title="AI tự điền đáp án đúng"
              style={{height:26, padding:'0 9px', borderRadius:999, border:'none',
                background:'linear-gradient(135deg,#6EE7B7,#10B981)', color:'#fff',
                fontSize:11, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', gap:3, flexShrink:0,
                boxShadow:'0 2px 8px rgba(16,185,129,0.3)'}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/></svg>
              AI
            </button>
          )}
          {canRemove && (
            <button onClick={e => { e.stopPropagation(); onRemove(); }}
              title="Xoá câu hỏi"
              style={{width:26, height:26, borderRadius:999, border:`1.5px solid #FECDD3`, background: C.rosePale, color:'#EF4444', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
          <div style={{width:22, height:22, borderRadius:999, background: open ? C.lavL : 'transparent', color: open ? C.lav : C.text4, display:'flex', alignItems:'center', justifyContent:'center', transition:'all .2s', flexShrink:0}}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{transition:'transform .2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)'}}><path d="M5 7l5 5 5-5"/></svg>
          </div>
        </div>
      </div>

      {/* Body */}
      {open && (
        <div style={{padding:'11px 13px 14px', borderTop:`1px solid ${C.border}`}}>
          {q.type === 'true_false' && (<>
            <Fld label="Đoạn tư liệu" icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.lav} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>}>
              <RichInp value={q.passage} onChange={e => onUp('passage', e.target.value)} placeholder="Nhập đoạn trích tư liệu lịch sử..."/>
            </Fld>
            <Fld label="Nguồn (tùy chọn)" icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.lav2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>}>
              <Inp value={q.source || ''} onChange={e => onUp('source', e.target.value)} placeholder="(NXB, năm, trang...)"/>
            </Fld>
            <Fld label="Các ý — bấm ✓ ✗ để đặt đáp án" icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.rose} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>}>
              <div style={{display:'flex', flexDirection:'column', gap:7}}>
                {q.items.map((it, ii) => (
                  <div key={ii} style={{display:'flex', gap:6, alignItems:'flex-start'}}>
                    <span style={{width:22, height:22, borderRadius:7, flexShrink:0, marginTop:9, background: C.lavL, color: C.lav, fontSize:11, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', border:`1px solid ${C.border2}`}}>
                      {String.fromCharCode(97 + ii)}
                    </span>
                    <MiniRichInp value={it.text} onChange={e => onUpItem(ii, 'text', e.target.value)} placeholder={`Ý ${String.fromCharCode(97 + ii)}...`}/>
                    <div style={{display:'flex', gap:4, flexShrink:0, marginTop:4}}>
                      <button onClick={() => onUpItem(ii, 'answer', true)} title="Đúng" style={{width:34, height:34, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all .15s', background: it.answer ? '#10B981' : C.mintL, color: it.answer ? '#fff' : C.mint, border:`1.5px solid ${it.answer ? 'transparent' : '#BBF7D0'}`, boxShadow: it.answer ? '0 2px 8px rgba(16,185,129,0.3)' : 'none'}}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </button>
                      <button onClick={() => onUpItem(ii, 'answer', false)} title="Sai" style={{width:34, height:34, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all .15s', background: !it.answer ? '#EF4444' : C.rosePale, color: !it.answer ? '#fff' : '#EF4444', border:`1.5px solid ${!it.answer ? 'transparent' : '#FECDD3'}`, boxShadow: !it.answer ? '0 2px 8px rgba(239,68,68,0.3)' : 'none'}}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                      {q.items.length > 2 && <button onClick={() => onRemItem(ii)} title="Xoá ý" style={{width:30, height:34, borderRadius:9, border:`1.5px solid ${C.border}`, background: C.bg, color: C.text4, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center'}}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </button>}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={onAddItem} style={{marginTop:8, display:'flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:999, border:`1.5px dashed ${C.lav2}`, background: C.lavL, color: C.lav, fontSize:12, fontWeight:800, cursor:'pointer'}}>
                <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path d="M11 9h4v2h-4v4H9v-4H5V9h4V5h2v4z"/></svg>
                Thêm ý
              </button>
            </Fld>
          </>)}

          {(q.type === 'multiple' || q.type === 'multi_select') && (<>
            <Fld label="Câu hỏi" icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.rose} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}>
              <RichInp value={q.question || ''} onChange={e => onUp('question', e.target.value)} placeholder="Nhập nội dung câu hỏi..."/>
            </Fld>
            <Fld label={q.type === 'multiple' ? 'Lựa chọn — bấm chữ cái để chọn đáp án đúng' : 'Lựa chọn — bấm để chọn nhiều đáp án đúng'}
              icon={q.type === 'multiple'
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.rose} strokeWidth="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5" fill={C.rose} stroke="none"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.rose} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><polyline points="8 12 11 15 16 9"/></svg>}>
              <div style={{display:'flex', flexDirection:'column', gap:7}}>
                {q.options.map((opt, i) => {
                  const isCor = q.type === 'multiple' ? q.correct === i : (q.correct || []).includes(i);
                  const togCor = () => {
                    if (q.type === 'multiple') {
                      onUp('correct', i);
                    } else {
                      const c = q.correct || [];
                      onUp('correct', c.includes(i) ? c.filter(x => x !== i) : [...c, i]);
                    }
                  };
                  return (
                    <div key={i} style={{display:'flex', gap:7, alignItems:'center'}}>
                      <button onClick={togCor} style={{width:30, height:30, borderRadius: q.type === 'multiple' ? '50%' : 9, flexShrink:0, border:'none', cursor:'pointer', fontSize:12, fontWeight:900, transition:'all .15s', background: isCor ? '#10B981' : C.lavL, color: isCor ? '#fff' : C.lav, boxShadow: isCor ? '0 2px 8px rgba(16,185,129,0.3)' : 'none'}}>
                        {LETTERS[i]}
                      </button>
                      <MiniRichInp value={opt} onChange={e => onUpOpt(i, e.target.value)} placeholder={`Lựa chọn ${LETTERS[i]}...`}/>
                      {q.options.length > 2 && <button onClick={() => onRemOpt(i)} title="Xoá lựa chọn" style={{width:26, height:26, borderRadius:8, border:`1.5px solid ${C.border}`, background: C.bg, color: C.text4, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>}
                    </div>
                  );
                })}
              </div>
              {q.options.length < 6 && <button onClick={onAddOpt} style={{marginTop:8, display:'flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:999, border:`1.5px dashed ${C.lav2}`, background: C.lavL, color: C.lav, fontSize:12, fontWeight:800, cursor:'pointer'}}>
                <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path d="M11 9h4v2h-4v4H9v-4H5V9h4V5h2v4z"/></svg>
                Thêm lựa chọn
              </button>}
            </Fld>
          </>)}

          {q.type === 'fill_blank' && (<>
            <Fld label="Câu hỏi (dùng ___ cho chỗ trống)" icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.peach} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}>
              <RichInp value={q.question || ''} onChange={e => onUp('question', e.target.value)} placeholder='Ví dụ: Ngô Quyền đánh tan quân ___ năm 938.'/>
            </Fld>
            <Fld label="Đáp án đúng" icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.mint} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}>
              <Inp value={q.answer || ''} onChange={e => onUp('answer', e.target.value)} placeholder="Nhập đáp án chính xác..."/>
            </Fld>
            <Fld label="Gợi ý (tùy chọn)" icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>}>
              <Inp value={q.hint || ''} onChange={e => onUp('hint', e.target.value)} placeholder="Gợi ý dành cho học sinh..."/>
            </Fld>
          </>)}
        </div>
      )}
    </div>
  );
}

window.QEditor = QEditor;
console.log('[question-editor] ✓ loaded');
})();