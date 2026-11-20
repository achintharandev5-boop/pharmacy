const fs=require('node:fs'),assert=require('node:assert/strict');
const css=fs.readFileSync('apps/web/app/theme.css','utf8');
const tokens=s=>Object.fromEntries([...s.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(m=>[m[1],m[2].trim()]));
const light=tokens(css.split(":root[data-theme='dark']")[0]);
const dark={...light,...tokens(css.split(":root[data-theme='dark']")[1].split('html, body')[0])};
function resolve(v,t){while(v.startsWith('var('))v=t[v.slice(4,-1)];return v;}
function lum(hex){const rgb=hex.replace('#','').match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;}
let failed=0;const results=[];
for(const [mode,t]of Object.entries({light,dark})){
 const pairs=[...['fg','muted','subtle'].flatMap(f=>['page','surface','canvas'].map(b=>[f,b,4.5])),...['primary','success','warning','danger','info','accent'].map(f=>[f,f==='accent'?'surface':f+'-soft',4.5]),...['primary','success','danger'].map(f=>['on-'+f,f,4.5]),['input-border','input',3],['focus','page',3]];
 for(const [f,b,min]of pairs){const a=lum(resolve(t['--color-'+f],t)),z=lum(resolve(t['--color-'+b],t));const ratio=(Math.max(a,z)+0.05)/(Math.min(a,z)+0.05);results.push({mode,foreground:f,background:b,ratio:+ratio.toFixed(2),minimum:min,pass:ratio>=min});if(ratio<min)failed++;}
}
fs.writeFileSync('docs/ui-modernization/token-contrast.json',JSON.stringify(results,null,2));
console.log(JSON.stringify({checks:results.length,failed,failures:results.filter(r=>!r.pass)},null,2));assert.equal(failed,0,'Semantic colors must meet AA contrast');
