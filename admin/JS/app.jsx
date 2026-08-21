import React from "react";
import ReactDOM from "react-dom/client";
import { createPortal } from "react-dom";

(function(){
const {useState,useRef,useEffect,useCallback,useMemo}=React;
// ── Lấy components từ window ──
const LoginScreen=window.LoginScreen;
const QEditor=window.QEditor;
const PreviewPanel=window.PreviewPanel;
const StudentManager=window.StudentManager;
const AdminDashboard=window.AdminDashboard;
const ListeningManager=window.ListeningManager;
const FileManager=window.FileManager;
const VocabularyManager=window.VocabularyManager;
const AUTH_KEY='learnsy_admin_auth';

/* ══ CACHE (Upstash qua /api/cache) ═══════════════════════════════════
   Trang học sinh đọc/ghi key 'lessons_cache' để tăng tốc load danh sách bài
   (khớp CACHE_KEY định nghĩa trong admin.html / trang học sinh).
   Admin luôn query Supabase trực tiếp — chỉ cần XOÁ cache sau khi
   save/thêm/xoá/sao chép bài, để lần load tiếp theo bên học sinh
   không thấy dữ liệu cũ.
   Lưu ý: hàm này GHI ĐÈ lên invalidateCache đã khai báo trong admin.html
   (bản đó gọi nhầm DELETE /api/lessons + DELETE /api/cache — 2 method
   không tồn tại trong functions/api/cache.js). Nếu sau này gỡ IIFE này
   ra khỏi file hoặc đổi thứ tự load script, nhớ xoá bản trùng ở admin.html
   để tránh 2 nơi cùng định nghĩa 1 tên hàm toàn cục. */
async function invalidateCache(){
  try{
    await fetch('/api/cache',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(['DEL','lessons_cache']),
    });
  }catch(e){
    // Cache là tối ưu tốc độ, không phải nguồn dữ liệu chính —
    // lỗi ở đây không được chặn luồng save/thêm/xoá bài của admin.
    console.error('invalidateCache error:',e);
  }
}
window.invalidateCache=invalidateCache;

/* ══ COLORS — nguồn thật duy nhất là learnsy-colors.jsx (window.CL/window.CD),
   app.jsx chỉ giữ biến C cục bộ để đổi theo dark mode, tránh 2 bảng màu
   trùng lặp có thể lệch nhau khi sửa. ══════════════════════════════════ */
const {CL,CD}=window;
let C=CL;

/* ══ SVG COMPONENTS — dùng chung từ ui-components.js (tránh trùng lặp code) ══ */
const {Flower,Heart,Star,Sparkle,Bow}=window;

/* ══ QUESTION TYPE CONFIG, LETTERS, stripHTML, parseText, importJSON, empty-factories, newQ
   — TẤT CẢ dùng chung từ ui-components.jsx / learnsy-parsers.jsx (đã load trước
   app.jsx trong main.jsx). Trước đây app.jsx định nghĩa lại các hàm này rồi ghi
   đè lên window.parseText/window.importJSON — vì app.jsx load SAU CÙNG, bản
   parseText/importJSON mạnh hơn (nhận diện multi-select qua *,  bảng đáp án
   1-A 2-B cuối đề, tách option dồn 1 dòng...) trong learnsy-parsers.jsx đã bị
   ghi đè âm thầm bởi bản cũ yếu hơn ngay tại đây. Sửa: dùng thẳng window.*,
   không định nghĩa lại. ══════════════════════════════════════════════════ */
const getTypes=window.getTypes;
const LETTERS=window.LETTERS;
const stripHTML=window.stripHTML;
const parseText=window.parseText;
const importJSON=window.importJSON;
const emptyTF=window.emptyTF, emptyMC=window.emptyMC, emptyMS=window.emptyMS, emptyFB=window.emptyFB;
const newQ=window.newQ;

/* ══ STYLED HELPERS — dùng chung từ ui-components.js (tránh trùng lặp code) ══ */
const {Inp,RichInp,MiniRichInp,Fld,Pill}=window;
/* Không cần re-export getTypes/LETTERS/stripHTML/parseText/importJSON/empty-factories/newQ/
   Inp/RichInp/MiniRichInp/Fld/Pill lên window nữa — chúng đã có sẵn trên window
   từ learnsy-parsers.jsx / ui-components.jsx (load trước app.jsx), và app.jsx giờ
   chỉ đọc lại chứ không định nghĩa mới, nên không có gì để ghi đè. */

/* ══ CONFIRM DIALOG ═══════════════════════════════════════════════════ */
const ConfirmDialog=({open,onClose,dark})=>{
  if(!open)return null;
  const {iconType,title,message,confirmLabel='Xác nhận',confirmColor='#EF4444',confirmGrad,onConfirm}=open;
  const isDel=iconType==='delete';
  const isCopy=iconType==='copy';
  const isAdd=iconType==='add';
  const glow=isDel?'rgba(239,68,68,.5)':isCopy?'rgba(168,85,247,.5)':'rgba(16,185,129,.5)';
  return(
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(10,2,25,0.82)',backdropFilter:'blur(12px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:9999}}>
      <div onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:480,background:dark?'#1E0D15':'#fff',borderRadius:'28px 28px 0 0',padding:'14px 20px 32px',boxShadow:'0 -8px 40px rgba(168,85,247,0.25)',animation:'slideIn .22s ease both'}}>
        <div style={{width:36,height:4,borderRadius:99,background:C.border2,margin:'0 auto 18px'}}/>
        <div style={{textAlign:'center',marginBottom:14}}>
          <div style={{width:54,height:54,borderRadius:18,
            background:isDel?'#FFF0F0':isCopy?C.lavL:C.mintL,
            border:`1.5px solid ${isDel?'#FECDD3':isCopy?C.border2:'#BBF7D0'}`,
            display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:12}}>
            {isDel&&<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{filter:`drop-shadow(0 0 5px ${glow})`}}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>}
            {isCopy&&<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={C.lav} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{filter:`drop-shadow(0 0 5px ${glow})`}}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
            {(isAdd||(!isDel&&!isCopy))&&<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={C.mint} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{filter:`drop-shadow(0 0 5px ${glow})`}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>}
          </div>
          <div style={{fontSize:17,fontWeight:900,color:C.text,marginBottom:6}}>{title}</div>
          {message&&<div style={{fontSize:13,color:C.text3,lineHeight:1.65}} dangerouslySetInnerHTML={{__html:message}}/>}
        </div>
        <div style={{display:'flex',gap:10,marginTop:18}}>
          <button onClick={onClose}
            style={{flex:1,padding:'11px',borderRadius:999,border:`1.5px solid ${C.border}`,background:'transparent',color:C.text2,fontSize:14,fontWeight:800,cursor:'pointer',transition:'all .18s'}}
            onMouseEnter={e=>{e.currentTarget.style.background=C.bg2;e.currentTarget.style.transform='translateY(-1px)';}}
            onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.transform='translateY(0)';}}
            onMouseDown={e=>e.currentTarget.style.transform='scale(0.96)'}
            onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>
            Huỷ
          </button>
          <button onClick={()=>{onConfirm&&onConfirm();onClose();}}
            style={{flex:1,padding:'11px',borderRadius:999,border:'none',
              background:confirmGrad||confirmColor,color:'#fff',
              fontSize:14,fontWeight:900,cursor:'pointer',
              boxShadow:`0 4px 16px ${confirmColor}55`,transition:'all .18s'}}
            onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
            onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}
            onMouseDown={e=>e.currentTarget.style.transform='scale(0.96)'}
            onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
window.ConfirmDialog=ConfirmDialog;

