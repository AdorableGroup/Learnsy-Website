import React, { useState, useEffect, useRef, useCallback } from 'react'

/* ══ APP.JS ══  Updated to use Dashboard */
;(function(){
const {useState,useEffect,useRef,useCallback,useMemo}=React;
const Dashboard=window.Dashboard;
const QuizPlayer=window.QuizPlayer;
const PwGate=window.PwGate;
const HistDetailModal=window.HistDetailModal;
const ListeningPractice=window.ListeningPractice;

function App(){
  const [dark,setDark]=useState(()=>{
    if(window.__darkInit!==undefined)return window.__darkInit;
    try{
      var stored=localStorage.getItem('learnsy_dark');
      if(stored==='1')return true;
      if(stored==='0')return false;
    }catch(e){}
    return window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches;
  });
  const [screen,setScreen]=useState('dashboard');// 'dashboard'|'pw'|'playing'
  const [homeTab,setHomeTab]=useState('lessons');// 'lessons'|'listening' — tab giống bên admin
  const [lessons,setLessons]=useState([]);
  const [loading,setLoading]=useState(true);
  const [fetchError,setFetchError]=useState(false);
  const [currentLesson,setCurrentLesson]=useState(null);
  const [pendingLesson,setPendingLesson]=useState(null);
  const [history,setHistory]=useState(()=>{try{return JSON.parse(localStorage.getItem('ls_student_hist')||'[]');}catch{return[];}});
  const [histDetail,setHistDetail]=useState(null);
  const [shuffleQ,setShuffleQ]=useState(false);
  const [shuffleA,setShuffleA]=useState(false);

  // ── Student Auth ──
  const [student,setStudent]=useState(()=>{
    try{const s=sessionStorage.getItem('ls_student');return s?JSON.parse(s):null;}catch{return null;}
  });
  const [authChecked,setAuthChecked]=useState(false);

  const doStudentLogin=useCallback(async(username,password)=>{
    try{
      const {data,error}=await supa.functions.invoke('student-login',{body:{username,password}});
      if(error){console.error('[doStudentLogin] Edge Function error:',error);return{ok:false,msg:'Lỗi kết nối, thử lại nhé!'};}
      if(!data.ok)return{ok:false,msg:data.msg||'Đăng nhập thất bại!'};
      const info=data.student;
      try{sessionStorage.setItem('ls_student',JSON.stringify(info));}catch{}
      setStudent(info);
      return{ok:true};
    }catch(e){console.error('[doStudentLogin]',e);return{ok:false,msg:'Lỗi kết nối, thử lại nhé!'};}
  },[]);

  const doStudentLogout=useCallback(()=>{
    try{sessionStorage.removeItem('ls_student');}catch{}
    setStudent(null);
    setHistory([]);
    try{localStorage.removeItem('ls_student_hist');}catch{}
  },[]);

  useEffect(()=>setAuthChecked(true),[]);

  // ── Sync background settings ngay khi login/logout ──
  useEffect(()=>{
    if(typeof window.__setBgSyncId==='function'){
      window.__setBgSyncId(student?.id||null);
    }
  },[student?.id]);

  // ── Load history từ Supabase khi login ──
  useEffect(()=>{
    if(!student?.id) return;
    const cacheKey='ls_student_hist_'+student.id;
    // Hiện cache localStorage ngay lập tức
    try{
      const cached=JSON.parse(localStorage.getItem(cacheKey)||'[]');
      if(cached.length) setHistory(cached);
    }catch{}
    // Sau đó fetch từ Supabase (source of truth)
    if(typeof window.loadQuizHistory==='function'){
      window.loadQuizHistory(student.id).then(rows=>{
        if(!rows.length) return;
        setHistory(rows);
        try{localStorage.setItem(cacheKey,JSON.stringify(rows));}catch{}
      });
    }
  },[student?.id]);

  C=dark?CD:CL;
  useEffect(()=>{
    document.body.classList.toggle('dark',dark);
    document.documentElement.classList.toggle('dark',dark);
    // Persist để pre-init script đọc đúng lần sau
    try{localStorage.setItem('learnsy_dark',dark?'1':'0');}catch(e){}
    // Đồng bộ lại background sau khi dark class thay đổi từ React
    if(typeof window.applyBackground==='function'&&typeof window.loadBgSettings==='function'){
      window.applyBackground(window.loadBgSettings(),dark);
    }
  },[dark]);

  // ── Fetch lessons: KV → Upstash → Supabase ──
  useEffect(()=>{
    (async()=>{
      try{
        const kvRes=await fetch('/api/lessons');
        if(kvRes.status===200){
          const data=await kvRes.json();
          if(data?.length){
            setLessons(data.map(r=>({id:r.id,title:r.title||'',subject:r.subject||'Tiếng Anh',password:r.password||'',timerLimit:r.timerLimit||0,questions:r.questions||[],questionCount:(r.questions||[]).length})));
            setLoading(false);return;
          }
        }
      }catch(e){}
      try{
        const cached=await upstashCmd('GET',CACHE_KEY);
        if(cached){
          const data=JSON.parse(cached);
          if(data?.length){
            setLessons(data.map(r=>({id:r.id,title:r.title||'',subject:r.subject||'Tiếng Anh',password:r.password||'',timerLimit:r.timerLimit||0,questions:r.questions||[],questionCount:(r.questions||[]).length})));
            setLoading(false);return;
          }
        }
      }catch(e){}
      supa.from('lessons').select('*').order('created_at').then(async({data,error})=>{
        if(error||!data?.length){setFetchError(true);}
        else{
          setLessons(data.map(r=>({id:r.id,title:r.title||'',subject:r.subject||'Tiếng Anh',password:r.password||'',timerLimit:r.timerLimit||0,questions:r.questions||[],questionCount:(r.questions||[]).length})));
          const json=JSON.stringify(data);
          fetch('/api/lessons',{method:'POST',headers:{'Content-Type':'application/json'},body:json}).catch(()=>{});
          upstashCmd('SET',CACHE_KEY,json,'EX',CACHE_TTL);
        }
        setLoading(false);
      });
    })();
  },[]);

  const playLesson=async(lessonMeta)=>{
    if(lessonMeta.password){setPendingLesson(lessonMeta);setScreen('pw');return;}
    await loadAndPlay(lessonMeta);
  };

  const loadAndPlay=async(lessonMeta)=>{
    try{
      const prepared={...applyShuffleToLesson(lessonMeta,shuffleQ,shuffleA),timeLimit:lessonMeta.timerLimit||lessonMeta.timeLimit||0};
      setCurrentLesson(prepared);
      setScreen('playing');
      trackEvent({event:'lesson_start',lessonId:lessonMeta.id,subject:lessonMeta.subject});
    }catch(e){alert('Không thể tải bài này. Vui lòng thử lại!');}
  };

  const onUnlockPw=async()=>{
    setPendingLesson(null);setScreen('dashboard');
    if(pendingLesson)await loadAndPlay(pendingLesson);
  };

  const _lastSaveRef=useRef(null);
  const saveHistory=(rec)=>{
    const entry={...rec,ts:Date.now()}; // ts luôn là number để so sánh chính xác
    // Chặn duplicate: nếu cùng bài + điểm được gọi trong vòng 5 giây thì bỏ qua
    const last=_lastSaveRef.current;
    if(last&&last.lessonTitle===entry.lessonTitle&&last.score===entry.score&&last.total===entry.total&&(entry.ts-last.ts)<5000){
      return;
    }
    _lastSaveRef.current=entry;
    trackEvent({event:'quiz_complete',lessonId:entry.lessonTitle,subject:entry.subject||'',score:entry.score,total:entry.total,pct:entry.pct});
    setHistory(prev=>{
      // Upsert: ghi đè entry cùng lessonTitle thay vì push thêm
      const idx=prev.findIndex(h=>h.lessonTitle===entry.lessonTitle);
      let updated;
      if(idx>=0){
        updated=prev.slice();
        updated[idx]=entry;
        // Đưa lên đầu (mới nhất)
        updated.splice(idx,1);
        updated.unshift(entry);
      }else{
        updated=[entry,...prev];
      }
      updated=updated.slice(0,50);
      const cacheKey=student?.id ? 'ls_student_hist_'+student.id : 'ls_student_hist';
      try{localStorage.setItem(cacheKey,JSON.stringify(updated));}catch{}
      return updated;
    });
  };

  const clearHistory=()=>{
    setHistory([]);
    const cacheKey=student?.id ? 'ls_student_hist_'+student.id : 'ls_student_hist';
    try{localStorage.removeItem(cacheKey);}catch{}
    try{localStorage.removeItem('ls_student_hist');}catch{}
  };

  if(!authChecked)return null;
  if(!student)return <StudentLoginScreen dark={dark} onLogin={doStudentLogin}/>;

  return(
    <>
      {screen==='pw'&&pendingLesson&&(
        <PwGate lesson={pendingLesson} dark={dark}
          onUnlock={onUnlockPw}
          onCancel={()=>{setPendingLesson(null);setScreen('dashboard');}}/>
      )}
      {screen==='playing'&&currentLesson&&(
        <QuizPlayer lesson={currentLesson} dark={dark} setDark={setDark}
          student={student}
          onBack={()=>setScreen('dashboard')}
          onSaveHistory={saveHistory}/>
      )}
      {screen==='dashboard'&&(
        <>
          {/* ── Tab Bar (giống bên admin) ── */}
          <div style={{display:'flex',gap:6,padding:'10px 14px 0',borderBottom:`1.5px solid ${C.border}`,background:dark?'rgba(30,13,21,0.97)':'rgba(255,255,255,0.95)',position:'sticky',top:0,zIndex:55}}>
            {[['lessons',<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,'Bài học'],['listening',<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/></svg>,'Listening']].map(([k,icon,l])=>(
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
          <div style={{display:homeTab==='lessons'?'block':'none'}}>
            <Dashboard
              student={student}
              lessons={lessons}
              loading={loading}
              fetchError={fetchError}
              history={history}
              dark={dark}
              setDark={setDark}
              onPlay={playLesson}
              onClearHistory={clearHistory}
              onHistDetail={setHistDetail}
              shuffleQ={shuffleQ} setShuffleQ={setShuffleQ}
              shuffleA={shuffleA} setShuffleA={setShuffleA}
              onLogout={doStudentLogout}
            />
          </div>
          {homeTab==='listening'&&ListeningPractice&&<ListeningPractice dark={dark}/>}
        </>
      )}
      {histDetail&&<HistDetailModal h={histDetail} dark={dark} onClose={()=>setHistDetail(null)}/>}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
})();
console.log('[app] v3 dashboard ✅ loaded!');
