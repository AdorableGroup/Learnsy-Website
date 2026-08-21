/* functions/api/cache.js — Cloudflare Pages Function
   Proxy Upstash Redis REST API.
   Env vars cần có: UPSTASH_URL, UPSTASH_TOKEN
*/
export async function onRequestPost(ctx){
  try{
    const args=await ctx.request.json();
    if(!Array.isArray(args)||args.length===0){
      return new Response(JSON.stringify({result:null,error:'Invalid args'}),
        {status:400,headers:{'Content-Type':'application/json'}});
    }

    const url=ctx.env.UPSTASH_URL;
    const token=ctx.env.UPSTASH_TOKEN;

    if(!url||!token){
      return new Response(JSON.stringify({result:null,error:'Missing env vars'}),
        {status:500,headers:{'Content-Type':'application/json'}});
    }

    // Upstash REST: dùng JSON body thay vì URL path để tránh giới hạn URL length
    // (quan trọng khi SET value lớn như base64 ảnh)
    const res=await fetch(url,{
      method:'POST',
      headers:{
        Authorization:'Bearer '+token,
        'Content-Type':'application/json',
      },
      body:JSON.stringify(args),
    });

    const data=await res.json();
    return new Response(JSON.stringify({result:data.result??null}),{
      status:200,
      headers:{
        'Content-Type':'application/json',
        'Access-Control-Allow-Origin':'*',
      },
    });
  }catch(e){
    return new Response(JSON.stringify({result:null,error:e.message}),
      {status:500,headers:{'Content-Type':'application/json'}});
  }
}

export async function onRequestOptions(){
  return new Response(null,{
    status:204,
    headers:{
      'Access-Control-Allow-Origin':'*',
      'Access-Control-Allow-Methods':'POST,OPTIONS',
      'Access-Control-Allow-Headers':'Content-Type',
    },
  });
}
