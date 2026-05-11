const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODELS = [
  { model: 'gemini-2.0-flash', version: 'v1beta' },
  { model: 'gemini-1.5-flash', version: 'v1' },
];

app.use(cors());
app.use(express.json({ limit: '2mb' }));

function toHalfBand(s) {
  if (s == null || isNaN(s)) return null;
  return Math.round(Math.max(0, Math.min(9, Number(s))) * 2) / 2;
}
function countWords(t) { return (t.match(/\b[\w']+\b/g) || []).length; }
function countSentences(t) { return (t.replace(/\s+/g,' ').trim().match(/[^.!?]+[.!?]+/g)||[]).length||(t.trim()?1:0); }
function countParagraphs(t) { return t.split(/\n\s*\n/).filter(p=>p.trim().length).length||(t.trim()?1:0); }

function sanitizeJson(str) {
  let r='', inStr=false, esc=false;
  for(const ch of str){
    if(esc){r+=ch;esc=false;}
    else if(ch==='\\'){r+=ch;esc=true;}
    else if(ch==='"'){r+=ch;inStr=!inStr;}
    else if(inStr&&(ch==='\n'||ch==='\r'||ch==='\t')){r+=' ';}
    else{r+=ch;}
  }
  return r;
}

async function callGemini(prompt) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
  let lastErr;
  for (const {model, version} of MODELS) {
    const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.3,maxOutputTokens:2048}}),
      });
      if (resp.status===429||resp.status===503||resp.status===404) {
        const t=await resp.text();
        console.warn(`${model} -> ${resp.status}, trying next`);
        lastErr=new Error(`Gemini ${resp.status}: ${t.substring(0,200)}`);
        continue;
      }
      if (!resp.ok) { const t=await resp.text(); lastErr=new Error(`Gemini ${resp.status}: ${t.substring(0,200)}`); continue; }
      const data=await resp.json();
      const raw=data?.candidates?.[0]?.content?.parts?.[0]?.text||'';
      const stripped=raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```\s*$/i,'').trim();
      console.log('Success:', model);
      return sanitizeJson(stripped);
    } catch(e){lastErr=e; console.warn(model,'threw:',e.message);}
  }
  throw lastErr||new Error('All models failed');
}

function buildPrompt(task, topic, essay) {
  const label=task==='task1'?'IELTS Academic Writing Task 1':'IELTS Academic Writing Task 2';
  const key=task==='task1'?'taskAchievement':'taskResponse';
  return `You are an expert IELTS examiner. Evaluate the essay below. Reply ONLY with a valid JSON object, no markdown, no extra text.

Format: {"bandScores":{"${key}":7,"coherenceCohesion":6.5,"lexicalResource":6,"grammaticalRange":7,"overall":6.5},"feedback":["Point 1.","Point 2.","Point 3.","Point 4.","Point 5."]}

${topic?'Topic: '+topic+'\n\n':''}Essay: ${essay}`;
}

async function evaluateHandler(req, res) {
  try {
    const body=req.body||{};
    const task=String(body.task||body.taskType||'task2').toLowerCase()==='task1'?'task1':'task2';
    const essay=String(body.essay||'').replace(/\r/g,'\n').trim();
    const topic=String(body.topic||'').trim();
    if (!essay||essay.length<20) return res.status(400).json({error:'Essay text required (min 20 chars).'});
    if (!GEMINI_API_KEY) return res.status(500).json({error:'GEMINI_API_KEY not set.'});

    const rawJson=await callGemini(buildPrompt(task,topic,essay));
    let parsed;
    try { parsed=JSON.parse(rawJson); }
    catch(e) {
      console.error('Parse failed:',rawJson.substring(0,500));
      const m=rawJson.match(/\{[\s\S]*\}/);
      if(m){try{parsed=JSON.parse(sanitizeJson(m[0]));}catch(e2){console.error('regex parse failed:',e2.message);}}
      if(!parsed) return res.status(500).json({error:'Gemini returned invalid JSON',raw:rawJson.substring(0,300)});
    }

    const bandScores={};
    for(const[k,v]of Object.entries(parsed.bandScores||{})) bandScores[k]=toHalfBand(v);
    const feedback=(parsed.feedback||[]).filter(f=>typeof f==='string'&&f.trim().length>4);
    const counts={words:countWords(essay),sentences:countSentences(essay),paragraphs:countParagraphs(essay)};
    return res.json({task,bandScores,feedback,counts});
  } catch(err) {
    console.error('evaluate error:',err);
    return res.status(500).json({error:'Evaluation failed',message:err.message});
  }
}

app.post('/evaluate',evaluateHandler);
app.post('/api/evaluate',evaluateHandler);
app.get('/health',(_,res)=>res.json({ok:true,gemini:!!GEMINI_API_KEY}));
app.get('/api/health',(_,res)=>res.json({ok:true,gemini:!!GEMINI_API_KEY}));

const PORT=process.env.PORT||3001;
if(require.main===module) app.listen(PORT,()=>console.log(`BandCheck API on port ${PORT}`));
module.exports=app;
