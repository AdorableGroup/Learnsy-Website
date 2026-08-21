import React, {useState,useEffect,useCallback,useMemo,useRef} from 'react';

// ══════════════════════════════════════════════════════════════════════
//  VOCABULARY MANAGER — trang độc lập, quản lý Khóa học > Unit > Từ vựng
//  Hiện ở tab riêng "Từ vựng" cạnh "Bài học" / "Listening" / "Tài liệu" / "Học sinh".
//  Dữ liệu lưu trong Supabase: vocab_courses, vocab_units, vocab_words
//
//  Cấu trúc:
//    vocab_courses  { id, title, description, sort_order, created_at }
//    vocab_units    { id, course_id, title, level, sort_order, created_at }
//    vocab_words    { id, unit_id, word, pos, ipa, meaning, example, sort_order, created_at }
//
//  SQL gợi ý:
//    create table vocab_courses(
//      id uuid default gen_random_uuid() primary key,
//      title text not null, description text default '',
//      sort_order integer default 0, created_at timestamptz default now()
//    );
//    create table vocab_units(
//      id uuid default gen_random_uuid() primary key,
//      course_id uuid references vocab_courses(id) on delete cascade,
//      title text not null, level text default '',
//      sort_order integer default 0, created_at timestamptz default now()
//    );
//    create table vocab_words(
//      id uuid default gen_random_uuid() primary key,
//      unit_id uuid references vocab_units(id) on delete cascade,
//      word text not null, pos text default 'noun', ipa text default '',
//      meaning text default '', example text default '',
//      sort_order integer default 0, created_at timestamptz default now()
//    );
//    alter table vocab_courses enable row level security;
//    alter table vocab_units enable row level security;
//    alter table vocab_words enable row level security;
//    create policy "public_read" on vocab_courses for select to anon, authenticated using (true);
//    create policy "admin_write" on vocab_courses for all to authenticated using (true) with check (true);
//    -- lặp lại 2 policy trên cho vocab_units và vocab_words
//
//  Props nhận từ app.jsx:
//    dark, C            — theme
//    confirm_, toast_   — dùng chung toàn app
// ══════════════════════════════════════════════════════════════════════
(function(){

  const POS_OPTIONS = [
    { value:'noun', label:'Danh từ', short:'n.' },
    { value:'verb', label:'Động từ', short:'v.' },
    { value:'adjective', label:'Tính từ', short:'adj.' },
    { value:'adverb', label:'Trạng từ', short:'adv.' },
    { value:'pronoun', label:'Đại từ', short:'pron.' },
    { value:'preposition', label:'Giới từ', short:'prep.' },
    { value:'conjunction', label:'Liên từ', short:'conj.' },
    { value:'interjection', label:'Thán từ', short:'interj.' },
  ];
  const POS_COLORS = {
    noun:'#3b82f6', verb:'#ef4444', adjective:'#f59e0b', adverb:'#10b981',
    pronoun:'#a855f7', preposition:'#06b6d4', conjunction:'#f97316', interjection:'#ec4899',
  };
  const posLabel = p => POS_OPTIONS.find(o=>o.value===p)?.short || p;
  const posColor = p => POS_COLORS[p] || '#9ca3af';
  const fmtDate = d => { try{return new Date(d).toLocaleDateString('vi-VN');}catch(e){return '';} };

  /* ─────────────────────── ICONS ─────────────────────── */
  const IconChevron = ({open}) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{transition:'transform .25s cubic-bezier(.34,1.56,.64,1)', transform:open?'rotate(180deg)':'rotate(0deg)'}}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
  const IconPlus = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  );
  const IconEdit = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
  );
  const IconTrash = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
  );
  const IconBook = ({size=14}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
  );

  /* ─────────────────────── HELPERS: styles dùng chung ─────────────────────── */
  function useInputStyle(C){
    return useMemo(()=>({
      width:'100%', padding:'10px 12px', borderRadius:12,
      border:`1.5px solid ${C.border2}`, background:C.surface, color:C.text,
      fontSize:13.5, fontFamily:"'Nunito',sans-serif", fontWeight:600,
      outline:'none', boxSizing:'border-box',
    }),[C]);
  }
  const labelStyleFor = C => ({ fontSize:11.5, fontWeight:800, color:C.text3, marginBottom:5, display:'block' });

  function PrimaryBtn({children, onClick, disabled, C, style, ...rest}){
    return(
      <button onClick={onClick} disabled={disabled} style={{
        display:'flex', alignItems:'center', justifyContent:'center', gap:6,
        padding:'11px 16px', borderRadius:999, border:'none',
        background:C.grad, color:'#fff', fontSize:13, fontWeight:900,
        cursor:disabled?'default':'pointer', boxShadow:'0 3px 14px rgba(168,85,247,0.3)',
        fontFamily:"'Nunito',sans-serif", transition:'all .18s', opacity:disabled?0.7:1,
        ...style,
      }}
        onMouseEnter={e=>{if(!disabled){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 6px 20px rgba(168,85,247,0.42)';}}}
        onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 3px 14px rgba(168,85,247,0.3)';}}
        onMouseDown={e=>{if(!disabled)e.currentTarget.style.transform='scale(0.96)';}}
        onMouseUp={e=>{if(!disabled)e.currentTarget.style.transform='translateY(-2px)';}}
        {...rest}>
        {children}
      </button>
    );
  }

  function GhostBtn({children, onClick, disabled, C}){
    return(
      <button onClick={onClick} disabled={disabled} style={{
        flex:1, padding:'11px', borderRadius:999, border:`1.5px solid ${C.border2}`,
        background:'transparent', color:C.text2, fontSize:13, fontWeight:800,
        cursor:disabled?'not-allowed':'pointer', fontFamily:"'Nunito',sans-serif",
        transition:'all .15s', opacity:disabled?0.6:1,
      }}
        onMouseEnter={e=>{if(!disabled){e.currentTarget.style.background=C.bg2;e.currentTarget.style.transform='translateY(-1px)';}}}
        onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.transform='translateY(0)';}}>
        {children}
      </button>
    );
  }

  function IconBtn({onClick, title, danger, C, children}){
    return(
      <button onClick={onClick} title={title} style={{
        width:30, height:30, borderRadius:10, flexShrink:0,
        border: danger?'1.5px solid rgba(239,68,68,0.35)':`1.5px solid ${C.border2}`,
        background: danger?'rgba(239,68,68,0.08)':C.bg2,
        color: danger?'#ef4444':C.lav,
        cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s',
      }}
        onMouseEnter={e=>{e.currentTarget.style.background= danger?'rgba(239,68,68,0.18)':C.lavL; e.currentTarget.style.transform='translateY(-1px)';}}
        onMouseLeave={e=>{e.currentTarget.style.background= danger?'rgba(239,68,68,0.08)':C.bg2; e.currentTarget.style.transform='translateY(0)';}}
        onMouseDown={e=>e.currentTarget.style.transform='scale(0.9)'}
        onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>
        {children}
      </button>
    );
  }

  /* ─────────────────────── MODAL: Khóa học (thêm/sửa) ─────────────────────── */
  function CourseModal({dark, C, initial, onClose, onSaved, toast_}){
    const isEdit = !!initial;
    const [title,setTitle] = useState(initial?.title||'');
    const [description,setDescription] = useState(initial?.description||'');
    const [saving,setSaving] = useState(false);
    const [err,setErr] = useState('');
    const inputStyle = useInputStyle(C);

    async function handleSave(){
      if(!title.trim()){ setErr('Nhập tên khóa học nhé!'); return; }
      setSaving(true); setErr('');
      try{
        const row = { title: title.trim(), description: description.trim() };
        if(isEdit){
          const { error } = await window.supa.from('vocab_courses').update(row).eq('id', initial.id);
          if(error) throw error;
        } else {
          const { error } = await window.supa.from('vocab_courses').insert({ id: crypto.randomUUID(), ...row, sort_order:0 });
          if(error) throw error;
        }
        toast_ && toast_(isEdit ? 'Đã cập nhật khóa học!' : 'Đã tạo khóa học mới!');
        onSaved();
      } catch(e){
        console.error('[vocab-manager] course save error:', e);
        setErr(e.message || 'Có lỗi xảy ra, thử lại nhé!');
      } finally { setSaving(false); }
    }

    return(
      <div onClick={e=>{if(e.target===e.currentTarget && !saving) onClose();}}
        style={{position:'fixed', inset:0, zIndex:9200, background:'rgba(10,2,25,0.72)', backdropFilter:'blur(10px)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:16, overflowY:'auto', WebkitOverflowScrolling:'touch'}}>
        <div style={{width:'100%', maxWidth:420, maxHeight:'min(85vh, 640px)', margin:'auto 0', borderRadius:22, background:dark?'#1E0D15':'#fff', border:`1.5px solid ${C.border2}`, boxShadow:'0 24px 60px rgba(0,0,0,.3)', animation:'pop .2s ease both', display:'flex', flexDirection:'column', overflow:'hidden'}}>
          <div style={{flex:'1 1 auto', minHeight:0, overflowY:'auto', WebkitOverflowScrolling:'touch', padding:'20px 18px 4px'}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16}}>
              <div style={{fontSize:15.5, fontWeight:900, color:C.text, display:'flex', alignItems:'center', gap:8}}>
                <span style={{display:'flex', color:C.lav}}><IconBook size={17}/></span>
                {isEdit ? 'Sửa khóa học' : 'Tạo khóa học mới'}
              </div>
              <button onClick={onClose} disabled={saving} style={{width:28, height:28, borderRadius:99, border:`1.5px solid ${C.border2}`, background:C.bg2, color:C.text3, cursor:saving?'not-allowed':'pointer', fontSize:15, fontWeight:900, lineHeight:1, opacity:saving?0.5:1}}>×</button>
            </div>
            <div style={{marginBottom:12}}>
              <label style={labelStyleFor(C)}>Tên khóa học *</label>
              <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Vd: Tiếng Anh Cơ Bản A1" style={inputStyle} autoFocus/>
            </div>
            <div style={{marginBottom:16}}>
              <label style={labelStyleFor(C)}>Mô tả</label>
              <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Mô tả ngắn về khóa học..." rows={2} style={{...inputStyle, resize:'vertical'}}/>
            </div>
            {err && <div style={{fontSize:12, fontWeight:700, color:'#ef4444', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'8px 12px', marginBottom:14}}>{err}</div>}
          </div>
          <div style={{display:'flex', gap:8, padding:'12px 18px', borderTop:`1.5px solid ${C.border2}`, background:dark?'#1E0D15':'#fff', flexShrink:0}}>
            <GhostBtn onClick={onClose} disabled={saving} C={C}>Huỷ</GhostBtn>
            <PrimaryBtn onClick={handleSave} disabled={saving} C={C} style={{flex:2}}>{saving?'Đang lưu...':(isEdit?'Lưu thay đổi':'Tạo khóa học')}</PrimaryBtn>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────── MODAL: Unit (thêm/sửa) ─────────────────────── */
  function UnitModal({dark, C, courseId, initial, onClose, onSaved, toast_}){
    const isEdit = !!initial;
    const [title,setTitle] = useState(initial?.title||'');
    const [level,setLevel] = useState(initial?.level||'');
    const [saving,setSaving] = useState(false);
    const [err,setErr] = useState('');
    const inputStyle = useInputStyle(C);

    async function handleSave(){
      if(!title.trim()){ setErr('Nhập tên bài học nhé!'); return; }
      setSaving(true); setErr('');
      try{
        const row = { title: title.trim(), level: level.trim() };
        if(isEdit){
          const { error } = await window.supa.from('vocab_units').update(row).eq('id', initial.id);
          if(error) throw error;
        } else {
          const { error } = await window.supa.from('vocab_units').insert({ id: crypto.randomUUID(), course_id: courseId, ...row, sort_order:0 });
          if(error) throw error;
        }
        toast_ && toast_(isEdit ? 'Đã cập nhật Unit!' : 'Đã tạo Unit mới!');
        onSaved();
      } catch(e){
        console.error('[vocab-manager] unit save error:', e);
        setErr(e.message || 'Có lỗi xảy ra, thử lại nhé!');
      } finally { setSaving(false); }
    }

    return(
      <div onClick={e=>{if(e.target===e.currentTarget && !saving) onClose();}}
        style={{position:'fixed', inset:0, zIndex:9200, background:'rgba(10,2,25,0.72)', backdropFilter:'blur(10px)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:16, overflowY:'auto', WebkitOverflowScrolling:'touch'}}>
        <div style={{width:'100%', maxWidth:420, maxHeight:'min(85vh, 640px)', margin:'auto 0', borderRadius:22, background:dark?'#1E0D15':'#fff', border:`1.5px solid ${C.border2}`, boxShadow:'0 24px 60px rgba(0,0,0,.3)', animation:'pop .2s ease both', display:'flex', flexDirection:'column', overflow:'hidden'}}>
          <div style={{flex:'1 1 auto', minHeight:0, overflowY:'auto', WebkitOverflowScrolling:'touch', padding:'20px 18px 4px'}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16}}>
              <div style={{fontSize:15.5, fontWeight:900, color:C.text}}>{isEdit?'Sửa Unit':'Tạo Unit mới'}</div>
              <button onClick={onClose} disabled={saving} style={{width:28, height:28, borderRadius:99, border:`1.5px solid ${C.border2}`, background:C.bg2, color:C.text3, cursor:saving?'not-allowed':'pointer', fontSize:15, fontWeight:900, lineHeight:1, opacity:saving?0.5:1}}>×</button>
            </div>
            <div style={{marginBottom:12}}>
              <label style={labelStyleFor(C)}>Tên bài học *</label>
              <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Vd: Unit 1 - Greetings" style={inputStyle} autoFocus/>
            </div>
            <div style={{marginBottom:16}}>
              <label style={labelStyleFor(C)}>Level</label>
              <input value={level} onChange={e=>setLevel(e.target.value)} placeholder="Vd: Beginner, A1, A2..." style={inputStyle}/>
            </div>
            {err && <div style={{fontSize:12, fontWeight:700, color:'#ef4444', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'8px 12px', marginBottom:14}}>{err}</div>}
          </div>
          <div style={{display:'flex', gap:8, padding:'12px 18px', borderTop:`1.5px solid ${C.border2}`, background:dark?'#1E0D15':'#fff', flexShrink:0}}>
            <GhostBtn onClick={onClose} disabled={saving} C={C}>Huỷ</GhostBtn>
            <PrimaryBtn onClick={handleSave} disabled={saving} C={C} style={{flex:2}}>{saving?'Đang lưu...':(isEdit?'Lưu thay đổi':'Tạo Unit')}</PrimaryBtn>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────── MODAL: Từ vựng (thêm/sửa) ─────────────────────── */
  function WordModal({dark, C, unitId, initial, onClose, onSaved, toast_}){
    const isEdit = !!initial;
    const [word,setWord] = useState(initial?.word||'');
    const [pos,setPos] = useState(initial?.pos||'noun');
    const [ipa,setIpa] = useState(initial?.ipa||'');
    const [meaning,setMeaning] = useState(initial?.meaning||'');
    const [example,setExample] = useState(initial?.example||'');
    const [saving,setSaving] = useState(false);
    const [err,setErr] = useState('');
    const inputStyle = useInputStyle(C);

    async function handleSave(){
      if(!word.trim()){ setErr('Nhập từ vựng nhé!'); return; }
      setSaving(true); setErr('');
      try{
        const row = { word: word.trim(), pos, ipa: ipa.trim(), meaning: meaning.trim(), example: example.trim() };
        if(isEdit){
          const { error } = await window.supa.from('vocab_words').update(row).eq('id', initial.id);
          if(error) throw error;
        } else {
          const { error } = await window.supa.from('vocab_words').insert({ id: crypto.randomUUID(), unit_id: unitId, ...row, sort_order:0 });
          if(error) throw error;
        }
        toast_ && toast_(isEdit ? 'Đã lưu thay đổi!' : 'Đã thêm từ vựng!');
        onSaved();
      } catch(e){
        console.error('[vocab-manager] word save error:', e);
        setErr(e.message || 'Có lỗi xảy ra, thử lại nhé!');
      } finally { setSaving(false); }
    }

    return(
      <div onClick={e=>{if(e.target===e.currentTarget && !saving) onClose();}}
        style={{position:'fixed', inset:0, zIndex:9200, background:'rgba(10,2,25,0.72)', backdropFilter:'blur(10px)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:16, overflowY:'auto', WebkitOverflowScrolling:'touch'}}>
        <div style={{width:'100%', maxWidth:440, maxHeight:'min(85vh, 640px)', margin:'auto 0', borderRadius:22, background:dark?'#1E0D15':'#fff', border:`1.5px solid ${C.border2}`, boxShadow:'0 24px 60px rgba(0,0,0,.3)', animation:'pop .2s ease both', display:'flex', flexDirection:'column', overflow:'hidden'}}>
          <div style={{flex:'1 1 auto', minHeight:0, overflowY:'auto', WebkitOverflowScrolling:'touch', padding:'20px 18px 4px'}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16}}>
              <div style={{fontSize:15.5, fontWeight:900, color:C.text}}>{isEdit?'Sửa từ vựng':'Thêm từ vựng'}</div>
              <button onClick={onClose} disabled={saving} style={{width:28, height:28, borderRadius:99, border:`1.5px solid ${C.border2}`, background:C.bg2, color:C.text3, cursor:saving?'not-allowed':'pointer', fontSize:15, fontWeight:900, lineHeight:1, opacity:saving?0.5:1}}>×</button>
            </div>
            <div style={{display:'flex', gap:10, marginBottom:12}}>
              <div style={{flex:2}}>
                <label style={labelStyleFor(C)}>Từ vựng *</label>
                <input value={word} onChange={e=>setWord(e.target.value)} placeholder="Vd: Hello" style={inputStyle} autoFocus/>
              </div>
              <div style={{flex:1}}>
                <label style={labelStyleFor(C)}>Loại từ</label>
                <select value={pos} onChange={e=>setPos(e.target.value)} style={{...inputStyle, cursor:'pointer'}}>
                  {POS_OPTIONS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <label style={labelStyleFor(C)}>Phiên âm (IPA)</label>
              <input value={ipa} onChange={e=>setIpa(e.target.value)} placeholder="Vd: /həˈloʊ/" style={inputStyle}/>
            </div>
            <div style={{marginBottom:12}}>
              <label style={labelStyleFor(C)}>Nghĩa</label>
              <textarea value={meaning} onChange={e=>setMeaning(e.target.value)} placeholder="Giải thích nghĩa..." rows={2} style={{...inputStyle, resize:'vertical'}}/>
            </div>
            <div style={{marginBottom:16}}>
              <label style={labelStyleFor(C)}>Ví dụ</label>
              <textarea value={example} onChange={e=>setExample(e.target.value)} placeholder="Câu ví dụ..." rows={2} style={{...inputStyle, resize:'vertical'}}/>
            </div>
            {err && <div style={{fontSize:12, fontWeight:700, color:'#ef4444', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'8px 12px', marginBottom:14}}>{err}</div>}
          </div>
          <div style={{display:'flex', gap:8, padding:'12px 18px', borderTop:`1.5px solid ${C.border2}`, background:dark?'#1E0D15':'#fff', flexShrink:0}}>
            <GhostBtn onClick={onClose} disabled={saving} C={C}>Huỷ</GhostBtn>
            <PrimaryBtn onClick={handleSave} disabled={saving} C={C} style={{flex:2}}>{saving?'Đang lưu...':(isEdit?'Lưu thay đổi':'Thêm từ vựng')}</PrimaryBtn>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────── HÀNG TỪ VỰNG ─────────────────────── */
  function WordRow({v, dark, C, onEdit, onDelete, index}){
    const col = posColor(v.pos);
    return(
      <div className="vm-word-row" style={{
        display:'flex', alignItems:'flex-start', gap:10, padding:'11px 12px',
        borderRadius:14, background:C.surface, border:`1.5px solid ${C.border}`,
        animation:`fadeUp .22s cubic-bezier(.16,1,.3,1) both`, animationDelay:`${Math.min(index*0.03,0.3)}s`,
        transition:'transform .15s ease, box-shadow .15s ease, border-color .15s ease',
      }}
        onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow=`0 4px 14px ${col}1a`; e.currentTarget.style.borderColor=`${col}44`; }}
        onMouseLeave={e=>{ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.borderColor=C.border; }}>
        <div style={{width:8, height:8, borderRadius:99, background:col, flexShrink:0, marginTop:5, boxShadow:`0 0 0 3px ${col}22`}}/>
        <div style={{flex:1, minWidth:0}}>
          <div style={{display:'flex', alignItems:'center', gap:7, flexWrap:'wrap'}}>
            <span style={{fontSize:14.5, fontWeight:900, color:C.text}}>{v.word}</span>
            <span style={{fontSize:10, fontWeight:800, color:col, background:`${col}18`, borderRadius:7, padding:'2px 7px'}}>{posLabel(v.pos)}</span>
            {v.ipa && <span style={{fontSize:12, color:C.text3, fontStyle:'italic'}}>/{v.ipa.replace(/^\/|\/$/g,'')}/</span>}
          </div>
          {v.meaning && <div style={{fontSize:13, color:C.text2, marginTop:3, fontWeight:600}}>{v.meaning}</div>}
          {v.example && <div style={{fontSize:12, color:C.text3, marginTop:2, fontStyle:'italic'}}>"{v.example}"</div>}
        </div>
        <div style={{display:'flex', gap:6, flexShrink:0}}>
          <IconBtn onClick={()=>onEdit(v)} title="Sửa" C={C}><IconEdit/></IconBtn>
          <IconBtn onClick={()=>onDelete(v)} title="Xoá" danger C={C}><IconTrash/></IconBtn>
        </div>
      </div>
    );
  }

  /* ─────────────────────── KHỐI UNIT (accordion) ─────────────────────── */
  function UnitBlock({unit, dark, C, confirm_, toast_, onChanged, defaultOpen}){
    const [open,setOpen] = useState(!!defaultOpen);
    const [words,setWords] = useState([]);
    const [loaded,setLoaded] = useState(false);
    const [wordModal,setWordModal] = useState(null); // null | {} (add) | word (edit)
    const [unitModal,setUnitModal] = useState(false);

    const fetchWords = useCallback(async ()=>{
      try{
        const { data, error } = await window.supa.from('vocab_words')
          .select('*').eq('unit_id', unit.id).order('sort_order',{ascending:true}).order('created_at',{ascending:true});
        if(error) throw error;
        setWords(data||[]);
      } catch(e){
        console.error('[vocab-manager] fetch words error:', e);
        toast_ && toast_('Không tải được từ vựng của unit');
      } finally { setLoaded(true); }
    },[unit.id, toast_]);

    useEffect(()=>{ if(open && !loaded) fetchWords(); },[open, loaded, fetchWords]);

    async function doDeleteWord(v){
      try{
        const { error } = await window.supa.from('vocab_words').delete().eq('id', v.id);
        if(error) throw error;
        setWords(prev=>prev.filter(x=>x.id!==v.id));
        toast_ && toast_('Đã xoá từ vựng');
      } catch(e){
        console.error('[vocab-manager] delete word error:', e);
        toast_ && toast_('Xoá thất bại, thử lại nhé!');
      }
    }
    function handleDeleteWord(v){
      if(confirm_){
        confirm_({ title:'Xoá từ vựng?', message:`"${v.word}" sẽ bị xoá vĩnh viễn.`, confirmLabel:'Xoá', danger:true, onConfirm:()=>doDeleteWord(v) });
      } else if(window.confirm(`Xoá "${v.word}"?`)){ doDeleteWord(v); }
    }

    async function doDeleteUnit(){
      try{
        const { error } = await window.supa.from('vocab_units').delete().eq('id', unit.id);
        if(error) throw error;
        toast_ && toast_('Đã xoá Unit');
        onChanged();
      } catch(e){
        console.error('[vocab-manager] delete unit error:', e);
        toast_ && toast_('Xoá thất bại, thử lại nhé!');
      }
    }
    function handleDeleteUnit(e){
      e.stopPropagation();
      if(confirm_){
        confirm_({ title:'Xoá Unit?', message:`"${unit.title}" và toàn bộ từ vựng bên trong sẽ bị xoá vĩnh viễn.`, confirmLabel:'Xoá', danger:true, onConfirm:doDeleteUnit });
      } else if(window.confirm(`Xoá "${unit.title}" và toàn bộ từ vựng?`)){ doDeleteUnit(); }
    }

    return(
      <div style={{
        borderRadius:16, border:`1.5px solid ${C.border}`, overflow:'hidden', background:C.surface,
        boxShadow: open ? '0 4px 16px rgba(168,85,247,0.1)' : 'none', transition:'box-shadow .25s ease',
      }}>
        <div onClick={()=>setOpen(p=>!p)} style={{
          display:'flex', alignItems:'center', gap:10, padding:'12px 14px', cursor:'pointer',
          background: open ? C.lavPale : 'transparent', transition:'background .18s',
        }}
          onMouseEnter={e=>{ if(!open) e.currentTarget.style.background = C.bg2; }}
          onMouseLeave={e=>{ if(!open) e.currentTarget.style.background = 'transparent'; }}>
          <span style={{display:'flex', color:C.lav, flexShrink:0}}><IconChevron open={open}/></span>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:13.5, fontWeight:800, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{unit.title}</div>
            <div style={{fontSize:11, color:C.text3, marginTop:1, display:'flex', gap:6, alignItems:'center'}}>
              {unit.level && <span style={{background:C.peachL, color:C.peach, borderRadius:7, padding:'1px 7px', fontWeight:800, fontSize:10}}>{unit.level}</span>}
              <span>{loaded ? `${words.length} từ` : '···'}</span>
            </div>
          </div>
          <div style={{display:'flex', gap:6, flexShrink:0}} onClick={e=>e.stopPropagation()}>
            <IconBtn onClick={()=>setUnitModal(true)} title="Sửa Unit" C={C}><IconEdit/></IconBtn>
            <IconBtn onClick={handleDeleteUnit} title="Xoá Unit" danger C={C}><IconTrash/></IconBtn>
          </div>
        </div>

        {open && (
          <div style={{padding:'12px 14px 14px', display:'flex', flexDirection:'column', gap:8, borderTop:`1.5px solid ${C.border}`, animation:'fadeUp .18s ease both'}}>
            <button onClick={()=>setWordModal({})} style={{
              display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', borderRadius:12,
              border:`1.5px dashed ${C.lav2}`, background:'transparent', color:C.lav, fontSize:12.5, fontWeight:800,
              cursor:'pointer', fontFamily:"'Nunito',sans-serif", transition:'all .15s',
            }}
              onMouseEnter={e=>{e.currentTarget.style.background=C.lavPale;}}
              onMouseLeave={e=>{e.currentTarget.style.background='transparent';}}>
              <IconPlus/> Thêm từ vựng
            </button>

            {!loaded && (
              <div style={{display:'flex', flexDirection:'column', gap:8}}>
                {[0,1].map(i=>(<div key={i} style={{height:52, borderRadius:14, background:C.bg2, opacity:0.6}}/>))}
              </div>
            )}
            {loaded && words.length===0 && (
              <div style={{textAlign:'center', padding:'18px 10px', fontSize:12.5, color:C.text3, fontWeight:600}}>Chưa có từ vựng nào trong unit này</div>
            )}
            {loaded && words.map((v,i)=>(
              <WordRow key={v.id} v={v} dark={dark} C={C} index={i}
                onEdit={()=>setWordModal(v)} onDelete={handleDeleteWord}/>
            ))}
          </div>
        )}

        {wordModal!==null && (
          <WordModal dark={dark} C={C} unitId={unit.id} initial={wordModal.id?wordModal:null}
            onClose={()=>setWordModal(null)}
            onSaved={()=>{ setWordModal(null); fetchWords(); }}
            toast_={toast_}/>
        )}
        {unitModal && (
          <UnitModal dark={dark} C={C} courseId={unit.course_id} initial={unit}
            onClose={()=>setUnitModal(false)}
            onSaved={()=>{ setUnitModal(false); onChanged(); }}
            toast_={toast_}/>
        )}
      </div>
    );
  }

  /* ─────────────────────── KHỐI KHÓA HỌC (accordion) ─────────────────────── */
  function CourseBlock({course, dark, C, confirm_, toast_, onChanged, defaultOpen}){
    const [open,setOpen] = useState(!!defaultOpen);
    const [units,setUnits] = useState([]);
    const [loaded,setLoaded] = useState(false);
    const [unitModal,setUnitModal] = useState(false);
    const [courseModal,setCourseModal] = useState(false);

    const fetchUnits = useCallback(async ()=>{
      try{
        const { data, error } = await window.supa.from('vocab_units')
          .select('*').eq('course_id', course.id).order('sort_order',{ascending:true}).order('created_at',{ascending:true});
        if(error) throw error;
        setUnits(data||[]);
      } catch(e){
        console.error('[vocab-manager] fetch units error:', e);
        toast_ && toast_('Không tải được units của khóa học');
      } finally { setLoaded(true); }
    },[course.id, toast_]);

    useEffect(()=>{ if(open && !loaded) fetchUnits(); },[open, loaded, fetchUnits]);

    async function doDeleteCourse(){
      try{
        const { error } = await window.supa.from('vocab_courses').delete().eq('id', course.id);
        if(error) throw error;
        toast_ && toast_('Đã xoá khóa học');
        onChanged();
      } catch(e){
        console.error('[vocab-manager] delete course error:', e);
        toast_ && toast_('Xoá thất bại, thử lại nhé!');
      }
    }
    function handleDeleteCourse(e){
      e.stopPropagation();
      if(confirm_){
        confirm_({ title:'Xoá khóa học?', message:`"${course.title}" và toàn bộ Unit + từ vựng bên trong sẽ bị xoá vĩnh viễn.`, confirmLabel:'Xoá', danger:true, onConfirm:doDeleteCourse });
      } else if(window.confirm(`Xoá "${course.title}" và toàn bộ nội dung?`)){ doDeleteCourse(); }
    }

    return(
      <div style={{
        borderRadius:18, border:`1.5px solid ${C.border}`, overflow:'hidden',
        background:dark?'rgba(255,255,255,0.02)':'rgba(168,85,247,0.02)',
        boxShadow: open ? '0 6px 22px rgba(168,85,247,0.12)' : '0 2px 8px rgba(168,85,247,0.05)',
        transition:'box-shadow .25s ease',
      }}>
        <div onClick={()=>setOpen(p=>!p)} style={{
          display:'flex', alignItems:'center', gap:10, padding:'14px 16px', cursor:'pointer',
          background: open ? C.gradSoft : 'transparent', transition:'background .2s',
        }}
          onMouseEnter={e=>{ if(!open) e.currentTarget.style.background = dark?'rgba(255,255,255,0.03)':'rgba(168,85,247,0.035)'; }}
          onMouseLeave={e=>{ if(!open) e.currentTarget.style.background = 'transparent'; }}>
          <span style={{display:'flex', color:C.lav, flexShrink:0}}><IconChevron open={open}/></span>
          <div style={{
            width:36, height:36, borderRadius:12, flexShrink:0, background:C.grad,
            display:'flex', alignItems:'center', justifyContent:'center', color:'#fff',
            boxShadow:'0 3px 10px rgba(168,85,247,0.3)',
            transform: open ? 'scale(1.06)' : 'scale(1)', transition:'transform .25s cubic-bezier(.34,1.56,.64,1)',
          }}>
            <IconBook size={17}/>
          </div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:14.5, fontWeight:900, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{course.title}</div>
            <div style={{fontSize:11.5, color:C.text3, marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
              {course.description || (loaded ? `${units.length} unit` : 'Bấm để xem units')}
            </div>
          </div>
          <div style={{display:'flex', gap:6, flexShrink:0}} onClick={e=>e.stopPropagation()}>
            <IconBtn onClick={()=>setCourseModal(true)} title="Sửa khóa học" C={C}><IconEdit/></IconBtn>
            <IconBtn onClick={handleDeleteCourse} title="Xoá khóa học" danger C={C}><IconTrash/></IconBtn>
          </div>
        </div>

        {open && (
          <div style={{padding:'12px 14px 16px', display:'flex', flexDirection:'column', gap:10, borderTop:`1.5px solid ${C.border}`, animation:'fadeUp .18s ease both'}}>
            <button onClick={()=>setUnitModal(true)} style={{
              display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px', borderRadius:12,
              border:`1.5px dashed ${C.lav2}`, background:'transparent', color:C.lav, fontSize:12.5, fontWeight:800,
              cursor:'pointer', fontFamily:"'Nunito',sans-serif", transition:'all .15s',
            }}
              onMouseEnter={e=>{e.currentTarget.style.background=C.lavPale;}}
              onMouseLeave={e=>{e.currentTarget.style.background='transparent';}}>
              <IconPlus/> Thêm Unit
            </button>

            {!loaded && (
              <div style={{display:'flex', flexDirection:'column', gap:8}}>
                {[0,1].map(i=>(<div key={i} style={{height:56, borderRadius:16, background:C.bg2, opacity:0.6}}/>))}
              </div>
            )}
            {loaded && units.length===0 && (
              <div style={{textAlign:'center', padding:'20px 10px', fontSize:12.5, color:C.text3, fontWeight:600}}>Chưa có Unit nào trong khóa học này</div>
            )}
            {loaded && units.map(u=>(
              <UnitBlock key={u.id} unit={u} dark={dark} C={C} confirm_={confirm_} toast_={toast_} onChanged={fetchUnits}/>
            ))}
          </div>
        )}

        {unitModal && (
          <UnitModal dark={dark} C={C} courseId={course.id} initial={null}
            onClose={()=>setUnitModal(false)}
            onSaved={()=>{ setUnitModal(false); setOpen(true); fetchUnits(); }}
            toast_={toast_}/>
        )}
        {courseModal && (
          <CourseModal dark={dark} C={C} initial={course}
            onClose={()=>setCourseModal(false)}
            onSaved={()=>{ setCourseModal(false); onChanged(); }}
            toast_={toast_}/>
        )}
      </div>
    );
  }

  /* ══ VOCABULARY MANAGER (main export) ══ */
  function VocabularyManager({dark, C, confirm_, toast_}){
    const [courses,setCourses] = useState([]);
    const [loading,setLoading] = useState(true);
    const [search,setSearch] = useState('');
    const [courseModal,setCourseModal] = useState(false);

    const fetchCourses = useCallback(async ()=>{
      setLoading(true);
      try{
        const { data, error } = await window.supa.from('vocab_courses')
          .select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:false});
        if(error) throw error;
        setCourses(data||[]);
      } catch(e){
        console.error('[vocab-manager] fetch courses error:', e);
        toast_ && toast_('Không tải được danh sách khóa học');
      } finally { setLoading(false); }
    },[toast_]);

    useEffect(()=>{ fetchCourses(); },[fetchCourses]);

    const filtered = useMemo(()=>{
      const q = search.trim().toLowerCase();
      if(!q) return courses;
      return courses.filter(c=>(c.title||'').toLowerCase().includes(q) || (c.description||'').toLowerCase().includes(q));
    },[courses,search]);

    return(
      <div style={{padding:'16px 12px 100px', display:'flex', flexDirection:'column', gap:14}} className="fade-up">
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <div style={{flex:1, position:'relative'}}>
            <span style={{position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:C.text3, display:'flex'}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm khóa học..."
              style={{width:'100%', padding:'10px 12px 10px 34px', borderRadius:14, border:`1.5px solid ${C.border2}`, background:C.surface, color:C.text, fontSize:13, outline:'none', fontFamily:"'Nunito',sans-serif", fontWeight:600, boxSizing:'border-box'}}/>
          </div>
          <PrimaryBtn onClick={()=>setCourseModal(true)} C={C} style={{whiteSpace:'nowrap'}}>
            <IconPlus/> Khóa học
          </PrimaryBtn>
        </div>

        <div style={{fontSize:12, color:C.text3, fontWeight:700}}>
          {courses.length} khóa học {search && `· ${filtered.length} khớp tìm kiếm`}
        </div>

        {loading && (
          <div style={{display:'flex', flexDirection:'column', gap:10}}>
            {[0,1,2].map(i=>(<div key={i} style={{height:66, borderRadius:18, background:C.surface, border:`1.5px solid ${C.border}`, opacity:0.5}}/>))}
          </div>
        )}

        {!loading && filtered.length===0 && (
          <div style={{
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            minHeight:'34vh', gap:12, padding:'32px 20px', textAlign:'center', animation:'fadeUp .3s ease both',
          }}>
            <span style={{
              display:'flex', color:C.lav, opacity:0.55, animation:'bb-float 3s ease-in-out infinite',
              width:64, height:64, borderRadius:'50%', background:C.lavPale, alignItems:'center', justifyContent:'center',
            }}><IconBook size={30}/></span>
            <div style={{fontSize:14.5, fontWeight:900, color:C.text2, fontFamily:"'Baloo 2',cursive"}}>{search ? 'Không tìm thấy khóa học' : 'Chưa có khóa học nào'}</div>
            <div style={{fontSize:12, color:C.text3}}>{search ? 'Thử từ khoá khác nhé' : 'Bấm "Khóa học" để tạo khóa học đầu tiên'}</div>
          </div>
        )}

        {!loading && filtered.length>0 && (
          <div style={{display:'flex', flexDirection:'column', gap:10}}>
            {filtered.map(c=>(
              <CourseBlock key={c.id} course={c} dark={dark} C={C} confirm_={confirm_} toast_={toast_} onChanged={fetchCourses}/>
            ))}
          </div>
        )}

        {courseModal && (
          <CourseModal dark={dark} C={C} initial={null}
            onClose={()=>setCourseModal(false)}
            onSaved={()=>{ setCourseModal(false); fetchCourses(); }}
            toast_={toast_}/>
        )}
      </div>
    );
  }

  window.VocabularyManager = VocabularyManager;
})();
