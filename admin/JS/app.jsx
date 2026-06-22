import React from "react";
import ReactDOM from "react-dom/client";

(function(){
const {useState,useRef,useEffect,useCallback,useMemo}=React;
// ── Lấy components từ window ──
const LoginScreen=window.LoginScreen;
const QEditor=window.QEditor;
const ChatMini=window.ChatMini;
const PreviewPanel=window.PreviewPanel;
const StudentManager=window.StudentManager;
const AdminDashboard=window.AdminDashboard;
const ListeningManager=window.ListeningManager;
const AUTH_KEY='learnsy_admin_auth';

/* ══ COLORS ═══════════════════════════════════════════════════════════ */
const CL={
  bg:'#FFF5F9', bg2:'#FEF0F7', surface:'#FFFFFF',
  rose:'#FF6B95', rose2:'#FF8FAF', roseL:'#FFE4ED', rosePale:'#FFF0F5',
  lav:'#A855F7', lav2:'#C084FC', lavL:'#F0E6FF', lavPale:'#FAF5FF',
  mint:'#10B981', mint2:'#6EE7B7', mintL:'#ECFDF5',
  peach:'#F97316', peachL:'#FFF7ED', peach2:'#FED7AA',
  text:'#3D1830', text2:'#6B3050', text3:'#A07090', text4:'#C8A0B8',
  border:'#F5D5E8', border2:'#E8DCFF',
  grad:'linear-gradient(135deg,#F472B6,#A855F7)',
  gradSoft:'linear-gradient(135deg,#FFDDED,#EDE9FE)',
};
const CD={
  bg:'#180A10', bg2:'#1E0D15', surface:'#261018',
  rose:'#FF6B95', rose2:'#FF8FAF', roseL:'#3A0F22', rosePale:'#2D0A1A',
  lav:'#C084FC', lav2:'#D8A8FF', lavL:'#2A1040', lavPale:'#200C35',
  mint:'#10B981', mint2:'#6EE7B7', mintL:'#0A2618',
  peach:'#FB923C', peachL:'#2A1208', peach2:'#7A3810',
  text:'#F0DCE8', text2:'#C898B8', text3:'#8A6080', text4:'#503040',
  border:'#421526', border2:'#34104E',
  grad:'linear-gradient(135deg,#F472B6,#A855F7)',
  gradSoft:'linear-gradient(135deg,#3A0F22,#2A1040)',
};
let C=CL;

/* ══ SVG COMPONENTS — dùng chung từ ui-components.js (tránh trùng lặp code) ══ */
const {Flower,Heart,Star,Sparkle,Bow}=window;

/* ══ QUESTION TYPE CONFIG ════════════════════════════════════════════ */
const getTypes=()=>({
  true_false:{label:'Đúng / Sai',short:'ĐS',icon:<Flower s={15} c="#C084FC"/>,color:C.lav,bg:C.lavL,pale:C.lavPale,border:C.border2},
  multiple:{label:'Trắc nghiệm 4 đáp án',short:'TN',icon:<Heart s={14} c="#FF8FAF"/>,color:C.rose,bg:C.roseL,pale:C.rosePale,border:C.border},
  multi_select:{label:'Chọn nhiều đáp án',short:'CN',icon:<Star s={13} c="#10B981"/>,color:C.mint,bg:C.mintL,pale:C.mintL,border:'#BBF7D0'},
  fill_blank:{label:'Điền chỗ trống',short:'ĐT',icon:<Sparkle s={13} c="#F97316"/>,color:C.peach,bg:C.peachL,pale:C.peachL,border:'#FED7AA'},
});
const LETTERS=['A','B','C','D','E','F'];
const stripHTML=s=>(s||'').replace(/<[^>]*>/g,'');

/* ══ OFFLINE TEXT PARSER ══════════════════════════════════════════════ */
function parseText(raw){
  const results=[];
  const blocks=raw.split(/(?=Câu\s*\d+[\.\:])|(?=\n{2,})/g).map(s=>s.trim()).filter(s=>s.length>10);
  for(const block of blocks){
    const lines=block.split('\n').map(s=>s.trim()).filter(Boolean);
    if(!lines.length)continue;

    // ── Detect loại câu ──────────────────────────────────────────────
    // Trắc nghiệm: có dòng bắt đầu bằng A. B. C. D. (chữ HOA)
    const hasABCD=lines.some(l=>/^[A-Da-d][\.\)]\s/.test(l)&&/^[A-D]/.test(l));
    // Đúng/Sai: có ít nhất 2 dòng bắt đầu bằng a. b. c. d. (chữ thường)
    const tfLines=lines.filter(l=>/^[a-d][\.\)]\s/.test(l));
    const hasTF=tfLines.length>=2;
    // Điền từ: CHỈ nhận khi KHÔNG có dấu hiệu TN / ĐS
    // — có "___" trong block, HOẶC dòng đầu bắt đầu bằng "điền" nhưng không có a./b./A./B.
    const hasFill=!hasTF&&!hasABCD&&(
      /___+/.test(block)||
      /^điền\s/i.test(lines[0])
    );

    if(hasTF){
      // ── Đúng / Sai ─────────────────────────────────────────────────
      const items=tfLines.map(l=>{
        const text=l.replace(/^[a-d][\.\)]\s*/,'').replace(/[\s\u00a0]*[SĐ]$/,'').trim();
        const suf=l.trimEnd().slice(-1);
        const answer=suf==='Đ'?true:suf==='S'?false:true;
        return{text,answer};
      });
      const firstIdx=lines.findIndex(l=>/^[a-d][\.\)]\s/.test(l));
      const passageLines=lines.slice(0,firstIdx);
      const passage=passageLines.join(' ')
        .replace(/^Câu\s*\d+[\.\:]\s*/,'')
        .replace(/^(Cho đoạn tư liệu|Đọc đoạn|Dựa vào đoạn)[^:]*:\s*/i,'')
        .trim();
      if(items.length>=2)results.push({
        id:Date.now()+Math.random(),type:'true_false',passage,source:'',
        items:items.length>=4?items:[...items,...Array(4-items.length).fill({text:'',answer:true})]
      });
    } else if(hasABCD){
      // ── Trắc nghiệm ────────────────────────────────────────────────
      const optLines=lines.filter(l=>/^[A-D][\.\)]\s/.test(l));
      const options=optLines.map(l=>l.replace(/^[A-D][\.\)]\s*/,'').trim());
      const ansLine=lines.find(l=>/^(answer|đáp án|Đáp án)\s*[:=]/i.test(l));
      let correct=0;
      if(ansLine){
        const letter=ansLine.replace(/^(answer|đáp án|Đáp án)\s*[:=]\s*/i,'').trim()[0].toUpperCase();
        correct=Math.max(0,LETTERS.indexOf(letter));
      }
      const firstOptIdx=lines.findIndex(l=>/^[A-D][\.\)]\s/.test(l));
      const question=lines.slice(0,firstOptIdx).join(' ').replace(/^Câu\s*\d+[\.\:]\s*/,'').trim();
      if(options.length>=2)results.push({
        id:Date.now()+Math.random(),type:'multiple',question,
        options:options.length>=4?options:[...options,...Array(4-options.length).fill('')],correct
      });
    } else if(hasFill){
      // ── Điền từ ────────────────────────────────────────────────────
      const ansLine=lines.find(l=>/^(answer|đáp án|Đáp án)\s*[:=]/i.test(l));
      const answer=ansLine?ansLine.replace(/^(answer|đáp án|Đáp án)\s*[:=]\s*/i,'').trim():'';
      const question=lines.filter(l=>l!==ansLine).join(' ').replace(/^Câu\s*\d+[\.\:]\s*/,'').trim();
      results.push({id:Date.now()+Math.random(),type:'fill_blank',question,answer,hint:''});
    }
  }
  if(!results.length&&raw.trim().length>10)results.push({
    id:Date.now()+Math.random(),type:'multiple',
    question:raw.slice(0,200).trim(),options:['','','',''],correct:0
  });
  return results;
}

