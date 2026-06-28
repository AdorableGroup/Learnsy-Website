/* ══ QUIZ-PLAYER.JSX ══ */
import React, { useState, useEffect, useRef, useMemo } from 'react';
(function(){

/* ────────────────────────────────────────────────
   FIX 🔴 Global variable safety
   Resolve all globals ONCE at load-time so the
   component never crashes if a dependency file
   hasn't loaded yet.
──────────────────────────────────────────────── */
const _useRipple = typeof useRipple  !== 'undefined' ? useRipple  : () => () => {};
const _useSwipe  = typeof useSwipe   !== 'undefined' ? useSwipe   : () => ({});
const _LETTERS   = typeof LETTERS    !== 'undefined' ? LETTERS    : ['A','B','C','D','E','F'];
const _Heart     = typeof Heart      !== 'undefined' ? Heart
                 : ({s,c}) => React.createElement('span',{style:{color:c,fontSize:s}},'♥');
const _call = fn => (...a) => { try { if (typeof fn === 'function') fn(...a); } catch {} };

/* ────────────────────────────────────────────────
   🔊 BUILT-IN AUDIO ENGINE (Web Audio API)
   Chạy độc lập — không cần CDN hay file ngoài.
   Fallback sang globals nếu có (playSound, v.v.)
   Tất cả hàm _sfx* đều an toàn (try/catch).
──────────────────────────────────────────────── */
const _AC = (() => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    let ctx = null;
    // lazy-create on first user gesture
    const get = () => {
      if (!ctx) ctx = new Ctx();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    };
    return { get };
  } catch { return null; }
})();

/* Master volume knob — tweak here to taste */
const _VOL = 0.22;

/* ────────────────────────────────────────────────
   🔇 MUTE — cờ ở module scope vì các hàm _sfx* sống
   ngoài component, không thể dùng useState trực tiếp.
   Đồng bộ với localStorage để giữ lựa chọn của HS.
──────────────────────────────────────────────── */
let _muted = false;
try { _muted = localStorage.getItem('qp_muted') === '1'; } catch {}
const _setMutedFlag = (v) => { _muted = !!v; try { localStorage.setItem('qp_muted', _muted ? '1' : '0'); } catch {} };

/* Low-level: play a series of {freq, dur, type, vol, delay} notes */
const _sfxPlay = (notes, masterVol) => {
  if (!_AC || _muted) return;
  try {
    const ctx = _AC.get();
    const mv = masterVol !== undefined ? masterVol : _VOL;
    notes.forEach(({ f, d, t, v, delay, ramp }) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      osc.connect(gain); gain.connect(comp); comp.connect(ctx.destination);
      osc.type = t || 'sine';
      osc.frequency.value = f;
      const start = ctx.currentTime + (delay || 0);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime((v !== undefined ? v : 1) * mv, start + 0.008);
      if (ramp === 'slide') {
        osc.frequency.setValueAtTime(f, start);
        osc.frequency.linearRampToValueAtTime(f * 1.08, start + d);
      }
      gain.gain.exponentialRampToValueAtTime(0.0001, start + d);
      osc.start(start);
      osc.stop(start + d + 0.01);
    });
  } catch {}
};

/* ── Âm thanh chọn đáp án (neutral click) ── */
const _sfxClick = () => _sfxPlay([
  { f: 880, d: 0.07, t: 'triangle', v: 0.7 },
  { f: 1100, d: 0.05, t: 'sine', v: 0.4, delay: 0.04 },
]);

/* ── Đúng! — bright ascending chime ── */
const _sfxCorrect = () => _sfxPlay([
  { f: 523, d: 0.10, t: 'triangle', v: 0.8 },
  { f: 659, d: 0.10, t: 'triangle', v: 0.8, delay: 0.09 },
  { f: 784, d: 0.14, t: 'triangle', v: 0.9, delay: 0.18 },
  { f: 1047,d: 0.18, t: 'sine',     v: 0.6, delay: 0.28 },
], 0.28);

/* ── Sai! — dull descending thud ── */
const _sfxWrong = () => _sfxPlay([
  { f: 300, d: 0.10, t: 'sawtooth', v: 0.5 },
  { f: 220, d: 0.18, t: 'sawtooth', v: 0.6, delay: 0.08 },
  { f: 160, d: 0.25, t: 'triangle', v: 0.4, delay: 0.18 },
], 0.24);

/* ── Streak! (>=3) — sparkle arpeggio ── */
const _sfxStreak = (n) => {
  // higher streak = faster + higher pitch
  const base = 523 + Math.min(n - 3, 5) * 40;
  const spd  = Math.max(0.045, 0.08 - (n - 3) * 0.005);
  _sfxPlay([
    { f: base,       d: 0.09, t: 'triangle', v: 0.7 },
    { f: base * 1.25,d: 0.09, t: 'triangle', v: 0.7, delay: spd },
    { f: base * 1.5, d: 0.09, t: 'triangle', v: 0.8, delay: spd * 2 },
    { f: base * 2,   d: 0.14, t: 'sine',     v: 0.6, delay: spd * 3 },
  ], 0.26);
};

/* ── Fanfare — victory jingle (8 notes) ── */
const _sfxFanfare = () => _sfxPlay([
  { f: 523, d: 0.12, t: 'triangle', v: 0.9 },
  { f: 659, d: 0.12, t: 'triangle', v: 0.9, delay: 0.11 },
  { f: 784, d: 0.12, t: 'triangle', v: 0.9, delay: 0.22 },
  { f: 1047,d: 0.18, t: 'sine',     v: 1.0, delay: 0.33 },
  { f: 784, d: 0.09, t: 'triangle', v: 0.7, delay: 0.52 },
  { f: 1047,d: 0.09, t: 'sine',     v: 0.8, delay: 0.62 },
  { f: 1319,d: 0.26, t: 'sine',     v: 1.0, delay: 0.72, ramp: 'slide' },
  // harmony
  { f: 659, d: 0.26, t: 'triangle', v: 0.4, delay: 0.72 },
], 0.30);

/* ── Sad — drooping wah ── */
const _sfxSad = () => _sfxPlay([
  { f: 440, d: 0.14, t: 'sawtooth', v: 0.6 },
  { f: 370, d: 0.18, t: 'sawtooth', v: 0.7, delay: 0.12 },
  { f: 294, d: 0.24, t: 'triangle', v: 0.5, delay: 0.26 },
  { f: 220, d: 0.30, t: 'triangle', v: 0.4, delay: 0.44 },
], 0.26);

/* ── Timer tick (last 10s) ── */
const _sfxTick = () => _sfxPlay([
  { f: 1200, d: 0.04, t: 'square', v: 0.35 },
], 0.18);

/* ── Timer urgent (last 5s) ── */
const _sfxTickUrgent = () => _sfxPlay([
  { f: 1400, d: 0.05, t: 'square', v: 0.5 },
  { f: 1600, d: 0.04, t: 'square', v: 0.4, delay: 0.06 },
], 0.22);

/* ── Navigation swipe ── */
const _sfxNav = () => _sfxPlay([
  { f: 660, d: 0.06, t: 'sine', v: 0.5 },
], 0.15);

/* ── Submit (nộp bài) ── */
const _sfxSubmit = () => _sfxPlay([
  { f: 440, d: 0.08, t: 'triangle', v: 0.6 },
  { f: 550, d: 0.10, t: 'triangle', v: 0.7, delay: 0.07 },
  { f: 660, d: 0.12, t: 'sine',     v: 0.8, delay: 0.15 },
], 0.24);

/* ────────────────────────────────────────────────
   🎵 BGM — Nhạc nền lo-fi học bài (loop, volume nhỏ)
   Nếu có file nhạc thật, điền URL vào _BGM_URL (mp3/ogg
   trên CDN hoặc cùng thư mục). Để rỗng '' → tự động
   dùng pad nhạc nền tổng hợp bằng Web Audio (êm, không
   cần file ngoài, nhưng chất lượng không bằng nhạc thật).
──────────────────────────────────────────────── */
const _BGM_URL = '';
const _BGM_VOL = 0.05;
const _startBgmSynth = () => {
  if (!_AC) return null;
  try {
    const ctx = _AC.get();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    master.gain.linearRampToValueAtTime(_BGM_VOL, ctx.currentTime + 1.5);

    // Tiếng mưa chill: white-noise loop qua bandpass + lowpass,
    // không dùng oscillator nên không bị rít/hú do cộng hưởng tần số.
    const bufSize = ctx.sampleRate * 2; // loop 2s
    const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1200;
    bandpass.Q.value = 0.6;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3500;

    // LFO rất chậm làm "mưa" lúc to lúc nhỏ tự nhiên, không tạo cao độ rõ
    const lfo = ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.15;
    const noiseGain = ctx.createGain(); noiseGain.gain.value = 0.85;
    lfo.connect(lfoGain); lfoGain.connect(noiseGain.gain);

    noise.connect(bandpass);
    bandpass.connect(lowpass);
    lowpass.connect(noiseGain);
    noiseGain.connect(master);

    noise.start(); lfo.start();

    return {
      stop: () => {
        try {
          master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.7);
          setTimeout(() => { try { noise.stop(); lfo.stop(); } catch {} }, 750);
        } catch {}
      },
    };
  } catch { return null; }
};

/* ────────────────────────────────────────────────
   Wrapper: ưu tiên globals nếu đã có, fallback
   sang engine nội bộ.
──────────────────────────────────────────────── */
const _playSound   = () => { if (typeof playSound   === 'function') { try { playSound();   } catch {} } else _sfxClick(); };
const _haptic      = _call(typeof haptic      !== 'undefined' ? haptic      : null);
const _playFanfare = () => { if (typeof playFanfare === 'function') { try { playFanfare(); } catch {} } else _sfxFanfare(); };
const _playSad     = () => { if (typeof playSad     === 'function') { try { playSad();     } catch {} } else _sfxSad(); };

/* ────────────────────────────────────────────────
   PERF 🟢 Canvas confetti engine
   Thay 28 <div> React + setTimeout bằng 1 <canvas>
   chạy requestAnimationFrame. Không tốn React
   reconciliation/layout cho từng mảnh — chỉ 1 lần
   vẽ canvas mỗi frame, rẻ hơn nhiều trên máy yếu.
   Tự huỷ canvas + cancelAnimationFrame khi xong.
──────────────────────────────────────────────── */
const _confettiColors=['#F472B6','#A855F7','#6EE7B7','#FCD34D','#FB923C','#60A5FA'];
const _runConfetti=(canvas)=>{
  if(!canvas)return ()=>{};
  const ctx=canvas.getContext('2d');
  if(!ctx)return ()=>{};
  const dpr=Math.min(window.devicePixelRatio||1,2); // cap DPR — tránh canvas khổng lồ trên máy Retina/yếu
  let w=0,h=0;
  const resize=()=>{
    w=window.innerWidth;h=window.innerHeight;
    canvas.width=w*dpr;canvas.height=h*dpr;
    canvas.style.width=w+'px';canvas.style.height=h+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  };
  resize();
  window.addEventListener('resize',resize);

  const N=28;
  const pieces=Array.from({length:N},(_,i)=>({
    x:Math.random()*w,
    y:-20-Math.random()*h*0.3,
    vy:2.2+Math.random()*2.2,
    vx:(Math.random()-0.5)*1.4,
    size:5+Math.random()*7,
    rot:Math.random()*360,
    vr:(Math.random()-0.5)*10,
    color:_confettiColors[i%_confettiColors.length],
    shape:Math.random()>0.5?'circle':'square',
    delay:Math.random()*0.6*60, // frames de delay (≈0.6s @60fps)
    life:0,
  }));

  const DURATION=2200; // ms — khớp với thời lượng cũ
  const start=performance.now();
  let rafId=null;

  const frame=(now)=>{
    const elapsed=now-start;
    if(elapsed>=DURATION){ctx.clearRect(0,0,w,h);return;}
    ctx.clearRect(0,0,w,h);
    pieces.forEach(p=>{
      p.life++;
      if(p.life<p.delay)return;
      p.x+=p.vx;p.y+=p.vy;p.rot+=p.vr;
      p.vy+=0.025; // gravity nhẹ
      const fadeStart=DURATION*0.7;
      const alpha=elapsed>fadeStart?Math.max(0,1-(elapsed-fadeStart)/(DURATION-fadeStart)):1;
      ctx.save();
      ctx.globalAlpha=alpha;
      ctx.translate(p.x,p.y);
      ctx.rotate(p.rot*Math.PI/180);
      ctx.fillStyle=p.color;
      if(p.shape==='circle'){
        ctx.beginPath();ctx.arc(0,0,p.size/2,0,Math.PI*2);ctx.fill();
      }else{
        ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size);
      }
      ctx.restore();
    });
    rafId=requestAnimationFrame(frame);
  };
  rafId=requestAnimationFrame(frame);

  return ()=>{
    if(rafId)cancelAnimationFrame(rafId);
    window.removeEventListener('resize',resize);
    try{ctx.clearRect(0,0,w,h);}catch{}
  };
};

