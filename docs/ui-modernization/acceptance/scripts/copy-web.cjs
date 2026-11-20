const fs=require('fs'),path=require('path');
const src=path.resolve(process.argv[2]),dest=path.resolve(process.argv[3]);
function copy(a,b){fs.mkdirSync(b,{recursive:true});for(const e of fs.readdirSync(a,{withFileTypes:true})){if(['node_modules','.next','.git','coverage','.turbo'].includes(e.name)||e.name.startsWith('.env')||e.name.endsWith('.tsbuildinfo'))continue;const x=path.join(a,e.name),y=path.join(b,e.name);e.isDirectory()?copy(x,y):fs.copyFileSync(x,y);}}
copy(src,dest);fs.symlinkSync(path.join(src,'node_modules'),path.join(dest,'node_modules'),'junction');
if(process.argv[4]==='uitest')fs.writeFileSync(path.join(dest,'.env.development.local'),'NEXT_PUBLIC_UI_TEST_MODE=true\n');
console.log(dest);
