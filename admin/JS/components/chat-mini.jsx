import React, {useRef,useEffect} from 'react';

(function(){
/* ══ CHAT MINI ════════════════════════════════════════════════════════ */

function ChatMini({open,onToggle,msgs,input,setInput,onSend,onClear,loading,dark}){
  const endRef=useRef();
  useEffect(()=>{if(open&&endRef.current)endRef.current.scrollIntoView({behavior:'smooth'});},[msgs,open]);
  const C2=dark?(window.CD||{border2:'#34104E',text3:'#8A6080',text4:'#503040',lavPale:'#200C35',lav:'#C084FC',text:'#F0DCE8',bg:'#180A10',border:'#421526'}):(window.CL||{border2:'#E8DCFF',text3:'#A07090',text4:'#C8A0B8',lavPale:'#FAF5FF',lav:'#A855F7',text:'#3D1830',bg:'#FFF5F9',border:'#F5D5E8'});
  return(<>
    {/* Floating button */}
    <button onClick={onToggle}
      style={{position:'fixed',bottom:24,right:18,width:52,height:52,borderRadius:'50%',border:'none',
        background:'linear-gradient(135deg,#F472B6,#A855F7,#6366F1)',color:'#fff',
        boxShadow:'0 6px 24px rgba(168,85,247,0.45)',cursor:'pointer',zIndex:300,
        display:'flex',alignItems:'center',justifyContent:'center',transition:'transform .2s',
        transform:open?'scale(0.9)':'scale(1)'}}>
      {open
        ?<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        :<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      }
      {!open&&msgs.length>0&&<span style={{position:'absolute',top:4,right:4,width:10,height:10,borderRadius:'50%',background:'#F472B6',border:'2px solid #fff'}}/>}
    </button>

    {/* Chat panel */}
    {open&&(
      <div style={{position:'fixed',bottom:86,right:14,width:'min(360px,calc(100vw - 28px))',
        background:dark?'#1E0D15':'#fff',borderRadius:20,
        boxShadow:'0 12px 48px rgba(168,85,247,0.3)',zIndex:299,
        border:`1.5px solid ${C2.border2}`,display:'flex',flexDirection:'column',overflow:'hidden',
        maxHeight:'70vh',animation:'slideIn .22s ease both'}}>
        {/* Header */}
        <div style={{padding:'12px 14px',background:'linear-gradient(135deg,#F472B6,#A855F7)',display:'flex',alignItems:'center',gap:8}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/></svg>
          <span style={{fontSize:14,fontWeight:900,color:'#fff',flex:1}}>Trợ lý AI</span>
          {msgs.length>0&&(
            <button onClick={onClear} style={{fontSize:10,fontWeight:800,color:'rgba(255,255,255,0.75)',background:'rgba(255,255,255,0.15)',border:'none',borderRadius:99,padding:'3px 8px',cursor:'pointer'}}>Xoá lịch sử</button>
          )}
        </div>
        {/* Messages */}
        <div style={{flex:1,overflowY:'auto',padding:'12px 10px',display:'flex',flexDirection:'column',gap:8,minHeight:120}}>
          {msgs.length===0&&(
            <div style={{textAlign:'center',padding:'20px 12px',color:C2.text3,fontSize:12}}>
              <div style={{fontSize:26,marginBottom:6}}>✦</div>
              <div style={{fontWeight:700}}>Hỏi AI về bộ đề đang soạn!</div>
              <div style={{marginTop:4,lineHeight:1.6,color:C2.text4,fontSize:11}}>Ví dụ: "Soạn thêm 3 câu hỏi về chủ đề này" hoặc "Giải thích đáp án câu 2"</div>
            </div>
          )}
          {msgs.map((m,i)=>(
            <div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}>
              <div style={{
                maxWidth:'85%',padding:'9px 12px',borderRadius:m.role==='user'?'16px 16px 4px 16px':'16px 16px 16px 4px',
                background:m.role==='user'?'linear-gradient(135deg,#F472B6,#A855F7)':dark?'rgba(255,255,255,0.06)':C2.lavPale,
                color:m.role==='user'?'#fff':C2.text,
                fontSize:13,fontWeight:600,lineHeight:1.5,
                border:m.role==='user'?'none':`1px solid ${C2.border2}`,
                whiteSpace:'pre-wrap',wordBreak:'break-word',
              }}>{m.content}</div>
            </div>
          ))}
          {loading&&(
            <div style={{display:'flex',justifyContent:'flex-start'}}>
              <div style={{padding:'9px 14px',borderRadius:'16px 16px 16px 4px',background:dark?'rgba(255,255,255,0.06)':C2.lavPale,border:`1px solid ${C2.border2}`,display:'flex',gap:4,alignItems:'center'}}>
                {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:'50%',background:C2.lav,animation:`pulse 1.2s ${i*0.2}s ease-in-out infinite`}}/>)}
              </div>
            </div>
          )}
          <div ref={endRef}/>
        </div>
        {/* Input */}
        <div style={{padding:'10px',borderTop:`1.5px solid ${C2.border}`,display:'flex',gap:7,alignItems:'flex-end'}}>
          <textarea value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();onSend(input);}}}
            placeholder="Nhập tin nhắn... (Enter gửi)"
            style={{flex:1,resize:'none',border:`1.5px solid ${C2.border2}`,borderRadius:12,padding:'8px 10px',
              fontSize:13,fontWeight:600,fontFamily:'Nunito,sans-serif',color:C2.text,background:C2.bg,
              outline:'none',lineHeight:1.5,maxHeight:80,overflowY:'auto'}}
            rows={1}/>
          <button onClick={()=>onSend(input)} disabled={!input.trim()||loading}
            style={{width:36,height:36,borderRadius:999,border:'none',flexShrink:0,
              background:!input.trim()||loading?'rgba(168,85,247,0.25)':'linear-gradient(135deg,#F472B6,#A855F7)',
              color:'#fff',cursor:!input.trim()||loading?'default':'pointer',
              display:'flex',alignItems:'center',justifyContent:'center',transition:'all .15s'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    )}
  </>);
}

window.ChatMini=ChatMini;
console.log('[chat-mini] ✓ loaded');
})();
