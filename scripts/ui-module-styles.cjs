const fs=require('node:fs'),crypto=require('node:crypto');
const baseline=JSON.parse(fs.readFileSync('docs/ui-modernization/source-baseline.json'));
const group=process.argv[2];
function inGroup(p){
 if(group==='label')return /^apps\/web\/(app\/label\/|components\/label\/)/.test(p)||/^apps\/web\/components\/(CustomerSearchInput|CustomerSearchPanel|ProductSearchInput|ProductInfoPopup|NumberPad|Stat.*Panel|ToggleButton|OABWorkflowPanel)\.tsx$/.test(p);
 if(group==='pos')return p.startsWith('apps/web/components/pos/');
 if(group==='management')return p==='apps/web/app/page.tsx'||p==='apps/web/app/login/LoginForm.tsx';
 return false;
}
const palette={ '#0f172a':'fg','#475569':'muted','#2563eb':'primary','#eff6ff':'primary-soft','#dbeafe':'primary-soft','#dce7f5':'border','#f1f5f9':'surface','#e2e8f0':'surface-2','#f8fafc':'surface','#059669':'success','#047857':'success','#065f46':'success','#10b981':'success','#fff1f2':'danger-soft','#ffe4e6':'danger-soft','#e11d48':'danger','#fecdd3':'danger-border','#fca5a5':'danger-soft','#fee2e2':'danger-soft'};
let changed=[];
for(const [p,hash]of Object.entries(baseline)){
 if(!inGroup(p)||!p.endsWith('.tsx')||p.includes('.test.')||p.includes('/print-check/'))continue;
 const original=fs.readFileSync(p,'utf8');if(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')!==hash)throw Error('Concurrent file change: '+p);
 let s=original.replace(/\b(bg|text|border)-\[(#[a-fA-F0-9]+)\]/g,(all,kind,hex)=>{const token=palette[hex.toLowerCase()];if(token)return kind+'-'+token;return kind+'-'+(kind==='text'?'muted':kind==='border'?'border':'surface');})
 .replace(/\bbg-white(?![\w-])/g,'bg-page').replace(/\btext-white(?![\w-])/g,'text-[var(--color-on-solid)]')
 .replace(/\b(bg|text|border)-(slate|gray)-(\d+)/g,(_,k,c,n)=>k+'-'+(k==='border'?'border':k==='bg'?Number(n)<=100?'surface':'surface-2':Number(n)>=800?'fg':Number(n)>=500?'muted':'subtle'))
 .replace(/\b(bg|text|border)-(green|emerald)-(\d+)/g,(_,k,c,n)=>k+'-'+(k==='border'?'success-border':k==='bg'&&Number(n)<=200?'success-soft':'success'))
 .replace(/\b(bg|text|border)-(red|rose)-(\d+)/g,(_,k,c,n)=>k+'-'+(k==='border'?'danger-border':k==='bg'&&Number(n)<=200?'danger-soft':'danger'))
 .replace(/\b(bg|text|border)-(amber|orange)-(\d+)/g,(_,k,c,n)=>k+'-'+(k==='border'?'warning-border':k==='bg'&&Number(n)<=200?'warning-soft':'warning'))
 .replace(/\bbg-black\/(?:40|50|60|70)/g,'bg-[var(--color-backdrop)]')
 .replaceAll('hover:bg-black/5','hover:bg-surface-2').replaceAll('active:bg-black/10','active:bg-surface-2')
 .replaceAll('ring-white/30','ring-[var(--color-on-solid)]/30').replaceAll('border-white/30','border-[var(--color-on-solid)]/30');
 if(p.endsWith('/DosagePanel.tsx'))s=s.replace(/fill="#[a-fA-F0-9]+"/g,'fill="var(--color-surface-2)"');
 if(p.endsWith('/BottomActionBar.tsx'))s=s.replace('shadow-[0_4px_12px_rgba(4,120,87,0.25)]','shadow-card');
 if(p.endsWith('/CustomerSearchPanel.tsx'))s=s.replaceAll('rounded-none','rounded-ui');
 if(s!==original){fs.writeFileSync(p,s);changed.push(p);}
}
fs.writeFileSync('docs/ui-modernization/'+group+'-files.json',JSON.stringify(changed,null,2));
console.log(JSON.stringify({group,changed}));
