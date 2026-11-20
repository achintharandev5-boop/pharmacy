const {chromium}=require('C:/Users/Achintha/node_modules/playwright-core');
const base=process.argv[2],route=process.argv[3]||'/admin',secs=+(process.argv[4]||150);
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const ctx=await b.newContext();await ctx.addCookies([{name:'pharmacy-ui-test',value:'local-ui-only-v1',url:base}]);
const p=await ctx.newPage();const t0=Date.now();const posts=[];
p.on('request',q=>{if(q.method()==='POST')posts.push(((Date.now()-t0)/1000)|0)});
await p.goto(base+route,{waitUntil:'load',timeout:120000});
for(let i=0;i<secs;i+=10){await p.waitForTimeout(10000);}
console.log(JSON.stringify({route,posts:posts.length,lastAt:posts.at(-1),firstAt:posts[0]}));await b.close();})().catch(e=>{console.error(e);process.exit(1)});
