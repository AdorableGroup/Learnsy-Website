import React from 'react';

/* ══ LEARNSY PARSERS & FACTORIES ═════════════════════════════════════ */
(function(){
  const LETTERS=['A','B','C','D','E','F'];
  const stripHTML=s=>(s||'').replace(/<[^>]*>/g,'');

  /* ── Offline Text Parser ── */
  function parseText(raw){
    const results=[];
    const blocks=raw.split(/(?=Câu\s*\d+[\.\:])|(?=\n{2,})/g).map(s=>s.trim()).filter(s=>s.length>10);
    for(const block of blocks){
      const lines=block.split('\n').map(s=>s.trim()).filter(Boolean);
      if(!lines.length)continue;

      const hasABCD=lines.some(l=>/^[A-Da-d][\.\)]\s/.test(l)&&/^[A-D]/.test(l));
      const tfLines=lines.filter(l=>/^[a-d][\.\)]\s/.test(l));
      const hasTF=tfLines.length>=2;
      const hasFill=!hasTF&&!hasABCD&&(
        /___+/.test(block)||
        /^điền\s/i.test(lines[0])
      );

      if(hasTF){
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

  /* ── JSON Importer ── */
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

  /* ── Empty Factories ── */
  const emptyTF=()=>({id:Date.now()+Math.random(),type:'true_false',passage:'',source:'',items:[{text:'',answer:true},{text:'',answer:false},{text:'',answer:true},{text:'',answer:false}]});
  const emptyMC=()=>({id:Date.now()+Math.random(),type:'multiple',question:'',options:['','','',''],correct:0});
  const emptyMS=()=>({id:Date.now()+Math.random(),type:'multi_select',question:'',options:['','','',''],correct:[0]});
  const emptyFB=()=>({id:Date.now()+Math.random(),type:'fill_blank',question:'',answer:'',hint:''});
  const newQ=t=>t==='true_false'?emptyTF():t==='multiple'?emptyMC():t==='multi_select'?emptyMS():emptyFB();

  /* ── Exports ── */
  window.LETTERS=LETTERS;
  window.stripHTML=stripHTML;
  window.parseText=parseText;
  window.importJSON=importJSON;
  window.emptyTF=emptyTF;
  window.emptyMC=emptyMC;
  window.emptyMS=emptyMS;
  window.emptyFB=emptyFB;
  window.newQ=newQ;
})();