/* ══ JSON IMPORTER ════════════════════════════════════════════════════ */
function importJSON(raw){
  const data=JSON.parse(raw);
  const arr=Array.isArray(data)?data:(data.questions||data.data||Object.values(data));
  return arr.map(q=>{
    const id=Date.now()+Math.random();
    const t=(q.type||'').toLowerCase();
    const autoTF=!t&&q.passage&&Array.isArray(q.items)&&q.items.length>0&&'answer' in(q.items[0]||{});
    const isTF=t==='true_false'||t==='trueFalse'||t==='dung_sai'||autoTF;
    if(isTF)return{id,type:'true_false',passage:q.passage||q.content||q.doantulieu||'',source:q.source||q.nguon||'',items:(q.items||q.statements||[]).map(it=>({text:it.text||it.content||it.statement||'',answer:it.answer===true||it.answer==='true'||it.answer==='Đúng'||it.answer===1}))};
    if(!isTF&&(t==='multi_select'||t==='multiselect'||t==='checkbox'))return{id,type:'multi_select',question:q.question||q.content||q.câu_hỏi||'',options:(q.options||q.choices||q.answers||[]).map(o=>o.text||o.content||o||''),correct:q.correct||q.correctAnswers||q.answers_correct||[0]};
    if(!isTF&&(t==='fill_blank'||t==='fillblank'||t==='fill'))return{id,type:'fill_blank',question:q.question||q.content||'',answer:q.answer||q.correct_answer||q.key||'',hint:q.hint||q.goi_y||''};
    const opts=q.options||q.choices||[];
    const optsArr=opts.map(o=>typeof o==='object'?(o.text||o.content||o.label||''):String(o||''));
    let correct=0;
    if(typeof q.correct==='number')correct=q.correct;
    else if(typeof q.correct==='string')correct=Math.max(0,LETTERS.indexOf(q.correct.toUpperCase()));
    else if(typeof q.correctAnswer==='string')correct=Math.max(0,LETTERS.indexOf(q.correctAnswer.toUpperCase()));
    else if(typeof q.answer==='number')correct=q.answer;
    return{id,type:'multiple',question:q.question||q.content||q.câu_hỏi||'',options:optsArr.length>=4?optsArr:[...optsArr,...Array(Math.max(0,4-optsArr.length)).fill('')],correct};
  }).filter(q=>q.passage||q.question);
}


/* ══ EMPTY FACTORIES ══════════════════════════════════════════════════ */
const emptyTF=()=>({id:Date.now()+Math.random(),type:'true_false',passage:'',source:'',items:[{text:'',answer:true},{text:'',answer:false},{text:'',answer:true},{text:'',answer:false}]});
const emptyMC=()=>({id:Date.now()+Math.random(),type:'multiple',question:'',options:['','','',''],correct:0});
const emptyMS=()=>({id:Date.now()+Math.random(),type:'multi_select',question:'',options:['','','',''],correct:[0]});
const emptyFB=()=>({id:Date.now()+Math.random(),type:'fill_blank',question:'',answer:'',hint:''});
const newQ=t=>t==='true_false'?emptyTF():t==='multiple'?emptyMC():t==='multi_select'?emptyMS():emptyFB();

/* ══ STYLED HELPERS — dùng chung từ ui-components.js (tránh trùng lặp code) ══ */
const {Inp,RichInp,MiniRichInp,Fld,Pill}=window;


/* ══ WINDOW EXPORTS — cho các file khác (question-editor.jsx, v.v.) dùng ══ */
window.getTypes=getTypes;
window.LETTERS=LETTERS;
window.stripHTML=stripHTML;
window.parseText=parseText;
window.importJSON=importJSON;
window.emptyTF=emptyTF;
window.emptyMC=emptyMC;
window.emptyMS=emptyMS;
window.emptyFB=emptyFB;
window.newQ=newQ;
window.Inp=Inp;
window.RichInp=RichInp;
window.MiniRichInp=MiniRichInp;
window.Fld=Fld;
window.Pill=Pill;

