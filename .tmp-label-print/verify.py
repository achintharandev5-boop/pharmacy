import base64, json, subprocess, time, urllib.request
from pathlib import Path
import websocket
from pypdf import PdfReader
out=Path('.tmp-label-print').resolve()
proc=subprocess.Popen([r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe','--headless=new','--disable-gpu','--remote-debugging-port=9237','--remote-allow-origins=*',f'--user-data-dir={out / "edge-profile"}','about:blank'],creationflags=subprocess.CREATE_NO_WINDOW,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 for _ in range(100):
  try:
   tabs=json.load(urllib.request.urlopen('http://localhost:9237/json'));break
  except Exception: time.sleep(.2)
 ws=websocket.create_connection(next(t['webSocketDebuggerUrl'] for t in tabs if t['type']=='page'),timeout=180)
 n=0
 def call(method,params=None):
  global n
  n+=1;ws.send(json.dumps({'id':n,'method':method,'params':params or {}}))
  while True:
   r=json.loads(ws.recv())
   if r.get('id')==n:
    if 'error' in r: raise RuntimeError(r['error'])
    return r.get('result',{})
 def evaluate(expression):
  r=call('Runtime.evaluate',{'expression':expression,'returnByValue':True,'awaitPromise':True})
  if 'exceptionDetails' in r: raise RuntimeError(r['exceptionDetails'])
  return r['result'].get('value')
 call('Network.enable')
 call('Network.setCookie',{'name':'pharmacy-ui-test','value':'local-ui-only-v1','url':'http://localhost:3002'})
 call('Emulation.setDeviceMetricsOverride',{'width':1200,'height':900,'deviceScaleFactor':2,'mobile':False})
 call('Page.navigate',{'url':'http://localhost:3002/label/print-check?print=current'})
 for _ in range(120):
  if evaluate('Boolean(window.__labelCheck && document.querySelector(".print-only [data-label]"))'):break
  time.sleep(1)
 else: raise RuntimeError(evaluate('document.body.innerText.slice(0,2000)'))
 result=evaluate('window.__labelCheck')
 print('FOOTER',evaluate('''(()=>{let f=document.querySelector('[data-card] [data-label-section="footer"]'); const rect=e=>{let r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,text:e.textContent}};return {section:rect(f),leaves:[...f.querySelectorAll('*')].filter(e=>!e.children.length).map(rect)}})()'''))
 (out/'layout-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
 assert not [r for r in result['results'] if r['clipped'] and not r['guard']], 'Unreported clipped text'
 assert not next(r for r in result['results'] if r['scenario']=='S1' and r['wording']=='current')['guard'], 'Standard label blocked'
 assert not [r for r in result['results'] if 'chemist footer' in r['guard']], 'Footer does not fit'
 box=evaluate('''(()=>{let e=document.querySelector('[data-card] [data-label]');let r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()''')
 snap=call('Page.captureScreenshot',{'format':'png','clip':dict(box,scale=3),'captureBeyondViewport':True})
 (out/'label-preview.png').write_bytes(base64.b64decode(snap['data']))
 call('Emulation.setEmulatedMedia',{'media':'print'})
 measure=evaluate('''(()=>{let e=document.querySelector('.print-only [data-label]'),r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,footer:getComputedStyle(e.querySelector('[data-label-section="footer"]')).fontSize,visibleUI:[...document.querySelectorAll('.no-print')].some(e=>e.getBoundingClientRect().height>0)}})()''')
 assert abs(measure['width']-70*96/25.4)<.1 and abs(measure['height']-50*96/25.4)<.1,measure
 assert abs(measure['x'])<.1 and abs(measure['y'])<.1 and not measure['visibleUI'],measure
 for name,w,h in [('default',70,50),('custom',80.5,40)]:
  if name=='custom':
   evaluate('''(()=>{document.querySelectorAll('style').forEach(s=>{if(s.textContent.includes('@page'))s.textContent=s.textContent.replaceAll('70mm','80.5mm').replaceAll('50mm','40mm')});document.querySelectorAll('[data-label]').forEach(e=>{Object.assign(e.style,{width:'80.5mm',minWidth:'80.5mm',maxWidth:'80.5mm',height:'40mm',minHeight:'40mm',maxHeight:'40mm'})})})()''')
  pdf=call('Page.printToPDF',{'preferCSSPageSize':True,'scale':1,'printBackground':True,'displayHeaderFooter':False,'marginTop':0,'marginBottom':0,'marginLeft':0,'marginRight':0})
  file=out/f'{name}.pdf';file.write_bytes(base64.b64decode(pdf['data']))
  pages=PdfReader(file).pages
  expected=evaluate('document.querySelectorAll(".print-only [data-label]").length')
  assert len(pages)==expected,(name,len(pages),expected)
  for page in pages:
   assert abs(float(page.mediabox.width)-w*72/25.4)<1,(name,page.mediabox)
   assert abs(float(page.mediabox.height)-h*72/25.4)<1,(name,page.mediabox)
  print(f'PASS {name}: {len(pages)} pages, {w} x {h} mm, 100% scale')
 print('PASS origin and UI isolation:',json.dumps(measure))
 print('PASS all scenario clipping is reported by existing guard; fonts:',result['fonts'])
finally:
 proc.terminate()
