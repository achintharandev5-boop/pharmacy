const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),os=require('node:os');
const baseline=JSON.parse(fs.readFileSync('docs/ui-modernization/source-baseline.json'));
const changed=[];let protectedCount=0,sinhalaCount=0;const missingPreimages=[];
for(const [p,hash] of Object.entries(baseline)){
 const buf=fs.readFileSync(p),current=crypto.createHash('sha256').update(buf).digest('hex');
 const protectedPath=p.startsWith('apps/api/')||/^apps\/web\/(lib|store|constants|app\/actions)\//.test(p)||p==='apps/web/components/PrintableLabel.tsx'||p==='apps/web/proxy.ts';
 if(protectedPath){assert.equal(current,hash,'Protected behaviour source changed: '+p);protectedCount++;}
 if(current!==hash){changed.push(p);const preimage=path.join(os.tmpdir(),'pharmacy-ui-modernization-before-20261031',p);if(!fs.existsSync(preimage)){missingPreimages.push(p);continue;}const original=fs.readFileSync(preimage,'utf8');const sinhala=s=>s.match(/[\u0D80-\u0DFF]+/g)||[];assert.deepEqual(sinhala(buf.toString('utf8')),sinhala(original),'Sinhala wording changed: '+p);sinhalaCount++;}
}
fs.writeFileSync('docs/ui-modernization/session-modified-files.json',JSON.stringify(changed,null,2));
console.log(JSON.stringify({protectedFilesUnchanged:protectedCount,modifiedFiles:changed.length,sinhalaComparisons:sinhalaCount,missingPreimages}));