/* ────────────────────────────────────────────────
   FIX 🔴 Duplicated score logic → single pure fn
   FIX 🔴 Null safety: (q.answer||'') everywhere
   Lives outside the component → never re-created.
──────────────────────────────────────────────── */
const computeScore = (questions, answers) => {
  let s = 0, t = 0;
  questions.forEach((q, qi) => {
    if (q.type === 'true_false') {
      t += q.items.length * 0.25;
      s += q.items.filter((it, ii) => answers[qi]?.[ii] === it.answer).length * 0.25;
    } else if (q.type === 'multiple') {
      t += 1; if (answers[qi] === q.correct) s += 1;
    } else if (q.type === 'multi_select') {
      t += 1;
      const a = answers[qi] || [];
      if (JSON.stringify([...a].sort()) === JSON.stringify([...(q.correct||[])].sort())) s += 1;
    } else if (q.type === 'fill_blank') {
      t += 1;
      if ((answers[qi]||'').trim().toLowerCase() === (q.answer||'').trim().toLowerCase()) s += 1;
    }
  });
  return { s, t };
};

/* Helper: check one question answer for correctness (null-safe) */
const isAnswerCorrect = (q, ans) => {
  if (q.type === 'multiple')    return ans === q.correct;
  if (q.type === 'multi_select') return JSON.stringify([...(ans||[])].sort()) === JSON.stringify([...(q.correct||[])].sort());
  if (q.type === 'fill_blank')  return (ans||'').trim().toLowerCase() === (q.answer||'').trim().toLowerCase();
  if (q.type === 'true_false')  return q.items.every((it, ii) => ans?.[ii] === it.answer);
  return false;
};

/* ── Score display: 10 thay vì 10.0 ── */
const fmtS=v=>v%1===0?String(v|0):v.toFixed(1);

/* ────────────────────────────────────────────────
   PERF 🟢 TimerBadge — React.memo
   Tách riêng để không phải tạo lại style object của
   TOÀN BỘ cây JSX cha mỗi khi timeLeft đổi (mỗi giây).
   timeLeft vẫn là nguồn sự thật duy nhất từ cha (để
   khớp chính xác với logic hết-giờ/doSubmit) — memo
   chỉ ngăn các phần KHÁC của cây bị re-render lây.
──────────────────────────────────────────────── */
const fmtTime=s=>{const m=Math.floor(s/60),sec=s%60;return m+':'+String(sec).padStart(2,'0');};
const TimerBadge=React.memo(function TimerBadge({timeLeft,dark}){
  if(timeLeft===null)return null;
  const timerColor=timeLeft<60?'#EF4444':timeLeft<120?'#F59E0B':'#10B981';
  return(
    <div style={{display:'flex',alignItems:'center',gap:5,padding:'4px 12px',borderRadius:999,
      background:dark?'rgba(0,0,0,0.2)':'rgba(255,255,255,0.6)',border:`1.5px solid ${timerColor}44`,boxShadow:`0 0 0 3px ${timerColor}14`,transition:'all .5s'}}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={timerColor} strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      <span style={{fontSize:11,fontWeight:900,color:timerColor,letterSpacing:.3}}>{fmtTime(timeLeft)}</span>
    </div>
  );
});

/* ────────────────────────────────────────────────
   PERF 🟢 NavDots — component riêng + React.memo
   Tránh việc cả mảng "dots" (1 button/câu hỏi) bị
   tạo lại style object mỗi khi QuizPlayer cha
   re-render vì lý do không liên quan (gõ phím, đổi
   timeLeft...). Chỉ re-render khi props thật sự đổi.
──────────────────────────────────────────────── */
const NavDots=React.memo(function NavDots({questions,answers,cur,submitted,onJump,flags}){
  return(
    <div data-dots="1" style={{flex:1,overflowX:'auto',display:'flex',gap:5,alignItems:'center',scrollbarWidth:'none',WebkitOverflowScrolling:'touch',padding:'4px 2px'}}
      onTouchStart={e=>e.stopPropagation()}
      onTouchMove={e=>e.stopPropagation()}
      onTouchEnd={e=>e.stopPropagation()}>
      {questions.map((q2,i)=>{
        let dotColor='rgba(255,150,200,0.28)';
        if(submitted){
          dotColor=isAnswerCorrect(q2,answers[i])?'#10B981':'#EF4444';
        }
        const isActive=i===cur;
        const bg=isActive?(submitted?dotColor:'linear-gradient(135deg,#E879AD,#9B59F5)'):submitted?dotColor:'rgba(255,150,200,0.15)';
        const txtColor=isActive?'#fff':submitted?'#fff':'rgba(255,107,149,0.5)';
        return(
          <button key={i} onClick={()=>onJump(i)} style={{
            position:'relative',
            flexShrink:0,width:24,height:24,borderRadius:999,
            border:isActive?'none':`1.5px solid ${submitted?dotColor:'rgba(255,150,200,0.22)'}`,
            padding:0,cursor:'pointer',background:bg,color:txtColor,
            fontSize:9,fontWeight:900,fontFamily:'Nunito,sans-serif',
            display:'flex',alignItems:'center',justifyContent:'center',
            boxShadow:isActive?`0 3px 12px ${submitted?dotColor+'99':'rgba(155,89,245,0.38)'}`:'none',
            transform:isActive?'scale(1.18)':'scale(1)',
            transition:'all .22s cubic-bezier(.4,0,.2,1)',lineHeight:1,
          }}>
            {i+1}
            {flags?.[i]&&<span style={{position:'absolute',top:-3,right:-3,width:7,height:7,borderRadius:'50%',background:'#FCD34D',boxShadow:'0 0 0 1.5px rgba(0,0,0,0.25)'}}/>}
          </button>
        );
      })}
    </div>
  );
});

/* ════════════════════════════════════════════════
   SCORE DYNAMIC ISLAND TOAST
   Mở từ giữa ra 2 bên  (di-open)
   Đóng từ 2 bên vào giữa (di-close)
   Compact pill → expand card → compact pill
════════════════════════════════════════════════ */
const _injectDIStyles=()=>{
  const id='qp-di-styles';
  if(document.getElementById(id))return;
  const s=document.createElement('style');
  s.id=id;
  s.textContent=`
    /* ── Dynamic Island open: grow from center-pill out ── */
    @keyframes diOpen{
      0%  {clip-path:inset(0 50% 0 50% round 999px);opacity:0;transform:scaleY(0.5);}
      40% {clip-path:inset(0 0% 0 0% round 26px);opacity:1;transform:scaleY(1.04);}
      60% {transform:scaleY(0.98);}
      100%{clip-path:inset(0 0% 0 0% round 26px);opacity:1;transform:scaleY(1);}
    }
    /* ── Dynamic Island close: shrink to center-pill ── */
    @keyframes diClose{
      0%  {clip-path:inset(0 0% 0 0% round 26px);opacity:1;transform:scaleY(1);}
      50% {clip-path:inset(0 0% 0 0% round 26px);opacity:1;transform:scaleY(1.03);}
      100%{clip-path:inset(0 50% 0 50% round 999px);opacity:0;transform:scaleY(0.5);}
    }
    /* ── Nội dung fade-in sau khi island đã mở xong ── */
    @keyframes diContentIn{
      from{opacity:0;transform:translateY(6px);}
      to  {opacity:1;transform:translateY(0);}
    }
    /* ── Progress bar fill ── */
    @keyframes diBarFill{
      from{width:0%;}
    }
    /* ── Score number count-up pop ── */
    @keyframes diScorePop{
      0%  {transform:scale(0.5);opacity:0;}
      70% {transform:scale(1.18);}
      100%{transform:scale(1);opacity:1;}
    }
    /* ── Icon spin ── */
    @keyframes diIconSpin{
      0%  {transform:rotate(-30deg) scale(0);}
      60% {transform:rotate(20deg) scale(1.15);}
      100%{transform:rotate(0deg) scale(1);}
    }
    /* ── Dot bounce ── */
    @keyframes diDotBounce{
      0%,100%{transform:scale(1);}
      50%{transform:scale(1.5);}
    }
    .di-island{
      position:fixed;
      top:18px;
      left:50%;
      transform:translateX(-50%);
      z-index:10500;
      width:min(92vw,380px);
      transform-origin:center top;
    }
    .di-island.di-entering{
      animation:diOpen .52s cubic-bezier(.32,1.28,.42,1) both;
    }
    .di-island.di-exiting{
      animation:diClose .38s cubic-bezier(.55,0,.68,.88) both;
    }
    .di-content{
      animation:diContentIn .28s ease both;
      animation-delay:.3s;
      opacity:0;
    }
    .di-score-num{
      animation:diScorePop .4s cubic-bezier(.34,1.56,.64,1) both;
      animation-delay:.45s;
    }
    .di-icon{
      animation:diIconSpin .45s cubic-bezier(.34,1.56,.64,1) both;
      animation-delay:.35s;
    }
    .di-bar-fill{
      animation:diBarFill .7s cubic-bezier(.4,0,.2,1) both;
      animation-delay:.55s;
    }
  `;
  document.head.appendChild(s);
};

