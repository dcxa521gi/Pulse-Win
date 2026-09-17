// Adapted from qunqin24/Pulse (Apache-2.0), upstream 442a9c5.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const catalog = [
 ['claude','Claude Code','claude','oauth'],['codex','Codex','openai','oauth'],
 ['antigravity','Antigravity','antigravity','local'],['cursor','Cursor','cursor','cookie'],
 ['copilot','GitHub Copilot','github','token'],['grok','Grok','grok','token'],
 ['grokbot','Grok Bot','xai','cookie'],['opencode','OpenCode Go','opencode','key'],
 ['kimi','Kimi Code','kimi','key'],['ollama','Ollama Cloud','ollama','cookie'],
 ['zai','z.ai','zai','key'],['zhipu','Zhipu','qingyan','key'],
 ['minimax','MiniMax','minimax','key'],['minimaxcn','MiniMax CN','minimax','key'],
 ['volcengine','Volcengine','volcengine','local'],['command','Command Code','commandcode','key'],
 ['deepseek','DeepSeek','deepseek','key'],['devin','Devin','devin','cookie']
].map(([id,name,icon,auth])=>({id,name,icon,auth}));
const num = x => x === null || x === undefined || x === '' || typeof x === 'boolean' ? null : Number.isFinite(Number(x)) ? Number(x) : null;
const clamp = n => Math.max(0,Math.min(100,n));
const date = x => { if(!x) return null; const n=num(x); const t=n===null?Date.parse(x):n<1e12?n*1000:n; return Number.isFinite(t)?new Date(t).toISOString():null; };
const label = s => s===18000?'5-hour limit':s===604800?'Weekly limit':s>=2419200?'Monthly limit':s?`${Math.round(s/3600)}-hour limit`:'Usage limit';
function window(id,percent,reset,seconds=0,name){ const n=num(percent); return n===null?null:{id,label:name||label(seconds),used:clamp(n),resetsAt:date(reset),seconds,exhausted:false}; }
function parse(provider,r){
 let windows=[],plan=null,balance=null;
 if(provider==='codex'){
  plan=r.plan_type;
  const groups=[['account',null,r.rate_limit],...(r.additional_rate_limits||[]).map((g,i)=>[g.metered_feature||`extra${i}`,g.limit_name,g.rate_limit])];
  for(const [id,name,g] of groups){if(!g)continue;const rows=['primary_window','secondary_window'].map(k=>{const w=g[k];return w?window(`${id}.${k}`,w.used_percent,w.reset_at,w.limit_window_seconds,name?`${label(w.limit_window_seconds)} · ${name}`:null):null;}).filter(Boolean);if(rows.length&&(g.limit_reached===true||g.allowed===false||r.spend_control?.reached===true)){rows.reduce((a,b)=>a.used>b.used?a:b).exhausted=true;}windows.push(...rows);}
  balance=r.credits?.unlimited?null:r.credits?.balance;
 }else if(provider==='claude'){
  for(const [key,val] of Object.entries(r)){if(!val||typeof val!=='object'||num(val.utilization)===null)continue;const seconds=key==='five_hour'?18000:604800;windows.push(window(key,val.utilization,val.resets_at,seconds,key==='five_hour'?'5-hour limit':key==='seven_day'?'Weekly limit':`Weekly · ${key.replace('seven_day_','')}`));}
 }else if(provider==='kimi'){
  plan=r.user?.membership?.level;const list=[...(r.limits||[]).map((w,i)=>({id:`limit${i}`,d:w.detail,s:(num(w.window?.duration)||0)*({TIME_UNIT_MINUTE:60,TIME_UNIT_HOUR:3600,TIME_UNIT_DAY:86400,MINUTE:60,HOUR:3600,DAY:86400}[w.window?.timeUnit]||60)})),{id:'weekly',d:r.usage,s:604800}];
  for(const {id,d,s} of list){const total=num(d?.limit);const used=num(d?.used)??(total!==null&&num(d?.remaining)!==null?total-num(d.remaining):null);if(total>0&&used!==null)windows.push(window(id,used/total*100,d.resetTime,s));}
 }else if(provider==='opencode'){
  for(const [k,s] of [['rolling',18000],['weekly',604800],['monthly',2592000]]){const d=r.usage?.[k];const w=window(k,d?.percent,d?.resetsAt,s);if(w){w.exhausted=d.status&&d.status.toLowerCase()!=='ok';windows.push(w);}}
 }else if(provider==='zai'||provider==='zhipu'){
  if(r.success===false||(r.code!==undefined&&Number(r.code)!==200))throw new Error('Service rejected the request');
  for(const [i,d] of (r.data?.limits||[]).entries()){if(!['TOKENS_LIMIT','CREDIT_LIMIT','TIME_LIMIT'].includes(d.type))continue;const unit={1:86400,3:3600,5:60,6:604800}[d.unit];if(!unit)continue;const s=d.type==='TIME_LIMIT'&&d.unit===5&&d.number===1?2592000:unit*d.number;let p=num(d.percentage);const total=num(d.usage);if(total>0){const used=num(d.currentValue),remaining=num(d.remaining);if(used!==null||remaining!==null)p=Math.max(used??0,remaining!==null?total-remaining:0)/total*100;}windows.push(window(`limit${i}`,p,d.nextResetTime,s,d.type==='TIME_LIMIT'?`${label(s)} · MCP`:null));}
 }else if(provider==='deepseek'){
  const balances=(r.balance_infos||[]).filter(b=>num(b.total_balance)!==null);if(!balances.length)throw new Error('No balance reported');balance=balances.map(b=>`${b.currency} ${b.total_balance}`).join(' / ');
 }else if(provider==='cursor'){
  plan=r.membershipType;const p=r.individualUsage?.plan??r.teamUsage?.pooled;const reset=r.billingCycleEnd;
  windows=[window('cursor',p?.autoPercentUsed,reset,2592000,'Monthly limit · Cursor Models'),window('other',p?.apiPercentUsed,reset,2592000,'Monthly limit · Other Models')].filter(Boolean);
  if(!windows.length&&num(p?.limit)>0&&num(p?.used)!==null)windows.push(window('plan',p.used/p.limit*100,reset,2592000));
  const o=r.individualUsage?.onDemand??r.teamUsage?.onDemand;if(o?.enabled&&num(o.limit)>0&&num(o.used)!==null)windows.push(window('ondemand',o.used/o.limit*100,reset,0,'On-demand spending'));
 }else if(provider==='copilot'){
  plan=r.copilot_plan;for(const [id,d] of Object.entries(r.quota_snapshots||{})){if(d.unlimited)continue;let p=num(d.percent_remaining);if(p!==null)p=100-p;else if(num(d.entitlement)>0&&num(d.remaining)!==null)p=(1-d.remaining/d.entitlement)*100;windows.push(window(id,p,r.quota_reset_date||r.quota_reset_date_utc,2592000,id==='premium_interactions'?'Premium requests':id));}
 }else if(provider==='grok'){
  const c=r.config||{},start=date(c.currentPeriod?.start||c.billingPeriodStart),end=date(c.currentPeriod?.end||c.billingPeriodEnd);if(start&&end&&Date.parse(end)>Date.parse(start)){const seconds=(Date.parse(end)-Date.parse(start))/1000;const current=Date.now()>=Date.parse(start)&&Date.now()<=Date.parse(end);windows.push(window('grok-pool',num(c.creditUsagePercent)??(current?0:null),end,seconds));}
 }else if(provider==='grokbot'){
  if(r.usesPooledEnterpriseAllowance!==true&&r.includedLimitZero!==true&&r.hasNonZeroIncludedLimit===true)windows.push(window('grok-bot',r.usagePercent,r.nextResetTimestampUtc,0,'Weekly limit'));
 }else if(provider==='command'){
  const c=r.credits;if(c){const values=['monthlyCredits','purchasedCredits','freeCredits'].map(k=>num(c[k])).filter(v=>v!==null);if(values.length)balance=`USD ${values.reduce((a,b)=>a+b,0).toFixed(2)}`;plan=c.planId;}
  if(r.windowLimits?.limited)for(const [key,seconds] of [['fiveHour',18000],['weekly',604800]]){const w=r.windowLimits[key];if(num(w?.cap)>0&&num(w?.used)!==null)windows.push(window(key,w.used/w.cap*100,w.resetAt,seconds));}
 }else if(provider==='devin'){
  if(r.has_quota_allocation===true&&r.is_quota_plan!==false){if(r.hide_daily_quota!==true)windows.push(window('daily',r.daily_percentage,r.daily_reset_at,86400,'Daily limit'));windows.push(window('weekly',r.weekly_percentage,r.weekly_reset_at,604800));}
  if(num(r.overage_balance)!==null)balance=`USD ${Number(r.overage_balance).toFixed(2)}`;plan=r.plan_name;
 }else if(provider==='antigravity'){
  for(const [i,g] of (r.response?.groups||r.groups||[]).entries())for(const [j,b] of (g.buckets||[]).entries()){const remaining=num(b.remainingFraction);if(remaining===null)continue;const seconds=b.window==='weekly'?604800:b.window==='5h'?18000:0;windows.push(window(`${i}.${b.bucketId||j}`,(1-remaining)*100,b.resetTime,seconds,`${label(seconds)} · ${g.displayName||'Models'}`));}
 }else if(provider==='volcengine'){
  for(const item of r.items||[]){if(!item.subscribed||item.error||!['coding-plan','agent-plan','coding-plan-team','agent-plan-team'].includes(item.product))continue;for(const p of item.periods||[])windows.push(window(`${item.product}.${p.label}`,p.percent,p.reset_at,{weekly:604800,'5h':18000,monthly:2592000}[p.label]||0,`${p.label} · ${item.product}`));}
 }else if(provider==='ollama'){
  const $=require('cheerio').load(r);if($('form[action*="signin"],form[action*="login"]').length)throw Error('Login expired or credential rejected');
  for(const [key,title] of [['session','Session usage'],['weekly','Weekly usage']]){const labels=$('*').filter((_,el)=>$(el).children().length===0&&$(el).text().trim()===title);if(labels.length!==1)throw Error('No readable quota reported');let node=labels.parent(),found=null;while(node.length){const other=key==='session'?'Weekly usage':'Session usage';if(node.text().includes(other))break;const values=[];node.find('*').addBack().contents().each((_,el)=>{if(el.type==='text'){const m=el.data.match(/^\s*([0-9]+(?:\.[0-9]+)?)\s*%\s*used\s*$/i);if(m)values.push(Number(m[1]));}});if(values.length===1&&values[0]>=0&&values[0]<=100){const stamps=node.find('[data-time]');if(stamps.length<=1)found=window(key,values[0],stamps.attr('data-time'),0,title);}if(node.attr('data-usage-meter')!==undefined)break;node=node.parent();}if(!found)throw Error('No readable quota reported');windows.push(found);}
 }else if(provider==='minimax'||provider==='minimaxcn'){
  if(Number(r.base_resp?.status_code||0)!==0)throw new Error('Service rejected the request');const p=r.data||r;plan=p.current_subscribe_title||p.plan_name;
  for(const [i,d] of (p.model_remains||[]).entries())for(const [k,nominal] of [['interval',18000],['weekly',604800]]){const total=num(d[`current_${k}_total_count`]),rem=num(d[`current_${k}_remaining_percent`]),left=num(d[`current_${k}_usage_count`]);if(Number(d[`current_${k}_status`])===3&&!(total>0)&&(rem??0)>=100)continue;const percent=rem!==null?100-rem:total>0&&left!==null?(total-left)/total*100:null;const s=k==='interval'&&num(d.end_time)!==null&&num(d.start_time)!==null?(Number(d.end_time)-Number(d.start_time))/1000:nominal;const w=window(`${i}.${k}`,percent,d[k==='weekly'?'weekly_end_time':'end_time'],s,`${label(s)}${d.model_name&&d.model_name!=='general'?' · '+d.model_name:''}`);if(w)windows.push(w);}
 }
 windows=windows.filter(Boolean);if(!windows.length&&balance==null)throw new Error('No readable quota reported');
 return {windows,plan:typeof plan==='string'?plan:null,balance:balance==null?null:String(balance),status:'live',observedAt:new Date().toISOString()};
}
function readJson(file){try{if(fs.statSync(file).size>2*1024*1024)return null;return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}}
function credentials(account,secret){
 if(secret)return {token:secret,source:'Saved credential'};
 if(account.id!==account.provider&&!account.dataPath)return null;
 const home=os.homedir();
 if(account.provider==='codex'){
  const r=readJson(path.join(account.dataPath||process.env.CODEX_HOME||path.join(home,'.codex'),'auth.json'));
  if(r?.tokens?.access_token)return {token:r.tokens.access_token,accountId:r.tokens.account_id,source:'Codex local login'};
 }else if(account.provider==='claude'){
  const r=readJson(path.join(account.dataPath||process.env.CLAUDE_CONFIG_DIR||path.join(home,'.claude'),'.credentials.json'));
  if(r?.claudeAiOauth?.accessToken)return {token:r.claudeAiOauth.accessToken,source:'Claude Code local login'};
 }else if(account.provider==='grok'){
  const r=readJson(path.join(home,'.grok','auth.json'));const entries=Object.values(r||{}).filter(e=>e?.key&&(!e.expires_at||Date.parse(e.expires_at)>Date.now())).sort((a,b)=>(Date.parse(b.expires_at)||0)-(Date.parse(a.expires_at)||0));if(entries[0])return{token:entries[0].key,source:'Grok local login'};
 }else if(account.provider==='command'){
  const r=readJson(path.join(home,'.commandcode','auth.json'));if(r?.apiKey)return{token:r.apiKey,source:'Command Code local login'};
 }else if(account.provider==='opencode'){
  const r=readJson(path.join(home,'.local','share','opencode','auth.json'));
  if(r?.['opencode-go']?.key)return {token:r['opencode-go'].key,source:'OpenCode local login'};
 }
 return null;
}
async function fetchUsage(account,secret,fetcher){
 if(['antigravity','volcengine'].includes(account.provider)){const result=await require('./local-clients.cjs').fetchLocal(account.provider);return{...parse(account.provider,result),source:account.provider==='antigravity'?'Local Antigravity language server':'arkcli usage plan'};}
 const fallback=async()=>{const result=await require('./local-clients.cjs').codexLimits(account.dataPath);const groups=result.rateLimitsByLimitId||(result.rateLimits?{codex:result.rateLimits}:{});const entries=Object.entries(groups);const normalized={plan_type:entries[0]?.[1]?.planType,additional_rate_limits:entries.map(([key,g])=>({metered_feature:key,limit_name:g.limitName,rate_limit:{allowed:result.ordinaryUsageAllowed,limit_reached:g.spendControlReached||g.rateLimitReachedType!=null,primary_window:g.primary?{used_percent:g.primary.usedPercent,reset_at:g.primary.resetsAt,limit_window_seconds:g.primary.windowDurationMins*60}:null,secondary_window:g.secondary?{used_percent:g.secondary.usedPercent,reset_at:g.secondary.resetsAt,limit_window_seconds:g.secondary.windowDurationMins*60}:null}}))};return {...parse('codex',normalized),source:'Codex app-server'};};
 const c=credentials(account,secret);if(!c){if(account.provider==='codex'&&!secret&&account.id==='codex')return fallback();throw new Error('Sign in or configure a credential in Settings');}
 const urls={codex:'https://chatgpt.com/backend-api/wham/usage',claude:'https://api.anthropic.com/api/oauth/usage',kimi:'https://api.kimi.com/coding/v1/usages',opencode:'https://opencode.ai/zen/go/v1/usage',zai:'https://api.z.ai/api/monitor/usage/quota/limit',zhipu:'https://open.bigmodel.cn/api/monitor/usage/quota/limit',deepseek:'https://api.deepseek.com/user/balance',cursor:'https://cursor.com/api/usage-summary',copilot:'https://api.github.com/copilot_internal/user',minimax:'https://api.minimax.io/v1/token_plan/remains',minimaxcn:'https://api.minimaxi.com/v1/token_plan/remains'};
 Object.assign(urls,{grok:'https://cli-chat-proxy.grok.com/v1/billing?format=credits',grokbot:'https://cursor.com/api/dashboard/get-sand-usage-status',command:'https://api.commandcode.ai/alpha/billing/credits',ollama:'https://ollama.com/settings'});
 const headers={Accept:'application/json',Authorization:`Bearer ${c.token}`};
 if(account.provider==='codex'&&c.accountId)headers['ChatGPT-Account-Id']=c.accountId;
 if(account.provider==='claude')headers['anthropic-beta']='oauth-2025-04-20';
 if(account.provider==='copilot'){headers.Authorization=`token ${c.token}`;headers['Editor-Version']='vscode/1.96.2';headers['User-Agent']='Pulse-Windows';}
 if(['cursor','grokbot'].includes(account.provider)){delete headers.Authorization;headers.Cookie=`WorkosCursorSessionToken=${c.token}`;}
 if(account.provider==='grok')headers['x-xai-token-auth']='xai-grok-cli';
 if(account.provider==='ollama'){delete headers.Authorization;const cookies=c.token.replace(/^cookie:\s*/i,'').split(';').map(x=>x.trim()).filter(x=>/^(wos-session|__Secure-session|__Secure-next-auth.session-token|next-auth.session-token)(\.\d+)?=[^;\r\n]+$/.test(x));if(!cookies.length)throw Error('Login expired or credential rejected');headers.Cookie=cookies.join('; ');headers.Accept='text/html';headers['Accept-Language']='en-US,en;q=0.9';}
 if(account.provider==='devin'){let v;try{v=JSON.parse(c.token);}catch{throw Error('Sign in or configure a credential in Settings');}if(!v.token||!v.org||!/^[-a-zA-Z0-9_]+$/.test(v.org))throw Error('Sign in or configure a credential in Settings');headers.Authorization=`Bearer ${v.token}`;urls.devin=`https://app.devin.ai/api/${encodeURIComponent(v.org)}/billing/quota/usage`;}
 if(!urls[account.provider])throw new Error('This Windows connector is not available in this release');
 const request=async url=>{const options={headers,signal:AbortSignal.timeout(20000),redirect:'error'};if(account.provider==='grokbot'){options.method='POST';options.body='{}';headers['Content-Type']='application/json';}const response=await fetcher(url,options);if(!response.ok)throw new Error(response.status===401||response.status===403?'Login expired or credential rejected':response.status===429?'Rate limited. Please retry later':`Service returned HTTP ${response.status}`);return account.provider==='ollama'?response.text():response.json();};
 if(account.provider==='command'){const who=await request('https://api.commandcode.ai/alpha/whoami?limits=1');if(who.org?.id)urls.command+='?orgId='+encodeURIComponent(who.org.id);}
 let result;
 try{result=parse(account.provider,await request(urls[account.provider]));}catch(e){if(account.provider==='codex'&&!secret&&account.id==='codex'&&e.message==='Login expired or credential rejected')return fallback();if(!['minimax','minimaxcn'].includes(account.provider))throw e;result=parse(account.provider,await request(urls[account.provider].replace('/v1/token_plan/remains','/v1/api/openplatform/coding_plan/remains')));}
 return {...result,source:c.source};
}
module.exports={catalog,parse,fetchUsage,num,window,credentials};
