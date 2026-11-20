const fs=require('fs'),path=require('path'),os=require('os');
const src=path.resolve('apps/web'),dest=path.join(os.tmpdir(),'pharmacy-ui-build-'+Date.now());
function copy(from,to){fs.mkdirSync(to,{recursive:true});for(const e of fs.readdirSync(from,{withFileTypes:true})){if(['node_modules','.next','.git','coverage'].includes(e.name)||e.name.startsWith('.env')||e.name.endsWith('.tsbuildinfo'))continue;const a=path.join(from,e.name),b=path.join(to,e.name);if(e.isDirectory())copy(a,b);else fs.writeFileSync(b,fs.readFileSync(a));}}
copy(src,dest);fs.symlinkSync(path.join(src,'node_modules'),path.join(dest,'node_modules'),'junction');fs.writeFileSync('docs/ui-modernization/build-directory.txt',dest);console.log(dest);