/* ScoreIsland component */
const ScoreIsland=React.memo(function ScoreIsland({
  visible,onClose,onReset,pct,s,t,rc,dark,questions,answers,bestStreak
}){
  const [phase,setPhase]=useState('hidden'); // hidden | entering | visible | exiting
  const [expanded,setExpanded]=useState(false);
  const phaseRef=useRef('hidden');

  useEffect(()=>{_injectDIStyles();},[]);

  useEffect(()=>{
    if(visible&&phaseRef.current==='hidden'){
      phaseRef.current='entering';
      setPhase('entering');
      setExpanded(false);
      // Sau 520ms animation xong → chuyển sang visible + expand
      const t1=setTimeout(()=>{
        phaseRef.current='visible';
        setPhase('visible');
        setExpanded(true);
      },520);
      return()=>clearTimeout(t1);
    }
    if(!visible&&phaseRef.current!=='hidden'&&phaseRef.current!=='exiting'){
      phaseRef.current='exiting';
      setPhase('exiting');
      setExpanded(false);
      const t2=setTimeout(()=>{
        phaseRef.current='hidden';
        setPhase('hidden');
      },380);
      return()=>clearTimeout(t2);
    }
  },[visible]);

  if(phase==='hidden')return null;

  const label=pct>=0.8?'Xuất sắc! 🎉':pct>=0.5?'Khá tốt! ✨':'Cần ôn thêm 📖';
  const correct=questions.filter((q2,qi)=>isAnswerCorrect(q2,answers[qi]));
  const wrong=questions.filter((q2,qi)=>!isAnswerCorrect(q2,answers[qi]));
  const wrongWithExp=wrong.filter(q2=>q2.explanation);

  const islandBg=dark
    ?'linear-gradient(145deg,#1A0A35 0%,#0D0220 60%,#0A1830 100%)'
    :'linear-gradient(145deg,#FFF0FA 0%,#F3E8FF 55%,#EEF2FF 100%)';
  const borderColor=dark?'rgba(255,150,200,0.22)':'rgba(200,140,255,0.45)';

  return(
    <div
      className={`di-island ${phase==='entering'?'di-entering':phase==='exiting'?'di-exiting':''}`}
      style={{left:'50%',transform:'translateX(-50%)'}}
    >
      {/* ── Backdrop blur overlay (chỉ hiện khi expanded) ── */}
      {expanded&&(
        <div
          onClick={onClose}
          style={{
            position:'fixed',inset:0,
            background:'rgba(8,1,22,0.6)',
            backdropFilter:'blur(12px)',
            WebkitBackdropFilter:'blur(12px)',
            zIndex:-1,
          }}
        />
      )}

      {/* ── Island card ── */}
      <div
        style={{
          background:islandBg,
          border:`1.5px solid ${borderColor}`,
          borderRadius:26,
          boxShadow:dark
            ?'0 12px 50px rgba(0,0,0,0.7),0 0 0 1px rgba(255,150,200,0.08)'
            :'0 12px 50px rgba(140,60,220,0.22),0 0 0 1px rgba(200,140,255,0.15)',
          overflow:'hidden',
          transition:'all .32s cubic-bezier(.4,0,.2,1)',
        }}
      >
        {/* ── Compact header (luôn hiển thị) ── */}
        <div
          style={{
            display:'flex',alignItems:'center',gap:10,
            padding:'11px 14px',
            cursor:'pointer',
          }}
          onClick={()=>setExpanded(e=>!e)}
        >
          {/* Icon */}
          <div className="di-icon" style={{
            width:34,height:34,borderRadius:12,flexShrink:0,
            background:pct>=0.8?'rgba(16,185,129,0.15)':pct>=0.5?'rgba(245,158,11,0.15)':'rgba(239,68,68,0.13)',
            border:`1.5px solid ${rc}44`,
            display:'flex',alignItems:'center',justifyContent:'center',
          }}>
            {pct>=0.8?(
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={rc} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ):pct>=0.5?(
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={rc} strokeWidth="2.2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            ):(
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={rc} strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="17" r="1" fill={rc}/>
                <circle cx="12" cy="12" r="10"/>
              </svg>
            )}
          </div>

          {/* Compact score + label */}
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'baseline',gap:4}}>
              <span className="di-score-num" style={{
                fontSize:22,fontWeight:900,color:rc,lineHeight:1,letterSpacing:-0.5,
              }}>{fmtS(pct*10)}</span>
              <span style={{fontSize:12,color:dark?'rgba(255,255,255,0.28)':'rgba(0,0,0,0.22)',fontWeight:700}}>/10</span>
              <span style={{
                fontSize:11,fontWeight:800,
                color:pct>=0.8?'#10B981':pct>=0.5?'#C89700':'#EF4444',
                background:pct>=0.8?'rgba(16,185,129,0.12)':pct>=0.5?'rgba(252,211,77,0.14)':'rgba(239,68,68,0.1)',
                padding:'1px 7px',borderRadius:999,marginLeft:2,
                flexShrink:0,
              }}>{label}</span>
            </div>
            {/* Mini progress bar */}
            <div style={{
              height:4,background:dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.07)',
              borderRadius:99,marginTop:5,overflow:'hidden',
            }}>
              <div className="di-bar-fill" style={{
                height:'100%',borderRadius:99,
                width:`${pct*100}%`,
                background:pct>=0.8
                  ?'linear-gradient(90deg,#10B981,#6EE7B7)'
                  :pct>=0.5
                    ?'linear-gradient(90deg,#F59E0B,#FCD34D)'
                    :'linear-gradient(90deg,#EF4444,#FCA5A5)',
              }}/>
            </div>
          </div>

          {/* Dots: đúng/sai + chevron */}
          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:3,flexShrink:0}}>
            <div style={{display:'flex',gap:3}}>
              {/* Đúng */}
              <span style={{
                fontSize:10,fontWeight:800,color:'#10B981',
                background:'rgba(16,185,129,0.12)',
                padding:'2px 7px',borderRadius:999,
              }}>{correct.length}✓</span>
              {/* Sai */}
              <span style={{
                fontSize:10,fontWeight:800,color:'#EF4444',
                background:'rgba(239,68,68,0.1)',
                padding:'2px 7px',borderRadius:999,
              }}>{wrong.length}✗</span>
            </div>
            {/* Chevron */}
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke={dark?'rgba(255,255,255,0.28)':'rgba(0,0,0,0.22)'}
              strokeWidth="2.2" strokeLinecap="round"
              style={{
                transition:'transform .28s ease',
                transform:expanded?'rotate(180deg)':'rotate(0deg)',
              }}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </div>

        {/* ── Expanded detail panel ── */}
        <div style={{
          overflow:'hidden',
          maxHeight:expanded?'70vh':'0px',
          transition:'max-height .38s cubic-bezier(.4,0,.2,1)',
        }}>
          <div className="di-content" style={{padding:'0 14px 16px'}}>
            {/* Divider */}
            <div style={{
              height:1,
              background:dark?'rgba(255,255,255,0.06)':'rgba(180,100,255,0.12)',
              marginBottom:13,
            }}/>

            {/* Stats row */}
            <div style={{display:'flex',gap:7,marginBottom:13}}>
              {[
                {l:'Câu đúng', v:`${s}/${t}`, c:'#10B981', bg:'rgba(16,185,129,0.1)'},
                {l:'Điểm',     v:`${fmtS(pct*10)}/10`, c:rc, bg:`${rc}18`},
                bestStreak>=3?{l:'Streak', v:`${bestStreak}🔥`, c:'#FCD34D', bg:'rgba(252,211,77,0.12)'}:null,
              ].filter(Boolean).map(({l,v,c,bg})=>(
                <div key={l} style={{
                  flex:1,borderRadius:14,padding:'8px 6px',textAlign:'center',
                  background:bg,border:`1px solid ${c}28`,
                }}>
                  <div style={{fontSize:8,fontWeight:800,color:dark?'rgba(255,255,255,0.38)':'rgba(0,0,0,0.35)',letterSpacing:.6,marginBottom:3}}>{l.toUpperCase()}</div>
                  <div style={{fontSize:14,fontWeight:900,color:c}}>{v}</div>
                </div>
              ))}
            </div>

            {/* Per-question list */}
            <div style={{
              background:dark?'rgba(255,255,255,0.033)':'rgba(176,124,240,0.06)',
              border:`1px solid ${dark?'rgba(196,181,253,0.1)':'rgba(176,124,240,0.14)'}`,
              borderRadius:16,padding:'9px 11px',
              marginBottom:12,maxHeight:160,overflowY:'auto',
            }}>
              {questions.map((q2,qi)=>{
                const ok2=isAnswerCorrect(q2,answers[qi]);
                return(
                  <div key={qi} style={{
                    borderBottom:qi<questions.length-1
                      ?`1px solid ${dark?'rgba(255,255,255,0.04)':'rgba(176,124,240,0.07)'}`
                      :'none',
                    padding:'4px 0',
                  }}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontSize:11,color:dark?'#9B7FC0':'#8060A0',fontWeight:600}}>Câu {qi+1}</span>
                      <span style={{
                        fontSize:10,fontWeight:800,color:ok2?'#10B981':'#EF4444',
                        background:ok2?'rgba(16,185,129,0.1)':'rgba(239,68,68,0.08)',
                        padding:'1px 7px',borderRadius:999,
                      }}>{ok2?'Đúng':'Sai'}</span>
                    </div>
                    {!ok2&&q2.explanation&&(
                      <div style={{
                        fontSize:10,color:dark?'rgba(196,181,253,0.65)':'rgba(130,80,180,0.85)',
                        marginTop:2,lineHeight:1.5,
                      }} dangerouslySetInnerHTML={{__html:'💡 '+q2.explanation}}/>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action buttons */}
            <div style={{display:'flex',gap:8}}>
              <button
                onClick={onReset}
                style={{
                  flex:1,padding:'10px 0',borderRadius:999,
                  border:`1.5px solid ${dark?'rgba(255,150,200,0.28)':'rgba(232,84,122,0.3)'}`,
                  background:'transparent',
                  color:dark?'#FBAFCE':'#E8547A',
                  fontSize:12,fontWeight:800,cursor:'pointer',
                  transition:'all .18s',fontFamily:'Nunito,sans-serif',
                }}
              >Làm lại</button>
              <button
                onClick={onClose}
                style={{
                  flex:1,padding:'10px 0',borderRadius:999,border:'none',
                  background:'linear-gradient(135deg,#F472B6,#A855F7)',
                  color:'#fff',fontSize:12,fontWeight:800,cursor:'pointer',
                  boxShadow:'0 4px 16px rgba(168,85,247,0.38)',
                  fontFamily:'Nunito,sans-serif',
                }}
              >Xem đáp án</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════ */
function QuizPlayer({lesson,onBack,dark,setDark,onSaveHistory}){
  const {questions=[],title=''}=lesson;
  const total=questions.length;

  /* LocalStorage key unique to this quiz */
  const STORAGE_KEY=`quizstate_${title}_${total}`;

  /* ── State ── */
  const [answers,setAnswers]=useState(()=>{
    try{
      const sv=JSON.parse(localStorage.getItem(STORAGE_KEY));
      if(sv?.answers?.length===total)return sv.answers;
    }catch{}
    return questions.map(q=>{
      if(q.type==='true_false')return q.items.map(()=>null);
      if(q.type==='multi_select')return[];
      return null;
    });
  });
  const [flags,setFlags]=useState(()=>{
    try{
      const sv=JSON.parse(localStorage.getItem(STORAGE_KEY));
      if(Array.isArray(sv?.flags)&&sv.flags.length===total)return sv.flags;
    }catch{}
    return questions.map(()=>false);
  });
  const [submitted,setSubmitted]=useState(false);
  const [cur,setCur]=useState(()=>{
    try{const sv=JSON.parse(localStorage.getItem(STORAGE_KEY));return Number(sv?.cur)||0;}catch{return 0;}
  });
  const [modal,setModal]=useState(false);
  const [warnModal,setWarnModal]=useState(null);
  const [streak,setStreak]=useState(0);
  const [bestStreak,setBestStreak]=useState(0);
  const [timeLeft,setTimeLeft]=useState(()=>{
    if(lesson.timeLimit>0){
      try{const sv=JSON.parse(localStorage.getItem(STORAGE_KEY));if(typeof sv?.timeLeft==='number')return sv.timeLeft;}catch{}
      return lesson.timeLimit*60;
    }
    return null;
  });
  const [showStats,setShowStats]=useState(false);
  const [answerTimes,setAnswerTimes]=useState({});
  const [qStartTime,setQStartTime]=useState(()=>Date.now());
  const timerRef=useRef(null);
  const submitGuardRef=useRef(false);
  const submittedRef=useRef(false);
  const [confettiOn,setConfettiOn]=useState(false);
  const confettiCanvasRef=useRef(null);
  /* ── Slide transition ── */
  const [slideDir,setSlideDir]=useState('none');
  const slideTimerRef=useRef(null);

  useEffect(()=>{
    const id='qp-slide-styles';
    if(document.getElementById(id))return;
    const s=document.createElement('style');
    s.id=id;
    s.textContent=`
      @keyframes qpSlideInRight{from{opacity:0;transform:perspective(900px) translateX(58px) rotateY(-10deg) scale(0.96);}to{opacity:1;transform:perspective(900px) translateX(0) rotateY(0deg) scale(1);}}
      @keyframes qpSlideInLeft {from{opacity:0;transform:perspective(900px) translateX(-58px) rotateY(10deg) scale(0.96);}to{opacity:1;transform:perspective(900px) translateX(0) rotateY(0deg) scale(1);}}
      @keyframes qpFadeUp{from{opacity:0;transform:translateY(18px) scale(0.98);}to{opacity:1;transform:translateY(0) scale(1);}}
      .qp-slide-right{animation:qpSlideInRight .38s cubic-bezier(.22,1,.36,1) both;transform-style:preserve-3d;backface-visibility:hidden;}
      .qp-slide-left {animation:qpSlideInLeft  .38s cubic-bezier(.22,1,.36,1) both;transform-style:preserve-3d;backface-visibility:hidden;}
      .qp-fade-up    {animation:qpFadeUp        .28s cubic-bezier(.22,1,.36,1) both;}
      @media print{
        body *{visibility:hidden !important;}
        #qp-print-area{display:block !important;visibility:visible !important;position:absolute;left:0;top:0;width:100%;color:#000;background:#fff;padding:24px;font-family:Arial,sans-serif;}
        #qp-print-area *{visibility:visible !important;}
      }
    `;
    document.head.appendChild(s);
  },[]);
  const [showExpSheet,setShowExpSheet]=useState(false);
  const [expSel,setExpSel]=useState(true); // bài hiện tại, true = selected

  /* ── Mute / BGM / Practice mode (persist qua localStorage) ── */
  const [muted,setMuted]=useState(()=>_muted);
  const toggleMuted=()=>{const nv=!muted;setMuted(nv);_setMutedFlag(nv);};

  const [bgmOn,setBgmOn]=useState(()=>{try{return localStorage.getItem('qp_bgm')==='1';}catch{return false;}});
  const bgmAudioRef=useRef(null);
  const bgmSynthRef=useRef(null);
  const startBgm=()=>{
    if(bgmAudioRef.current||bgmSynthRef.current)return; // đã chạy rồi
    if(_BGM_URL){
      const a=new Audio(_BGM_URL);
      a.loop=true;a.volume=_BGM_VOL;
      a.play().catch(err=>console.warn('[BGM] play() bị chặn:',err));
      bgmAudioRef.current=a;
    }else{
      bgmSynthRef.current=_startBgmSynth();
    }
  };
  const stopBgm=()=>{
    if(bgmAudioRef.current){bgmAudioRef.current.pause();bgmAudioRef.current=null;}
    if(bgmSynthRef.current){bgmSynthRef.current.stop();bgmSynthRef.current=null;}
  };
  // Toggle gọi trực tiếp trong onClick (user gesture) để unlock AudioContext
  // ngay lập tức trên Chrome/Safari mobile — không đợi qua useEffect.
  const toggleBgm=()=>{
    const next=!bgmOn;
    setBgmOn(next);
    try{localStorage.setItem('qp_bgm',next?'1':'0');}catch{}
    if(next){
      if(muted){setMuted(false);_setMutedFlag(false);} // bật nhạc thì tự bỏ mute, tránh "bật mà câm"
      if(_AC)_AC.get(); // resume AudioContext ngay trong tap, không trễ
      startBgm();
    }else{
      stopBgm();
    }
  };
  // Đồng bộ khi muted đổi từ nút loa riêng (không phải từ toggleBgm)
  useEffect(()=>{
    if(!bgmOn)return;
    if(muted)stopBgm();
    else startBgm();
  },[muted]);
  // Dọn dẹp khi unmount component
  useEffect(()=>()=>stopBgm(),[]);

  const [practiceMode,setPracticeMode]=useState(()=>{try{return localStorage.getItem('qp_practice')==='1';}catch{return false;}});
  useEffect(()=>{try{localStorage.setItem('qp_practice',practiceMode?'1':'0');}catch{}},[practiceMode]);

  /* ── Touch-drag tracking (kéo theo ngón tay khi vuốt) ──
     cardRef = vùng overflowY:auto (chỉ lo cuộn).
     innerRef = wrapper animation bên trong (chỉ lo transform/opacity
     khi vuốt + slide/fade animation). Tách riêng để không lặp lại vấn
     đề nháy do 1 phần tử vừa bị cuộn vừa bị biến đổi transform. */
  const cardRef=useRef(null);
  const innerRef=useRef(null);
  const dragRef=useRef(null);

  /* ────────────────────────────────────────────────
     PERF 🔴 useMemo for score
     Only recalculates when answers or questions change,
     NOT every second when timeLeft ticks.
  ──────────────────────────────────────────────── */
  const {s,t}=useMemo(()=>computeScore(questions,answers),[answers,questions]);
  const pct=t>0?s/t:0;
  const rc=pct>=0.8?'#10B981':pct>=0.5?'#F59E0B':'#EF4444';

  /* ────────────────────────────────────────────────
     PERF 🔴 useMemo for QC style object
     Only rebuilds when dark mode changes.
  ──────────────────────────────────────────────── */
  const QC=useMemo(()=>({
    text:dark?'#F2EAFF':'#2D1245',
    text2:dark?'#DDD0F8':'#4A1860',
    textMid:dark?'#9B7FC0':'#8060A0',
    surface:dark?'rgba(255,255,255,0.05)':'rgba(255,255,255,0.82)',
    surfaceQ:dark?'rgba(255,255,255,0.06)':'rgba(255,255,255,0.92)',
    border:dark?'rgba(196,181,253,0.13)':'rgba(180,100,255,0.13)',
    borderQ:dark?'rgba(196,181,253,0.18)':'rgba(180,100,255,0.18)',
    optBg:dark?'rgba(255,255,255,0.045)':'rgba(255,255,255,0.75)',
    optBorder:dark?'rgba(196,181,253,0.18)':'rgba(180,100,255,0.18)',
    optSel:dark?'rgba(196,181,253,0.14)':'rgba(180,100,255,0.1)',
    navBtn:dark?'rgba(255,150,200,0.07)':'rgba(255,107,149,0.06)',
    navBtnBorder:dark?'rgba(255,150,200,0.28)':'rgba(255,107,149,0.28)',
    navBtnText:dark?'#FBAFCE':'#E8547A',
    stickyBg:dark?'rgba(15,2,37,0.96)':'rgba(255,245,252,0.96)',
    stickyBorder:dark?'rgba(196,181,253,0.12)':'rgba(180,100,255,0.1)',
    headerBg:dark?'rgba(255,255,255,0.035)':'rgba(255,255,255,0.75)',
    progressBg:dark?'rgba(255,150,200,0.12)':'rgba(180,100,255,0.1)',
    typeBadge:dark?'rgba(255,255,255,0.07)':'rgba(180,100,255,0.09)',
    tfPassageBg:dark?'rgba(196,181,253,0.06)':'rgba(196,181,253,0.07)',
    inputBg:dark?'rgba(255,255,255,0.07)':'rgba(255,255,255,0.92)',
    inputColor:dark?'#F2EAFF':'#2D1245',
    inputBorder:dark?'rgba(196,181,253,0.28)':'rgba(180,100,255,0.28)',
    cardShadow:dark?'0 2px 16px rgba(0,0,0,0.35)':'0 2px 16px rgba(168,85,247,0.08)',
    optShadowSel:dark?'0 3px 14px rgba(168,85,247,0.22)':'0 3px 14px rgba(168,85,247,0.14)',
  }),[dark]);

  /* ── Ripple & Swipe (safe-wrapped) ── */
  const ripple=_useRipple();

  /* ── Slide-aware navigation ──
     FIX 🔴 Nhấp nháy khi chuyển câu:
     Trước đây vùng câu hỏi có key={cur}, khiến React unmount toàn bộ
     DOM cũ rồi mount lại DOM mới mỗi lần đổi câu (thay vì chỉ update).
     Việc huỷ + dựng lại cây DOM lớn (text, ảnh, input...) trong cùng
     1 frame gây ra khoảng trống/giật hình — đó là hiện tượng nhấp nháy.
     Giờ bỏ key={cur}: DOM được giữ nguyên, React chỉ patch nội dung.
     Để CSS animation (qp-slide-x / qp-fade-up) vẫn re-trigger được mỗi
     lần chuyển câu (vì class name không đổi giữa 2 lần "right" liên
     tiếp nên browser sẽ không tự restart animation), ta ép reflow thủ
     công bằng cách tạm gỡ class rồi gắn lại ở frame kế tiếp. */
  const navTo=(idx)=>{
    if(idx===cur)return;
    const dir=idx>cur?'right':'left';
    clearTimeout(slideTimerRef.current);
    // Gỡ animation class trước, ép reflow, rồi mới set class mới +
    // đổi câu — đảm bảo animation luôn restart kể cả khi đi cùng hướng
    // 2 lần liên tiếp (right → right).
    setSlideDir('none');
    if(innerRef.current)void innerRef.current.offsetWidth; // force reflow
    requestAnimationFrame(()=>{
      setSlideDir(dir);
      setCur(idx);
    });
    // reset class sau 400ms để animation có thể re-trigger khi chuyển lại
    slideTimerRef.current=setTimeout(()=>setSlideDir('none'),460);
  };

  /* ── Drag theo ngón tay: transform bám sát finger qua DOM trực tiếp
     (không qua setState) để mượt 60fps, chỉ commit điều hướng ở touchend. ── */
  const onCardTouchStart=(e)=>{
    if(submitted)return;
    const t=e.touches[0];
    dragRef.current={startX:t.clientX,startY:t.clientY,dx:0,dragging:false,decided:false};
  };
  const onCardTouchMove=(e)=>{
    const d=dragRef.current;
    if(!d)return;
    const t=e.touches[0];
    const dx=t.clientX-d.startX, dy=t.clientY-d.startY;
    if(!d.decided){
      if(Math.abs(dx)<8&&Math.abs(dy)<8)return;
      d.decided=true;
      d.dragging=Math.abs(dx)>Math.abs(dy); // ngang mới coi là vuốt câu, dọc để cuộn bình thường
      if(d.dragging&&innerRef.current)innerRef.current.style.transition='none';
    }
    if(!d.dragging)return;
    e.preventDefault?.();
    d.dx=dx;
    if(innerRef.current){
      const damp=dx*0.62; // có lực cản nhẹ, không kéo 1:1
      innerRef.current.style.transform=`translateX(${damp}px)`;
      innerRef.current.style.opacity=String(Math.max(0.45,1-Math.abs(damp)/260));
    }
  };
  const onCardTouchEnd=()=>{
    const d=dragRef.current;
    dragRef.current=null;
    if(!d||!d.dragging)return;
    const dx=d.dx;
    if(innerRef.current)innerRef.current.style.transition='transform .3s cubic-bezier(.22,1,.36,1), opacity .3s';
    const THRESH=64;
    if(dx<=-THRESH&&cur<total-1){_sfxNav();navTo(cur+1);}
    else if(dx>=THRESH&&cur>0){_sfxNav();navTo(cur-1);}
    else if(innerRef.current){innerRef.current.style.transform='translateX(0)';innerRef.current.style.opacity='1';}
  };

  /* Gắn bằng addEventListener thuần (không qua JSX onTouchMove) vì React
     đặt onTouchMove ở dạng passive listener mặc định → preventDefault không
     hoạt động và bị browser báo lỗi. touchmove cần {passive:false} mới
     chặn được gesture vuốt-back/forward của trình duyệt khi đang kéo ngang. */
  useEffect(()=>{
    const el=cardRef.current;
    if(!el)return;
    el.addEventListener('touchstart',onCardTouchStart,{passive:true});
    el.addEventListener('touchmove',onCardTouchMove,{passive:false});
    el.addEventListener('touchend',onCardTouchEnd,{passive:true});
    return()=>{
      el.removeEventListener('touchstart',onCardTouchStart);
      el.removeEventListener('touchmove',onCardTouchMove);
      el.removeEventListener('touchend',onCardTouchEnd);
    };
  },[cur,submitted]);

  /* ── Effects ── */

  // Timer (runs each second only because timeLeft/submitted changed)
  useEffect(()=>{
    if(timeLeft===null||submittedRef.current||submitGuardRef.current)return;
    if(timeLeft<=0){doSubmit();return;}
    // Tick sounds for countdown urgency
    if(timeLeft<=5)  _sfxTickUrgent();
    else if(timeLeft<=10) _sfxTick();
    timerRef.current=setTimeout(()=>setTimeLeft(t=>t-1),1000);
    return()=>clearTimeout(timerRef.current);
  },[timeLeft,submitted]);

  // Reset question start-time on navigation
  useEffect(()=>{setQStartTime(Date.now());},[cur]);

  /* FIX 🟡 Scroll to top on question change
     Trước đây dùng window.scrollTo — nếu vùng câu hỏi nằm
     trong container overflowY:'auto' riêng (cardRef) thì lệnh
     đó không có tác dụng. Giờ scroll đúng container đó, kèm
     fallback window.scrollTo cho trường hợp trang ngoài cũng scroll.
     FIX 🔴 behavior:'auto' thay vì 'smooth' — tránh scroll-animation
     chạy song song/cạnh tranh với CSS slide/fade-in animation.
     FIX 🔴 Nháy khi cuộn — sửa tận gốc: animation (qp-slide-x/qp-fade-up)
     giờ nằm trên 1 div con riêng (qp-anim-inner), KHÔNG còn cùng phần
     tử với cardRef (vùng overflowY:auto bị set scrollTop=0 ở đây).
     Vì 2 việc không còn đụng chạm trên cùng 1 phần tử nữa, không cần
     trì hoãn qua requestAnimationFrame nữa — set ngay cũng không gây
     tranh chấp layout/compositor như trước. */
  useEffect(()=>{
    cardRef.current?.scrollTo({top:0,behavior:'auto'});
    window.scrollTo({top:0,behavior:'auto'});
  },[cur]);

  // NEW: Save progress to LocalStorage (skipped when submitted)
  useEffect(()=>{
    if(submitted){try{localStorage.removeItem(STORAGE_KEY);}catch{}return;}
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify({answers,cur,timeLeft,flags}));}catch{}
  },[answers,cur,timeLeft,submitted,flags]);

  /* NEW: Keyboard shortcuts
     A/B/C/D hoặc 1/2/3/4 → chọn option cho trắc nghiệm / chọn nhiều
     ← → → chuyển câu hỏi
     Enter (khi KHÔNG focus vào button) → sang câu tiếp / nộp bài ở câu cuối
     Space khi không có gì focus → chặn cuộn trang ngoài ý muốn
     Không làm gì khi đang focus vào input/textarea (input tự xử lý riêng). */
  useEffect(()=>{
    const handler=(e)=>{
      if(submitted)return;
      const tag=document.activeElement?.tagName;
      if(tag==='INPUT'||tag==='TEXTAREA')return;
      if(e.key==='ArrowRight'&&cur<total-1){navTo(cur+1);_sfxNav();return;}
      if(e.key==='ArrowLeft' &&cur>0)      {navTo(cur-1);_sfxNav();return;}
      if(e.key==='Enter'){
        // Nếu đang focus 1 button thì để hành vi click gốc của button tự xử lý,
        // tránh bị nhảy câu 2 lần (1 lần do click, 1 lần do handler này).
        if(tag==='BUTTON')return;
        if(cur<total-1){navTo(cur+1);_sfxNav();}else handleSubmit();
        return;
      }
      if(e.key===' '&&tag!=='BUTTON'){e.preventDefault();return;}
      const cq=questions[cur];
      if(!cq)return;
      if(cq.type==='multiple'||cq.type==='multi_select'){
        const k=e.key.toLowerCase();
        let idx=-1;
        if('abcdef'.includes(k))idx='abcdef'.indexOf(k);
        else if(k>='1'&&k<='6')idx=Number(k)-1;
        if(idx>=0&&idx<(cq.options||[]).length){
          if(cq.type==='multiple'){
            const sv=answers[cur];const nv=sv===idx?null:idx;
            setAnswers(prev=>{const n=[...prev];n[cur]=nv;return n;});
            if(nv!==null) _sfxClick();
          }else{
            const msv=answers[cur]||[];
            setAnswers(prev=>{const n=[...prev];n[cur]=msv.includes(idx)?msv.filter(x=>x!==idx):[...msv,idx];return n;});
            _sfxClick();
          }
        }
      }
    };
    window.addEventListener('keydown',handler);
    return()=>window.removeEventListener('keydown',handler);
  },[cur,submitted,answers,questions,total]);

  /* ── Helpers (non-hook) ── */
  // fmtTime/timerColor giờ nằm trong TimerBadge (module scope), không cần ở đây nữa

  // Canvas confetti: chạy rAF loop khi confettiOn bật, tự dọn khi tắt/unmount
  useEffect(()=>{
    if(!confettiOn)return;
    const stop=_runConfetti(confettiCanvasRef.current);
    const t=setTimeout(()=>setConfettiOn(false),2200);
    return ()=>{stop();clearTimeout(t);};
  },[confettiOn]);

  const spawnConfetti=()=>{setConfettiOn(true);};

  /* ── Early return (after ALL hooks) ── */
  const q=questions[cur];
  if(!q)return null;

  const setA=v=>{const n=[...answers];n[cur]=v;setAnswers(n);};
  const toggleFlag=()=>{setFlags(prev=>{const n=[...prev];n[cur]=!n[cur];return n;});_sfxClick();};

  const ti={
    true_false: {l:'Đúng / Sai',   c:'#C084FC'},
    multiple:   {l:'Trắc nghiệm',  c:'#F9A8D4'},
    multi_select:{l:'Chọn nhiều',  c:'#6EE7B7'},
    fill_blank: {l:'Điền chỗ trống',c:'#FED7AA'},
  };
  const info=ti[q.type]||ti.multiple;

  /* Practice mode: hiện đáp án đúng/sai NGAY khi đã trả lời câu hiện tại,
     không cần đợi Nộp bài. answeredCur = câu hiện tại đã có câu trả lời chưa. */
  const answeredCur=
    q.type==='multiple' ? (answers[cur]!==null&&answers[cur]!==undefined) :
    q.type==='multi_select' ? (answers[cur]||[]).length>0 :
    q.type==='fill_blank' ? !!(answers[cur]||'').trim() :
    q.type==='true_false' ? (answers[cur]||[]).some(v=>v!==null) : false;
  const questionRevealed=submitted||(practiceMode&&answeredCur);

  /* FIX 🔴 Null-safe checkCurrent */
  const checkCurrent=(ans)=>{
    if(q.type==='multiple')    return ans===q.correct;
    if(q.type==='multi_select')return JSON.stringify([...(ans||[])].sort())===JSON.stringify([...(q.correct||[])].sort());
    if(q.type==='fill_blank')  return(ans||'').trim().toLowerCase()===(q.answer||'').trim().toLowerCase();
    if(q.type==='true_false')  return q.items.filter((it,ii)=>ans?.[ii]===it.answer).length===q.items.length;
    return false;
  };

  const setAWithFeedback=(v)=>{
    setA(v);
    const ok=checkCurrent(v);
    _haptic(ok?'success':'error');
    const elapsed=Math.round((Date.now()-qStartTime)/1000);
    setAnswerTimes(prev=>({...prev,[cur]:elapsed}));
    if(ok){
      const ns=streak+1;
      setStreak(ns);
      setBestStreak(bs=>Math.max(bs,ns));
      // streak >= 3: sparkle arpeggio thay chime thường
      if(ns>=3) _sfxStreak(ns);
      else _sfxCorrect();
    } else {
      _sfxWrong();
      setStreak(0);
    }
  };

  const getUnanswered=()=>questions.reduce((acc,q,qi)=>{
    let empty=false;
    if(q.type==='multiple')    empty=answers[qi]===null||answers[qi]===undefined;
    else if(q.type==='multi_select')empty=!(answers[qi]||[]).length;
    else if(q.type==='fill_blank')  empty=!(answers[qi]||'').trim();
    else if(q.type==='true_false')  empty=!(answers[qi])||answers[qi].some(v=>v===null);
    if(empty)acc.push(qi+1);
    return acc;
  },[]);

  /* FIX 🔴 doSubmit: uses computeScore directly — no duplicated IIFE */
  const doSubmit=()=>{
    if(submitGuardRef.current)return; // 🔒 chống gọi lại lần 2
    submitGuardRef.current=true;
    submittedRef.current=true;
    setSubmitted(true);
    const {s:hs,t:ht}=computeScore(questions,answers);
    const hpct=ht>0?Math.round(hs/ht*100):0;  // 0-100 integer
    const _strip=s=>(s||'').replace(/<[^>]*>/g,'').trim();
    const perQ=questions.map((q,qi)=>{
      let ok=false,partial=false;
      const qText=_strip(q.question||q.passage||q.content||'').slice(0,120);
      let correctAns='';
      if(q.type==='true_false'){
        const full=q.items.every((it,ii)=>answers[qi]?.[ii]===it.answer);
        const half=q.items.some((it,ii)=>answers[qi]?.[ii]===it.answer);
        ok=full;partial=half&&!full;
        correctAns=(q.items||[]).map((it,ii)=>`${String.fromCharCode(97+ii)}:${it.answer?'Đ':'S'}`).join(' ');
      }else if(q.type==='multiple'){
        ok=answers[qi]===q.correct;
        correctAns=_strip(q.options?.[q.correct]||String(q.correct));
      }else if(q.type==='multi_select'){
        const a=answers[qi]||[];ok=JSON.stringify([...a].sort())===JSON.stringify([...(q.correct||[])].sort());
        correctAns=(q.correct||[]).map(i=>_strip(q.options?.[i]||i)).join(', ');
      }else{
        ok=(answers[qi]||'').trim().toLowerCase()===(q.answer||'').trim().toLowerCase();
        correctAns=_strip(q.answer||'');
      }
      return{type:q.type,ok,partial,qText,correctAns};
    });
    onSaveHistory&&onSaveHistory({
      id:Date.now(),ts:new Date().toISOString(),lessonTitle:title,
      score:hs,total:ht,pct:hpct,qCount:questions.length,perQ,
    });
    // ── Lưu kết quả vào Supabase ──
    if(typeof window.saveQuizResult==='function'){
      window.saveQuizResult({
        lessonId:   lesson.id||lesson.lessonId||'',
        lessonTitle: title,
        score:      hs,   // số câu đúng thực tế
        total:      ht,   // tổng số câu — save-result tự tính điểm thang 10
        questions,
        answers,
        perQ,
      }).catch(()=>{});
    }
    // Use locally computed hpct (not stale closure pct) for fanfare decision
    _sfxSubmit();
    setTimeout(()=>{
      _AC?.get(); // wake AudioContext trước khi play fanfare/sad
      setModal(true);
      if(hpct>=70){_playFanfare();spawnConfetti();}else _playSad();
    },420);
  };

  const handleSubmit=()=>{
    const un=getUnanswered();
    if(un.length>0){setWarnModal(un);return;}
    doSubmit();
  };

  const resetQuiz=()=>{
    submitGuardRef.current=false; // 🔒 reset guard cho lần làm mới
    submittedRef.current=false;
    setAnswers(questions.map(q=>{
      if(q.type==='true_false')return q.items.map(()=>null);
      if(q.type==='multi_select')return[];
      return null;
    }));
    setSubmitted(false);setModal(false);setCur(0);setStreak(0);
    setBestStreak(0);setAnswerTimes({});setShowStats(false);
    setFlags(questions.map(()=>false));
    if(lesson.timeLimit>0)setTimeLeft(lesson.timeLimit*60);
    try{localStorage.removeItem(STORAGE_KEY);}catch{}
  };

  /* ══════════════════════════════════════════════
     JSX
  ════════════════════════════════════════════ */
  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',background:'transparent',color:QC.text,minHeight:'100vh',position:'relative'}}>

      {/* Confetti — canvas, không phải 28 div React */}
      {confettiOn&&(
        <canvas ref={confettiCanvasRef} style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:9998}}/>
      )}

      {/* Header */}
      <div style={{padding:'11px 15px 10px',background:QC.headerBg,borderBottom:`1px solid ${QC.border}`,position:'sticky',top:0,zIndex:50,backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)'}}>
        {!submitted&&(
          <div style={{display:'flex',gap:7,marginBottom:8,alignItems:'center',flexWrap:'wrap'}}>
            {timeLeft!==null&&<TimerBadge timeLeft={timeLeft} dark={dark}/>}
            {streak>=2&&(
              <div style={{display:'flex',alignItems:'center',gap:4,padding:'4px 11px',borderRadius:999,background:'rgba(252,211,77,0.1)',border:'1.5px solid rgba(252,211,77,0.4)',boxShadow:'0 0 0 3px rgba(252,211,77,0.07)'}}>
                <span style={{fontSize:11}}>🔥</span><span style={{fontSize:11,fontWeight:900,color:'#C89700'}}>{streak} liên tiếp</span>
              </div>
            )}
            <button onClick={()=>setPracticeMode(p=>!p)} title="Xem giải thích ngay khi làm hay đợi đến lúc nộp bài"
              style={{display:'flex',alignItems:'center',gap:5,padding:'4px 11px',borderRadius:999,border:`1.5px solid ${practiceMode?'rgba(110,231,183,0.45)':QC.navBtnBorder}`,background:practiceMode?'rgba(110,231,183,0.12)':QC.navBtn,cursor:'pointer'}}>
              <span style={{fontSize:11,fontWeight:900,color:practiceMode?'#10B981':QC.navBtnText}}>{practiceMode?'📖 Luyện tập':'📝 Thi cử'}</span>
            </button>
          </div>
        )}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <button onClick={(e)=>{ripple(e);onBack();}} className="ripple-host"
            style={{padding:'6px 14px',borderRadius:999,border:`1.5px solid ${QC.navBtnBorder}`,background:QC.navBtn,color:QC.navBtnText,fontSize:12,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',gap:4,transition:'all .18s',flexShrink:0}}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Quay lại
          </button>
          <div style={{fontSize:13,fontWeight:900,color:QC.text,textAlign:'center',flex:1,margin:'0 10px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{title}</div>
          <div style={{display:'flex',alignItems:'center',gap:7,flexShrink:0}}>
            <button onClick={()=>setShowExpSheet(true)} title="Tải bài về máy"
              style={{width:30,height:30,borderRadius:999,border:`1.5px solid ${QC.navBtnBorder}`,background:QC.navBtn,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F472B6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
            <button onClick={toggleMuted} title={muted?'Bật âm thanh':'Tắt âm thanh'}
              style={{width:30,height:30,borderRadius:999,border:`1.5px solid ${QC.navBtnBorder}`,background:QC.navBtn,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
              {muted
                ?<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={QC.navBtnText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                :<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={QC.navBtnText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>}
            </button>
            <button onClick={toggleBgm} title={bgmOn?'Tắt nhạc nền':'Bật nhạc nền (lo-fi, nhỏ)'}
              style={{width:30,height:30,borderRadius:999,border:`1.5px solid ${bgmOn?'rgba(110,231,183,0.5)':QC.navBtnBorder}`,background:bgmOn?'rgba(110,231,183,0.12)':QC.navBtn,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={bgmOn?'#10B981':QC.navBtnText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            </button>
            <button onClick={()=>setDark(d=>!d)} className="dm-btn" title="Đổi giao diện"
              style={{width:30,height:30,borderRadius:999,border:`1.5px solid ${QC.navBtnBorder}`,background:QC.navBtn,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
              {dark
                ?<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={QC.navBtnText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                :<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={QC.navBtnText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
            </button>
            {submitted&&<div style={{padding:'5px 13px',borderRadius:999,fontSize:12,fontWeight:900,color:'#fff',background:`linear-gradient(135deg,${rc}ee,${rc}aa)`,boxShadow:`0 3px 12px ${rc}44`}}>{fmtS(pct*10)}/10</div>}
          </div>
        </div>
        <div style={{height:6,background:QC.progressBg,borderRadius:99,overflow:'hidden',position:'relative'}}>
          <div style={{height:'100%',width:`${(cur+1)/total*100}%`,background:'linear-gradient(90deg,#F472B6,#A855F7,#818CF8)',borderRadius:99,transition:'width .45s cubic-bezier(.4,0,.2,1)'}}/>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:6,alignItems:'center'}}>
          <span style={{fontSize:11,fontWeight:800,color:info.c,background:QC.typeBadge,padding:'2px 10px',borderRadius:999,border:`1px solid ${info.c}22`}}>{info.l}</span>
          <div style={{display:'flex',alignItems:'center',gap:9}}>
            <button onClick={toggleFlag} title={flags[cur]?'Bỏ đánh dấu':'Đánh dấu câu này'}
              style={{background:'none',border:'none',cursor:'pointer',padding:0,fontSize:14,lineHeight:1,opacity:flags[cur]?1:0.32,transform:flags[cur]?'scale(1.18)':'scale(1)',transition:'all .18s'}}>
              🚩
            </button>
            <span style={{fontSize:11,color:QC.textMid,fontWeight:700}}>
              {cur+1} <span style={{opacity:.4}}>/</span> {total}
              {!submitted&&(q.type==='multiple'||q.type==='multi_select')&&
                <span style={{opacity:.35,marginLeft:7,fontSize:9}}>A/B/C/D · 1/2/3/4</span>}
            </span>
          </div>
        </div>
      </div>

      {/* Question area — KHÔNG dùng key={cur} nữa: trước đây key={cur}
          khiến React unmount/remount toàn bộ DOM mỗi lần đổi câu, gây
          nhấp nháy. Animation giờ được re-trigger thủ công trong navTo()
          bằng cách reset class → force reflow → set class mới.
          FIX 🔴 Nháy khi cuộn (lần 2 — sửa tận gốc): cardRef trước đây
          VỪA là vùng overflowY:auto (bị set scrollTop=0 mỗi lần đổi câu)
          VỪA là phần tử mang class animation (opacity/transform). Hai
          việc đụng vào cùng 1 phần tử cùng lúc là nguyên nhân nháy thật
          sự, không chỉ là vấn đề thời điểm (RAF không giải quyết triệt
          để vì layout vẫn bị động tới khi animation đang chạy).
          Giờ tách hẳn 2 vai trò ra 2 lớp DOM khác nhau:
            - cardRef (div ngoài): CHỈ lo cuộn, không có animation gì cả
              → set scrollTop=0 không bao giờ ảnh hưởng compositor.
            - div trong (qp-anim-inner): CHỈ lo animation slide/fade,
              không bị set scrollTop, không bị động tới khi cuộn.
          Nhờ vậy "cuộn về đầu" và "animation chuyển câu" hoàn toàn độc
          lập, không còn tranh chấp gây nháy nữa. */}
      <div style={{flex:1,padding:'14px',overflowY:'auto',touchAction:'pan-y'}}
        ref={cardRef}>
      <div className={slideDir==='right'?'qp-slide-right':slideDir==='left'?'qp-slide-left':'qp-fade-up'} ref={innerRef}>

        {/* Passage (True/False) */}
        {q.type==='true_false'&&q.passage&&(
          <div style={{background:QC.tfPassageBg,border:`1.5px solid ${QC.borderQ}`,borderRadius:18,padding:'15px 17px',marginBottom:13,boxShadow:QC.cardShadow}}>
            <div style={{fontSize:10,fontWeight:900,color:'#B07CF0',letterSpacing:1.2,marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#B07CF0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              ĐOẠN TƯ LIỆU
            </div>
            <p className="ls-passage-text" style={{fontStyle:'italic',color:QC.text2,marginBottom:q.source?5:0,lineHeight:1.75}} dangerouslySetInnerHTML={{__html:q.passage}}/>
            {q.source&&<p style={{fontSize:11,color:QC.textMid,fontWeight:700,marginTop:5,paddingTop:5,borderTop:`1px dashed ${QC.border}`}}>{q.source}</p>}
          </div>
        )}

        {/* Question text */}
        {q.type!=='true_false'&&(
          <div style={{background:QC.surfaceQ,border:`1.5px solid ${QC.borderQ}`,borderRadius:18,padding:'15px 17px',marginBottom:13,boxShadow:QC.cardShadow}}>
            <div style={{fontSize:10,fontWeight:900,color:info.c,letterSpacing:1.1,marginBottom:8,opacity:.8}}>{info.l.toUpperCase()}</div>
            <p className="ls-question-text" style={{fontWeight:700,color:QC.text,lineHeight:1.75}} dangerouslySetInnerHTML={{__html:q.question}}/>
            {q.type==='multi_select'&&(
              <div style={{display:'flex',alignItems:'center',gap:5,marginTop:8,padding:'4px 10px',borderRadius:999,background:'rgba(110,231,183,0.1)',border:'1px solid rgba(110,231,183,0.3)',width:'fit-content'}}>
                <span style={{fontSize:11,color:'#5CB893',fontWeight:800}}>Chọn nhiều đáp án</span>
              </div>
            )}
          </div>
        )}

        {/* TF items */}
        {q.type==='true_false'&&(
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {q.items.map((item,ii)=>{
              const sv=answers[cur]?.[ii];
              const rowRevealed=submitted||(practiceMode&&sv!==null);
              const ok=rowRevealed&&sv===item.answer;
              const bad=rowRevealed&&sv!==null&&sv!==item.answer;
              return(
                <div key={ii} style={{background:ok?'rgba(16,185,129,0.1)':bad?'rgba(239,68,68,0.08)':sv===true?'rgba(16,185,129,0.07)':sv===false?'rgba(239,68,68,0.07)':QC.optBg,border:'1.5px solid '+(ok?'#10B981':bad?'#EF4444':sv===true?'#6EE7B7':sv===false?'#FCA5A5':QC.optBorder),borderRadius:16,padding:'13px 14px',transition:'all .22s',boxShadow:sv!==null?QC.optShadowSel:'none'}}>
                  <div style={{display:'flex',gap:9,marginBottom:11}}>
                    <span style={{minWidth:22,height:22,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,background:'rgba(176,124,240,0.18)',color:'#B07CF0',flexShrink:0}}>{String.fromCharCode(97+ii).toUpperCase()}</span>
                    <p className="ls-tf-text" style={{margin:0,color:QC.text2,lineHeight:1.65,fontWeight:600}} dangerouslySetInnerHTML={{__html:item.text}}/>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    <button onClick={()=>{if(submitted)return;const n=[...(answers[cur]||q.items.map(()=>null))];n[ii]=n[ii]===true?null:true;setA(n);_sfxClick();}} style={{padding:'8px 0',borderRadius:12,fontSize:12,fontWeight:800,transition:'all .18s',background:sv===true?(rowRevealed?(ok?'rgba(16,185,129,0.25)':'rgba(239,68,68,0.2)'):'rgba(16,185,129,0.18)'):'rgba(16,185,129,0.07)',color:sv===true?(rowRevealed?(ok?'#10B981':'#EF4444'):'#10B981'):'#6EE7B7',border:'1.5px solid '+(sv===true?(rowRevealed?(ok?'#10B981':'#EF4444'):'#10B981'):'rgba(110,231,183,0.35)'),cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
                      <span style={{fontSize:14}}>&#10003;</span> Đúng</button>
                    <button onClick={()=>{if(submitted)return;const n=[...(answers[cur]||q.items.map(()=>null))];n[ii]=n[ii]===false?null:false;setA(n);_sfxClick();}} style={{padding:'8px 0',borderRadius:12,fontSize:12,fontWeight:800,transition:'all .18s',background:sv===false?(rowRevealed?(ok?'rgba(16,185,129,0.25)':'rgba(239,68,68,0.2)'):'rgba(239,68,68,0.18)'):'rgba(239,68,68,0.07)',color:sv===false?(rowRevealed?(ok?'#10B981':'#EF4444'):'#EF4444'):'#FCA5A5',border:'1.5px solid '+(sv===false?(rowRevealed?(ok?'#10B981':'#EF4444'):'#EF4444'):'rgba(252,165,165,0.35)'),cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
                      <span style={{fontSize:14}}>&#10007;</span> Sai</button>
                  </div>
                  {rowRevealed&&<div style={{marginTop:6,textAlign:'right'}}><span style={{fontSize:11,fontWeight:800,color:'#C084FC',background:'rgba(196,181,253,0.15)',padding:'2px 9px',borderRadius:999}}>Đáp án: {item.answer?'✓ Đúng':'✗ Sai'}</span></div>}
                </div>
              );
            })}
          </div>
        )}

        {/* MC / MS */}
        {(q.type==='multiple'||q.type==='multi_select')&&(
          <div style={{display:'flex',flexDirection:'column',gap:9}}>
            {q.options.map((opt,i)=>{
              const sv=q.type==='multiple'?answers[cur]:(answers[cur]||[]);
              const isSel=q.type==='multiple'?sv===i:sv.includes(i);
              const isCor=q.type==='multiple'?q.correct===i:(q.correct||[]).includes(i);
              const ok=questionRevealed&&isSel&&isCor;
              const bad=questionRevealed&&isSel&&!isCor;
              const missed=questionRevealed&&!isSel&&isCor;
              return(
                <button key={i} onClick={()=>{
                  if(submitted)return;
                  if(q.type==='multiple'){
                    const newVal=sv===i?null:i;setA(newVal);
                    if(newVal!==null){_sfxClick();}
                  }else{setA(sv.includes(i)?sv.filter(x=>x!==i):[...sv,i]);_sfxClick();}
                }}
                style={{display:'flex',alignItems:'center',gap:11,background:ok?'rgba(16,185,129,0.12)':bad?'rgba(239,68,68,0.1)':missed?'rgba(245,158,11,0.1)':isSel?QC.optSel:QC.optBg,border:'1.5px solid '+(ok?'#10B981':bad?'#EF4444':missed?'#F59E0B':isSel?'#B07CF0':QC.optBorder),borderRadius:16,padding:'12px 13px',cursor:'pointer',textAlign:'left',transition:'all .22s cubic-bezier(.4,0,.2,1)',width:'100%',boxShadow:isSel?QC.optShadowSel:'none',transform:isSel?'scale(1.005)':'scale(1)'}}>
                  <span style={{width:30,height:30,borderRadius:q.type==='multiple'?'50%':9,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:900,transition:'all .22s',background:isSel?(questionRevealed?(ok?'#10B981':bad?'#EF4444':'linear-gradient(135deg,#B07CF0,#8B5CF6)'):'linear-gradient(135deg,#D490FF,#8B5CF6)'):'rgba(176,124,240,0.14)',color:isSel?'#fff':'#B07CF0'}}>{_LETTERS[i]}</span>
                  <span style={{fontSize:13,lineHeight:1.7,color:QC.text2,flex:1,fontWeight:600}} dangerouslySetInnerHTML={{__html:opt}}/>
                  {questionRevealed&&isCor&&<span style={{color:'#10B981',fontWeight:900,fontSize:15,flexShrink:0}}>&#10003;</span>}
                  {questionRevealed&&bad&&<span style={{color:'#EF4444',fontWeight:900,fontSize:15,flexShrink:0}}>&#10007;</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Fill blank */}
        {q.type==='fill_blank'&&(
          <div>
            <input value={answers[cur]||''} onChange={e=>{if(!submitted)setA(e.target.value);}}
              onKeyDown={e=>{
                if(e.key==='Enter'&&!submitted&&(answers[cur]||'').trim()){
                  _sfxClick();
                  if(cur<total-1){_sfxNav();navTo(cur+1);}
                  else handleSubmit();
                }
              }}
              placeholder="Nhập câu trả lời... (Enter để tiếp theo)"
              style={{width:'100%',padding:'13px 16px',borderRadius:16,fontSize:14,fontWeight:700,
                color:questionRevealed?undefined:QC.inputColor,
                background:questionRevealed?((answers[cur]||'').trim().toLowerCase()===(q.answer||'').trim().toLowerCase()?'rgba(16,185,129,0.1)':'rgba(239,68,68,0.08)'):QC.inputBg,
                border:'1.5px solid '+(questionRevealed?((answers[cur]||'').trim().toLowerCase()===(q.answer||'').trim().toLowerCase()?'#10B981':'#EF4444'):QC.inputBorder),
                outline:'none',fontFamily:'Nunito,sans-serif',boxSizing:'border-box',transition:'border-color .2s,box-shadow .2s',boxShadow:questionRevealed?'none':`0 0 0 3px ${QC.inputBorder}22`}}/>
            {questionRevealed&&(
              <div style={{marginTop:8,fontSize:13,fontWeight:800,
                color:(answers[cur]||'').trim().toLowerCase()===(q.answer||'').trim().toLowerCase()?'#6EE7B7':'#FCA5A5',
                display:'flex',alignItems:'center',gap:5}}>
                {(answers[cur]||'').trim().toLowerCase()===(q.answer||'').trim().toLowerCase()
                  ?'✓ Chính xác!'
                  :`✗ Đáp án đúng: ${q.answer||'—'}`}
              </div>
            )}
            {!submitted&&q.hint&&<div style={{marginTop:6,fontSize:12,color:QC.textMid,fontWeight:700}}>💡 {q.hint}</div>}
          </div>
        )}

        {/* Explanation (hiện sau khi nộp, hoặc ngay khi trả lời nếu đang Practice mode) */}
        {questionRevealed&&q.explanation&&(
          <div style={{marginTop:13,background:dark?'rgba(176,124,240,0.07)':'rgba(176,124,240,0.07)',border:'1.5px solid rgba(176,124,240,0.28)',borderRadius:16,padding:'12px 14px',boxShadow:'0 2px 12px rgba(176,124,240,0.08)'}}>
            <div style={{fontSize:10,fontWeight:900,color:'#B07CF0',marginBottom:6,letterSpacing:1,display:'flex',alignItems:'center',gap:5}}>
              <span style={{fontSize:13}}>&#128161;</span> GIẢI THÍCH
            </div>
            <div style={{fontSize:13,color:QC.text2,lineHeight:1.7,fontWeight:500}} dangerouslySetInnerHTML={{__html:q.explanation}}/>
          </div>
        )}

        {/* Nav dots */}
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'14px 0 6px'}}>
          <button onClick={(e)=>{ripple(e);if(cur>0){_sfxNav();navTo(cur-1);}}} disabled={cur===0} className="ripple-host"
            style={{flexShrink:0,width:34,height:34,borderRadius:999,fontSize:14,fontWeight:800,background:QC.navBtn,border:`1.5px solid ${QC.navBtnBorder}`,color:QC.navBtnText,opacity:cur===0?0.28:1,cursor:cur===0?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .18s'}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <NavDots questions={questions} answers={answers} cur={cur} submitted={submitted} onJump={navTo} flags={flags}/>
          <button onClick={(e)=>{ripple(e);if(cur<total-1){_sfxNav();navTo(cur+1);}}} disabled={cur===total-1} className="ripple-host"
            style={{flexShrink:0,width:34,height:34,borderRadius:999,fontSize:14,fontWeight:800,background:QC.navBtn,border:`1.5px solid ${QC.navBtnBorder}`,color:QC.navBtnText,opacity:cur===total-1?0.28:1,cursor:cur===total-1?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .18s'}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>
      </div>

      {/* Submit bar */}
      <div style={{position:'sticky',bottom:0,padding:'10px 15px 22px',borderTop:`1px solid ${QC.stickyBorder}`,background:QC.stickyBg,backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)'}}>
        {!submitted
          ?<button onClick={(e)=>{ripple(e);handleSubmit();}} className="ripple-host"
              style={{width:'100%',padding:14,borderRadius:999,border:'none',background:'linear-gradient(135deg,#F472B6,#A855F7)',color:'#fff',fontSize:15,fontWeight:900,boxShadow:'0 5px 22px rgba(168,85,247,0.38)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,transition:'transform .15s,box-shadow .15s',letterSpacing:.2}}>
            <_Heart s={14} c="#fff"/> Nộp bài
          </button>
          :<div style={{display:'flex',gap:9}}>
            <button onClick={(e)=>{ripple(e);resetQuiz();}} className="ripple-host"
              style={{flex:1,padding:13,borderRadius:999,border:'1.5px solid rgba(255,150,200,0.28)',background:'rgba(255,150,200,0.07)',color:'#FBAFCE',fontSize:13,fontWeight:900,cursor:'pointer',transition:'all .18s'}}>
              Làm lại
            </button>
            <button onClick={()=>setShowStats(true)}
              style={{flex:1,padding:13,borderRadius:999,border:'none',background:'linear-gradient(135deg,#10B981,#6EE7B7)',color:'#fff',fontSize:13,fontWeight:900,cursor:'pointer',boxShadow:'0 4px 16px rgba(16,185,129,0.3)',transition:'all .18s'}}>
              Thống kê
            </button>
            <button onClick={()=>window.print()} title="In hoặc lưu thành PDF"
              style={{flex:1,padding:13,borderRadius:999,border:'1.5px solid rgba(176,124,240,0.3)',background:'rgba(176,124,240,0.08)',color:'#B07CF0',fontSize:13,fontWeight:900,cursor:'pointer',transition:'all .18s'}}>
              In kết quả
            </button>
          </div>}
      </div>

      {/* Vùng dành riêng cho in (ẩn trên màn hình, chỉ hiện khi window.print() — xem CSS @media print) */}
      {submitted&&(
        <div id="qp-print-area" style={{display:'none'}}>
          <h2>{title}</h2>
          <p>Ngày làm bài: {new Date().toLocaleDateString('vi-VN')}</p>
          <p>Điểm: {fmtS(pct*10)}/10 &nbsp;({s}/{t} câu đúng)</p>
          <hr/>
          {questions.map((q2,qi)=>{
            const ok2=isAnswerCorrect(q2,answers[qi]);
            return(
              <div key={qi} style={{marginBottom:10,paddingBottom:6,borderBottom:'1px solid #ccc'}}>
                <strong>Câu {qi+1}:</strong> {ok2?'Đúng':'Sai'}
                {!ok2&&q2.explanation&&(
                  <div style={{marginTop:4,fontSize:13}} dangerouslySetInnerHTML={{__html:'Giải thích: '+q2.explanation}}/>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Stats modal */}
      {showStats&&submitted&&(
        <div onClick={()=>setShowStats(false)} style={{position:'fixed',inset:0,background:'rgba(8,1,22,0.87)',backdropFilter:'blur(18px)',WebkitBackdropFilter:'blur(18px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10000,padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{background:dark?'linear-gradient(160deg,#1A0640,#110228)':'linear-gradient(160deg,#FFF0F8,#F4E8FF)',border:`1.5px solid ${dark?'rgba(196,181,253,0.18)':'rgba(220,180,255,0.5)'}`,borderRadius:26,padding:'22px 19px',maxWidth:340,width:'100%',maxHeight:'85vh',overflowY:'auto',animation:'pop .28s cubic-bezier(.34,1.56,.64,1) both',boxShadow:dark?'0 20px 60px rgba(0,0,0,0.55)':'0 20px 60px rgba(140,60,220,0.15)'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
              <span style={{fontSize:14,fontWeight:900,color:dark?'#F2EAFF':'#2D1245',flex:1}}>Thống kê bài làm</span>
              <button onClick={()=>setShowStats(false)} style={{width:28,height:28,borderRadius:999,background:'rgba(128,100,180,0.12)',border:'none',color:dark?'#9B7FC0':'#8060A0',fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>&#10005;</button>
            </div>
            <div style={{textAlign:'center',marginBottom:16}}>
              <div style={{fontSize:40,fontWeight:900,color:rc,lineHeight:1,letterSpacing:-1}}>{fmtS(pct*10)}<span style={{fontSize:18,opacity:0.35,fontWeight:700}}>/10</span></div>
              <div style={{fontSize:12,color:dark?'#9B7FC0':'#8060A0',marginTop:3}}>{s} / {t} câu đúng</div>
              <div style={{height:7,background:'rgba(0,0,0,0.06)',borderRadius:99,margin:'12px 0 10px',overflow:'hidden'}}>
                <div style={{height:'100%',width:`${pct*100}%`,borderRadius:99,background:pct>=0.8?'linear-gradient(90deg,#10B981,#6EE7B7)':pct>=0.5?'linear-gradient(90deg,#F59E0B,#FCD34D)':'linear-gradient(90deg,#EF4444,#FCA5A5)',transition:'width .8s ease'}}/>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9,marginBottom:15}}>
              {[
                ['Streak tốt nhất',`${bestStreak} câu`,'#EEB800','#FEF9C3'],
                ['Trung bình/câu',`${Math.round(Object.values(answerTimes).reduce((a,b)=>a+b,0)/Math.max(Object.keys(answerTimes).length,1))}s`,'#B07CF0','#F3E8FF'],
              ].map(([l,v,col,bg])=>(
                <div key={l} style={{background:dark?'rgba(255,255,255,0.045)':bg+'55',border:`1px solid ${dark?'rgba(255,255,255,0.08)':col+'33'}`,borderRadius:14,padding:'12px 10px',textAlign:'center'}}>
                  <div style={{fontSize:9,color:dark?'#9B7FC0':'#8060A0',marginBottom:4,fontWeight:700,letterSpacing:.5}}>{l.toUpperCase()}</div>
                  <div style={{fontSize:18,fontWeight:900,color:col}}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{background:dark?'rgba(255,255,255,0.035)':'rgba(176,124,240,0.05)',borderRadius:16,padding:'11px 13px',marginBottom:15,maxHeight:190,overflowY:'auto'}}>
              <div style={{fontSize:9,fontWeight:900,color:dark?'#9B7FC0':'#8060A0',marginBottom:9,letterSpacing:.8}}>TỪNG CÂU</div>
              {questions.map((q2,qi)=>{
                const ok2=isAnswerCorrect(q2,answers[qi]);
                return(
                  <div key={qi} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:qi<questions.length-1?`1px solid ${dark?'rgba(255,255,255,0.04)':'rgba(176,124,240,0.07)'}`:  'none'}}>
                    <span style={{fontSize:12,color:dark?'#9B7FC0':'#8060A0',fontWeight:600}}>Câu {qi+1} <span style={{fontSize:9,opacity:.4}}>{q2.type==='true_false'?'DS':q2.type==='multiple'?'TN':q2.type==='multi_select'?'CN':'DT'}</span></span>
                    <div style={{display:'flex',gap:9,alignItems:'center'}}>
                      {answerTimes[qi]!=null&&<span style={{fontSize:10,color:dark?'#9B7FC0':'#A080B0'}}>{answerTimes[qi]}s</span>}
                      <span style={{fontSize:11,fontWeight:800,color:ok2?'#10B981':'#EF4444',background:ok2?'rgba(16,185,129,0.1)':'rgba(239,68,68,0.08)',padding:'2px 8px',borderRadius:999}}>{ok2?'Đúng':'Sai'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {bestStreak>=3&&<div style={{textAlign:'center',fontSize:12,color:'#C89700',fontWeight:800,marginBottom:11,background:'rgba(252,211,77,0.1)',borderRadius:10,padding:'6px'}}>Streak tốt nhất: {bestStreak} câu liên tiếp!</div>}
            <button onClick={resetQuiz} style={{width:'100%',padding:'12px',borderRadius:999,border:'none',background:'linear-gradient(135deg,#F472B6,#A855F7)',color:'#fff',fontSize:13,fontWeight:900,cursor:'pointer',boxShadow:'0 4px 18px rgba(168,85,247,0.35)'}}>Làm lại</button>
          </div>
        </div>
      )}

      {/* Warn modal */}
      {warnModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(8,1,22,0.87)',backdropFilter:'blur(18px)',WebkitBackdropFilter:'blur(18px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10000,padding:20}}>
          <div style={{background:dark?'linear-gradient(160deg,#1A0640,#110228)':'linear-gradient(160deg,#FFF5E8,#FFF0F6)',border:'1.5px solid rgba(252,211,77,0.3)',borderRadius:26,padding:'28px 22px',maxWidth:300,width:'100%',textAlign:'center',animation:'pop .3s cubic-bezier(.34,1.56,.64,1) both',boxShadow:dark?'0 20px 60px rgba(0,0,0,0.5)':'0 20px 60px rgba(252,211,77,0.12)'}}>
            <div style={{width:56,height:56,borderRadius:999,background:'rgba(252,211,77,0.12)',border:'2px solid rgba(252,211,77,0.3)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px',fontSize:26}}>
              &#9888;
            </div>
            <div style={{fontSize:16,fontWeight:900,color:dark?'#FDE68A':'#C89700',marginBottom:8}}>Còn câu chưa làm!</div>
            <div style={{fontSize:13,color:dark?'#C0A0D8':'#806090',marginBottom:20,lineHeight:1.7}}>
              {warnModal.length===1?`Câu ${warnModal[0]} chưa trả lời.`:`${warnModal.length} câu chưa trả lời: câu ${warnModal.join(', ')}.`}
            </div>
            <div style={{display:'flex',gap:9}}>
              <button onClick={()=>{navTo(warnModal[0]-1);setWarnModal(null);}} style={{flex:1,padding:'11px 0',borderRadius:999,border:'1.5px solid rgba(255,150,200,0.28)',background:'transparent',color:dark?'#FBAFCE':'#E8547A',fontSize:13,fontWeight:800,cursor:'pointer',transition:'all .18s'}}>Xem lại</button>
              <button onClick={()=>{setWarnModal(null);doSubmit();}} style={{flex:1,padding:'11px 0',borderRadius:999,border:'none',background:'linear-gradient(135deg,#F472B6,#A855F7)',color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer',boxShadow:'0 4px 16px rgba(168,85,247,0.35)'}}>Nộp thôi!</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Score Dynamic Island Toast ── */}
      <ScoreIsland
        visible={modal}
        onClose={()=>setModal(false)}
        onReset={resetQuiz}
        pct={pct} s={s} t={t} rc={rc} dark={dark}
        questions={questions} answers={answers}
        bestStreak={bestStreak}
      />

      {/* ── Export bottom sheet ── */}
      {showExpSheet&&(
        <>
          <div onClick={()=>setShowExpSheet(false)} style={{position:'fixed',inset:0,background:'rgba(10,2,25,0.72)',zIndex:8800,backdropFilter:'blur(4px)',WebkitBackdropFilter:'blur(4px)'}}/>
          <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:760,zIndex:8801,borderRadius:'28px 28px 0 0',padding:'20px 20px 36px',background:'linear-gradient(160deg,#1E0845,#120330)',borderTop:'1.5px solid rgba(255,150,200,0.2)',boxShadow:'0 -12px 60px rgba(168,85,247,0.3)'}}>
            <div style={{width:36,height:4,borderRadius:99,background:'rgba(255,255,255,0.15)',margin:'0 auto 18px'}}/>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F472B6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span style={{fontSize:15,fontWeight:900,color:'#F0DCE8',flex:1}}>Tải bài về máy</span>
              <button onClick={()=>setShowExpSheet(false)} style={{background:'none',border:'none',cursor:'pointer',padding:4,color:'#8A6080',display:'flex'}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <p style={{fontSize:12,color:'#8A6080',marginBottom:16,lineHeight:1.6}}>File HTML hoạt động offline, không cần internet.</p>
            <div onClick={()=>setExpSel(s=>!s)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 13px',borderRadius:14,border:`1.5px solid ${expSel?'rgba(168,85,247,0.6)':'rgba(255,150,200,0.15)'}`,background:expSel?'rgba(168,85,247,0.1)':'rgba(255,255,255,0.04)',cursor:'pointer',marginBottom:16,transition:'all .15s'}}>
              <div style={{width:18,height:18,borderRadius:6,border:`1.5px solid ${expSel?'#A855F7':'rgba(255,255,255,0.2)'}`,background:expSel?'linear-gradient(135deg,#F472B6,#A855F7)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all .15s'}}>
                {expSel&&<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1.5 6 4.5 9 10.5 3"/></svg>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:800,color:'#F0DCE8',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{title||'Bài tập'}</div>
                <div style={{fontSize:11,color:'#8A6080',marginTop:2}}>{total} câu hỏi</div>
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>{
                if(!expSel){alert('Chọn bài nhé!');return;}
                if(typeof buildExportLiteHTML==='function'){
                  var html=buildExportLiteHTML([lesson]);
                  var blob=new Blob([html],{type:'text/html;charset=utf-8'});
                  var url=URL.createObjectURL(blob);
                  var a=document.createElement('a');
                  a.href=url;a.download=(title||'learnsy-quiz').replace(/[<>:"/\\|?*]/g,'').trim()+'.html';
                  document.body.appendChild(a);a.click();
                  setTimeout(function(){URL.revokeObjectURL(url);a.remove();},1000);
                  setShowExpSheet(false);
                }
              }} style={{flex:1,padding:'11px 0',borderRadius:999,border:'1.5px solid rgba(255,150,200,0.3)',background:'transparent',color:'#F9A8D4',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:'Nunito,sans-serif'}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:-2,marginRight:4}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Lite
              </button>
              <button onClick={()=>{
                if(!expSel){alert('Chọn bài nhé!');return;}
                if(typeof buildExportHTML==='function'){
                  var html=buildExportHTML([lesson]);
                  var blob=new Blob([html],{type:'text/html;charset=utf-8'});
                  var url=URL.createObjectURL(blob);
                  var a=document.createElement('a');
                  a.href=url;a.download=(title||'learnsy-quiz').replace(/[<>:"/\\|?*]/g,'').trim()+'.html';
                  document.body.appendChild(a);a.click();
                  setTimeout(function(){URL.revokeObjectURL(url);a.remove();},1000);
                  setShowExpSheet(false);
                }
              }} style={{flex:1,padding:'11px 0',borderRadius:999,border:'none',background:'linear-gradient(135deg,#F472B6,#A855F7)',color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:'Nunito,sans-serif',boxShadow:'0 4px 18px rgba(168,85,247,0.35)'}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:-2,marginRight:4}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Full (âm thanh)
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

window.QuizPlayer=QuizPlayer;
})();
console.log('[quiz-player] ✓ loaded');