/* ══ CONFIRM DIALOG ═══════════════════════════════════════════════════ */
const ConfirmDialog=({open,onClose,dark})=>{
  if(!open)return null;
  const {iconType,title,message,confirmLabel='Xác nhận',confirmColor='#EF4444',confirmGrad,onConfirm}=open;
  const isDel=iconType==='delete';
  const isCopy=iconType==='copy';
  const isAdd=iconType==='add';
  return(
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(10,2,25,0.82)',backdropFilter:'blur(12px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:9999}}>
      <div onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:480,background:dark?'#1E0D15':'#fff',borderRadius:'24px 24px 0 0',padding:'24px 20px 32px',boxShadow:'0 -8px 40px rgba(168,85,247,0.25)',animation:'slideIn .22s ease both'}}>
        <div style={{textAlign:'center',marginBottom:14}}>
          <div style={{width:52,height:52,borderRadius:16,
            background:isDel?'#FFF0F0':isCopy?C.lavL:C.mintL,
            border:`1.5px solid ${isDel?'#FECDD3':isCopy?C.border2:'#BBF7D0'}`,
            display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:10}}>
            {isDel&&<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>}
            {isCopy&&<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.lav} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
            {(isAdd||(!isDel&&!isCopy))&&<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.mint} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>}
          </div>
          <div style={{fontSize:17,fontWeight:900,color:dark?'#F0DCE8':'#3D1830',marginBottom:6}}>{title}</div>
          {message&&<div style={{fontSize:13,color:dark?'#8A6080':'#A07090',lineHeight:1.65}} dangerouslySetInnerHTML={{__html:message}}/>}
        </div>
        <div style={{display:'flex',gap:10,marginTop:18}}>
          <button onClick={onClose}
            style={{flex:1,padding:'10px',borderRadius:999,border:`1.5px solid ${dark?'#421526':'#F5D5E8'}`,background:'transparent',color:dark?'#C898B8':'#6B3050',fontSize:14,fontWeight:800,cursor:'pointer'}}>
            Huỷ
          </button>
          <button onClick={()=>{onConfirm&&onConfirm();onClose();}}
            style={{flex:1,padding:'10px',borderRadius:999,border:'none',
              background:confirmGrad||confirmColor,color:'#fff',
              fontSize:14,fontWeight:900,cursor:'pointer',
              boxShadow:`0 4px 16px ${confirmColor}55`,transition:'all .18s'}}>
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
  const [history,setHistory]=useState(()=>{try{return JSON.parse(localStorage.getItem('ta_history')||'[]');}catch{return[];}});
  const [histDetail,setHistDetail]=useState(null);
  const [editingId,setEditingId]=useState(_h0.editingId);
  const [subject,setSubject]=useState('Tiếng Anh');
  const [aiLoading,setAiLoading]=useState(false);
  const [aiModal,setAiModal]=useState(false);
  const [aiSuggestions,setAiSuggestions]=useState([]);
  // Chat mini
  const [chatOpen,setChatOpen]=useState(false);
  const [chatMsgs,setChatMsgs]=useState([]);
  const [chatInput,setChatInput]=useState('');
  const [chatLoading,setChatLoading]=useState(false);
  // Auto-answer
  const [autoAI,setAutoAI]=useState(false);
  // Merge questions from other lessons
  const [mergeModal,setMergeModal]=useState(false);
  const [toolboxOpen,setToolboxOpen]=useState(false);
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
  C=dark?CD:CL;
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
  const _isLoadingLesson=useRef(false); // guard: vừa load bài xong, chưa được phép auto-save
  useEffect(()=>{
    if(!authed)return;
    if(editingId===null)return;
    setLeaving(false); // reset khi vào bài mới
    _isLoadingLesson.current=true; // chặn auto-save trong lúc load
    const l=lessonsRef.current.find(l=>l.id===editingId);
    if(l){setTitle(l.title||'');setSubject(l.subject||'Tiếng Anh');setPassword(l.password||'');setQ(l.questions&&l.questions.length?l.questions:[emptyTF()]);setTimerLimit(l.timerLimit||0);}
    // Tắt guard sau 1.2s (> debounce 800ms) — đủ để state settle xong
    const t=setTimeout(()=>{_isLoadingLesson.current=false;},1200);
    return()=>clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[editingId,authed]); // ← KHÔNG đưa lessons vào deps: tránh loop khi setLessons sau save
  const toast_=useCallback((msg,ms=3000)=>{
    let type='auto',txt=msg;
    const p=msg&&msg[0];
    if(p==='+'){type='success';txt=msg.slice(2);}
    else if(p==='!'){type='warn';txt=msg.slice(2);}
    else if(p==='x'){type='error';txt=msg.slice(2);}
    showToast(txt,type,ms);
  },[]);
  useEffect(()=>{
    // Skip auto-save nếu editingId vừa đổi (chuyển bài, không phải edit)
    if(editingId===null)return;
    if(_prevEditingId.current!==editingId){_prevEditingId.current=editingId;return;}
    // Skip nếu đang trong quá trình save (setLessons/renderLessons vừa trigger re-render)
    if(_isSaving.current)return;
    // Skip nếu vừa load bài (tránh auto-save ngay khi mở bài)
    if(_isLoadingLesson.current)return;
    // Sync to bridge
    if(window.data){
      const idx=(window.data.lessons||[]).findIndex(l=>String(l.id)===String(editingId));
      if(idx>=0) Object.assign(window.data.lessons[idx],{title,subject,questions,password,lessonPassword:password,timerLimit,timeLimit:timerLimit||null});
    }
    const t=setTimeout(()=>{
      _isSaving.current=true;
      supa.from('lessons').upsert({id:editingId,title,subject,questions,password,timerLimit},{onConflict:'id'})
        .then(({error})=>{
          if(error){console.error('Auto-save error:',error);}
          else{
            setLessonsSynced(prev=>prev.map(l=>l.id===editingId?{...l,title,subject,questions,password,timerLimit}:l));
            // Bọc vào setTimeout để phá vỡ vòng lặp đồng bộ đè Stack
            setTimeout(()=>{
              window.dispatchEvent(new CustomEvent('learnsy:render-lessons'));
            },0);
            if(typeof invalidateCache==='function') invalidateCache();
          }
        })
        .finally(()=>{
          // Reset flag sau 500ms — đủ để setLessons flush xong và effect deps không retrigger nữa
          setTimeout(()=>{_isSaving.current=false;},500);
        });
    },800);
    return()=>clearTimeout(t);
  },[title,subject,questions,password,timerLimit,editingId,toast_]);
  const jsonRef=useRef();
  const addMenuRef=useRef();
  const toolboxRef=useRef();
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

  const addQ=useCallback((t)=>{setQ(p=>[...p,newQ(t)]);setAddMenu(false);setTimeout(()=>window.scrollTo({top:9999,behavior:'smooth'}),60);},[]);
  const removeQ=useCallback((id)=>setQ(p=>p.filter(q=>q.id!==id)),[]);
  const upQ=useCallback((id,f,v)=>setQ(p=>p.map(q=>q.id===id?{...q,[f]:v}:q)),[]);
  const upItem=useCallback((id,ii,f,v)=>setQ(p=>p.map(q=>q.id===id?{...q,items:q.items.map((it,i)=>i===ii?{...it,[f]:v}:it)}:q)),[]);
  const addItem=useCallback((id)=>setQ(p=>p.map(q=>q.id===id?{...q,items:[...q.items,{text:'',answer:true}]}:q)),[]);
  const remItem=useCallback((id,ii)=>setQ(p=>p.map(q=>q.id===id&&q.items.length>2?{...q,items:q.items.filter((_,i)=>i!==ii)}:q)),[]);
  const upOpt=useCallback((id,ii,v)=>setQ(p=>p.map(q=>q.id===id?{...q,options:q.options.map((o,i)=>i===ii?v:o)}:q)),[]);
  const addOpt=useCallback((id)=>setQ(p=>p.map(q=>q.id===id&&q.options.length<6?{...q,options:[...q.options,'']}:q)),[]);
  const remOpt=useCallback((id,ii)=>setQ(p=>p.map(q=>q.id===id&&q.options.length>2?{...q,options:q.options.filter((_,i)=>i!==ii),correct:typeof q.correct==='number'&&q.correct>=ii?Math.max(0,q.correct-1):q.correct}:q)),[]);

  const saveHistory=(rec)=>{
    setHistory(prev=>{
      const updated=[rec,...prev].slice(0,20);
      try{localStorage.setItem('ta_history',JSON.stringify(updated));}catch{}
      return updated;
    });
  };
  const clearHistory=useCallback(()=>{setHistory([]);try{localStorage.removeItem('ta_history');}catch{}},[]);
  const addLesson=useCallback(async()=>{
    const id='l'+Date.now();
    const lesson={id,title:'Bộ câu hỏi mới',subject:'Tiếng Anh',password:'',questions:[emptyTF()]};
    const {error}=await supa.from('lessons').insert({id,title:lesson.title,subject:lesson.subject,password:lesson.password,questions:lesson.questions,created_at:new Date().toISOString()});
    if(error){toast_('x Không tạo được bài: '+error.message,5000);console.error('Insert error:',error);return;}
    if(typeof invalidateCache==="function") invalidateCache();
    setLessonsSynced(prev=>[...prev,lesson]);
    setTitle('Bộ câu hỏi mới');setSubject('Tiếng Anh');setPassword('');setQ([emptyTF()]);
    setEditingId(id);setTab('build');
    toast_('+ Đã tạo bài mới!',2000);
  },[toast_]);
  const deleteLesson=useCallback(async(id,e,_confirmed=false)=>{
    e&&e.stopPropagation();
    if(!_confirmed&&!window.confirm('Xoá bộ câu hỏi này?'))return;
    await supa.from('lessons').delete().eq('id',id);
    if(typeof invalidateCache==="function") invalidateCache();
    setLessonsSynced(prev=>prev.filter(l=>l.id!==id));
    window.dispatchEvent(new CustomEvent('learnsy:delete-success'));
  },[]);
  const suggestAI=useCallback(async()=>{
    setAiLoading(true);setAiModal(true);setAiSuggestions([]);
    try{
      const res=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({subject,title,existingQuestions:questions.slice(0,5)})});
      const data=await res.json();
      if(Array.isArray(data))setAiSuggestions(data);
      else setAiSuggestions([]);
    }catch(e){setAiSuggestions([]);}
    setAiLoading(false);
  },[subject,title,questions]);
  const addAiQuestion=useCallback((q)=>{
    const id='q'+Date.now()+Math.random();
    setQ(p=>[...p,{...q,id,type:'multiple'}]);
    toast_('+ Đã thêm câu hỏi AI!');
  },[toast_]);
  // Chat mini — gửi tin nhắn
  const sendChat=useCallback(async(msg)=>{
    if(!msg.trim()||chatLoading)return;
    const userMsg={role:'user',content:msg.trim()};
    const history=[...chatMsgs,userMsg];
    setChatMsgs(history);
    setChatInput('');
    setChatLoading(true);
    try{
      const ctx=`Bạn là trợ lý soạn đề thi thân thiện. Bộ đề đang soạn: môn "${subject}", tiêu đề "${title||'Chưa đặt tên'}", ${questions.length} câu hỏi.`;
      const data=await cfFetch('/api/chat',{
        messages:[{role:'system',content:ctx},...history.map(m=>({role:m.role,content:m.content}))],
      });
      const reply=data.reply||data.response||data.result||'(Không có phản hồi)';
      setChatMsgs(p=>[...p,{role:'assistant',content:reply}]);
    }catch(e){
      setChatMsgs(p=>[...p,{role:'assistant',content:'❌ Lỗi kết nối Worker AI. Thử lại nhé!'}]);
    }
    setChatLoading(false);
  },[chatMsgs,chatLoading,subject,title,questions]);
  // Auto-answer — AI tự xác định đáp án đúng cho một câu
  const aiAnswer=useCallback(async(q)=>{
    try{
      const data=await cfFetch('/api/ai-answer',{
        type:q.type,
        question:q.question||'',
        options:q.options||[],
        passage:q.passage||'',
        items:(q.items||[]).map(it=>it.text),
        subject,
      });
      return data;
    }catch(e){return null;}
  },[subject]);
  const handleAIAnswer=useCallback(async(q)=>{
    const res=await aiAnswer(q);
    if(!res){toast_('x AI không trả về đáp án!',3000);return;}
    if(q.type==='multiple'&&typeof res.correct==='number'){
      upQ(q.id,'correct',res.correct);toast_('+ AI đã chọn đáp án!');
    } else if(q.type==='multi_select'&&Array.isArray(res.correct)){
      upQ(q.id,'correct',res.correct);toast_('+ AI đã chọn đáp án!');
    } else if(q.type==='fill_blank'&&res.answer){
      upQ(q.id,'answer',res.answer);toast_('+ AI đã điền đáp án!');
    } else if(q.type==='true_false'&&Array.isArray(res.items)){
      res.items.forEach((val,ii)=>{if(ii<q.items.length)upItem(q.id,ii,'answer',!!val);});
      toast_('+ AI đã xác định đúng/sai!');
    } else {
      toast_('! AI trả về không khớp loại câu hỏi',3000);
    }
  },[aiAnswer,upQ,upItem,toast_]);
  const goHome=useCallback(()=>{
    // Blur contenteditable trước — dừng Samsung WebView inject DOM nodes
    document.querySelectorAll('[contenteditable]').forEach(el=>el.blur());
    if(document.activeElement)document.activeElement.blur();
    // display:none QEditors ngay (setLeaving) → đợi 150ms → mới unmount (setEditingId null)
    // Tránh race condition: React unmount contenteditable trong khi browser còn mutation
    setLeaving(true);
    setTimeout(()=>{setEditingId(null);setTab('build');},150);
  },[]);
  const handleMergeQuestions=useCallback((toAdd)=>{
    if(!toAdd||!toAdd.length)return;
    setQ(p=>[...p,...toAdd]);
    toast_(`+ Đã gộp ${toAdd.length} câu hỏi vào bộ đề!`,3000);
  },[toast_]);
  const dupLesson=useCallback(async(l,e)=>{
    e&&e.stopPropagation();
    const id='l'+Date.now();
    const dup={...l,id,title:l.title+' (bản sao)',questions:l.questions.map(q=>({...q,id:Date.now()+Math.random()}))};
    await supa.from('lessons').insert({id:dup.id,title:dup.title,subject:dup.subject,password:dup.password,questions:dup.questions});
    if(typeof invalidateCache==="function") invalidateCache();
    setLessonsSynced(prev=>[...prev,dup]);
    toast_('+ Đã sao chép bộ câu hỏi!');
  },[toast_]);

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
    if(!lessons.length){toast_('! Chưa có bộ câu hỏi nào!');return;}
    const validLessons=lessons.filter(l=>l.questions&&l.questions.length>0);
    if(!validLessons.length){toast_('! Chưa có câu hỏi trong bộ nào!');return;}
    const html=exportTheme==='lite'
      ?buildExportLiteHTML(validLessons,shuffleQ,shuffleA,timerLimit)
      :buildExportHTML(validLessons,shuffleQ,shuffleA,timerLimit);
    const blob=new Blob([html],{type:'text/html'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download='thu-anh-quiz.html';a.click();
    toast_(`+ Đã xuất ${validLessons.length} bộ câu hỏi!`);
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
      if(q.type==='multiple'){const cv=q.options[q.correct];const o=_sf([...q.options]);return{...q,options:o,correct:o.indexOf(cv)};}
      if(q.type==='multi_select'){const cvs=(q.correct||[]).map(i=>q.options[i]);const o=_sf([...q.options]);return{...q,options:o,correct:cvs.map(v=>o.indexOf(v))};}
      if(q.type==='true_false')return{...q,items:_sf([...q.items])};
      return q;
    });
    if(shuffleQ)qs=_sf(qs);
    setLiveQs(qs);
    setPAns(qs.map(q=>{if(q.type==='true_false')return q.items.map(()=>null);if(q.type==='multi_select')return[];return null;}));
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
            <span className="logo-learnsy">Learnsy</span>
            <span className="logo-flb"><Sparkle s={13} c="#6366f1"/></span>
            <span style={{fontSize:10,fontWeight:900,color:C.lav,background:C.lavL,border:`1.5px solid ${C.border2}`,borderRadius:99,padding:'2px 7px',marginLeft:1,flexShrink:0}}>Admin</span>
            <div style={{flex:1}}/>
            {/* Logout — luôn hiện */}
            <button title="Đăng xuất" onClick={()=>{try{localStorage.removeItem(AUTH_KEY);}catch{}setAuthed(false);}}
              style={{display:'flex',alignItems:'center',justifyContent:'center',width:32,height:32,borderRadius:999,border:`1.5px solid ${C.border}`,background:C.bg,color:C.text3,cursor:'pointer',flexShrink:0}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
            {/* Menu bung — chứa các nút còn lại */}
            <div ref={headerMenuRef} style={{position:'relative',flexShrink:0}}>
              <button title="Menu" onClick={()=>setHeaderMenuOpen(p=>!p)}
                style={{display:'flex',alignItems:'center',justifyContent:'center',width:32,height:32,borderRadius:999,
                  border:`1.5px solid ${headerMenuOpen?C.lav:C.border2}`,
                  background:headerMenuOpen?C.grad:C.lavL,
                  color:headerMenuOpen?'#fff':C.lav,
                  cursor:'pointer',transition:'all .18s',boxShadow:headerMenuOpen?'0 2px 12px rgba(168,85,247,0.3)':'none'}}>
                {headerMenuOpen
                  ?<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  :<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></svg>}
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
        {/* ── Home Tab Bar ── */}
        <div style={{display:'flex',gap:6,padding:'10px 14px 0',borderBottom:`1.5px solid ${C.border}`,background:dark?'rgba(30,13,21,0.97)':'rgba(255,255,255,0.95)'}}>
          {[['lessons',<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,'Bài học'],['listening',<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/></svg>,'Listening'],['students',<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,'Học sinh']].map(([k,icon,l])=>(
            <button key={k} onClick={()=>setHomeTab(k)} style={{
              display:'flex',alignItems:'center',gap:5,padding:'8px 16px',
              borderRadius:'12px 12px 0 0',fontSize:13,fontWeight:800,cursor:'pointer',
              border:`1.5px solid ${homeTab===k?C.border:'transparent'}`,
              borderBottom:homeTab===k?`2px solid ${C.rose}`:'2px solid transparent',
              background:homeTab===k?(dark?'rgba(255,100,150,0.08)':'rgba(255,240,248,0.8)'):'transparent',
              color:homeTab===k?C.rose:C.text3,transition:'all .18s',
            }}>{icon}{l}</button>
          ))}
        </div>
        {homeTab==='students'&&<StudentManager dark={dark} C={C} cardBlur={cardBlur} cardBlurStyle={cardBlurStyle}/>}
        {homeTab==='listening'&&ListeningManager&&<ListeningManager dark={dark} C={C} confirm_={confirm_} toast_={toast_}/>}
        <div style={{display:homeTab==='lessons'?'flex':'none',padding:'16px 12px 100px',flexDirection:'column',gap:10}} className="fade-up">
          {/* Stats + Add button */}
          <div style={{paddingBottom:12,marginBottom:2,borderBottom:`2px solid ${C.border}`}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{flex:1}}>
              <div style={{fontSize:18,fontWeight:900,color:C.text,lineHeight:1.2}}>Bài học</div>
              <div style={{fontSize:12,color:C.text3,marginTop:2}}>{lessons.length} bài · {lessons.reduce((a,l)=>a+(l.questions?.length||0),0)} câu hỏi</div>
            </div>
            <button onClick={()=>confirm_({
                iconType:'add',title:'Tạo bộ câu hỏi mới?',
                message:'Bộ câu hỏi mới sẽ được tạo và lưu vào Supabase.',
                confirmLabel:'Tạo ngay',confirmColor:'#A855F7',
                confirmGrad:'linear-gradient(135deg,#F472B6,#A855F7)',
                onConfirm:addLesson,
              })}
              style={{display:'flex',alignItems:'center',gap:6,padding:'10px 16px',borderRadius:999,border:'none',background:C.grad,color:'#fff',fontSize:13,fontWeight:900,cursor:'pointer',boxShadow:'0 4px 16px rgba(168,85,247,0.3)',flexShrink:0}}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M11 9h4v2h-4v4H9v-4H5V9h4V5h2v4z"/></svg>
              Thêm bài mới
            </button>
          </div>
          </div>

          {/* Search bar */}
          <div style={{position:'relative',marginBottom:6}}>
            <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
              placeholder="🔍 Tìm kiếm bộ câu hỏi..."
              style={{width:'100%',padding:'9px 14px 9px 36px',borderRadius:999,border:`1.5px solid ${searchQuery?C.lav:C.border}`,background:C.surface,color:C.text,fontSize:13,fontWeight:700,outline:'none',fontFamily:'Nunito,sans-serif',transition:'all .2s'}}/>
            <svg style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={searchQuery?C.lav:C.text3} strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            {searchQuery&&<button onClick={()=>setSearchQuery('')} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:C.text3,fontSize:16,lineHeight:1}}>×</button>}
          </div>
          {/* Sort bar */}
          <div style={{display:'flex',gap:6,marginBottom:8,overflowX:'auto',paddingBottom:2}}>
            {[['newest','Mới nhất'],['oldest','Cũ nhất'],['name','Tên A-Z'],['count','Nhiều câu nhất']].map(([k,l])=>(
              <button key={k} onClick={()=>setSortBy(k)}
                style={{flexShrink:0,padding:'5px 13px',borderRadius:999,fontSize:11,fontWeight:800,cursor:'pointer',border:`1.5px solid ${sortBy===k?C.lav:C.border}`,background:sortBy===k?C.lavL:C.bg,color:sortBy===k?C.lav:C.text3,transition:'all .15s'}}>
                {l}
              </button>
            ))}
            <div style={{flex:1}}/>
            {/* Blur quick toggle */}
            <button onClick={()=>setCardBlurPersist(cardBlur==='off'?'50':cardBlur==='50'?'85':'off')}
              title={"Blur card: "+(cardBlur==='off'?'Tắt':cardBlur+'%')}
              style={{flexShrink:0,display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:999,fontSize:11,fontWeight:800,cursor:'pointer',
                border:`1.5px solid ${cardBlur!=='off'?'#8B5CF6':C.border}`,
                background:cardBlur!=='off'?C.lavL:C.bg,
                color:cardBlur!=='off'?'#8B5CF6':C.text3,transition:'all .15s'}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="5"/><circle cx="16" cy="16" r="5" opacity=".5"/></svg>
              {cardBlur==='off'?'Blur':cardBlur+'%'}
            </button>
          </div>

          {/* Subject Filter Tabs */}
          {(()=>{
            const tabDefs=[
              {key:'all',text:'Tất cả',count:lessons.length},
              {key:'english',text:'Tiếng Anh',count:lessons.filter(l=>l.subject==='Tiếng Anh').length},
              {key:'other',text:'Các môn',count:lessons.filter(l=>l.subject!=='Tiếng Anh').length},
            ];
            const TabIcon=({k})=>{
              if(k==='all')return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 10h16M4 14h8M4 18h6"/></svg>;
              if(k==='english')return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8l4 4-4 4"/><path d="M12 16h7"/></svg>;
              return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
            };
            return(
              <div style={{display:'flex',gap:7,marginBottom:4}}>
                {tabDefs.map(({key,text,count})=>{
                  const active=lessonFilter===key;
                  return(
                    <button key={key} onClick={()=>setLessonFilter(key)}
                      style={{
                        flex:1,padding:'8px 4px',borderRadius:13,
                        border:`1.5px solid ${active?C.lav:C.border}`,
                        background:active?C.grad:(dark?'#261018':'#FFFFFF'),
                        color:active?'#fff':C.text2,
                        fontSize:11,fontWeight:900,cursor:'pointer',transition:'all .18s',
                        display:'flex',flexDirection:'column',alignItems:'center',gap:3,
                        boxShadow:active?'0 4px 14px rgba(168,85,247,0.28)':'none',
                      }}>
                      <span style={{display:'flex',alignItems:'center',gap:4}}><TabIcon k={key}/><span style={{fontSize:11}}>{text}</span></span>
                      <span style={{
                        fontSize:10,fontWeight:800,
                        background:active?'rgba(255,255,255,0.22)':'transparent',
                        color:active?'rgba(255,255,255,0.85)':C.text3,
                        borderRadius:99,padding:'1px 7px',
                        border:active?'none':`1px solid ${C.border}`,
                      }}>{count} bộ</span>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* Empty state */}
          {lessons.length===0&&(
            <div style={{textAlign:'center',padding:'48px 20px',background:C.surface,border:`2px dashed ${C.border}`,borderRadius:20,marginTop:8}}>
              <div style={{fontSize:40,marginBottom:12}}>
                <Flower s={48} c="#FFB7C9"/>
              </div>
              <div style={{fontSize:15,fontWeight:900,color:C.text2,marginBottom:6}}>Chưa có bộ câu hỏi nào</div>
              <div style={{fontSize:12,color:C.text3,lineHeight:1.7,marginBottom:16}}>Bấm "Thêm bộ mới" để bắt đầu tạo đề thi nhé!</div>
              <button onClick={addLesson}
                style={{padding:'10px 24px',borderRadius:999,border:'none',background:C.grad,color:'#fff',fontSize:13,fontWeight:900,cursor:'pointer',boxShadow:'0 4px 16px rgba(168,85,247,0.25)'}}>
                + Thêm bộ đầu tiên
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
                style={{background:C.surface,...cardBlurStyle,border:`2px solid ${C.border}`,borderRadius:18,padding:'14px 16px',display:'flex',alignItems:'center',gap:12,boxShadow:`0 2px 14px rgba(255,100,150,0.09),0 0 0 1px ${C.border}`,cursor:'pointer',transition:'all .18s',animation:`fadeUp .2s ${idx*0.04}s both`}}
                onMouseEnter={e=>{e.currentTarget.style.boxShadow=`0 6px 24px rgba(168,85,247,0.18),0 0 0 1.5px ${C.lav2}`;e.currentTarget.style.borderColor=C.lav2;e.currentTarget.style.transform='translateY(-1px)';}}
                onMouseLeave={e=>{e.currentTarget.style.boxShadow=`0 2px 14px rgba(255,100,150,0.09),0 0 0 1px ${C.border}`;e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform='translateY(0)';}}>
                {/* Icon */}
                <div style={{width:46,height:46,borderRadius:13,background:'rgba(100,160,255,0.13)',border:'1.5px solid rgba(100,160,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6BA4E8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    <line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="13" y2="13"/>
                  </svg>
                </div>
                {/* Info */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:15,fontWeight:800,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{l.title||'Chưa đặt tên'}</div>
                  <div style={{fontSize:11,color:C.lav2,fontWeight:600,marginTop:2,display:'flex',alignItems:'center',gap:5}}>
                    {l.password&&<span style={{fontSize:9,fontWeight:800,color:'#6366f1',background:'#EEF2FF',border:'1px solid #C7D2FE',borderRadius:99,padding:'1px 6px',display:'inline-flex',alignItems:'center',gap:3}}><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Mật khẩu</span>}
                    Bài tập trắc nghiệm
                  </div>
                  {qCount>0&&(
                    <div style={{display:'flex',gap:5,marginTop:5,flexWrap:'wrap'}}>
                      {tfCount>0&&<span style={{fontSize:9,fontWeight:800,color:'#A855F7',background:C.lavL,border:`1px solid ${C.border2}`,borderRadius:99,padding:'1px 6px'}}>{tfCount} ĐS</span>}
                      {tnCount>0&&<span style={{fontSize:9,fontWeight:800,color:'#10B981',background:C.mintL,border:'1px solid #BBF7D0',borderRadius:99,padding:'1px 6px'}}>{tnCount} TN</span>}
                      {dtCount>0&&<span style={{fontSize:9,fontWeight:800,color:'#F97316',background:C.peachL,border:'1px solid #FED7AA',borderRadius:99,padding:'1px 6px'}}>{dtCount} ĐT</span>}
                    </div>
                  )}
                </div>
                {/* Badges + actions */}
                <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                  <span style={{fontSize:11,fontWeight:700,color:C.text2,background:dark?'rgba(255,255,255,0.07)':'rgba(100,160,255,0.1)',border:`1px solid ${dark?'rgba(255,255,255,0.1)':'rgba(100,160,255,0.2)'}`,borderRadius:99,padding:'3px 9px',whiteSpace:'nowrap'}}>{l.subject||'Tiếng Anh'}</span>
                  <span style={{fontSize:11,fontWeight:700,color:C.text2,background:dark?'rgba(255,255,255,0.07)':'rgba(100,160,255,0.1)',border:`1px solid ${dark?'rgba(255,255,255,0.1)':'rgba(100,160,255,0.2)'}`,borderRadius:99,padding:'3px 9px',whiteSpace:'nowrap'}}>{qCount} câu</span>
                  {/* Dup */}
                  <button onClick={(e)=>{e.stopPropagation();
                    const _t=l.title||'Chưa đặt tên';
                    confirm_({
                    iconType:'copy',title:'Sao chép bộ câu hỏi?',
                    message:'Tạo bản sao của <b>'+_t+'</b>.',
                    confirmLabel:'Sao chép',confirmColor:'#A855F7',
                    confirmGrad:'linear-gradient(135deg,#C084FC,#A855F7)',
                    onConfirm:()=>dupLesson(l,null),
                  });}}
                    style={{width:28,height:28,borderRadius:8,border:`1.5px solid ${C.border2}`,background:C.lavL,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,transition:'all .15s'}}
                    onMouseEnter={e=>e.currentTarget.style.background=C.lavPale}
                    onMouseLeave={e=>e.currentTarget.style.background=C.lavL}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.lav} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  </button>
                  {/* Delete */}
                  <button onClick={(e)=>{e.stopPropagation();
                    const _t2=l.title||'Chưa đặt tên';
                    const _qc=(l.questions||[]).length;
                    confirm_({
                    iconType:'delete',title:'Xoá bộ câu hỏi?',
                    message:'<b>'+_t2+'</b><br/><span style="color:#A07090">'+_qc+' câu hỏi sẽ bị xóa vĩnh viễn.</span>',
                    confirmLabel:'Xoá',confirmColor:'#EF4444',
                    onConfirm:()=>deleteLesson(l.id,null,true),
                  });}}
                    style={{width:28,height:28,borderRadius:8,border:'1.5px solid #FECDD3',background:C.rosePale,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,transition:'all .15s'}}
                    onMouseEnter={e=>e.currentTarget.style.background=C.roseL}
                    onMouseLeave={e=>e.currentTarget.style.background=C.rosePale}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                  {/* Arrow */}
                  <svg width="14" height="14" viewBox="0 0 20 20" fill={C.lav2}><path d="M5 7l5 5 5-5"/></svg>
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
                {lessonFilter==='english'?'Chưa có bộ câu hỏi Tiếng Anh nào':'Chưa có bộ câu hỏi các môn nào'}
              </div>
            </div>
          )}
        </div>

        {/* ── HISTORY SECTION ── */}
        {history.length>0&&(
          <div style={{marginTop:16}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.rose} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span style={{fontSize:13,fontWeight:900,color:C.text2,flex:1}}>Lịch sử làm bài</span>
              <button onClick={clearHistory}
                style={{padding:'4px 11px',borderRadius:999,border:`1.5px solid ${C.border}`,background:C.rosePale,color:'#EF4444',fontSize:11,fontWeight:800,cursor:'pointer',transition:'all .15s'}}
                onMouseEnter={e=>e.currentTarget.style.background=C.roseL}
                onMouseLeave={e=>e.currentTarget.style.background=C.rosePale}>
                Xóa tất cả
              </button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {history.map((h,hi)=>{
                const rc2=h.pct>=0.8?'#10B981':h.pct>=0.5?'#F59E0B':'#EF4444';
                const bg2=h.pct>=0.8?C.mintL:h.pct>=0.5?C.peachL:C.rosePale;
                const bd2=h.pct>=0.8?'#BBF7D0':h.pct>=0.5?'#FED7AA':C.border;
                const d=new Date(h.ts);
                const dateStr=`${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                return(
                  <div key={h.id} onClick={()=>setHistDetail(h)}
                    style={{background:C.surface,border:`1.5px solid ${C.border}`,borderRadius:15,padding:'11px 14px',display:'flex',alignItems:'center',gap:11,cursor:'pointer',transition:'all .18s',animation:`fadeUp .18s ${hi*0.03}s both`}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=rc2;e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow=`0 4px 18px rgba(0,0,0,0.07)`;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}>
                    {/* Score badge */}
                    <div style={{width:46,height:46,borderRadius:13,background:bg2,border:`1.5px solid ${bd2}`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <span style={{fontSize:13,fontWeight:900,color:rc2,lineHeight:1}}>{Math.round(h.pct*100)}%</span>
                      <span style={{fontSize:9,fontWeight:700,color:rc2,opacity:0.75}}>{h.score?.toFixed?.(1)||h.score}/{h.total}</span>
                    </div>
                    {/* Info */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:800,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{h.lessonTitle}</div>
                      <div style={{fontSize:11,color:C.text3,marginTop:2}}>{dateStr} · {h.qCount} câu</div>
                      {/* Mini dots */}
                      {h.perQ&&(
                        <div style={{display:'flex',gap:3,marginTop:5,flexWrap:'wrap'}}>
                          {h.perQ.map((pq,pi)=>(
                            <div key={pi} title={`Câu ${pi+1}: ${pq.ok?'Đúng':pq.partial?'Một phần':'Sai'}`}
                              style={{width:8,height:8,borderRadius:'50%',flexShrink:0,
                                background:pq.ok?'#10B981':pq.partial?'#F59E0B':'#EF4444',
                                opacity:0.85}}/>
                          ))}
                        </div>
                      )}
                    </div>
                    <svg width="13" height="13" viewBox="0 0 20 20" fill={C.text4}><path d="M7 5l6 5-6 5V5z"/></svg>
                  </div>
                );
              })}
            </div>
          </div>
        )}


        {/* History Detail Modal */}
        {histDetail&&(
          <div onClick={()=>setHistDetail(null)} style={{position:'fixed',inset:0,background:'rgba(10,2,25,0.82)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:20}}>
            <div onClick={e=>e.stopPropagation()} style={{background:dark?'linear-gradient(160deg,#1E0845,#120330)':'linear-gradient(160deg,#FFF5F9,#F0E6FF)',border:`1.5px solid ${dark?'rgba(255,150,200,0.2)':C.border}`,borderRadius:24,padding:'22px 18px 20px',maxWidth:340,width:'100%',boxShadow:'0 30px 80px rgba(0,0,0,0.5)',animation:'pop .22s ease both',maxHeight:'85vh',overflowY:'auto'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.rose} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span style={{fontSize:14,fontWeight:900,color:C.text,flex:1}}>Chi tiết lần làm</span>
                <button onClick={()=>setHistDetail(null)} style={{background:'none',border:'none',cursor:'pointer',padding:4,color:C.text3}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              {/* Score summary */}
              <div style={{textAlign:'center',marginBottom:14}}>
                <div style={{fontSize:11,color:C.text3,marginBottom:2}}>{histDetail.lessonTitle}</div>
                <div style={{fontSize:11,color:C.text4}}>{new Date(histDetail.ts).toLocaleString('vi-VN')}</div>
                {(()=>{const rc3=histDetail.pct>=0.8?'#10B981':histDetail.pct>=0.5?'#F59E0B':'#EF4444';return(
                  <div style={{marginTop:10,fontSize:32,fontWeight:900,color:rc3}}>{Math.round(histDetail.pct*100)}%
                    <span style={{fontSize:14,fontWeight:700,color:C.text3,marginLeft:6}}>{histDetail.score?.toFixed?.(2)||histDetail.score} / {histDetail.total}</span>
                  </div>
                );})()}
                <div style={{height:6,background:dark?'rgba(255,255,255,0.08)':C.border,borderRadius:99,margin:'8px 0 4px',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${histDetail.pct*100}%`,borderRadius:99,
                    background:histDetail.pct>=0.8?'linear-gradient(90deg,#10B981,#6EE7B7)':histDetail.pct>=0.5?'linear-gradient(90deg,#F59E0B,#FCD34D)':'linear-gradient(90deg,#EF4444,#FCA5A5)',
                    transition:'width .6s ease'}}/>
                </div>
              </div>
              {/* Per-question list */}
              {histDetail.perQ&&(
                <div style={{background:dark?'rgba(255,255,255,0.04)':C.bg2,border:`1px solid ${dark?'rgba(196,181,253,0.12)':C.border}`,borderRadius:13,padding:'9px 12px'}}>
                  {histDetail.perQ.map((pq,pi)=>{
                    const typeLabel={true_false:'ĐS',multiple:'TN',multi_select:'CN',fill_blank:'ĐT'}[pq.type]||'?';
                    const c=pq.ok?'#10B981':pq.partial?'#F59E0B':'#EF4444';
                    return(
                      <div key={pi} style={{padding:'5px 0',borderBottom:pi<histDetail.perQ.length-1?`1px solid ${dark?'rgba(255,255,255,0.05)':C.border}`:'none'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12,fontWeight:700}}>
                          <span style={{color:C.text3,display:'flex',gap:5,alignItems:'center'}}>
                            <span style={{fontSize:9,fontWeight:800,color:C.text4,background:dark?'rgba(255,255,255,0.06)':C.border,padding:'1px 5px',borderRadius:99}}>{typeLabel}</span>
                            Câu {pi+1}
                          </span>
                          <span style={{color:c,display:'flex',alignItems:'center',gap:3}}>
                            {pq.ok?'Đúng':pq.partial?'Một phần':'Sai'}
                          </span>
                        </div>
                        {!pq.ok&&pq.qText&&(
                          <div style={{marginTop:5,padding:'6px 8px',background:dark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.04)',borderRadius:8,borderLeft:`2.5px solid ${c}`}}>
                            <div style={{fontSize:11,color:C.text3,lineHeight:1.55,marginBottom:3}}>‹ {pq.qText}{pq.qText.length>=90?'…':''}</div>
                            {pq.correctAns&&<div style={{fontSize:11,fontWeight:800,color:'#10B981',display:'flex',gap:4,alignItems:'flex-start'}}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{marginTop:1,flexShrink:0}}><polyline points="20 6 9 17 4 12"/></svg>
                              <span>Đáp án: {pq.correctAns}</span>
                            </div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <button onClick={()=>setHistDetail(null)}
                style={{marginTop:14,width:'100%',padding:'10px',borderRadius:999,border:'none',background:'linear-gradient(135deg,#F472B6,#A855F7)',color:'#fff',fontSize:13,fontWeight:900,cursor:'pointer',boxShadow:'0 4px 14px rgba(168,85,247,0.3)'}}>
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Dialog — dùng chung toàn app */}
      <ConfirmDialog open={confirmState} onClose={()=>setConfirmState(null)} dark={dark}/>

      {/* Chat Mini */}
      <ChatMini
        open={chatOpen}
        onToggle={()=>setChatOpen(p=>!p)}
        msgs={chatMsgs}
        input={chatInput}
        setInput={setChatInput}
        onSend={sendChat}
        onClear={()=>setChatMsgs([])}
        loading={chatLoading}
        dark={dark}/>
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
          <button onClick={goHome}
            style={{display:'flex',alignItems:'center',gap:5,padding:'6px 11px',borderRadius:999,border:`1.5px solid ${C.border}`,background:C.bg2,color:C.text3,fontSize:12,fontWeight:800,cursor:'pointer',flexShrink:0,transition:'all .15s'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.rose;e.currentTarget.style.color=C.rose;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.text3;}}>
            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path d="M12 4l-8 6 8 6V4z"/></svg>
            Danh sách
          </button>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <span className="logo-fl">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="url(#lg2)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <defs><linearGradient id="lg2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f472b6"/><stop offset="100%" stopColor="#6366f1"/></linearGradient></defs>
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
              </span>
              <span className="logo-learnsy">Learnsy</span>
              <span className="logo-flb"><Sparkle s={12} c="#6366f1"/></span>
              <span style={{fontSize:10,fontWeight:900,color:C.lav,background:C.lavL,border:`1.5px solid ${C.border2}`,borderRadius:99,padding:'2px 8px',marginLeft:2,flexShrink:0,display:'inline-flex',alignItems:'center',gap:3}}><Sparkle s={10} c={C.lav}/>Quiz Builder</span>
            </div>
            <div style={{display:'flex',gap:6,marginTop:5,flexWrap:'wrap'}}>
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
          </div>
        </div>
        {/* Tab bar + Toolbox row */}
        <div style={{display:'flex',padding:'0 10px 9px',gap:4,alignItems:'center'}}>
          <input ref={jsonRef} type="file" accept=".json,application/json" onChange={handleJSONFile} style={{display:'none'}}/>
          {[['build',<svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path d="M2 5h16v2H2V5zm2 4h12v2H4V9zm2 4h8v2H6v-2z"/></svg>,'Soạn'],['import',<svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path d="M10 14l-5-5 1.4-1.4L9 11.2V2h2v9.2l2.6-2.6L15 9l-5 5zM5 16h10v2H5v-2z"/></svg>,'Nhập'],['preview',<svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path d="M10 4C5.5 4 2 10 2 10s3.5 6 8 6 8-6 8-6-3.5-6-8-6zm0 9a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0-4a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg>,'Xem']].map(([k,icon,l])=>(
            <button key={k} onClick={()=>k==='preview'?startPreview():setTab(k)}
              style={{display:'flex',alignItems:'center',gap:5,padding:'7px 13px',borderRadius:999,fontSize:12,fontWeight:800,transition:'all .18s',cursor:'pointer',
                background:tab===k?(dark?'linear-gradient(135deg,#3A0F22,#2A1040)':'linear-gradient(135deg,#FFF0F5,#F0E6FF)'):C.bg,
                color:tab===k?C.rose:C.text3,
                boxShadow:tab===k?`0 2px 8px rgba(255,100,150,0.15)`:undefined,
                border:tab===k?`1.5px solid ${C.border}`:'1.5px solid transparent'}}>
              {icon}{l}
            </button>
          ))}
          <div style={{flex:1}}/>
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
                {/* Thử */}
                <button onClick={()=>{startPreview();setToolboxOpen(false);}}
                  style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'11px 14px',border:'none',
                    background:'transparent',color:C.lav,fontSize:12,fontWeight:800,cursor:'pointer',transition:'background .15s',borderBottom:`1px solid ${C.border}`}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.lavL}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M10 4C5.5 4 2 10 2 10s3.5 6 8 6 8-6 8-6-3.5-6-8-6zm0 10a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>
                  Thử đề
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
                {/* AI */}
                <button onClick={()=>{suggestAI();setToolboxOpen(false);}}
                  style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'11px 14px',border:'none',
                    background:'transparent',color:'#A855F7',fontSize:12,fontWeight:800,cursor:'pointer',transition:'background .15s',borderBottom:`1px solid ${C.border}`,opacity:aiLoading?0.6:1}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.lavL}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  {aiLoading
                    ?<span className="spin" style={{fontSize:14}}>✦</span>
                    :<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/></svg>}
                  Gợi ý AI
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
        </div>
      </div>

      {/* ══ AI MODAL ══ */}
      {aiModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center',padding:'0 0 0 0'}} onClick={()=>setAiModal(false)}>
          <div onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:700,maxHeight:'80vh',overflowY:'auto',background:dark?'#1E0D15':'#fff',borderRadius:'24px 24px 0 0',padding:'20px 16px 32px',boxShadow:'0 -8px 40px rgba(168,85,247,0.25)'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A855F7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/></svg>
              <span style={{fontSize:15,fontWeight:900,color:C.text}}>Gợi ý câu hỏi từ AI</span>
              <div style={{flex:1}}/>
              <button onClick={()=>setAiModal(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.text3}}>×</button>
            </div>
            {aiLoading&&(
              <div style={{textAlign:'center',padding:'32px 0',color:C.text3,fontSize:13}}>✦ AI đang soạn câu hỏi...</div>
            )}
            {!aiLoading&&aiSuggestions.length===0&&(
              <div style={{textAlign:'center',padding:'32px 0',color:C.text3,fontSize:13}}>Không lấy được gợi ý. Thử lại nhé!</div>
            )}
            {!aiLoading&&aiSuggestions.map((q,i)=>(
              <div key={i} style={{background:dark?'rgba(255,255,255,0.04)':'#F9F0FF',border:`1.5px solid ${C.border2}`,borderRadius:14,padding:'13px 14px',marginBottom:10}}>
                <div style={{fontSize:13,fontWeight:800,color:C.text,marginBottom:8}}>❓ {q.text}</div>
                {q.options?.map((opt,oi)=>(
                  <div key={oi} style={{fontSize:12,color:oi===q.correct?'#10B981':C.text3,fontWeight:oi===q.correct?800:600,padding:'3px 0'}}>
                    {['A','B','C','D'][oi]}. {opt} {oi===q.correct?'✓':''}
                  </div>
                ))}
                <button onClick={()=>addAiQuestion(q)}
                  style={{marginTop:10,padding:'7px 16px',borderRadius:999,border:'none',background:'linear-gradient(135deg,#F472B6,#A855F7)',color:'#fff',fontSize:12,fontWeight:800,cursor:'pointer'}}>
                  + Thêm vào đề
                </button>
              </div>
            ))}
            {!aiLoading&&aiSuggestions.length>0&&(
              <button onClick={suggestAI} style={{width:'100%',marginTop:4,padding:'10px',borderRadius:999,border:`1.5px solid ${C.border2}`,background:'none',color:C.lav,fontSize:13,fontWeight:800,cursor:'pointer'}}>↺ Gợi ý lại</button>
            )}
          </div>
        </div>
      )}

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
              <span style={{fontSize:11,fontWeight:900,color:C.rose,textTransform:'uppercase',letterSpacing:.8}}>Tên đề thi</span>
            </div>
            <Inp value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ví dụ: Ôn tập Lịch sử Chương 3"/>
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
                      [autoAI,setAutoAI,'AI tự điền đáp án','#10B981','#10B981',C.mintL,C.border,C.mintL,<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/></svg>],
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
            <QEditor key={q.id} q={q} qi={qi}
              onUp={(f,v)=>upQ(q.id,f,v)}
              onUpItem={(ii,f,v)=>upItem(q.id,ii,f,v)}
              onAddItem={()=>addItem(q.id)}
              onRemItem={ii=>remItem(q.id,ii)}
              onUpOpt={(ii,v)=>upOpt(q.id,ii,v)}
              onAddOpt={()=>addOpt(q.id)}
              onRemOpt={ii=>remOpt(q.id,ii)}
              onRemove={()=>confirm_({
                iconType:'delete',title:'Xóa câu hỏi này?',
                message:'Câu hỏi sẽ bị xóa khỏi bộ đề hiện tại.',
                confirmLabel:'Xóa',confirmColor:'#EF4444',
                onConfirm:()=>removeQ(q.id),
              })}
              canRemove={questions.length>1}
              autoAI={autoAI}
              onAIAnswer={()=>handleAIAnswer(q)}
              dark={dark}/>
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
              onMouseEnter={e=>{e.currentTarget.style.background='#EDE9FE';}}
              onMouseLeave={e=>{e.currentTarget.style.background=C.lavL;}}>
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
              style={{marginTop:10,width:'100%',padding:'12px',borderRadius:999,border:'none',background:parsing?C.lav2:'linear-gradient(135deg,#F472B6,#A855F7)',color:'#fff',fontSize:14,fontWeight:900,cursor:parsing?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:parsing?'none':'0 4px 20px rgba(168,85,247,0.28)',transition:'all .2s'}}>
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
          ...(q.items?{items:q.items.map(it=>({...it,text:stripHTML(it.text)}))}:{}),
          ...(q.options?{options:q.options.map(o=>stripHTML(o))}:{}),
          ...(q.question?{question:stripHTML(q.question)}:{}),
        }))}
          answers={previewAns} setAnswers={setPAns}
          submitted={previewDone} setSubmitted={setPDone}
          cur={previewCur} setCur={setPCur}
          modal={previewModal} setModal={setPModal}
          dark={dark}
          lessonTitle={title||'Không tên'}
          onSaveHistory={saveHistory}
          onBack={()=>setTab('build')}
          timeLimit={timerLimit}/>
      )}

      {/* Chat Mini */}
      <ChatMini
        open={chatOpen}
        onToggle={()=>setChatOpen(p=>!p)}
        msgs={chatMsgs}
        input={chatInput}
        setInput={setChatInput}
        onSend={sendChat}
        onClear={()=>setChatMsgs([])}
        loading={chatLoading}
        dark={dark}/>

      {/* Confirm Dialog — cần render cả trong editing view */}
      <ConfirmDialog open={confirmState} onClose={()=>setConfirmState(null)} dark={dark}/>

    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
})();
