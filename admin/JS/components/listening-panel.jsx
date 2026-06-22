import React, {useState,useEffect,useCallback} from 'react';

// ══════════════════════════════════════════════════════════════════════
//  LISTENING MANAGER — trang độc lập, KHÔNG thuộc về bài học nào
//  Hiện ở tab riêng "Listening" cạnh "Bài học" / "Học sinh" trên trang chủ.
//  Dữ liệu lưu trong bảng Supabase riêng: listening_items
//  (không liên quan tới bảng lessons / mảng questions)
//
//  Cấu trúc 1 câu Listening (1 row trong bảng listening_items):
//    { id, text:'',          // đoạn văn để đọc — dùng ___ để đánh dấu chỗ trống
//      word_box:[],          // Word Box — các từ cho học sinh chọn
//      answers:[],           // đáp án đúng theo thứ tự (1),(2),(3)...
//      statements:[],        // [{statement, answer:'True'|'False'|'Not Mentioned'}]
//      created_at }
//
//  SQL gợi ý để tạo bảng trên Supabase:
//    create table listening_items (
//      id text primary key,
//      text text,
//      word_box jsonb default '[]',
//      answers jsonb default '[]',
//      statements jsonb default '[]',
//      created_at timestamptz default now()
//    );
//
//  Props nhận từ app.js:
//    dark, C            — theme
//    confirm_, toast_   — dùng chung toàn app
//
//  Load bằng: <script> qua loadModule, TRƯỚC admin/JS/app.js
// ══════════════════════════════════════════════════════════════════════
(function(){
  const stripHTML = s => (s||'').replace(/<[^>]*>/g,'');
  const ANS_COLORS = {
    'True':{c:'#16a34a',bg:'rgba(22,163,74,.1)',bd:'rgba(22,163,74,.35)',label:'Đúng'},
    'False':{c:'#dc2626',bg:'rgba(220,38,38,.08)',bd:'rgba(220,38,38,.32)',label:'Sai'},
    'Not Mentioned':{c:'#6366f1',bg:'rgba(99,102,241,.08)',bd:'rgba(99,102,241,.32)',label:'NM'},
  };

  // map DB row (snake_case) <-> UI item (camelCase)
  const fromRow = r => ({id:r.id, text:r.text||'', wordBox:r.word_box||[], answers:r.answers||[], statements:r.statements||[], created_at:r.created_at});
  const toRow = (it) => ({id:it.id, text:it.text, word_box:it.wordBox, answers:it.answers, statements:it.statements});

  function ListeningManager({dark, C, confirm_, toast_}){
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);

    const [editingId, setEditingId] = useState(null);
    const [text, setText] = useState('');
    const [wordBox, setWordBox] = useState([]);
    const [wbInput, setWbInput] = useState('');
    const [answers, setAnswers] = useState([]);
    const [statements, setStatements] = useState([]);
    const [saving, setSaving] = useState(false);

    useEffect(()=>{
      const supa = window.supa;
      if(!supa){ setLoading(false); setLoadError(true); return; }
      supa.from('listening_items').select('*').order('created_at').then(({data,error})=>{
        if(error){ console.error('Listening load error:',error); setLoadError(true); }
        else setItems((data||[]).map(fromRow));
        setLoading(false);
      });
    },[]);

    const resetForm = () => {
      setEditingId(null); setText(''); setWordBox([]); setWbInput(''); setAnswers([]); setStatements([]);
    };

    const startEdit = (it) => {
      setEditingId(it.id);
      setText(it.text || '');
      setWordBox(Array.isArray(it.wordBox) ? [...it.wordBox] : []);
      setWbInput('');
      setAnswers(Array.isArray(it.answers) ? [...it.answers] : []);
      setStatements(Array.isArray(it.statements) ? it.statements.map(s=>({...s})) : []);
    };

    // ── Word Box ──
    const addWord = () => {
      const w = wbInput.trim();
      if(!w) return;
      setWordBox(p=>[...p,w]);
      setWbInput('');
    };
    const removeWord = (i) => setWordBox(p=>p.filter((_,idx)=>idx!==i));

    // ── Đáp án theo thứ tự chỗ trống ──
    const addAnswer = () => setAnswers(p=>[...p,'']);
    const updateAnswer = (i,v) => setAnswers(p=>p.map((a,idx)=>idx===i?v:a));
    const removeAnswer = (i) => setAnswers(p=>p.filter((_,idx)=>idx!==i));

    // ── True / False / Not Mentioned ──
    const addStatement = () => setStatements(p=>[...p,{statement:'',answer:'True'}]);
    const updateStatement = (i,field,v) => setStatements(p=>p.map((s,idx)=>idx===i?{...s,[field]:v}:s));
    const removeStatement = (i) => setStatements(p=>p.filter((_,idx)=>idx!==i));

    const save = useCallback(async () => {
      if(!text.trim()){ toast_ && toast_('! Nhập đoạn văn để đọc trước!'); return; }
      const supa = window.supa;
      if(!supa){ toast_ && toast_('x Chưa kết nối Supabase!'); return; }
      const cleanWordBox = wordBox.filter(w=>w.trim());
      const cleanAnswers = answers.filter(a=>a.trim());
      const cleanStatements = statements.filter(s=>s.statement && s.statement.trim());
      setSaving(true);
      try{
        if(editingId){
          const payload = {text, wordBox:cleanWordBox, answers:cleanAnswers, statements:cleanStatements};
          const {error} = await supa.from('listening_items').update(toRow({id:editingId, ...payload})).eq('id',editingId);
          if(error) throw error;
          setItems(p => p.map(it => it.id === editingId ? {...it, ...payload} : it));
          toast_ && toast_('+ Đã cập nhật câu Listening!');
        } else {
          const newItem = {id:'ls'+Date.now()+Math.random(), text, wordBox:cleanWordBox, answers:cleanAnswers, statements:cleanStatements};
          const {error} = await supa.from('listening_items').insert(toRow(newItem));
          if(error) throw error;
          setItems(p => [...p, newItem]);
          toast_ && toast_('+ Đã thêm câu Listening!');
        }
        resetForm();
      }catch(e){
        console.error('Listening save error:',e);
        toast_ && toast_('x Lưu thất bại: '+(e.message||''),5000);
      }finally{
        setSaving(false);
      }
    },[text,wordBox,answers,statements,editingId,toast_]);

    const remove = useCallback(async (id) => {
      const supa = window.supa;
      if(supa){
        const {error} = await supa.from('listening_items').delete().eq('id',id);
        if(error){ toast_ && toast_('x Xoá thất bại: '+error.message,5000); return; }
      }
      setItems(p => p.filter(it => it.id !== id));
      if(editingId === id) resetForm();
      toast_ && toast_('Đã xoá câu Listening');
    },[editingId,toast_]);

    const askRemove = (it) => {
      const _t = stripHTML(it.text) || 'câu này';
      if(confirm_){
        confirm_({
          iconType:'delete', title:'Xoá câu Listening?',
          message:'<b>'+_t.slice(0,60)+'</b><br/><span style="color:#A07090">Sẽ bị xoá vĩnh viễn.</span>',
          confirmLabel:'Xoá', confirmColor:'#EF4444',
          onConfirm:()=>remove(it.id),
        });
      } else remove(it.id);
    };

    const previewTTS = (raw) => {
      if(!raw || !raw.trim()) return;
      if(!window.speechSynthesis){ toast_ && toast_('! Trình duyệt không hỗ trợ đọc văn bản'); return; }
      try{
        window.speechSynthesis.cancel();
        const plain = stripHTML(raw).replace(/_{3,}/g,' blank ').replace(/\s+/g,' ').trim();
        const u = new SpeechSynthesisUtterance(plain);
        u.lang = 'en-US';
        window.speechSynthesis.speak(u);
      }catch(e){}
    };

    const inputStyle = {width:'100%',padding:'9px 11px',borderRadius:10,border:`1.5px solid ${C.border2}`,background:dark?'#180A10':'#fff',color:C.text,fontSize:13,fontFamily:'inherit',outline:'none'};

    return(
      <div style={{padding:'16px 12px 100px',display:'flex',flexDirection:'column',gap:14}} className="fade-up">
        {/* Header trang */}
        <div style={{display:'flex',alignItems:'center',gap:10,paddingBottom:12,borderBottom:`2px solid ${C.border}`}}>
          <div style={{width:38,height:38,borderRadius:11,background:C.lavL,border:`1.5px solid ${C.border2}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.lav} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/></svg>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:18,fontWeight:900,color:C.text,lineHeight:1.2}}>Listening</div>
            <div style={{fontSize:12,color:C.text3,marginTop:2}}>{items.length} câu · Đoạn văn + Điền từ + True/False/NM</div>
          </div>
        </div>

        {loadError && (
          <div style={{padding:'10px 14px',borderRadius:12,background:'rgba(220,38,38,.08)',border:'1.5px solid rgba(220,38,38,.25)',color:'#dc2626',fontSize:12.5,fontWeight:700}}>
            Không tải được dữ liệu Listening — kiểm tra bảng <code>listening_items</code> đã tạo trên Supabase chưa.
          </div>
        )}

        {loading ? (
          <div style={{textAlign:'center',padding:'30px 10px',color:C.text3,fontSize:13,fontWeight:700}}>Đang tải...</div>
        ) : items.length === 0 ? (
          <div style={{textAlign:'center',padding:'24px 10px',color:C.text3,fontSize:12.5,fontWeight:700}}>
            Chưa có câu Listening nào. Thêm câu đầu tiên bên dưới 👇
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {items.map((it,idx)=>(
              <div key={it.id} style={{padding:'10px 12px',borderRadius:14,border:`1.5px solid ${editingId===it.id?C.lav:C.border}`,background:editingId===it.id?C.lavPale:C.bg2}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:8}}>
                  <span style={{fontSize:10,fontWeight:900,color:C.lav,background:C.lavL,borderRadius:999,padding:'2px 7px',flexShrink:0,marginTop:1}}>#{idx+1}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12.5,fontWeight:700,color:dark?'#F0DCE8':'#3D1830',lineHeight:1.5,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
                      {stripHTML(it.text) || <span style={{color:C.text4,fontStyle:'italic'}}>(chưa có văn bản)</span>}
                    </div>
                    <div style={{display:'flex',gap:5,marginTop:5,flexWrap:'wrap'}}>
                      {(it.answers||[]).length>0 && (
                        <span style={{fontSize:10,fontWeight:800,color:'#059669',background:'rgba(16,185,129,.1)',border:'1px solid rgba(16,185,129,.3)',borderRadius:99,padding:'2px 7px'}}>
                          {it.answers.length} chỗ trống
                        </span>
                      )}
                      {(it.wordBox||[]).length>0 && (
                        <span style={{fontSize:10,fontWeight:800,color:'#4338ca',background:'rgba(99,102,241,.1)',border:'1px solid rgba(99,102,241,.3)',borderRadius:99,padding:'2px 7px'}}>
                          Word Box: {it.wordBox.length}
                        </span>
                      )}
                      {(it.statements||[]).length>0 && (
                        <span style={{fontSize:10,fontWeight:800,color:'#dc2626',background:'rgba(220,38,38,.08)',border:'1px solid rgba(220,38,38,.28)',borderRadius:99,padding:'2px 7px'}}>
                          {it.statements.length} nhận định T/F/NM
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:5,flexShrink:0}}>
                    <button title="Nghe thử" onClick={()=>previewTTS(it.text)}
                      style={{width:26,height:26,borderRadius:8,border:`1.5px solid ${C.border2}`,background:C.mintL,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill={C.mint} stroke="none"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                    <button title="Sửa" onClick={()=>startEdit(it)}
                      style={{width:26,height:26,borderRadius:8,border:`1.5px solid ${C.border2}`,background:C.lavL,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.lav} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z"/></svg>
                    </button>
                    <button title="Xoá" onClick={()=>askRemove(it)}
                      style={{width:26,height:26,borderRadius:8,border:'1.5px solid #FECDD3',background:C.rosePale,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Form thêm/sửa */}
        <div style={{padding:'12px 14px',borderRadius:16,border:`1.5px dashed ${C.border2}`,background:C.lavPale}}>
          <div style={{fontSize:12,fontWeight:900,color:C.lav,marginBottom:8}}>
            {editingId ? '✏️ Sửa câu Listening' : '➕ Thêm câu Listening mới'}
          </div>

          {/* Đoạn văn */}
          <div style={{marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:800,color:C.text3,marginBottom:5}}>
              Đoạn văn để đọc <span style={{fontWeight:600,color:C.text4}}>(dùng <code>___</code> cho chỗ trống)</span>
            </div>
            <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="VD: Trang An is famous ___ its beautiful landscape." rows={4} style={{...inputStyle,resize:'vertical'}}/>
          </div>

          {/* Word Box */}
          <div style={{marginBottom:10,padding:'10px 12px',borderRadius:12,border:`1.5px solid ${C.border2}`,background:dark?'#180A10':'#FAFAFE'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <span style={{fontSize:11,fontWeight:800,color:'#4338ca'}}>Word Box — từ cho học sinh chọn</span>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:wordBox.length?8:0}}>
              {wordBox.map((w,i)=>(
                <span key={i} style={{display:'flex',alignItems:'center',gap:5,fontSize:12,fontWeight:700,color:'#4338ca',background:'rgba(99,102,241,.12)',borderRadius:99,padding:'4px 6px 4px 10px'}}>
                  {w}
                  <button onClick={()=>removeWord(i)} style={{width:16,height:16,borderRadius:99,border:'none',background:'rgba(99,102,241,.25)',color:'#4338ca',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,lineHeight:1,padding:0}}>×</button>
                </span>
              ))}
            </div>
            <div style={{display:'flex',gap:6}}>
              <input value={wbInput} onChange={e=>setWbInput(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addWord();}}}
                placeholder="Nhập từ rồi Enter..." style={{...inputStyle,flex:1}}/>
              <button onClick={addWord} style={{padding:'0 14px',borderRadius:10,border:'1.5px solid rgba(99,102,241,.35)',background:'rgba(99,102,241,.1)',color:'#4338ca',fontSize:12,fontWeight:800,cursor:'pointer'}}>+ Thêm</button>
            </div>
          </div>

          {/* Đáp án theo thứ tự chỗ trống */}
          <div style={{marginBottom:10,padding:'10px 12px',borderRadius:12,border:'1.5px solid rgba(16,185,129,.25)',background:'rgba(16,185,129,.05)'}}>
            <div style={{fontSize:11,fontWeight:800,color:'#059669',marginBottom:8}}>Đáp án đúng theo thứ tự (1),(2),(3)...</div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {answers.map((a,i)=>(
                <div key={i} style={{display:'flex',gap:6,alignItems:'center'}}>
                  <span style={{fontSize:11,fontWeight:900,color:'#059669',minWidth:20}}>({i+1})</span>
                  <input value={a} onChange={e=>updateAnswer(i,e.target.value)} placeholder={`Đáp án ${i+1}`} style={{...inputStyle,flex:1}}/>
                  <button onClick={()=>removeAnswer(i)} title="Xoá" style={{width:26,height:26,flexShrink:0,borderRadius:8,border:'1.5px solid rgba(220,38,38,.25)',background:'rgba(220,38,38,.08)',color:'#dc2626',cursor:'pointer'}}>−</button>
                </div>
              ))}
            </div>
            <button onClick={addAnswer} style={{marginTop:8,padding:'5px 11px',borderRadius:8,border:'1.5px solid rgba(16,185,129,.35)',background:'rgba(16,185,129,.1)',color:'#059669',fontSize:11,fontWeight:800,cursor:'pointer'}}>+ Thêm chỗ trống</button>
          </div>

          {/* True / False / Not Mentioned */}
          <div style={{marginBottom:10,padding:'10px 12px',borderRadius:12,border:'1.5px solid rgba(220,38,38,.2)',background:'rgba(220,38,38,.04)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <span style={{fontSize:11,fontWeight:800,color:'#dc2626'}}>True / False / Not Mentioned <span style={{fontWeight:600,color:C.text4}}>(tuỳ chọn)</span></span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:7}}>
              {statements.map((s,i)=>(
                <div key={i} style={{padding:'8px 10px',borderRadius:10,background:dark?'rgba(255,255,255,.04)':'rgba(255,255,255,.6)',border:'1px solid rgba(220,38,38,.15)'}}>
                  <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:7}}>
                    <span style={{fontSize:11,fontWeight:900,color:'#dc2626',minWidth:16}}>{i+1}.</span>
                    <input value={s.statement} onChange={e=>updateStatement(i,'statement',e.target.value)} placeholder={`Nhận định ${i+1}`} style={{...inputStyle,flex:1}}/>
                    <button onClick={()=>removeStatement(i)} title="Xoá" style={{width:26,height:26,flexShrink:0,borderRadius:8,border:'1.5px solid rgba(220,38,38,.25)',background:'rgba(220,38,38,.08)',color:'#dc2626',cursor:'pointer'}}>−</button>
                  </div>
                  <div style={{display:'flex',gap:6}}>
                    {Object.keys(ANS_COLORS).map(key=>{
                      const ac=ANS_COLORS[key]; const sel=s.answer===key;
                      return(
                        <button key={key} onClick={()=>updateStatement(i,'answer',key)}
                          style={{flex:1,padding:'5px 0',borderRadius:8,border:`1.5px solid ${sel?ac.c:ac.bd}`,background:sel?ac.c:ac.bg,color:sel?'#fff':ac.c,fontSize:11,fontWeight:800,cursor:'pointer'}}>
                          {ac.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addStatement} style={{marginTop:8,padding:'5px 11px',borderRadius:8,border:'1.5px solid rgba(220,38,38,.3)',background:'rgba(220,38,38,.08)',color:'#dc2626',fontSize:11,fontWeight:800,cursor:'pointer'}}>+ Thêm nhận định</button>
          </div>

          <div style={{display:'flex',gap:8,marginTop:6}}>
            {editingId && (
              <button onClick={resetForm}
                style={{flex:1,padding:'9px',borderRadius:999,border:`1.5px solid ${C.border}`,background:'transparent',color:C.text3,fontSize:12.5,fontWeight:800,cursor:'pointer'}}>
                Hủy sửa
              </button>
            )}
            <button onClick={()=>previewTTS(text)}
              style={{padding:'9px 12px',borderRadius:999,border:`1.5px solid ${C.border2}`,background:C.mintL,color:C.mint,fontSize:12.5,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5v14l11-7z"/></svg>
              Nghe thử
            </button>
            <button onClick={save} disabled={saving}
              style={{flex:1,padding:'9px',borderRadius:999,border:'none',background:C.grad,color:'#fff',fontSize:12.5,fontWeight:900,cursor:saving?'default':'pointer',opacity:saving?0.7:1,boxShadow:'0 4px 14px rgba(168,85,247,0.3)'}}>
              {saving ? 'Đang lưu...' : (editingId ? 'Lưu thay đổi' : 'Thêm câu')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  window.ListeningManager = ListeningManager;
})();
