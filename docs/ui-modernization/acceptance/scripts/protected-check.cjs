const fs=require('node:fs'),crypto=require('node:crypto');
const baseline=JSON.parse(fs.readFileSync('docs/ui-modernization/source-baseline.json'));
let prot=0,protChanged=[],missing=[],changedAny=0,total=0;
for(const [p,hash] of Object.entries(baseline)){total++;
 const isProt=p.startsWith('apps/api/')||/^apps\/web\/(lib|store|constants|app\/actions)\//.test(p)||p==='apps/web/components/PrintableLabel.tsx'||p==='apps/web/proxy.ts';
 if(!fs.existsSync(p)){ if(isProt){prot++;missing.push(p);} continue;}
 const cur=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
 if(cur!==hash) changedAny++;
 if(isProt){prot++; if(cur!==hash) protChanged.push(p);}
}
console.log(JSON.stringify({baselineEntries:total,protectedFiles:prot,protectedChanged:protChanged,protectedMissing:missing,anyBaselineFileChanged:changedAny},null,1));
