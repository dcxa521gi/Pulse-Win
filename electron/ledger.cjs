const fs=require('node:fs');const path=require('node:path');const readline=require('node:readline');const os=require('node:os');
async function list(root,limit=600){let result=[];async function visit(dir,depth){if(depth>7||result.length>=limit)return;let entries;try{entries=await fs.promises.readdir(dir,{withFileTypes:true});}catch{return;}for(const e of entries){if(result.length>=limit)break;const f=path.join(dir,e.name);if(e.isDirectory())await visit(f,depth+1);else if(e.isFile()&&e.name.endsWith('.jsonl'))result.push(f);}}await visit(root,0);return result;}
async function scan({codexPath,claudePath,days=7}){
 const cutoff=Date.now()-days*86400000;const rows=new Map();let filesRead=0,skipped=0;const seen=new Set();
 const add=(agent,model,time,input,output,cached)=>{const stamp=Date.parse(time);if(!Number.isFinite(stamp)||stamp<cutoff)return;const day=new Date(stamp).toLocaleDateString('en-CA');input=Math.max(0,Number(input)||0);output=Math.max(0,Number(output)||0);cached=Math.max(0,Number(cached)||0);const key=[day,agent,model].join('|');const row=rows.get(key)||{day,agent,model,input:0,output:0,cached:0};row.input+=input;row.output+=output;row.cached+=cached;rows.set(key,row);};
 for(const [agent,root] of [['Codex',path.join(codexPath||process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),'sessions')],['Claude Code',path.join(claudePath||process.env.CLAUDE_CONFIG_DIR||path.join(os.homedir(),'.claude'),'projects')]]){
  const files=await list(root);if(files.length>=600)skipped++;
  for(const file of files){let stat;try{stat=await fs.promises.stat(file);}catch{continue;}if(stat.mtimeMs<cutoff)continue;if(stat.size>50*1024*1024){skipped++;continue;}filesRead++;let model='Unknown model',previous={input_tokens:0,output_tokens:0,cached_input_tokens:0};
   const lines=readline.createInterface({input:fs.createReadStream(file),crlfDelay:Infinity});
   try{for await(const line of lines){if(line.length>4*1024*1024){skipped++;continue;}let r;try{r=JSON.parse(line);}catch{continue;}
    if(agent==='Codex'){
     if(r.type==='turn_context')model=r.payload?.model||model;
     if(r.type!=='event_msg'||r.payload?.type!=='token_count')continue;const info=r.payload.info;const t=info?.total_token_usage;if(!t)continue;
     const curr={input_tokens:Number(t.input_tokens)||0,output_tokens:Number(t.output_tokens)||0,cached_input_tokens:Number(t.cached_input_tokens)||0};
     const reset=curr.input_tokens<previous.input_tokens||curr.output_tokens<previous.output_tokens;const base=reset?{input_tokens:0,output_tokens:0,cached_input_tokens:0}:previous;
     add(agent,model,r.timestamp,curr.input_tokens-base.input_tokens,curr.output_tokens-base.output_tokens,curr.cached_input_tokens-base.cached_input_tokens);previous=curr;
    }else if(r.type==='assistant'&&r.message?.usage){const id=r.message.id||r.uuid;if(id&&seen.has(id))continue;if(id)seen.add(id);const u=r.message.usage;add(agent,r.message.model||model,r.timestamp,(u.input_tokens||0)+(u.cache_read_input_tokens||0)+(u.cache_creation_input_tokens||0),u.output_tokens,u.cache_read_input_tokens);}
   }}catch{skipped++;}finally{lines.close();}
  }
 }
 return {rows:[...rows.values()].sort((a,b)=>a.day.localeCompare(b.day)),filesRead,skipped,scannedAt:new Date().toISOString(),sources:['Codex','Claude Code']};
}
if(!require('node:worker_threads').isMainThread){const {parentPort,workerData}=require('node:worker_threads');scan(workerData).then(r=>parentPort.postMessage(r)).catch(()=>parentPort.postMessage({rows:[],filesRead:0,skipped:1,error:true}));}
module.exports={scan};
