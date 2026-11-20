const {chromium}=require('C:/Users/Achintha/node_modules/playwright-core');
const base=process.argv[2]||'http://localhost:3002';const routes=(process.argv[3]||'/login,/admin,/label,/pos').split(',');
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const ctx=await b.newContext({viewport:{width:1366,height:768}});
// UI-test-mode session cookie (local only, no backend).
const out=[];
for(const r of routes){const p=await ctx.newPage();const logs=[],failed=[];
 p.on('console',m=>{if(['error','warning'].includes(m.type()))logs.push(m.type()+': '+m.text().slice(0,300))});
 p.on('pageerror',e=>logs.push('pageerror: '+e.message.slice(0,300)));
 p.on('requestfailed',q=>failed.push(q.url().slice(0,150)+' '+(q.failure()||{}).errorText));
 p.on('response',s=>{if(s.status()>=400)failed.push(s.status()+' '+s.url().slice(0,150))});
 const t0=Date.now();
 try{await p.goto(base+r,{waitUntil:'load',timeout:60000});}catch(e){logs.push('goto: '+e.message.slice(0,200))}
 await p.waitForTimeout(6000);
 const info=await p.evaluate(()=>{const els=[...document.querySelectorAll('button,select,a,input')];const hyd=els.filter(e=>Object.keys(e).some(k=>k.startsWith('__reactProps')||k.startsWith('__reactFiber')));
  return {url:location.pathname,title:document.title,controls:els.length,reactAttached:hyd.length,nextData:!!window.__next_f,scripts:document.scripts.length}});
 out.push({route:r,ms:Date.now()-t0,...info,errors:logs.slice(0,8),failed:failed.slice(0,8)});await p.close();}
console.log(JSON.stringify(out,null,1));await b.close();})().catch(e=>{console.error(e);process.exit(1)});