/* ══ MAIN APP ═════════════════════════════════════════════════════════ */
function App(){
  const [authed,setAuthed]=useState(()=>{try{return localStorage.getItem(AUTH_KEY)==='1';}catch{return false;}});
  // ── Confirm dialog (dùng chung toàn app) ──
  const [confirmState,setConfirmState]=useState(null);
  const confirm_=(opts)=>setConfirmState(opts);
  // Expose để student-manager và các module khác dùng
  React.useEffect(()=>{window.showConfirm=confirm_;},[]);
  // Keyframe nhấp nháy nhẹ cho viền nút "Lưu thủ công" — chèn 1 lần duy nhất
  React.useEffect(()=>{
    if(document.getElementById('manual-save-pulse-style'))return;
    const s=document.createElement('style');
    s.id='manual-save-pulse-style';
    s.textContent=`@keyframes manualSavePulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.55);}50%{box-shadow:0 0 0 4px rgba(239,68,68,0);}}
@keyframes noTitleBlink{0%,100%{opacity:1;filter:drop-shadow(0 0 0 rgba(239,68,68,0));}50%{opacity:.35;filter:drop-shadow(0 0 5px rgba(239,68,68,0.65));}}`;
    document.head.appendChild(s);
  },[]);
  // ── Hash routing helpers ──────────────────────────────────────────
  function _parseHash(){
    const h=(location.hash||'').replace(/^#/,'');
    if(h==='dashboard')return{screen:'dashboard',homeTab:'lessons',tab:'build',editingId:null};
    if(h==='students')return{screen:'home',homeTab:'students',tab:'build',editingId:null};
    const em=h.match(/^edit\/([^/]+)(?:\/(\w+))?$/);
    if(em)return{screen:'edit',homeTab:'lessons',tab:em[2]||'build',editingId:em[1]};
    return{screen:'home',homeTab:h==='students'?'students':'lessons',tab:'build',editingId:null};
  }
  function _navigate(hash,replace=false){
    if(replace)window.history.replaceState(null,'','#'+hash);
    else window.history.pushState(null,'','#'+hash);
  }
  const _h0=_parseHash();
  const [title,setTitle]=useState('');
  const [titleDupWarn,setTitleDupWarn]=useState(false);
  const [noTitleWarn,setNoTitleWarn]=useState(false); // nhấp nháy đỏ khi thoát mà chưa đặt tên bài
  const [questions,setQ]=useState([emptyTF()]);
  const [tab,setTab]=useState(_h0.tab);
  const [homeTab,setHomeTab]=useState(_h0.homeTab);// 'lessons'|'students'
  const [showDashboard,setShowDashboard]=useState(_h0.screen==='dashboard');// Dashboard screen
  const [showBgPanel,setShowBgPanel]=useState(false);// Background settings panel
  const [rawText,setRaw]=useState('');
  const [parsing,setParsing]=useState(false);
  const [addMenu,setAddMenu]=useState(false);
  const [previewAns,setPAns]=useState([]);
  const [previewDone,setPDone]=useState(false);
  const [previewCur,setPCur]=useState(0);
  const [previewModal,setPModal]=useState(false);
  const [dark,setDark]=useState(()=>{
    // Dùng giá trị đã inject từ dark-pre-init script — tránh race condition với bg-settings
    if(window.__adminDarkInit!==undefined)return window.__adminDarkInit;
    try{
      var stored=localStorage.getItem('learnsy_admin_dark');
      if(stored==='1')return true;
      if(stored==='0')return false;
    }catch(e){}
    return window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches;
  });
  const [shuffleQ,setShuffleQ]=useState(false);
  const [shuffleA,setShuffleA]=useState(false);
  const [exportTheme,setExportTheme]=useState('full');
  const [password,setPassword]=useState('');
  const [liveQs,setLiveQs]=useState(null);
  const [lessons,setLessons]=useState([]);
  const lessonsRef=useRef([]);
  // Wrapper: luôn sync lessonsRef — khai báo sớm để mọi effect bên dưới đều dùng được
  const setLessonsSynced=useCallback((updater)=>{
    setLessons(prev=>{
      const next=typeof updater==='function'?updater(prev):updater;
      lessonsRef.current=next;
      return next;
    });
  },[]);
  const [lessonFilter,setLessonFilter]=useState('all');// 'all'|'english'|'other'

  const [editingId,setEditingId]=useState(_h0.editingId);
  const [subject,setSubject]=useState('Tiếng Anh');
  // Merge questions from other lessons
  const [mergeModal,setMergeModal]=useState(false);
  const [toolboxOpen,setToolboxOpen]=useState(false);
  const [now,setNow]=useState(()=>new Date());
  const [searchQuery,setSearchQuery]=useState('');
  const [sortBy,setSortBy]=useState('newest'); // newest|oldest|name|count
  const [timerLimit,setTimerLimit]=useState(0); // minutes, 0=no timer
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [subjectOpen,setSubjectOpen]=useState(false);
  const [cardBlur,setCardBlur]=useState(()=>{try{return localStorage.getItem('learnsy_card_blur')||'off';}catch{return'off';}});// 'off'|'50'|'85'
  const setCardBlurPersist=(v)=>{setCardBlur(v);try{localStorage.setItem('learnsy_card_blur',v);}catch{}};
  const [leaving,setLeaving]=useState(false); // ẩn QEditors trước khi unmount — tránh Samsung WebView crash
  const [headerMenuOpen,setHeaderMenuOpen]=useState(false);
  const headerMenuRef=useRef();
  const [sortMenuOpen,setSortMenuOpen]=useState(false);
  const sortMenuRef=useRef();
  const [homeTabMenuOpen,setHomeTabMenuOpen]=useState(false);
  const homeTabMenuRef=useRef();
  const [tabMenuOpen,setTabMenuOpen]=useState(false);
  const tabMenuRef=useRef();
  const [statsOpen,setStatsOpen]=useState(false);
  const statsRef=useRef();
  const [cardMenuOpenId,setCardMenuOpenId]=useState(null);
  const [cardMenuPos,setCardMenuPos]=useState(null);
  C=dark?CD:CL;window.C=C; // Gán window.C ngay khi render (không đợi useEffect) — tránh 1 frame lệch màu khi toggle dark mode
  // Helper: card blur style (áp dụng cho lesson cards & student cards)
  const cardBlurStyle=cardBlur==='off'?{}:{
    backdropFilter:`blur(${cardBlur==='85'?'22px':'10px'})`,
    WebkitBackdropFilter:`blur(${cardBlur==='85'?'22px':'10px'})`,
    background:cardBlur==='85'
      ?(dark?'rgba(30,13,21,0.55)':'rgba(255,255,255,0.5)')
      :(dark?'rgba(30,13,21,0.75)':'rgba(255,255,255,0.72)'),
  };
  
  useEffect(()=>{
    C=dark?CD:CL;window.C=C;
    document.body.classList.toggle('dark',dark);
    document.documentElement.classList.toggle('dark',dark);
    try{localStorage.setItem('learnsy_admin_dark',dark?'1':'0');}catch(e){}
    if(typeof window.adminApplyBackground==='function'&&typeof window.adminLoadBgSettings==='function'){
      window.adminApplyBackground(window.adminLoadBgSettings(),dark);
    }
  },[dark]);
  // Sync cardBlur to window so StudentManager can pick it up
  useEffect(()=>{window._cardBlur=cardBlur;window._cardBlurStyle=cardBlurStyle;},[cardBlur,dark]);
  // Lắng nghe khi Dashboard thay đổi blur (cùng trang)
  useEffect(()=>{
    const handler=(e)=>{if(e.detail?.value)setCardBlur(e.detail.value);};
    window.addEventListener('learnsy:card-blur',handler);
    return()=>window.removeEventListener('learnsy:card-blur',handler);
  },[]);
  // ── Hash routing: ghi URL khi state thay đổi ─────────────────────
  useEffect(()=>{
    if(!authed)return;
    let hash='lessons';
    if(showDashboard)hash='dashboard';
    else if(editingId)hash='edit/'+editingId+(tab&&tab!=='build'?'/'+tab:'');
    else if(homeTab==='students')hash='students';
    else hash='lessons';
    if(location.hash!=='#'+hash)_navigate(hash);
  },[authed,showDashboard,editingId,tab,homeTab]);
  // ── Hash routing: nút Back/Forward trình duyệt ───────────────────
  useEffect(()=>{
    function _onPop(){
      const s=_parseHash();
      setShowDashboard(s.screen==='dashboard');
      setHomeTab(s.homeTab);
      setTab(s.tab);
      if(s.editingId!==editingId)setEditingId(s.editingId);
    }
    window.addEventListener('popstate',_onPop);
    return()=>window.removeEventListener('popstate',_onPop);
  },[editingId]);
  // Load bài tập từ Supabase (chỉ khi đã auth)
  useEffect(()=>{
    if(!authed)return;
    // Expose setLessons so bridge can update React state
    window._reactSetLessons = setLessonsSynced; // backward compat
    // Bridge mới dùng CustomEvent thay vì gọi trực tiếp
    const _onSetLessons=(e)=>{
      if(e&&e.detail&&Array.isArray(e.detail.lessons))setLessonsSynced(e.detail.lessons);
    };
    window.addEventListener('learnsy:set-lessons',_onSetLessons);
    supa.from('lessons').select('*').order('created_at').then(({data})=>{
      if(data){
        const mapped=data.map(r=>({id:r.id,title:r.title||'',subject:r.subject||'Tiếng Anh',password:r.password||'',timerLimit:r.timerLimit||0,questions:r.questions||[],created_at:r.created_at||''}));
        setLessonsSynced(mapped);
        // Sync to bridge data
        if(window.data) window.data.lessons=mapped.map(l=>{
          // Giữ lại liveExam/disabled từ bridge nếu đã tồn tại (tránh reset khi re-render)
          const existing=(window.data.lessons||[]).find(x=>String(x.id)===String(l.id));
          return {...(existing||{}),
            ...l,
            lessonCategory:'general',
            liveExam:existing?existing.liveExam:false,
            disabled:existing?existing.disabled:false,
            timeLimit:l.timerLimit||null,
            maxAttempts:null,perUserAttempts:null,labelText:'',labelColor:'',passScore:null,
            lessonPassword:l.password||'',scoreSettings:null,settings:null,
            openAt:null,closeAt:null,created_at:l.created_at||''
          };
        });
        if(typeof window.dispatchEvent==='function') window.dispatchEvent(new CustomEvent('learnsy:render-lessons'));
      }
    });
    return()=>window.removeEventListener('learnsy:set-lessons',_onSetLessons);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[authed]); // setLessonsSynced intentionally excluded: stable useCallback but causes re-run loop if included
  const _prevEditingId=useRef(editingId);
  const _isSaving=useRef(false); // guard chống re-entrant loop
  const _dupWarnedRef=useRef(false); // chặn spam toast khi tên vẫn đang trùng
  const _isLoadingLesson=useRef(false); // guard: vừa load bài xong, chưa được phép auto-save
  const [retryTick,setRetryTick]=useState(0); // tăng lên để tự trigger lại effect auto-save sau khi guard hết hạn
  const [loadRetryTick,setLoadRetryTick]=useState(0); // retry riêng cho effect load bài (race condition lessonsRef), tách khỏi retryTick của auto-save
  useEffect(()=>{ setLoadRetryTick(0); },[editingId]); // reset bộ đếm retry mỗi khi chuyển bài, tránh cộng dồn giới hạn từ lần trước
  const toast_=useCallback((msg,ms=3000)=>{
    let type='auto',txt=msg;
    const p=msg&&msg[0];
    if(p==='+'){type='success';txt=msg.slice(2);}
    else if(p==='!'){type='warn';txt=msg.slice(2);}
    else if(p==='x'){type='error';txt=msg.slice(2);}
    (window.showDiToast||window.showToast)?.(txt,type,ms);
  },[]);
  useEffect(()=>{
    if(!authed)return;
    if(editingId===null)return;
    setLeaving(false); // reset khi vào bài mới
    setNoTitleWarn(false); // reset cảnh báo chưa đặt tên khi chuyển bài
    _isLoadingLesson.current=true; // chặn auto-save trong lúc load
    _dupWarnedRef.current=false; // reset cảnh báo trùng tên khi chuyển bài
    const l=lessonsRef.current.find(l=>l.id===editingId);
    if(l){
      setTitle(l.title||'');setSubject(l.subject||'Tiếng Anh');setPassword(l.password||'');setQ(l.questions&&l.questions.length?l.questions:[emptyTF()]);setTimerLimit(l.timerLimit||0);
      // Tắt guard sau 1.2s (> debounce 800ms) — đủ để state settle xong
      const t=setTimeout(()=>{_isLoadingLesson.current=false;},1200);
      return()=>clearTimeout(t);
    }
    // Không tìm thấy bài trong lessonsRef — thường do race condition ngay sau khi tạo bài mới
    // (setLessonsSynced + setEditingId cùng lúc, lessonsRef chưa kịp sync khi effect này chạy).
    // KHÔNG được set title/questions rỗng ở đây rồi tắt guard — nếu làm vậy, auto-save
    // sẽ đè state rỗng lên bản ghi đã có dữ liệu thật trên Supabase, gây mất câu hỏi.
    // Thay vào đó: giữ guard bật, tự retry sau 250ms tới khi lessonsRef có bài hoặc hết thời gian chờ (tối đa ~5s).
    if(loadRetryTick>=20){
      console.error('[load-lesson] Không tìm thấy bài sau nhiều lần thử — có thể bài đã bị xoá hoặc lỗi tải dữ liệu.',editingId);
      _isLoadingLesson.current=false; // hết cách retry, mở guard để không kẹt vĩnh viễn
      toast_('x Không tải được bài này. Thử vào lại từ danh sách nhé!',4000);
      return;
    }
    console.warn('[load-lesson] Không tìm thấy bài trong lessonsRef, thử lại...',editingId,'lần',loadRetryTick+1);
    const retryId=setTimeout(()=>{setLoadRetryTick(v=>v+1);},250);
    return()=>clearTimeout(retryId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[editingId,authed,loadRetryTick]); // ← KHÔNG đưa lessons vào deps: tránh loop khi setLessons sau save
  // Chống trùng tên — kiểm tra realtime khi gõ tiêu đề, so với các bài tập khác (không tính bài đang sửa)
  useEffect(()=>{
    if(editingId===null){setTitleDupWarn(false);return;}
    const t=(title||'').trim().toLowerCase();
    if(!t){setTitleDupWarn(false);return;}
    const dup=lessonsRef.current.some(l=>l.id!==editingId&&(l.title||'').trim().toLowerCase()===t);
    setTitleDupWarn(dup);
  },[title,editingId,lessons]);
  const [saveDebug,setSaveDebug]=useState({
    status:'idle',        // idle | pending | saving | saved | error | dup-blocked
    lastSavedAt:null,     // timestamp lần lưu thành công gần nhất
    lastDurationMs:null,  // thời gian request lưu mất bao lâu (ms)
    lastError:null,       // message lỗi gần nhất (nếu có)
    table:'lessons',      // bảng Supabase đang ghi vào
    lessonId:null,        // id bài đang theo dõi
  });
  const [debugPanelOpen,setDebugPanelOpen]=useState(false);
  useEffect(()=>{
    // Skip auto-save nếu editingId vừa đổi (chuyển bài, không phải edit)
    if(editingId===null)return;
    if(_prevEditingId.current!==editingId){_prevEditingId.current=editingId;return;}
    // Skip nếu đang trong quá trình save (setLessons/renderLessons vừa trigger re-render)
    if(_isSaving.current)return;
    // Nếu vừa load bài (guard còn hiệu lực): KHÔNG bỏ qua vĩnh viễn — tự retry sau khi guard hết hạn,
    // để tránh mất các thay đổi (vd. gõ tên) xảy ra trong lúc guard đang bật.
    if(_isLoadingLesson.current){
      const retryId=setTimeout(()=>{
        setRetryTick(v=>v+1); // trigger lại effect này khi guard đã hết hạn
      },1300);
      return()=>clearTimeout(retryId);
    }
    // Sync to bridge
    if(window.data){
      const idx=(window.data.lessons||[]).findIndex(l=>String(l.id)===String(editingId));
      if(idx>=0) Object.assign(window.data.lessons[idx],{title,subject,questions,password,lessonPassword:password,timerLimit,timeLimit:timerLimit||null});
    }
    setSaveDebug(d=>({...d,status:'pending',lessonId:editingId}));
    const t=setTimeout(()=>{
      // Chặn lưu nếu tên trùng với bài tập khác — không upsert lên Supabase
      const tt=(title||'').trim().toLowerCase();
      if(tt&&lessonsRef.current.some(l=>l.id!==editingId&&(l.title||'').trim().toLowerCase()===tt)){
        if(!_dupWarnedRef.current){toast_('x Tên bài tập bị trùng! Đổi tên khác để lưu được nhé.',3500);_dupWarnedRef.current=true;}
        setSaveDebug(d=>({...d,status:'dup-blocked',lastError:'Tên bài tập bị trùng'}));
        return;
      }
      _dupWarnedRef.current=false;
      _isSaving.current=true;
      const _saveStart=performance.now();
      setSaveDebug(d=>({...d,status:'saving'}));
      supa.from('lessons').upsert({id:editingId,title,subject,questions,password,timerLimit},{onConflict:'id'})
        .then(({error})=>{
          const durationMs=Math.round(performance.now()-_saveStart);
          if(error){
            console.error('Auto-save error:',error);toast_('x Lưu thất bại: '+error.message,4000);
            setSaveDebug(d=>({...d,status:'error',lastError:error.message,lastDurationMs:durationMs}));
          }
          else{
            setLessonsSynced(prev=>prev.map(l=>l.id===editingId?{...l,title,subject,questions,password,timerLimit}:l));
            // Bọc vào setTimeout để phá vỡ vòng lặp đồng bộ đè Stack
            setTimeout(()=>{
              window.dispatchEvent(new CustomEvent('learnsy:render-lessons'));
            },0);
            if(typeof invalidateCache==='function') invalidateCache();
            setSaveDebug(d=>({...d,status:'saved',lastError:null,lastDurationMs:durationMs,lastSavedAt:Date.now()}));
          }
        })
        .finally(()=>{
          // Reset flag sau 500ms — đủ để setLessons flush xong và effect deps không retrigger nữa
          setTimeout(()=>{_isSaving.current=false;},500);
        });
    },800);
    return()=>clearTimeout(t);
  },[title,subject,questions,password,timerLimit,editingId,toast_,retryTick]);
  // Lưu thủ công — bỏ qua debounce, lưu ngay lập tức khi bấm nút
  const manualSave=useCallback(()=>{
    if(editingId===null)return;
    const tt=(title||'').trim().toLowerCase();
    if(tt&&lessonsRef.current.some(l=>l.id!==editingId&&(l.title||'').trim().toLowerCase()===tt)){
      if(!_dupWarnedRef.current){toast_('x Tên bài tập bị trùng! Đổi tên khác để lưu được nhé.',3500);_dupWarnedRef.current=true;}
      setSaveDebug(d=>({...d,status:'dup-blocked',lastError:'Tên bài tập bị trùng'}));
      return;
    }
    _dupWarnedRef.current=false;
    _isSaving.current=true;
    const _saveStart=performance.now();
    setSaveDebug(d=>({...d,status:'saving',lessonId:editingId}));
    supa.from('lessons').upsert({id:editingId,title,subject,questions,password,timerLimit},{onConflict:'id'})
      .then(({error})=>{
        const durationMs=Math.round(performance.now()-_saveStart);
        if(error){
          console.error('Manual save error:',error);toast_('x Lưu thất bại: '+error.message,4000);
          setSaveDebug(d=>({...d,status:'error',lastError:error.message,lastDurationMs:durationMs}));
        }
        else{
          setLessonsSynced(prev=>prev.map(l=>l.id===editingId?{...l,title,subject,questions,password,timerLimit}:l));
          setTimeout(()=>{
            window.dispatchEvent(new CustomEvent('learnsy:render-lessons'));
          },0);
          if(typeof invalidateCache==='function') invalidateCache();
          setSaveDebug(d=>({...d,status:'saved',lastError:null,lastDurationMs:durationMs,lastSavedAt:Date.now()}));
          toast_('✓ Đã lưu',1500);
        }
      })
      .finally(()=>{
        setTimeout(()=>{_isSaving.current=false;},500);
      });
  },[editingId,title,subject,questions,password,timerLimit,toast_]);
  const jsonRef=useRef();
  const addMenuRef=useRef();
  const toolboxRef=useRef();
  const saveBtnRef=useRef();
  const subjectRef=useRef();
  useEffect(()=>{
    if(!addMenu)return;
    const handler=(e)=>{if(addMenuRef.current&&!addMenuRef.current.contains(e.target))setAddMenu(false);};
    document.addEventListener('mousedown',handler);
    document.addEventListener('touchstart',handler);
    return()=>{document.removeEventListener('mousedown',handler);document.removeEventListener('touchstart',handler);};
  },[addMenu]);
  useEffect(()=>{
    if(!toolboxOpen)return;
    const handler=(e)=>{if(toolboxRef.current&&!toolboxRef.current.contains(e.target))setToolboxOpen(false);};
    document.addEventListener('mousedown',handler);
    document.addEventListener('touchstart',handler);
    return()=>{document.removeEventListener('mousedown',handler);document.removeEventListener('touchstart',handler);};
  },[toolboxOpen]);
  // Đồng hồ thời gian thực UTC+7 — chạy liên tục, không phụ thuộc múi giờ máy
  useEffect(()=>{
    const t=setInterval(()=>setNow(new Date()),1000);
    return()=>clearInterval(t);
  },[]);
  useEffect(()=>{
    if(!debugPanelOpen)return;
    const handler=(e)=>{if(saveBtnRef.current&&!saveBtnRef.current.contains(e.target))setDebugPanelOpen(false);};
    document.addEventListener('mousedown',handler);
    document.addEventListener('touchstart',handler);
    return()=>{document.removeEventListener('mousedown',handler);document.removeEventListener('touchstart',handler);};
  },[debugPanelOpen]);
  // Luôn hiển thị theo múi giờ Việt Nam (UTC+7, không có giờ mùa hè) — bất kể máy đang ở múi giờ nào
  const vnZone='Asia/Ho_Chi_Minh';
  const vnTimeStr=now.toLocaleTimeString('vi-VN',{timeZone:vnZone,hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const vnDateStr=now.toLocaleDateString('vi-VN',{timeZone:vnZone,weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});
  useEffect(()=>{
    if(!subjectOpen)return;
    const handler=(e)=>{if(subjectRef.current&&!subjectRef.current.contains(e.target))setSubjectOpen(false);};
    document.addEventListener('mousedown',handler);
    document.addEventListener('touchstart',handler);
    return()=>{document.removeEventListener('mousedown',handler);document.removeEventListener('touchstart',handler);};
  },[subjectOpen]);
  useEffect(()=>{
    if(!headerMenuOpen)return;
    const handler=(e)=>{if(headerMenuRef.current&&!headerMenuRef.current.contains(e.target))setHeaderMenuOpen(false);};
    document.addEventListener('mousedown',handler);
    document.addEventListener('touchstart',handler);
    return()=>{document.removeEventListener('mousedown',handler);document.removeEventListener('touchstart',handler);};
  },[headerMenuOpen]);
  useEffect(()=>{
    if(!sortMenuOpen)return;
    const handler=(e)=>{if(sortMenuRef.current&&!sortMenuRef.current.contains(e.target))setSortMenuOpen(false);};
    document.addEventListener('mousedown',handler);
    document.addEventListener('touchstart',handler);
    return()=>{document.removeEventListener('mousedown',handler);document.removeEventListener('touchstart',handler);};
  },[sortMenuOpen]);
  useEffect(()=>{
    if(!homeTabMenuOpen)return;
    const handler=(e)=>{if(homeTabMenuRef.current&&!homeTabMenuRef.current.contains(e.target))setHomeTabMenuOpen(false);};
    document.addEventListener('mousedown',handler);
    document.addEventListener('touchstart',handler);
    return()=>{document.removeEventListener('mousedown',handler);document.removeEventListener('touchstart',handler);};
  },[homeTabMenuOpen]);
  useEffect(()=>{
    if(!tabMenuOpen)return;
    const handler=(e)=>{if(tabMenuRef.current&&!tabMenuRef.current.contains(e.target))setTabMenuOpen(false);};
    document.addEventListener('mousedown',handler);
    document.addEventListener('touchstart',handler);
    return()=>{document.removeEventListener('mousedown',handler);document.removeEventListener('touchstart',handler);};
  },[tabMenuOpen]);
  useEffect(()=>{
    if(!statsOpen)return;
    const handler=(e)=>{if(statsRef.current&&!statsRef.current.contains(e.target))setStatsOpen(false);};
    document.addEventListener('mousedown',handler);
    document.addEventListener('touchstart',handler);
    return()=>{document.removeEventListener('mousedown',handler);document.removeEventListener('touchstart',handler);};
  },[statsOpen]);
  useEffect(()=>{
    if(!cardMenuOpenId)return;
    const handler=(e)=>{if(!e.target.closest('[data-card-menu]')){setCardMenuOpenId(null);setCardMenuPos(null);}};
    const closeOnScroll=()=>{setCardMenuOpenId(null);setCardMenuPos(null);};
    document.addEventListener('mousedown',handler);
    document.addEventListener('touchstart',handler);
    window.addEventListener('scroll',closeOnScroll,true);
    return()=>{document.removeEventListener('mousedown',handler);document.removeEventListener('touchstart',handler);window.removeEventListener('scroll',closeOnScroll,true);};
  },[cardMenuOpenId]);

  const addQ=useCallback((t)=>{
    const q=newQ(t);
    setQ(p=>[...p,q]);
    setAddMenu(false);
    // Cuộn đúng tới câu hỏi vừa thêm (không đoán toạ độ tuyệt đối của trang,
    // vì scrollTo({top:9999}) có thể dừng giữa chừng nếu DOM chưa render kịp
    // trên danh sách dài — từng gây nhảy lộn tới câu hỏi cũ khác).
    // Thử vài lần vì DOM của câu hỏi mới có thể chưa mount ngay sau setQ.
    let tries=0;
    const tryScroll=()=>{
      const el=document.getElementById(`q-block-${q.id}`);
      if(el){el.scrollIntoView({behavior:'smooth',block:'start'});}
      else if(tries<10){tries++;setTimeout(tryScroll,80);}
    };
    setTimeout(tryScroll,60);
  },[]);
  const removeQ=useCallback((id)=>setQ(p=>p.filter(q=>q.id!==id)),[]);
  const upQ=useCallback((id,f,v)=>setQ(p=>p.map(q=>q.id===id?{...q,[f]:v}:q)),[]);
  const upItem=useCallback((id,ii,f,v)=>setQ(p=>p.map(q=>q.id===id?{...q,items:(q.items||[]).map((it,i)=>i===ii?{...it,[f]:v}:it)}:q)),[]);
  const addItem=useCallback((id)=>setQ(p=>p.map(q=>q.id===id?{...q,items:[...(q.items||[]),{text:'',answer:true}]}:q)),[]);
  const remItem=useCallback((id,ii)=>setQ(p=>p.map(q=>q.id===id&&(q.items||[]).length>2?{...q,items:q.items.filter((_,i)=>i!==ii)}:q)),[]);
  const upOpt=useCallback((id,ii,v)=>setQ(p=>p.map(q=>q.id===id?{...q,options:(q.options||[]).map((o,i)=>i===ii?v:o)}:q)),[]);
  const addOpt=useCallback((id)=>setQ(p=>p.map(q=>q.id===id&&(q.options||[]).length<6?{...q,options:[...(q.options||[]),'']}:q)),[]);
  const remOpt=useCallback((id,ii)=>setQ(p=>p.map(q=>q.id===id&&(q.options||[]).length>2?{...q,options:q.options.filter((_,i)=>i!==ii),correct:typeof q.correct==='number'&&q.correct>=ii?Math.max(0,q.correct-1):q.correct}:q)),[]);


  const addLesson=useCallback(async()=>{
    const id='l'+Date.now();
    const lesson={id,title:'',subject:'Tiếng Anh',password:'',questions:[emptyTF()]};
    const {error}=await supa.from('lessons').insert({id,title:lesson.title,subject:lesson.subject,password:lesson.password,questions:lesson.questions,created_at:new Date().toISOString()});
    if(error){toast_('x Không tạo được bài: '+error.message,5000);console.error('Insert error:',error);return;}
    if(typeof invalidateCache==="function") invalidateCache();
    setLessonsSynced(prev=>[...prev,lesson]);
    // Đảm bảo lessonsRef.current đã có bài mới TRƯỚC khi đổi editingId —
    // tránh race condition: nếu effect load chạy trước khi lessonsRef kịp sync,
    // nó sẽ không tìm thấy bài (l=undefined) và bỏ qua việc set title/questions,
    // khiến state giữ nguyên rỗng rồi auto-save đè đúng cái rỗng đó lên Supabase.
    if(!lessonsRef.current.some(l=>l.id===id)) lessonsRef.current=[...lessonsRef.current,lesson];
    setTitle('');setSubject('Tiếng Anh');setPassword('');setQ([emptyTF()]);
    setEditingId(id);setTab('build');
    setTimeout(()=>(window.showDiToast||window.showToast)?.('Đã tạo bài mới! Nhập tên bài tập nhé','success',2500),100);
  },[toast_]);
  const deleteLesson=useCallback(async(id,e,_confirmed=false)=>{
    e&&e.stopPropagation();
    if(!_confirmed&&!window.confirm('Xoá bài tập này?'))return;
    await supa.from('lessons').delete().eq('id',id);
    if(typeof invalidateCache==="function") invalidateCache();
    setLessonsSynced(prev=>prev.filter(l=>l.id!==id));
    window.dispatchEvent(new CustomEvent('learnsy:delete-success'));
  },[]);
  const goHome=useCallback(()=>{
    // Chặn thoát nếu đang sửa bài mà chưa đặt tên — tránh lưu/rời đi với bài "Chưa đặt tên"
    if(editingId!==null&&!(title||'').trim()){
      setTab('build'); // đưa về tab có ô nhập tên để người dùng thấy ngay
      setNoTitleWarn(true);
      toast_('x Đặt tên cho bài tập trước khi thoát nhé!',3000);
      setTimeout(()=>setNoTitleWarn(false),3000);
      return;
    }
    // Blur contenteditable trước — dừng Samsung WebView inject DOM nodes
    document.querySelectorAll('[contenteditable]').forEach(el=>el.blur());
    if(document.activeElement)document.activeElement.blur();
    // display:none QEditors ngay (setLeaving) → đợi 150ms → mới unmount (setEditingId null)
    // Tránh race condition: React unmount contenteditable trong khi browser còn mutation
    setLeaving(true);
    setTimeout(()=>{setEditingId(null);setTab('build');},150);
  },[editingId,title,toast_]);
  const handleMergeQuestions=useCallback((toAdd)=>{
    if(!toAdd||!toAdd.length)return;
    setQ(p=>[...p,...toAdd]);
    toast_(`+ Đã gộp ${toAdd.length} câu hỏi vào bài tập!`,3000);
  },[toast_]);
  const makeUniqueTitle=useCallback((base,excludeId)=>{
    const existing=new Set(lessonsRef.current.filter(l=>l.id!==excludeId).map(l=>(l.title||'').trim().toLowerCase()));
    let candidate=(base||'').trim();
    if(!candidate)return candidate; // để trống thì cứ để trống, không tự chế tên
    if(!existing.has(candidate.toLowerCase()))return candidate;
    let n=2;
    while(existing.has(`${candidate} (${n})`.toLowerCase()))n++;
    return `${candidate} (${n})`;
  },[]);
  const dupLesson=useCallback(async(l,e)=>{
    e&&e.stopPropagation();
    const id='l'+Date.now();
    const newTitle=makeUniqueTitle((l.title||'')+' (bản sao)');
    const dup={...l,id,title:newTitle,questions:l.questions.map(q=>({...q,id:Date.now()+Math.random()}))};
    await supa.from('lessons').insert({id:dup.id,title:dup.title,subject:dup.subject,password:dup.password,questions:dup.questions});
    if(typeof invalidateCache==="function") invalidateCache();
    setLessonsSynced(prev=>[...prev,dup]);
    toast_('+ Đã sao chép bài tập!');
  },[toast_,makeUniqueTitle]);

  const handleParse=()=>{
    if(!rawText.trim()){toast_('! Dán nội dung câu hỏi vào trước!');return;}
    setParsing(true);
    setTimeout(()=>{
      try{
        const parsed=parseText(rawText);
        if(!parsed.length){toast_('! Không nhận diện được. Thử định dạng khác!');setParsing(false);return;}
        setQ(p=>[...p,...parsed]);setRaw('');setTab('build');
        toast_(`+ Đã thêm ${parsed.length} câu hỏi!`);
      }catch(e){toast_('x Lỗi: '+e.message);}
      setParsing(false);
    },400);
  };
  const handleJSONFile=(e)=>{
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      try{
        const parsed=importJSON(ev.target.result);
        if(!parsed.length){toast_('! Không tìm thấy câu hỏi trong JSON!');return;}
        setQ(p=>[...p,...parsed]);setTab('build');
        toast_(`+ Đã import ${parsed.length} câu từ JSON!`);
      }catch(err){toast_('x File JSON lỗi: '+err.message);}
    };
    reader.readAsText(file,'utf-8');e.target.value='';
  };
  const handleExport=()=>{
    if(!lessons.length){toast_('! Chưa có bài tập nào!');return;}
    const validLessons=lessons.filter(l=>l.questions&&l.questions.length>0);
    if(!validLessons.length){toast_('! Chưa có câu hỏi trong bộ nào!');return;}
    const html=exportTheme==='lite'
      ?buildExportLiteHTML(validLessons,shuffleQ,shuffleA,timerLimit)
      :buildExportHTML(validLessons,shuffleQ,shuffleA,timerLimit);
    const blob=new Blob([html],{type:'text/html'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download='thu-anh-quiz.html';a.click();
    toast_(`+ Đã xuất ${validLessons.length} bài tập!`);
  };
  const handleExportJSON=()=>{
    const blob=new Blob([JSON.stringify(questions,null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download=(title.trim().replace(/\s+/g,'-').toLowerCase()||'quiz')+'.json';a.click();
    toast_('+ Đã lưu JSON! Lần sau import lại dễ dàng');
  };
  const startPreview=()=>{
    const _sf=a=>{const r=[...a];for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];}return r;};
    let qs=questions.map(q=>{
      if(!shuffleA)return q;
      if(q.type==='multiple'){const opts=q.options||[];const cv=opts[q.correct];const o=_sf([...opts]);return{...q,options:o,correct:o.indexOf(cv)};}
      if(q.type==='multi_select'){const opts=q.options||[];const cvs=(q.correct||[]).map(i=>opts[i]);const o=_sf([...opts]);return{...q,options:o,correct:cvs.map(v=>o.indexOf(v))};}
      if(q.type==='true_false')return{...q,items:_sf([...(q.items||[])])};
      return q;
    });
    if(shuffleQ)qs=_sf(qs);
    setLiveQs(qs);
    setPAns(qs.map(q=>{if(q.type==='true_false')return (q.items||[]).map(()=>null);if(q.type==='multi_select')return[];return null;}));
    setPDone(false);setPCur(0);setPModal(false);setTab('preview');
  };
  const countByType=t=>questions.filter(q=>q.type===t).length;

  // Auth gate — đặt trước tất cả conditional render
  if(!authed)return <LoginScreen dark={dark} onAuth={()=>{try{localStorage.setItem(AUTH_KEY,'1');}catch{}setAuthed(true);}}/>;

  /* ── HOME SCREEN ── */
  if(editingId===null){
    const SUBJECTS=['Tiếng Anh','Lịch Sử','Địa Lý','Vật Lý','GDKTPL','GDQPAN','Công Nghệ','Ngữ Văn','Khác'];
    return(<>
      {/* ══ DASHBOARD SCREEN ══ */}
      {showDashboard&&typeof AdminDashboard!=='undefined'&&(
        <AdminDashboard
          lessons={lessons}
          dark={dark}
          C={C}
          onDarkToggle={()=>setDark(d=>!d)}
          onClose={()=>setShowDashboard(false)}
        />
      )}
      {!showDashboard&&(<>
      <div style={{minHeight:'100vh',background:'transparent',color:C.text,maxWidth:760,margin:'0 auto',position:'relative'}}>
        {/* HEADER */}
        <div style={{background:dark?'rgba(30,13,21,0.97)':'rgba(255,255,255,0.95)',borderBottom:`1.5px solid ${C.border}`,position:'sticky',top:0,zIndex:60,backdropFilter:'blur(20px)',boxShadow:'0 2px 20px rgba(255,100,150,0.08)',padding:'12px 14px 10px'}}>
          <div style={{display:'flex',alignItems:'center',gap:6,minWidth:0}}>
            <span className="logo-fl">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="url(#lg1)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <defs><linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f472b6"/><stop offset="100%" stopColor="#6366f1"/></linearGradient></defs>
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
            </span>
            <span className="logo-wrap" style={{display:'inline-flex',flexDirection:'column',alignItems:'flex-start',lineHeight:1}}>
              <span className="logo-learnsy">Learnsy</span>
            </span>
            <span className="logo-flb"><Sparkle s={13} c="#6366f1"/></span>
            <span style={{fontSize:10,fontWeight:900,color:C.lav,background:C.lavL,border:`1.5px solid ${C.border2}`,borderRadius:99,padding:'2px 7px',marginLeft:1,flexShrink:0}}>Admin</span>
            <div style={{flex:1}}/>
            {/* Menu — gồm tất cả tuỳ chọn, kể cả đăng xuất */}
            <div ref={headerMenuRef} style={{position:'relative',flexShrink:0}}>
              <button title="Menu" onClick={()=>setHeaderMenuOpen(p=>!p)}
                style={{display:'flex',alignItems:'center',justifyContent:'center',width:32,height:32,borderRadius:999,
                  border:`1.5px solid ${headerMenuOpen?C.lav:C.border2}`,
                  background:headerMenuOpen?C.grad:C.lavL,
                  color:headerMenuOpen?'#fff':C.lav,
                  cursor:'pointer',transition:'all .18s',boxShadow:headerMenuOpen?'0 2px 12px rgba(168,85,247,0.3)':'none'}}>
                {headerMenuOpen
                  ?<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  :<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{filter:'drop-shadow(0 0 3px rgba(168,85,247,.6))'}}><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></svg>}
              </button>
              {/* Dropdown */}
              {headerMenuOpen&&(
                <div style={{position:'absolute',top:'calc(100% + 8px)',right:0,
                  background:dark?'#1E0D15':'#fff',
                  border:`1.5px solid ${C.border2}`,borderRadius:16,
                  boxShadow:'0 8px 32px rgba(168,85,247,0.18)',
                  padding:'6px',display:'flex',flexDirection:'column',gap:4,minWidth:170,
                  animation:'fadeUp .15s ease both',zIndex:200}}>
                  {/* Tùy chỉnh nền */}
                  <button onClick={()=>{setShowBgPanel(p=>!p);setHeaderMenuOpen(false);}}
                    style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:10,border:'none',
                      background:showBgPanel?C.roseL:'transparent',color:showBgPanel?C.rose:C.text2,
                      cursor:'pointer',fontSize:13,fontWeight:700,textAlign:'left',transition:'background .12s'}}
                    onMouseEnter={e=>e.currentTarget.style.background=C.rosePale}
                    onMouseLeave={e=>e.currentTarget.style.background=showBgPanel?C.roseL:'transparent'}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
                      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
                      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
                    </svg>
                    Tùy chỉnh nền
                  </button>
                  {/* Student page */}
                  <a href="index.html" onClick={()=>setHeaderMenuOpen(false)}
                    style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:10,
                      color:C.text2,textDecoration:'none',fontSize:13,fontWeight:700,transition:'background .12s'}}
                    onMouseEnter={e=>e.currentTarget.style.background=C.rosePale}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    Trang học sinh
                  </a>
                  {/* Dashboard */}
                  <button onClick={()=>{setShowDashboard(true);setHeaderMenuOpen(false);}}
                    style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:10,border:'none',
                      background:'transparent',color:C.text2,cursor:'pointer',fontSize:13,fontWeight:700,textAlign:'left',transition:'background .12s'}}
                    onMouseEnter={e=>e.currentTarget.style.background=C.lavL}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                    </svg>
                    Dashboard
                  </button>
                  {/* Dark mode */}
                  <button onClick={()=>{setDark(d=>!d);setHeaderMenuOpen(false);}}
                    style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:10,border:'none',
                      background:'transparent',color:C.text2,cursor:'pointer',fontSize:13,fontWeight:700,textAlign:'left',transition:'background .12s'}}
                    onMouseEnter={e=>e.currentTarget.style.background=C.lavL}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    {dark
                      ?<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FCD34D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                      :<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A855F7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
                    {dark?'Sáng':'Tối'}
                  </button>
                  {/* Đăng xuất */}
                  <div style={{height:1,background:C.border,margin:'4px 2px'}}/>
                  <button onClick={()=>{try{localStorage.removeItem(AUTH_KEY);}catch{}setAuthed(false);setHeaderMenuOpen(false);}}
                    style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:10,border:'none',
                      background:'transparent',color:'#EF4444',cursor:'pointer',fontSize:13,fontWeight:800,textAlign:'left',transition:'background .12s'}}
                    onMouseEnter={e=>e.currentTarget.style.background=dark?'rgba(239,68,68,0.14)':'#FEF2F2'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* BG SETTINGS PANEL */}
        {showBgPanel&&typeof window.AdminBgSettingsCard==='function'&&(()=>{
          const AdminBgSettingsCard=window.AdminBgSettingsCard;
          return(
            <div style={{position:'sticky',top:0,zIndex:55,padding:'8px 12px',
              background:dark?'rgba(15,12,41,0.97)':'rgba(248,250,252,0.97)',
              borderBottom:`1.5px solid ${C.border}`,backdropFilter:'blur(16px)',
              animation:'fadeUp .18s ease both'}}>
              <AdminBgSettingsCard dark={dark}/>
            </div>
          );
        })()}
        {/* BODY */}
        {/* ── Home Tab Switcher — 1 nút pill, bấm bung dropdown mini giống menu header ── */}
        <div style={{padding:'10px 14px',borderBottom:`1.5px solid ${C.border}`,background:dark?'rgba(30,13,21,0.97)':'rgba(255,255,255,0.95)'}}>
          {(()=>{
            const HOME_TABS=[
              ['lessons',<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,'Bài học'],
              ['listening',<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/></svg>,'Listening'],
              ['files',<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,'Tài liệu'],
              ['vocab',<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,'Từ vựng'],
              ['students',<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,'Học sinh'],
            ];
            const cur=HOME_TABS.find(t=>t[0]===homeTab)||HOME_TABS[0];
            return(
              <div ref={homeTabMenuRef} style={{position:'relative'}}>
                <button onClick={()=>setHomeTabMenuOpen(p=>!p)} style={{
                  display:'flex',alignItems:'center',gap:8,padding:'9px 14px',width:'100%',
                  borderRadius:16,border:`1.5px solid ${homeTabMenuOpen?C.lav:'transparent'}`,
                  background:C.grad,color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer',
                  boxShadow:'0 3px 14px rgba(168,85,247,0.28)',transition:'all .2s cubic-bezier(.34,1.56,.64,1)',
                }}>
                  <span style={{display:'flex',flexShrink:0}}>{cur[1]}</span>
                  <span style={{flex:1,textAlign:'left'}}>{cur[2]}</span>
                  <span style={{display:'flex',flexShrink:0,transition:'transform .25s cubic-bezier(.34,1.56,.64,1)',transform:homeTabMenuOpen?'rotate(180deg)':'rotate(0deg)'}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </span>
                </button>
                {homeTabMenuOpen&&(
                  <div style={{
                    position:'absolute',top:'calc(100% + 8px)',left:0,right:0,zIndex:120,
                    background:dark?'#1E0D15':'#fff',border:`1.5px solid ${C.border2}`,borderRadius:18,
                    boxShadow:'0 10px 34px rgba(168,85,247,0.2)',padding:6,
                    display:'flex',flexDirection:'column',gap:3,
                    animation:'fadeUp .18s cubic-bezier(.16,1,.3,1) both',transformOrigin:'top center',
                  }}>
                    {HOME_TABS.map(([k,icon,l])=>{
                      const active=homeTab===k;
                      return(
                        <button key={k} onClick={()=>{setHomeTab(k);setHomeTabMenuOpen(false);}} style={{
                          display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:12,border:'none',
                          background:active?C.lavL:'transparent',color:active?C.lav:C.text2,
                          fontSize:13.5,fontWeight:active?900:700,cursor:'pointer',textAlign:'left',
                          transition:'background .15s',
                        }}
                          onMouseEnter={e=>{if(!active)e.currentTarget.style.background=C.rosePale;}}
                          onMouseLeave={e=>{if(!active)e.currentTarget.style.background='transparent';}}>
                          <span style={{display:'flex',flexShrink:0}}>{icon}</span>
                          {l}
                          {active&&<span style={{marginLeft:'auto',display:'flex'}}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
        {homeTab==='students'&&<StudentManager dark={dark} C={C} cardBlur={cardBlur} cardBlurStyle={cardBlurStyle}/>}
        {homeTab==='listening'&&ListeningManager&&<ListeningManager dark={dark} C={C} confirm_={confirm_} toast_={toast_}/>}
        {homeTab==='files'&&FileManager&&<FileManager dark={dark} C={C} confirm_={confirm_} toast_={toast_}/>}
        {homeTab==='vocab'&&VocabularyManager&&<VocabularyManager dark={dark} C={C} confirm_={confirm_} toast_={toast_}/>}
        <div style={{display:homeTab==='lessons'?'flex':'none',padding:'16px 12px 100px',flexDirection:'column',gap:16}} className="fade-up">
          {/* Stats + Add button */}
          <div style={{paddingBottom:16,marginBottom:2,borderBottom:`1.5px solid ${C.border}`}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{flex:1}}>
              <div style={{fontSize:18,fontWeight:900,color:C.text,lineHeight:1.2}}>Bài học</div>
              <div style={{fontSize:12,color:C.text3,marginTop:4}}>{lessons.length} bài · {lessons.reduce((a,l)=>a+(l.questions?.length||0),0)} câu hỏi</div>
            </div>
            {lessons.length>0&&(
            <button onClick={()=>confirm_({
                iconType:'add',title:'Tạo bài tập mới?',
                message:'Bài tập mới sẽ được tạo và lưu vào Supabase.',
                confirmLabel:'Tạo ngay',confirmColor:'#A855F7',
                confirmGrad:'linear-gradient(135deg,#F472B6,#A855F7)',
                onConfirm:addLesson,
              })}
              style={{display:'flex',alignItems:'center',gap:6,padding:'10px 16px',borderRadius:999,border:'none',background:C.grad,color:'#fff',fontSize:13,fontWeight:900,cursor:'pointer',boxShadow:'0 4px 16px rgba(168,85,247,0.3)',flexShrink:0}}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M11 9h4v2h-4v4H9v-4H5V9h4V5h2v4z"/></svg>
              Thêm bài mới
            </button>
            )}
          </div>
          </div>

          {lessons.length>0&&(<>
          {/* Search bar */}
          <div style={{position:'relative'}}>
            <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm bài tập..."
              style={{width:'100%',padding:'10px 14px 10px 36px',borderRadius:999,border:`1.5px solid ${searchQuery?C.lav:C.border}`,background:C.surface,color:C.text,fontSize:13,fontWeight:700,outline:'none',fontFamily:'Nunito,sans-serif',transition:'all .2s'}}/>
            <svg style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none',filter:'drop-shadow(0 0 3px rgba(168,85,247,.5))'}} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={searchQuery?C.lav:C.text3} strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            {searchQuery&&<button onClick={()=>setSearchQuery('')}
              style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',
                width:22,height:22,display:'flex',alignItems:'center',justifyContent:'center',
                background:'none',border:'none',borderRadius:999,cursor:'pointer',color:C.text3,
                fontSize:16,lineHeight:1,transition:'background .15s,color .15s,transform .15s',
                animation:'pop .18s cubic-bezier(0.34,1.56,0.64,1) both'}}
              onMouseEnter={e=>{e.currentTarget.style.background=C.rosePale;e.currentTarget.style.color=C.rose;}}
              onMouseLeave={e=>{e.currentTarget.style.background='none';e.currentTarget.style.color=C.text3;}}
              onMouseDown={e=>e.currentTarget.style.transform='translateY(-50%) scale(0.85)'}
              onMouseUp={e=>e.currentTarget.style.transform='translateY(-50%) scale(1)'}>×</button>}
          </div>

          {/* Bộ lọc + sắp xếp — gộp 8 nút rời rạc (4 sort + Blur + 3 môn) thành 1 thanh gọn */}
          {(()=>{
            const tabDefs=[
              {key:'all',text:'Tất cả',count:lessons.length},
              {key:'english',text:'Tiếng Anh',count:lessons.filter(l=>l.subject==='Tiếng Anh').length},
              {key:'other',text:'Các môn',count:lessons.filter(l=>l.subject!=='Tiếng Anh').length},
            ];
            const sortDefs=[['newest','Mới nhất'],['oldest','Cũ nhất'],['name','Tên A-Z'],['count','Nhiều câu nhất']];
            const sortLabel=(sortDefs.find(([k])=>k===sortBy)||sortDefs[0])[1];
            const blurDefs=[['off','Tắt'],['50','50%'],['85','85%']];
            return(
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                {/* Lọc theo môn — segmented, 3 nút cũ gộp thành 1 thanh */}
                <div style={{display:'flex',flex:1,gap:2,padding:3,borderRadius:999,background:C.bg,border:`1.5px solid ${C.border}`,minWidth:0}}>
                  {tabDefs.map(({key,text,count})=>{
                    const active=lessonFilter===key;
                    return(
                      <button key={key} onClick={()=>setLessonFilter(key)}
                        style={{flex:1,minWidth:0,padding:'7px 4px',borderRadius:999,border:'none',textAlign:'center',
                          background:active?C.grad:'transparent',
                          color:active?'#fff':C.text3,
                          fontSize:11.5,fontWeight:800,cursor:'pointer',transition:'all .18s',
                          whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',
                          boxShadow:active?'0 3px 10px rgba(168,85,247,0.3)':'none'}}>
                        {text} <span style={{opacity:.72}}>· {count}</span>
                      </button>
                    );
                  })}
                </div>
                {/* Sắp xếp + độ mờ thẻ — 4 nút sort + nút Blur cũ gộp vào 1 dropdown */}
                <div ref={sortMenuRef} style={{position:'relative',flexShrink:0}}>
                  <button onClick={()=>setSortMenuOpen(p=>!p)}
                    style={{display:'flex',alignItems:'center',gap:5,padding:'8px 12px',borderRadius:999,
                      border:`1.5px solid ${sortMenuOpen?C.lav:C.border}`,
                      background:sortMenuOpen?C.lavL:C.bg,
                      color:sortMenuOpen?C.lav:C.text3,fontSize:11.5,fontWeight:800,cursor:'pointer',transition:'all .15s',whiteSpace:'nowrap'}}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{filter:'drop-shadow(0 0 3px rgba(168,85,247,.55))'}}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                    {sortLabel}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{transition:'transform .2s',transform:sortMenuOpen?'rotate(180deg)':'none'}}><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {sortMenuOpen&&(
                    <div style={{position:'absolute',top:'calc(100% + 8px)',right:0,minWidth:196,
                      background:dark?'#1E0D15':'#fff',border:`1.5px solid ${C.border2}`,borderRadius:16,
                      boxShadow:'0 8px 32px rgba(168,85,247,0.18)',padding:8,zIndex:120,animation:'fadeUp .15s ease both'}}>
                      <div style={{fontSize:10,fontWeight:800,color:C.text4,textTransform:'uppercase',letterSpacing:.5,padding:'4px 8px 6px'}}>Sắp xếp theo</div>
                      {sortDefs.map(([k,l])=>(
                        <button key={k} onClick={()=>{setSortBy(k);setSortMenuOpen(false);}}
                          style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%',padding:'8px 10px',borderRadius:10,border:'none',
                            background:sortBy===k?C.lavL:'transparent',color:sortBy===k?C.lav:C.text2,
                            fontSize:12.5,fontWeight:sortBy===k?800:700,cursor:'pointer',textAlign:'left'}}>
                          {l}
                          {sortBy===k&&<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        </button>
                      ))}
                      <div style={{height:1,background:C.border,margin:'6px 2px'}}/>
                      <div style={{fontSize:10,fontWeight:800,color:C.text4,textTransform:'uppercase',letterSpacing:.5,padding:'6px 8px 6px'}}>Độ mờ thẻ</div>
                      <div style={{display:'flex',gap:4,padding:'0 2px'}}>
                        {blurDefs.map(([v,l])=>(
                          <button key={v} onClick={()=>setCardBlurPersist(v)}
                            style={{flex:1,padding:'6px 4px',borderRadius:8,fontSize:11,fontWeight:800,cursor:'pointer',
                              border:`1.5px solid ${cardBlur===v?C.lav:C.border}`,
                              background:cardBlur===v?C.lavL:'transparent',color:cardBlur===v?C.lav:C.text3,transition:'all .15s'}}>{l}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          </>)}

          {/* Empty state */}
          {lessons.length===0&&(
            <div style={{textAlign:'center',padding:'44px 20px 40px',background:C.surface,border:`1.5px dashed ${C.border2}`,borderRadius:24,animation:'fadeUp .3s ease both'}}>
              <div style={{width:76,height:76,margin:'0 auto 16px',borderRadius:'50%',background:C.gradSoft,display:'flex',alignItems:'center',justifyContent:'center',animation:'pop .35s cubic-bezier(0.34,1.56,0.64,1) both'}}>
                <Flower s={40} c="#FFB7C9"/>
              </div>
              <div style={{fontSize:16,fontWeight:900,color:C.text2,marginBottom:6}}>Chưa có bài tập nào</div>
              <div style={{fontSize:12.5,color:C.text3,lineHeight:1.7,marginBottom:20}}>Bấm nút bên dưới để tạo bài tập<br/>đầu tiên cho lớp của bạn nhé!</div>
              <button onClick={addLesson}
                style={{display:'inline-flex',alignItems:'center',gap:6,padding:'11px 26px',borderRadius:999,border:'none',background:C.grad,color:'#fff',fontSize:13,fontWeight:900,cursor:'pointer',boxShadow:'0 4px 16px rgba(168,85,247,0.3)',transition:'all .18s'}}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 6px 20px rgba(168,85,247,0.4)';}}
                onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 4px 16px rgba(168,85,247,0.3)';}}
                onMouseDown={e=>e.currentTarget.style.transform='scale(0.96)'}
                onMouseUp={e=>e.currentTarget.style.transform='translateY(-2px)'}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M11 9h4v2h-4v4H9v-4H5V9h4V5h2v4z"/></svg>
                Thêm bài đầu tiên
              </button>
            </div>
          )}

          {/* Lesson cards */}


          {lessons.filter(l=>{
            if(lessonFilter==='english')return l.subject==='Tiếng Anh';
            if(lessonFilter==='other')return l.subject!=='Tiếng Anh';
            return true;
          }).filter(l=>!searchQuery||(l.title||'').toLowerCase().includes(searchQuery.toLowerCase())||(l.subject||'').toLowerCase().includes(searchQuery.toLowerCase()))
          .sort((a,b)=>{
            if(sortBy==='name')return(a.title||'').localeCompare(b.title||'','vi');
            if(sortBy==='count')return(b.questions?.length||0)-(a.questions?.length||0);
            if(sortBy==='oldest')return(a.id||'').localeCompare(b.id||'');
            return(b.id||'').localeCompare(a.id||'');// newest
          }).map((l,idx)=>{
            const qCount=l.questions?.length||0;
            const tfCount=(l.questions||[]).filter(q=>q.type==='true_false').length;
            const tnCount=(l.questions||[]).filter(q=>q.type==='multiple'||q.type==='multi_select').length;
            const dtCount=(l.questions||[]).filter(q=>q.type==='fill_blank').length;
            return(
              <div key={l.id} onClick={()=>{setEditingId(l.id);setTab('build');}}
                style={{background:C.surface,...cardBlurStyle,border:'none',borderRadius:24,padding:'18px 18px',display:'flex',alignItems:'center',gap:14,boxShadow:dark?'0 4px 18px rgba(0,0,0,0.28)':'0 4px 18px rgba(168,85,247,0.10)',cursor:'pointer',transition:'all .2s cubic-bezier(.34,1.56,.64,1)',animation:`fadeUp .2s ${idx*0.04}s both`}}
                onMouseEnter={e=>{e.currentTarget.style.boxShadow=dark?'0 8px 28px rgba(0,0,0,0.36)':'0 8px 28px rgba(168,85,247,0.18)';e.currentTarget.style.transform='translateY(-2px)';}}
                onMouseLeave={e=>{e.currentTarget.style.boxShadow=dark?'0 4px 18px rgba(0,0,0,0.28)':'0 4px 18px rgba(168,85,247,0.10)';e.currentTarget.style.transform='translateY(0)';}}>
                {/* Icon — tím pastel dịu, không dùng tím đậm gốc để mềm mắt hơn */}
                <div style={{width:52,height:52,borderRadius:18,background:dark?'rgba(192,132,252,0.14)':'linear-gradient(135deg,#FDEBF3,#F3ECFC)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={dark?'#D8B4FE':'#C4A0F0'} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    <line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="13" y2="13"/>
                  </svg>
                </div>
                {/* Info — gộp môn học + số câu vào 1 dòng meta thay vì để rời trên pill bên phải, title không còn bị bóp */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:15.5,fontWeight:800,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{l.title||'Chưa đặt tên'}</div>
                  <div style={{fontSize:12,color:C.text3,fontWeight:700,marginTop:4,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{l.subject||'Tiếng Anh'} · {qCount} câu</div>
                  {(qCount>0||l.password)&&(
                    <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
                      {l.password&&<span style={{fontSize:9,fontWeight:800,color:'#8B93F0',background:dark?'rgba(99,102,241,0.14)':'#EEF2FF',borderRadius:99,padding:'2px 7px',display:'inline-flex',alignItems:'center',gap:3}}><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#8B93F0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Mật khẩu</span>}
                      {tfCount>0&&<span style={{fontSize:9,fontWeight:800,color:'#C4A0F0',background:dark?'rgba(192,132,252,0.14)':'#F3ECFC',borderRadius:99,padding:'2px 7px'}}>{tfCount} ĐS</span>}
                      {tnCount>0&&<span style={{fontSize:9,fontWeight:800,color:'#6EC9A0',background:dark?'rgba(16,185,129,0.14)':'#EAFAF3',borderRadius:99,padding:'2px 7px'}}>{tnCount} TN</span>}
                      {dtCount>0&&<span style={{fontSize:9,fontWeight:800,color:'#F0A870',background:dark?'rgba(249,115,22,0.14)':'#FFF3E8',borderRadius:99,padding:'2px 7px'}}>{dtCount} ĐT</span>}
                    </div>
                  )}
                </div>
                {/* Actions — gộp Sao chép + Xoá thành 1 menu ⋮ thay vì 2 nút màu rời */}
                <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                  <div data-card-menu style={{position:'relative'}}>
                    <button onClick={(e)=>{e.stopPropagation();
                        if(cardMenuOpenId===l.id){setCardMenuOpenId(null);setCardMenuPos(null);return;}
                        const r=e.currentTarget.getBoundingClientRect();
                        const menuH=96,menuW=154,gap=6;
                        const openUp=r.bottom+gap+menuH>window.innerHeight;
                        const top=openUp?Math.max(8,r.top-gap-menuH):r.bottom+gap;
                        const left=Math.min(window.innerWidth-menuW-8,Math.max(8,r.right-menuW));
                        setCardMenuPos({top,left});
                        setCardMenuOpenId(l.id);
                      }}
                      style={{width:32,height:32,borderRadius:'50%',border:'none',background:cardMenuOpenId===l.id?C.lavL:C.bg,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,transition:'all .15s'}}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill={cardMenuOpenId===l.id?C.lav:C.text3}><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                    </button>
                    {cardMenuOpenId===l.id&&cardMenuPos&&createPortal(
                      <div data-card-menu onClick={e=>e.stopPropagation()} style={{position:'fixed',top:cardMenuPos.top,left:cardMenuPos.left,minWidth:154,background:dark?'#1E0D15':'#fff',border:'none',borderRadius:16,boxShadow:'0 10px 30px rgba(168,85,247,0.22)',padding:6,zIndex:9999,animation:'fadeUp .15s ease both'}}>
                        <button onClick={()=>{setCardMenuOpenId(null);setCardMenuPos(null);
                            const _t=l.title||'Chưa đặt tên';
                            confirm_({
                            iconType:'copy',title:'Sao chép bài tập?',
                            message:'Tạo bản sao của <b>'+_t+'</b>.',
                            confirmLabel:'Sao chép',confirmColor:'#A855F7',
                            confirmGrad:'linear-gradient(135deg,#C084FC,#A855F7)',
                            onConfirm:()=>dupLesson(l,null),
                          });}}
                          style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'8px 10px',borderRadius:10,border:'none',background:'transparent',color:C.text2,cursor:'pointer',fontSize:12.5,fontWeight:700,textAlign:'left',transition:'background .12s'}}
                          onMouseEnter={e=>e.currentTarget.style.background=C.lavL}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.lav} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                          Sao chép
                        </button>
                        <button onClick={()=>{setCardMenuOpenId(null);setCardMenuPos(null);
                            const _t2=l.title||'Chưa đặt tên';
                            const _qc=(l.questions||[]).length;
                            confirm_({
                            iconType:'delete',title:'Xoá bài tập?',
                            message:'<b>'+_t2+'</b><br/><span style="color:#A07090">'+_qc+' câu hỏi sẽ bị xóa vĩnh viễn.</span>',
                            confirmLabel:'Xoá',confirmColor:'#EF4444',
                            onConfirm:()=>deleteLesson(l.id,null,true),
                          });}}
                          style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'8px 10px',borderRadius:10,border:'none',background:'transparent',color:'#EF4444',cursor:'pointer',fontSize:12.5,fontWeight:800,textAlign:'left',transition:'background .12s'}}
                          onMouseEnter={e=>e.currentTarget.style.background=dark?'rgba(239,68,68,0.14)':'#FEF2F2'}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          Xoá
                        </button>
                      </div>
                    ,document.body)}
                  </div>
                  {/* Mũi tên — nền tròn nhạt thay vì icon trần, mềm mại hơn */}
                  <div style={{width:32,height:32,borderRadius:'50%',background:C.lavPale,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.lav2} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
                  </div>
                </div>
              </div>
            );
          })}


          {lessons.filter(l=>{
            if(lessonFilter==='english')return l.subject==='Tiếng Anh';
            if(lessonFilter==='other')return l.subject!=='Tiếng Anh';
            return true;
          }).length===0&&lessons.length>0&&(
            <div style={{textAlign:'center',padding:'28px 20px',background:C.surface,border:`1.5px dashed ${C.border}`,borderRadius:18}}>
              <div style={{marginBottom:6}}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.text3} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <div style={{fontSize:13,fontWeight:800,color:C.text3}}>
                {lessonFilter==='english'?'Chưa có bài tập Tiếng Anh nào':'Chưa có bài tập các môn nào'}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Confirm Dialog — dùng chung toàn app */}
      <ConfirmDialog open={confirmState} onClose={()=>setConfirmState(null)} dark={dark}/>
    </>)}
    </>);
  }

  return(
    <div style={{minHeight:'100vh',background:'transparent',color:C.text,display:'flex',flexDirection:'column',maxWidth:760,margin:'0 auto',position:'relative'}}>

      {/* ══ HEADER ══ */}
      <div style={{background:dark?'rgba(30,13,21,0.97)':'rgba(255,255,255,0.95)',borderBottom:`1.5px solid ${C.border}`,position:'sticky',top:0,zIndex:60,backdropFilter:'blur(20px)',boxShadow:'0 2px 20px rgba(255,100,150,0.08)'}}>
        {/* Top row — logo + badges only */}
        <div style={{padding:'11px 14px 7px',display:'flex',alignItems:'center',gap:8}}>
          {/* Back button */}
          <div style={{position:'relative',flexShrink:0}}>
            <button onClick={goHome}
              style={{display:'flex',alignItems:'center',gap:5,padding:'6px 11px',borderRadius:999,border:`1.5px solid ${noTitleWarn?'#EF4444':C.border}`,background:C.bg2,color:C.text3,fontSize:12,fontWeight:800,cursor:'pointer',flexShrink:0,transition:'all .15s'}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.rose;e.currentTarget.style.color=C.rose;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=noTitleWarn?'#EF4444':C.border;e.currentTarget.style.color=C.text3;}}>
              <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path d="M12 4l-8 6 8 6V4z"/></svg>
              Danh sách
            </button>
            {noTitleWarn&&(
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                style={{position:'absolute',top:-7,right:-7,background:dark?'#1E0D15':'#fff',borderRadius:'50%',animation:'noTitleBlink 0.8s ease-in-out infinite'}}>
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            )}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <span className="logo-fl">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="url(#lg2)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <defs><linearGradient id="lg2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f472b6"/><stop offset="100%" stopColor="#6366f1"/></linearGradient></defs>
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
              </span>
              <span className="logo-wrap" style={{display:'inline-flex',flexDirection:'column',alignItems:'flex-start',lineHeight:1}}>
                <span className="logo-learnsy">Learnsy</span>
              </span>
              <span className="logo-flb"><Sparkle s={12} c="#6366f1"/></span>
              <span style={{fontSize:10,fontWeight:900,color:C.lav,background:C.lavL,border:`1.5px solid ${C.border2}`,borderRadius:99,padding:'2px 8px',marginLeft:2,flexShrink:0,display:'inline-flex',alignItems:'center',gap:3}}><Sparkle s={10} c={C.lav}/>Quiz Builder</span>
            </div>
            <div ref={statsRef} style={{marginTop:5,position:'relative'}}>
              <button onClick={()=>setStatsOpen(p=>!p)}
                style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:10,fontWeight:800,color:'#F472B6',background:C.rosePale,border:`1px solid ${C.border}`,borderRadius:99,padding:'2px 7px 2px 9px',cursor:'pointer'}}>
                {questions.length} câu
                <svg width="9" height="9" viewBox="0 0 20 20" fill="currentColor" style={{transform:statsOpen?'rotate(180deg)':'none',transition:'transform .2s'}}><path d="M5 7l5 5 5-5"/></svg>
              </button>
              {statsOpen&&(
                <div style={{position:'absolute',top:'calc(100% + 6px)',left:0,zIndex:70,display:'flex',gap:6,flexWrap:'wrap',
                  background:dark?'#1E0D15':'#fff',border:`1.5px solid ${C.border2}`,borderRadius:14,padding:'8px 10px',
                  boxShadow:'0 8px 26px rgba(168,85,247,0.18)',animation:'fadeUp .15s ease both',minWidth:180}}>
                  {[
                    [questions.length,'câu','#F472B6',C.rosePale,C.border],
                    [countByType('true_false'),'ĐS','#A855F7',C.lavL,C.border2],
                    [countByType('multiple')+countByType('multi_select'),'TN','#10B981',C.mintL,'#BBF7D0'],
                    [countByType('fill_blank'),'ĐT','#F97316',C.peachL,'#FED7AA'],
                  ].map(([n,l,c,bg,bd])=>(
                    <span key={l} style={{fontSize:10,fontWeight:800,color:c,background:bg,border:`1px solid ${bd}`,borderRadius:99,padding:'2px 7px'}}>
                      {n} {l}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Tab bar + Toolbox row */}
        <div style={{display:'flex',padding:'0 10px 9px',gap:4,alignItems:'center'}}>
          <input ref={jsonRef} type="file" accept=".json,application/json" onChange={handleJSONFile} style={{display:'none'}}/>
          {(()=>{
            const TABS=[
              ['build',<svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path d="M2 5h16v2H2V5zm2 4h12v2H4V9zm2 4h8v2H6v-2z"/></svg>,'Soạn'],
              ['import',<svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path d="M10 14l-5-5 1.4-1.4L9 11.2V2h2v9.2l2.6-2.6L15 9l-5 5zM5 16h10v2H5v-2z"/></svg>,'Nhập'],
              ['preview',<svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path d="M10 4C5.5 4 2 10 2 10s3.5 6 8 6 8-6 8-6-3.5-6-8-6zm0 9a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0-4a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg>,'Xem'],
            ];
            const cur=TABS.find(t=>t[0]===tab)||TABS[0];
            const goTab=(k)=>{setTabMenuOpen(false);k==='preview'?startPreview():setTab(k);};
            return(
              <div ref={tabMenuRef} style={{position:'relative'}}>
                <button onClick={()=>setTabMenuOpen(p=>!p)}
                  style={{display:'flex',alignItems:'center',gap:5,padding:'7px 13px',borderRadius:999,fontSize:12,fontWeight:800,transition:'all .18s',cursor:'pointer',
                    background:tabMenuOpen?(dark?'linear-gradient(135deg,#3A0F22,#2A1040)':'linear-gradient(135deg,#FFF0F5,#F0E6FF)'):C.bg,
                    color:tabMenuOpen?C.rose:C.text3,
                    boxShadow:tabMenuOpen?`0 2px 8px rgba(255,100,150,0.15)`:undefined,
                    border:tabMenuOpen?`1.5px solid ${C.border}`:'1.5px solid transparent'}}>
                  {cur[1]}{cur[2]}
                  <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor" style={{transform:tabMenuOpen?'rotate(180deg)':'none',transition:'transform .2s'}}><path d="M5 7l5 5 5-5"/></svg>
                </button>
                {tabMenuOpen&&(
                  <div style={{position:'absolute',top:'calc(100% + 8px)',left:0,zIndex:120,minWidth:150,
                    background:dark?'#1E0D15':'#fff',border:`1.5px solid ${C.border2}`,borderRadius:16,
                    boxShadow:'0 10px 30px rgba(168,85,247,0.2)',padding:6,
                    display:'flex',flexDirection:'column',gap:3,
                    animation:'fadeUp .18s cubic-bezier(.16,1,.3,1) both',transformOrigin:'top left'}}>
                    {TABS.map(([k,icon,l])=>{
                      const active=tab===k;
                      return(
                        <button key={k} onClick={()=>goTab(k)} style={{
                          display:'flex',alignItems:'center',gap:9,padding:'9px 11px',borderRadius:11,border:'none',
                          background:active?C.rosePale:'transparent',color:active?C.rose:C.text2,
                          fontSize:12.5,fontWeight:active?900:700,cursor:'pointer',textAlign:'left',transition:'background .12s'}}
                          onMouseEnter={e=>{if(!active)e.currentTarget.style.background=C.bg2;}}
                          onMouseLeave={e=>{if(!active)e.currentTarget.style.background='transparent';}}>
                          <span style={{display:'flex',flexShrink:0}}>{icon}</span>
                          {l}
                          {active&&<span style={{marginLeft:'auto',display:'flex'}}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
          {/* Toolbox button */}
          <div style={{position:'relative'}} ref={toolboxRef}>
            <button onClick={()=>setToolboxOpen(o=>!o)}
              style={{display:'flex',alignItems:'center',gap:5,padding:'7px 13px',borderRadius:999,
                border:`1.5px solid ${toolboxOpen?C.rose:C.border}`,fontSize:12,fontWeight:800,cursor:'pointer',flexShrink:0,
                background:toolboxOpen?(dark?'linear-gradient(135deg,#3A0F22,#2A1040)':'linear-gradient(135deg,#FFF0F5,#F0E6FF)'):C.bg,
                color:toolboxOpen?C.rose:C.text3,
                boxShadow:toolboxOpen?'0 2px 8px rgba(255,100,150,0.15)':'none',
                transition:'all .18s'}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
              </svg>
              Toolbox
              <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor" style={{transform:toolboxOpen?'rotate(180deg)':'none',transition:'transform .2s'}}>
                <path d="M5 7l5 5 5-5"/>
              </svg>
            </button>
            {toolboxOpen&&(
              <div onTouchStart={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()}
                style={{position:'absolute',top:'calc(100% + 7px)',right:0,minWidth:180,
                background:dark?'#1E0D15':'#fff',border:`1.5px solid ${C.border}`,borderRadius:16,
                boxShadow:'0 12px 36px rgba(255,100,150,0.18)',zIndex:80,overflow:'hidden',
                animation:'pop .18s ease both'}}>
                {/* Dark mode toggle */}
                <button onClick={(e)=>{e.stopPropagation();setDark(d=>!d);setToolboxOpen(false);}}
                  style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'11px 14px',border:'none',
                    background:'transparent',color:C.text2,fontSize:12,fontWeight:800,cursor:'pointer',transition:'background .15s',borderBottom:`1px solid ${C.border}`}}
                  onMouseEnter={e=>e.currentTarget.style.background=dark?'rgba(255,255,255,0.05)':C.bg2}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  {dark
                    ?<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FCD34D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                    :<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A855F7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
                  {dark?'Chế độ sáng':'Chế độ tối'}
                </button>
                {/* JSON */}
                <button onClick={()=>{handleExportJSON();setToolboxOpen(false);}}
                  style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'11px 14px',border:'none',
                    background:'transparent',color:C.mint,fontSize:12,fontWeight:800,cursor:'pointer',transition:'background .15s',borderBottom:`1px solid ${C.border}`}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.mintL}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M13 3H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7l-4-4zm-1 4V4l4 4h-3a1 1 0 0 1-1-1z"/></svg>
                  Lưu JSON
                </button>
                {/* Export */}
                <button onClick={()=>{handleExport();setToolboxOpen(false);}}
                  style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'11px 14px',border:'none',
                    background:'transparent',color:'#F472B6',fontSize:12,fontWeight:800,cursor:'pointer',transition:'background .15s',borderBottom:`1px solid ${C.border}`}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.rosePale}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M10 14l-5-5 1.4-1.4L9 11.2V2h2v9.2l2.6-2.6L15 9l-5 5zM5 16h10v2H5v-2z"/></svg>
                  Export HTML
                </button>
                {/* Gộp câu hỏi */}
                <button onClick={()=>{setMergeModal(true);setToolboxOpen(false);}}
                  style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'11px 14px',border:'none',
                    background:'transparent',color:C.mint,fontSize:12,fontWeight:800,cursor:'pointer',transition:'background .15s'}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.mintL}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h4"/>
                    <path d="M16 7h4a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-4"/>
                    <path d="M8 12h8"/><path d="M12 7v10"/>
                  </svg>
                  Gộp câu hỏi
                </button>
              </div>
            )}
          </div>
          {/* Nút lưu thủ công — lưu ngay lập tức, bỏ qua debounce */}
          {editingId!==null&&(
            <button onClick={manualSave}
              title="Lưu thủ công"
              style={{display:'flex',alignItems:'center',justifyContent:'center',width:32,height:32,borderRadius:999,
                border:'1.5px solid #EF4444',background:dark?'rgba(239,68,68,0.12)':'#FEF2F2',cursor:'pointer',flexShrink:0,
                animation:'manualSavePulse 2s ease-in-out infinite'}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
            </button>
          )}
          {/* Nút lưu — tích hợp giờ VN (UTC+7) nhỏ gọn ngay trong nút, cạnh nút lưu thủ công */}
          {editingId!==null&&(
            <div style={{position:'relative'}} ref={saveBtnRef}>
              <button onClick={()=>setDebugPanelOpen(p=>!p)}
                title="Trạng thái lưu bài"
                style={{
                  display:'flex',alignItems:'center',gap:6,padding:'6px 6px 6px 11px',borderRadius:999,border:'none',cursor:'pointer',flexShrink:0,
                  background: saveDebug.status==='error'?'linear-gradient(135deg,#EF4444,#DC2626)'
                    : saveDebug.status==='saving'?'linear-gradient(135deg,#F59E0B,#D97706)'
                    : saveDebug.status==='saved'?'linear-gradient(135deg,#10B981,#059669)'
                    : 'linear-gradient(135deg,#A855F7,#7C3AED)',
                  boxShadow:'0 3px 10px rgba(0,0,0,0.22)',
                  transition:'background .25s,transform .15s,box-shadow .15s',
                }}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 5px 16px rgba(0,0,0,0.28)';}}
                onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 3px 10px rgba(0,0,0,0.22)';}}
                onMouseDown={e=>e.currentTarget.style.transform='scale(0.95)'}
                onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>
                <span style={{fontSize:10.5,fontWeight:800,color:'rgba(255,255,255,0.92)',fontVariantNumeric:'tabular-nums',letterSpacing:.2}}>{vnTimeStr}</span>
                <span style={{width:22,height:22,borderRadius:'50%',background:'rgba(255,255,255,0.18)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  {saveDebug.status==='saving'
                    ? <span style={{width:11,height:11,border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',borderRadius:'50%',display:'inline-block'}} className="spin"/>
                    : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                        <polyline points="17 21 17 13 7 13 7 21"/>
                        <polyline points="7 3 7 8 15 8"/>
                      </svg>}
                </span>
              </button>
              {debugPanelOpen&&(
                <div onTouchStart={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()}
                  style={{position:'absolute',top:'calc(100% + 7px)',right:0,width:250,maxWidth:'calc(100vw - 28px)',
                  background:dark?'#1E0D15':'#fff',border:`1.5px solid ${C.border}`,borderRadius:18,padding:'14px 15px',
                  boxShadow:'0 12px 40px rgba(0,0,0,0.35)',zIndex:80,animation:'pop .18s ease both'}}>
                  <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:11}}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.rose} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    <span style={{fontSize:13,fontWeight:900,color:C.text,fontFamily:"'Baloo 2',cursive"}}>Trạng thái lưu bài</span>
                  </div>
                  {[
                    ['Giờ hiện tại', `${vnTimeStr} · ${vnDateStr}`, C.text2],
                    ['Trạng thái',
                      {idle:'Chưa có thay đổi',pending:'Đang chờ (debounce)…',saving:'Đang lưu…',saved:'Đã lưu',error:'Lỗi khi lưu','dup-blocked':'Bị chặn — tên trùng'}[saveDebug.status]||saveDebug.status,
                      {idle:C.text3,pending:'#F59E0B',saving:'#F59E0B',saved:'#10B981',error:'#EF4444','dup-blocked':'#EF4444'}[saveDebug.status]||C.text3],
                    ['Thời gian lưu', saveDebug.lastDurationMs!=null?`${saveDebug.lastDurationMs} ms`:'—', C.text2],
                    ['Lưu lần cuối', saveDebug.lastSavedAt?new Date(saveDebug.lastSavedAt).toLocaleTimeString('vi-VN'):'—', C.text2],
                    ['Lưu ở đâu', `Supabase · bảng "${saveDebug.table}"`, C.text2],
                    ['ID bài', saveDebug.lessonId||'—', C.text3],
                    ...(saveDebug.lastError?[['Lỗi gần nhất', saveDebug.lastError, '#EF4444']]:[]),
                  ].map(([label,value,color])=>(
                    <div key={label} style={{display:'flex',justifyContent:'space-between',gap:10,padding:'6px 0',borderBottom:`1px solid ${C.border}`,fontSize:11.5}}>
                      <span style={{color:C.text3,fontWeight:700,flexShrink:0}}>{label}</span>
                      <span style={{color,fontWeight:800,textAlign:'right',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══ MERGE QUESTIONS MODAL ══ */}
      {mergeModal&&typeof MergeQuestionsModal!=='undefined'&&(
        <MergeQuestionsModal
          lessons={lessons}
          currentLessonId={editingId}
          onClose={()=>setMergeModal(false)}
          onMerge={handleMergeQuestions}
          dark={dark}/>
      )}

      {/* ══ BUILD TAB ══ */}
      {tab==='build'&&(
        <div style={{flex:1,padding:'13px 12px 120px',display:'flex',flexDirection:'column',gap:11}} className="fade-up">
          {/* Title card */}
          <div style={{background:C.surface,border:`1.5px solid ${C.border}`,borderRadius:18,padding:'13px 15px',boxShadow:'0 3px 16px rgba(255,100,150,0.06)'}}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
              <Bow s={22}/>
              <span style={{fontSize:11,fontWeight:900,color:C.rose,textTransform:'uppercase',letterSpacing:.8}}>Tên bài học</span>
            </div>
            <Inp value={title} onChange={e=>{setTitle(e.target.value);if(e.target.value.trim())setNoTitleWarn(false);}} placeholder="Nhập tên bài tập, ví dụ: Ôn tập Lịch sử Chương 3"/>
            {noTitleWarn&&(
              <div style={{marginTop:6,display:'flex',alignItems:'center',gap:6,padding:'7px 10px',borderRadius:10,background:dark?'rgba(239,68,68,0.14)':'#FEF2F2',border:'1.5px solid #EF4444'}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{flexShrink:0,animation:'noTitleBlink 0.8s ease-in-out infinite'}}>
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span style={{fontSize:11.5,fontWeight:800,color:'#EF4444'}}>Chưa đặt tên bài tập — đặt tên trước khi thoát nhé!</span>
              </div>
            )}
            {titleDupWarn&&(
              <div style={{marginTop:6,display:'flex',alignItems:'center',gap:6,padding:'7px 10px',borderRadius:10,background:dark?'rgba(239,68,68,0.14)':'#FEF2F2',border:'1.5px solid #EF4444'}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <span style={{fontSize:11.5,fontWeight:800,color:'#EF4444'}}>Trùng tên với bài tập khác — sẽ không lưu được, đổi tên khác nhé!</span>
              </div>
            )}
            {/* Subject selector — dropdown */}
            <div style={{marginTop:8,display:'flex',alignItems:'center',gap:8,position:'relative'}}>
              <span style={{fontSize:11,fontWeight:900,color:C.text3,letterSpacing:.5,flexShrink:0}}>Môn học:</span>
              <div style={{position:'relative'}} ref={subjectRef}>
                <button onClick={()=>setSubjectOpen(o=>!o)}
                  style={{display:'inline-flex',alignItems:'center',gap:6,padding:'5px 13px',borderRadius:999,
                    border:`1.5px solid ${subjectOpen?C.lav:C.border}`,
                    background:subjectOpen?C.lavL:C.bg,
                    color:subjectOpen?C.lav:C.text2,
                    fontSize:12,fontWeight:800,cursor:'pointer',transition:'all .18s'}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                  {subject}
                  <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor" style={{transform:subjectOpen?'rotate(180deg)':'none',transition:'transform .2s'}}>
                    <path d="M5 7l5 5 5-5"/>
                  </svg>
                </button>
                {subjectOpen&&(
                  <div style={{position:'absolute',top:'calc(100% + 6px)',left:0,minWidth:150,
                    background:dark?'#1E0D15':'#fff',border:`1.5px solid ${C.border2}`,borderRadius:14,
                    boxShadow:'0 10px 32px rgba(168,85,247,0.18)',zIndex:90,overflow:'hidden',
                    animation:'pop .16s ease both'}}>
                    {['Tiếng Anh','Lịch Sử','Địa Lý','Vật Lý','GDKTPL','GDQPAN','Công Nghệ','Ngữ Văn','Khác'].map((s,i,arr)=>(
                      <button key={s} onClick={()=>{setSubject(s);setSubjectOpen(false);}}
                        style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'9px 13px',border:'none',
                          borderBottom:i<arr.length-1?`1px solid ${C.border}`:'none',
                          background:subject===s?(dark?'rgba(192,132,252,0.15)':C.lavL):'transparent',
                          color:subject===s?C.lav:C.text2,
                          fontSize:12,fontWeight:subject===s?900:700,cursor:'pointer',transition:'background .13s',textAlign:'left'}}
                        onMouseEnter={e=>{if(subject!==s)e.currentTarget.style.background=dark?'rgba(255,255,255,0.05)':C.bg2;}}
                        onMouseLeave={e=>{if(subject!==s)e.currentTarget.style.background='transparent';}}>
                        {subject===s&&<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.lav} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        {subject!==s&&<span style={{width:11,display:'inline-block'}}/>}
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {/* Password field */}
            <div style={{marginTop:8,display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:11,fontWeight:900,color:C.text3,letterSpacing:.5,flexShrink:0,display:'inline-flex',alignItems:'center',gap:4}}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Mật khẩu:</span>
              <input type="text" value={password} onChange={e=>setPassword(e.target.value)}
                placeholder="Để trống = không cần mật khẩu"
                style={{flex:1,padding:'5px 10px',border:`1.5px solid ${password?C.lav:C.border}`,borderRadius:999,
                  fontSize:12,fontWeight:700,color:C.text,background:password?C.lavL:C.bg,outline:'none',
                  transition:'all .2s',fontFamily:'Nunito,sans-serif'}}/>
              {password&&<span style={{fontSize:10,fontWeight:800,color:C.lav,background:C.lavL,border:`1px solid ${C.border2}`,borderRadius:99,padding:'2px 8px',flexShrink:0,whiteSpace:'nowrap',display:'inline-flex',alignItems:'center',gap:4}}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1.5" fill="currentColor"/></svg> Đã đặt</span>}
            </div>
            {/* Collapsible settings */}
            <div style={{marginTop:10}}>
              <button onClick={()=>setSettingsOpen(o=>!o)}
                style={{display:'flex',alignItems:'center',gap:7,padding:'6px 13px',borderRadius:999,
                  border:`1.5px solid ${settingsOpen?C.lav:C.border}`,
                  background:settingsOpen?C.lavL:C.bg2,
                  color:settingsOpen?C.lav:C.text3,
                  fontSize:11,fontWeight:800,cursor:'pointer',transition:'all .18s'}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
                  <path d="M12 2v2m0 16v2M2 12h2m16 0h2"/>
                </svg>
                Cài đặt đề thi
                <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor" style={{transform:settingsOpen?'rotate(180deg)':'none',transition:'transform .2s'}}>
                  <path d="M5 7l5 5 5-5"/>
                </svg>
              </button>
              {settingsOpen&&(
                <div style={{marginTop:10,padding:'13px 14px',background:dark?'rgba(255,255,255,0.03)':C.bg2,border:`1.5px solid ${C.border2}`,borderRadius:14,animation:'fadeUp .18s ease both'}}>
                  {/* Shuffle toggles */}
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    {[
                      [shuffleQ,setShuffleQ,'Xáo thứ tự câu','#F472B6','#FF6B95',C.rosePale,C.border,C.roseL,<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6"/></svg>],
                      [shuffleA,setShuffleA,'Xáo đáp án','#A855F7','#A855F7',C.lavPale,C.border2,C.lavL,<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6"/></svg>],
                    ].map(([val,set,label,onColor,onStroke,offBg,offBd,onBg,icon])=>(
                      <button key={label} onClick={()=>set(v=>!v)}
                        style={{display:'flex',alignItems:'center',gap:6,padding:'5px 11px',borderRadius:999,border:`1.5px solid ${val?onColor:offBd}`,background:val?onBg:offBg,color:val?onColor:C.text3,fontSize:11,fontWeight:800,cursor:'pointer',transition:'all .18s',flexShrink:0}}>
                        <div style={{width:26,height:14,borderRadius:99,background:val?onColor:'rgba(0,0,0,0.1)',transition:'background .2s',position:'relative',flexShrink:0}}>
                          <div style={{position:'absolute',top:2,left:val?14:2,width:10,height:10,borderRadius:'50%',background:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,0.2)',transition:'left .2s'}}/>
                        </div>
                        {label}
                      </button>
                    ))}
                    {(shuffleQ||shuffleA)&&(
                      <span style={{fontSize:10,fontWeight:700,color:C.text4,alignSelf:'center',flexShrink:0}}>
                        áp dụng khi Thử & Export
                      </span>
                    )}
                  </div>
                  {/* Export theme */}
                  <div style={{marginTop:10,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                    <span style={{fontSize:11,fontWeight:900,color:C.text3,letterSpacing:.5,flexShrink:0}}>Giao diện xuất:</span>
                    {[
                      ['full','✦ Full','Đẹp, animation, âm thanh',C.lav,C.lavL,C.border2],
                      ['lite','◈ Lite','Nhẹ, không animation, máy yếu',C.peach,C.peachL,'#FED7AA'],
                    ].map(([v,label,desc,c,bg,bd])=>(
                      <button key={v} onClick={()=>setExportTheme(v)}
                        style={{display:'flex',flexDirection:'column',alignItems:'flex-start',padding:'5px 12px',borderRadius:12,
                          border:`1.5px solid ${exportTheme===v?c:C.border}`,background:exportTheme===v?bg:C.bg2,
                          color:exportTheme===v?c:C.text3,fontSize:11,fontWeight:800,cursor:'pointer',transition:'all .15s',flexShrink:0,gap:1}}>
                        <span>{label}</span>
                        <span style={{fontSize:9,fontWeight:600,color:exportTheme===v?c:C.text4}}>{desc}</span>
                      </button>
                    ))}
                  </div>
                  {/* Timer */}
                  <div style={{marginTop:10,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                    <span style={{fontSize:11,fontWeight:900,color:C.text3,letterSpacing:.5,flexShrink:0}}>⏱ Giới hạn thời gian:</span>
                    {[0,5,10,15,20,30,45,60].map(m=>(
                      <button key={m} onClick={()=>setTimerLimit(m)}
                        style={{padding:'4px 11px',borderRadius:999,border:`1.5px solid ${timerLimit===m?C.rose:C.border}`,background:timerLimit===m?C.roseL:C.bg2,color:timerLimit===m?C.rose:C.text3,fontSize:11,fontWeight:800,cursor:'pointer',flexShrink:0}}>
                        {m===0?'Không':m+'p'}
                      </button>
                    ))}
                  </div>
                  {/* Card Blur */}
                  <div style={{marginTop:10,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                    <span style={{fontSize:11,fontWeight:900,color:C.text3,letterSpacing:.5,flexShrink:0,display:'inline-flex',alignItems:'center',gap:4}}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="5"/><circle cx="16" cy="16" r="5" opacity=".5"/></svg>
                      Blur card:
                    </span>
                    {[['off','Tắt',C.text3,C.bg2,C.border],['50','50%','#0EA5E9','#E0F2FE','#BAE6FD'],['85','85%','#8B5CF6',C.lavL,C.border2]].map(([v,l,c,bg,bd])=>(
                      <button key={v} onClick={()=>setCardBlurPersist(v)}
                        style={{display:'flex',flexDirection:'column',alignItems:'flex-start',padding:'4px 12px',borderRadius:12,
                          border:`1.5px solid ${cardBlur===v?c:C.border}`,background:cardBlur===v?bg:C.bg2,
                          color:cardBlur===v?c:C.text3,fontSize:11,fontWeight:800,cursor:'pointer',transition:'all .15s',flexShrink:0,gap:1}}>
                        <span>{l}</span>
                        <span style={{fontSize:9,fontWeight:600,color:cardBlur===v?c:C.text4}}>
                          {v==='off'?'không blur':v==='50'?'nhẹ, xuyên card':'mạnh, trong suốt'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Questions — display:none khi leaving tránh Samsung WebView crash khi unmount contenteditable */}
          <div style={{display:leaving?'none':'block'}}>
          {questions.map((q,qi)=>(
            <div key={q.id} id={`q-block-${q.id}`}>
            <QEditor q={q} qi={qi}
              onUp={(f,v)=>upQ(q.id,f,v)}
              onUpItem={(ii,f,v)=>upItem(q.id,ii,f,v)}
              onAddItem={()=>addItem(q.id)}
              onRemItem={ii=>remItem(q.id,ii)}
              onUpOpt={(ii,v)=>upOpt(q.id,ii,v)}
              onAddOpt={()=>addOpt(q.id)}
              onRemOpt={ii=>remOpt(q.id,ii)}
              onRemove={()=>confirm_({
                iconType:'delete',title:'Xóa câu hỏi này?',
                message:'Câu hỏi sẽ bị xóa khỏi bài tập hiện tại.',
                confirmLabel:'Xóa',confirmColor:'#EF4444',
                onConfirm:()=>removeQ(q.id),
              })}
              canRemove={questions.length>1}
              dark={dark}/>
            </div>
          ))}
          </div>

          {/* Add menu */}
          <div ref={addMenuRef} style={{position:'relative'}}>
            <button onClick={()=>setAddMenu(p=>!p)}
              style={{width:'100%',padding:13,borderRadius:16,border:`2px dashed ${addMenu?C.rose:C.border}`,background:addMenu?C.rosePale:C.bg2,color:addMenu?C.rose:C.text3,fontSize:14,fontWeight:900,cursor:'pointer',transition:'all .18s',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M11 9h4v2h-4v4H9v-4H5V9h4V5h2v4z"/></svg>
              Thêm câu hỏi mới
            </button>
            {addMenu&&(
              <div style={{position:'absolute',top:'calc(100% + 7px)',left:0,right:0,background:C.surface,border:`1.5px solid ${C.border}`,borderRadius:18,overflow:'hidden',zIndex:20,boxShadow:'0 12px 40px rgba(255,100,150,0.15)'}}>
                {Object.entries(getTypes()).map(([type,info],idx)=>(
                  <button key={type} onClick={()=>addQ(type)}
                    style={{display:'flex',alignItems:'center',gap:12,width:'100%',padding:'12px 16px',border:'none',borderBottom:idx<3?`1px solid ${C.border}`:'none',background:C.surface,textAlign:'left',cursor:'pointer',transition:'background .15s'}}
                    onMouseEnter={e=>e.currentTarget.style.background=info.pale}
                    onMouseLeave={e=>e.currentTarget.style.background=C.surface}>
                    <div style={{width:36,height:36,borderRadius:11,flexShrink:0,background:info.bg,border:`1.5px solid ${info.border}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {info.icon}
                    </div>
                    <div>
                      <div style={{fontSize:13,fontWeight:900,color:C.text}}>{info.label}</div>
                      <div style={{fontSize:11,color:C.text3,marginTop:1}}>
                        {type==='true_false'?'Đoạn tư liệu + 4 ý đúng/sai':type==='multiple'?'4 lựa chọn, 1 đáp án đúng':type==='multi_select'?'Nhiều đáp án đúng':'Điền từ vào chỗ trống'}
                      </div>
                    </div>
                    <div style={{marginLeft:'auto',width:20,height:20,borderRadius:99,background:info.bg,border:`1.5px solid ${info.border}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <svg width="9" height="9" viewBox="0 0 12 12" fill={info.color}><path d="M7 1H5v4H1v2h4v4h2V7h4V5H7V1z"/></svg>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tip box */}
          <div style={{background:dark?'linear-gradient(135deg,#1E0D15,#200C35)':'linear-gradient(135deg,#FFF5F9,#FAF5FF)',border:`1.5px solid ${C.border}`,borderRadius:16,padding:'12px 14px',display:'flex',gap:10,alignItems:'flex-start'}}>
            <div style={{width:32,height:32,borderRadius:10,background:C.rosePale,border:`1.5px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <Flower s={16} c="#FFB7C9"/>
            </div>
            <div style={{fontSize:12,color:C.text3,lineHeight:1.7}}>
              <span style={{fontWeight:900,color:C.rose,display:'inline-flex',alignItems:'center',gap:3}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.rose} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> JSON</span> = lưu để import lại sau •{' '}
              <span style={{fontWeight:900,color:C.lav,display:'inline-flex',alignItems:'center',gap:3}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.lav} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export</span> = xuất HTML upload Cloudflare •{' '}
              Tab <span style={{fontWeight:900,color:C.text2}}>Nhập</span> = dán văn bản hoặc upload file JSON
            </div>
          </div>
        </div>
      )}

      {/* ══ IMPORT TAB ══ */}
      {tab==='import'&&(
        <div style={{flex:1,padding:'13px 12px 28px',display:'flex',flexDirection:'column',gap:12}} className="fade-up">

          {/* JSON Upload */}
          <div style={{background:C.surface,border:`1.5px solid ${C.border2}`,borderRadius:18,padding:'15px 16px',boxShadow:'0 3px 16px rgba(168,85,247,0.06)'}}>
            <div style={{display:'flex',gap:11,alignItems:'flex-start',marginBottom:13}}>
              <div style={{width:44,height:44,borderRadius:13,background:C.lavL,border:`1.5px solid ${C.border2}`,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill={C.lav}><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              </div>
              <div>
                <div style={{fontSize:14,fontWeight:900,color:C.lav,marginBottom:3}}>Upload file JSON</div>
                <div style={{fontSize:12,color:C.text3,lineHeight:1.65}}>Upload file <code style={{background:C.lavL,padding:'1px 5px',borderRadius:5}}>.json</code> đã lưu từ lần trước. Hỗ trợ nhiều format JSON phổ biến.</div>
              </div>
            </div>
            <input ref={jsonRef} type="file" accept=".json,application/json" onChange={handleJSONFile} style={{display:'none'}}/>
            <button onClick={()=>jsonRef.current.click()}
              style={{width:'100%',padding:'11px',borderRadius:12,border:`2px dashed ${C.lav2}`,background:C.lavL,color:C.lav,fontSize:13,fontWeight:900,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,transition:'all .18s'}}
              onMouseEnter={e=>{e.currentTarget.style.background='#EDE9FE';e.currentTarget.style.transform='translateY(-1px)';}}
              onMouseLeave={e=>{e.currentTarget.style.background=C.lavL;e.currentTarget.style.transform='translateY(0)';}}
              onMouseDown={e=>e.currentTarget.style.transform='scale(0.98)'}
              onMouseUp={e=>e.currentTarget.style.transform='translateY(-1px)'}>
              <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path d="M13 3H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7l-4-4zm-1 4V4l4 4h-3a1 1 0 0 1-1-1z"/></svg>
              Chọn file JSON
            </button>
            <div style={{marginTop:11,padding:'10px 12px',background:C.lavPale,borderRadius:11,fontSize:11.5,color:C.text3,lineHeight:1.75}}>
              <b style={{color:C.text2}}>Format hỗ trợ:</b><br/>
              • Array: <code style={{background:C.lavL,padding:'0 4px',borderRadius:4}}>[{'{'}type, question, options, correct{'}'}]</code><br/>
              • Object: <code style={{background:C.lavL,padding:'0 4px',borderRadius:4}}>{'{'}questions: [...]{'}'}</code><br/>
              • Nhiều tên field: question / content / câu_hỏi, answer / correct / key...
            </div>
          </div>

          {/* Text paste */}
          <div style={{background:dark?'linear-gradient(135deg,#1E0D15,#200C35)':'linear-gradient(135deg,#FFF5F9,#FAF5FF)',border:`1.5px solid ${C.border}`,borderRadius:18,padding:'15px 16px',boxShadow:'0 3px 16px rgba(255,100,150,0.06)'}}>
            <div style={{display:'flex',gap:11,alignItems:'flex-start',marginBottom:11}}>
              <div style={{width:44,height:44,borderRadius:13,background:C.roseL,border:`1.5px solid ${C.border}`,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill={C.rose}><path d="M14.06 9L15 9.94 5.92 19H5v-.92L14.06 9zm3.6-6a1 1 0 0 0-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-.71-.29zM3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/></svg>
              </div>
              <div>
                <div style={{fontSize:14,fontWeight:900,color:C.rose,marginBottom:3}}>Dán văn bản — nhận diện tự động</div>
                <div style={{fontSize:12,color:C.text3,lineHeight:1.65}}>Dán từ sách, đề thi... Hệ thống tự phân tích <b style={{color:C.text2}}>không cần mạng internet</b>.</div>
              </div>
            </div>
            <textarea value={rawText} onChange={e=>setRaw(e.target.value)}
              placeholder={"Dán câu hỏi vào đây — hỗ trợ:\n\n• Đúng/Sai: Đoạn văn + a. ... S  b. ... Đ\n• Trắc nghiệm: Câu hỏi + A. ... B. ... Answer: A\n• Điền chỗ trống: Câu có ___ + Answer: từ\n\nCó thể dán nhiều câu cùng lúc!"}
              style={{width:'100%',padding:'11px 13px',border:`1.5px solid ${C.border}`,borderRadius:12,fontSize:13,fontWeight:600,color:C.text,background:dark?'rgba(30,13,21,0.8)':'rgba(255,255,255,0.8)',outline:'none',minHeight:180,resize:'vertical',fontFamily:'Nunito,sans-serif',lineHeight:1.65}}/>
            <button onClick={handleParse} disabled={parsing}
              style={{marginTop:10,width:'100%',padding:'12px',borderRadius:999,border:'none',background:parsing?C.lav2:'linear-gradient(135deg,#F472B6,#A855F7)',color:'#fff',fontSize:14,fontWeight:900,cursor:parsing?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:parsing?'none':'0 4px 20px rgba(168,85,247,0.28)',transition:'all .2s'}}
              onMouseEnter={e=>{if(!parsing){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 6px 24px rgba(168,85,247,0.4)';}}}
              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow=parsing?'none':'0 4px 20px rgba(168,85,247,0.28)';}}
              onMouseDown={e=>{if(!parsing)e.currentTarget.style.transform='scale(0.97)';}}
              onMouseUp={e=>{if(!parsing)e.currentTarget.style.transform='translateY(-2px)';}}>
              {parsing
                ?<><span style={{width:16,height:16,border:'2.5px solid rgba(255,255,255,0.35)',borderTopColor:'#fff',borderRadius:'50%',display:'inline-block'}} className="spin"/>Đang phân tích...</>
                :<><svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path d="M9 4a5 5 0 1 0 0 10A5 5 0 0 0 9 4zm6.9 11.5-2.4-2.4A7 7 0 1 1 15 9a6.97 6.97 0 0 1-1.49 4.32l2.39 2.38-1.5 1.5.5-.72z"/></svg>Nhận diện & Thêm câu hỏi</>}
            </button>
          </div>

          {/* Format guide */}
          <div style={{background:C.surface,border:`1.5px solid ${C.border}`,borderRadius:16,padding:'13px 15px'}}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:11}}>
              <Star s={14} c="#F59E0B"/>
              <span style={{fontSize:11,fontWeight:900,color:C.mint,textTransform:'uppercase',letterSpacing:.8}}>Ví dụ định dạng văn bản</span>
            </div>
            {[
              ['Đúng/Sai',C.lav,C.lavL,'Câu 1. Cho đoạn: "..." \na. Nội dung ý a. Đ\nb. Nội dung ý b. S'],
              ['Trắc nghiệm',C.rose,C.roseL,'Câu 2. Ngô Quyền đánh trận nào?\nA. Bạch Đằng\nB. Chi Lăng\nC. Đống Đa\nD. Điện Biên Phủ\nAnswer: A'],
              ['Điền chỗ trống',C.peach,C.peachL,'Câu 3. Ngô Quyền đánh quân ___ năm 938.\nAnswer: Nam Hán'],
            ].map(([k,c,bg,v])=>(
              <div key={k} style={{marginBottom:10}}>
                <span style={{fontSize:11,fontWeight:900,color:c,background:bg,padding:'2px 9px',borderRadius:999}}>{k}</span>
                <pre style={{marginTop:6,fontSize:11.5,color:C.text2,lineHeight:1.75,whiteSpace:'pre-wrap',fontFamily:'monospace',background:dark?'#120B10':'#FAFAFA',padding:'9px 11px',borderRadius:10,border:`1px solid ${C.border}`}}>{v}</pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ PREVIEW TAB ══ */}
      {tab==='preview'&&(
        <PreviewPanel title={title} questions={(liveQs||questions).map(q=>({
          ...q,
          ...(q.items?{items:(q.items||[]).map(it=>({...it,text:stripHTML(it.text)}))}:{}),
          ...(q.options?{options:(q.options||[]).map(o=>stripHTML(o))}:{}),
          ...(q.question?{question:stripHTML(q.question)}:{}),
        }))}
          answers={previewAns} setAnswers={setPAns}
          submitted={previewDone} setSubmitted={setPDone}
          cur={previewCur} setCur={setPCur}
          modal={previewModal} setModal={setPModal}
          dark={dark}
          lessonTitle={title||'Không tên'}
          onBack={()=>setTab('build')}
          timeLimit={timerLimit}/>
      )}

      {/* Confirm Dialog — cần render cả trong editing view */}
      <ConfirmDialog open={confirmState} onClose={()=>setConfirmState(null)} dark={dark}/>

    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
})();
