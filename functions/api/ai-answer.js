/**
 * Cloudflare Pages Function — /api/ai-answer
 * Binding cần tạo trong Pages dashboard:
 *   Workers AI → Variable name: "AI"
 *
 * POST /api/ai-answer  { type, question, options, passage, items, subject }
 * → trả về tuỳ loại câu:
 *   multiple:    { correct: 0 }            (index 0-3)
 *   multi_select: { correct: [0, 2] }       (mảng index)
 *   fill_blank:  { answer: "Nam Hán" }
 *   true_false:  { items: [true, false, true, true] }
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequest(ctx) {
  const { request, env } = ctx;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS });
  }

  if (!env.AI) {
    return new Response('AI not bound', { status: 503, headers: CORS });
  }

  try {
    const { type, question = '', options = [], passage = '', items = [], subject = '' } = await request.json();

    let prompt = '';

    if (type === 'multiple') {
      const optList = options.map((o, i) => `${['A','B','C','D'][i]}. ${o}`).join('\n');
      prompt = `Môn: ${subject}
Câu hỏi trắc nghiệm (1 đáp án đúng):
${question}
${optList}

Trả lời ONLY JSON, không giải thích:
{ "correct": <số thứ tự 0-based của đáp án đúng> }`;

    } else if (type === 'multi_select') {
      const optList = options.map((o, i) => `${['A','B','C','D','E','F'][i]}. ${o}`).join('\n');
      prompt = `Môn: ${subject}
Câu hỏi trắc nghiệm (có thể nhiều đáp án đúng):
${question}
${optList}

Trả lời ONLY JSON, không giải thích:
{ "correct": [<mảng index 0-based của các đáp án đúng>] }`;

    } else if (type === 'fill_blank') {
      prompt = `Môn: ${subject}
Câu điền chỗ trống (dấu ___ là chỗ trống):
${question}

Hãy điền từ/cụm từ chính xác vào chỗ trống.
Trả lời ONLY JSON, không giải thích:
{ "answer": "<đáp án điền vào chỗ trống>" }`;

    } else if (type === 'true_false') {
      const itemList = items.map((it, i) => `${String.fromCharCode(97+i)}. ${it}`).join('\n');
      prompt = `Môn: ${subject}
Đoạn tư liệu:
${passage}

Các ý cần xác định đúng (true) hay sai (false):
${itemList}

Trả lời ONLY JSON, không giải thích, mảng theo đúng thứ tự các ý:
{ "items": [true/false, ...] }`;
    }

    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 256,
    });

    const text = response.response || '';

    // Extract JSON object từ response
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');

    const result = JSON.parse(match[0]);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
}
