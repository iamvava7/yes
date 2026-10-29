// node tools/render.js <index.html> <outdir> [stepFrames=1]  -> PNG frames + sfx.json
const {chromium}=require('playwright'); const fs=require('fs');
(async()=>{
  const [html,out,step='1']=process.argv.slice(2);
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1080,height:1920}});
  p.on('pageerror',e=>console.error('PAGEERROR',e.message));
  await p.addInitScript(()=>{window.RENDER=true});
  await p.goto('file://'+require('path').resolve(html)); await p.waitForTimeout(500);
  const {sfx,dur}=await p.evaluate(()=>({sfx:window.SFX,dur:window.DURATION}));
  fs.writeFileSync(out+'/sfx.json',JSON.stringify({duration:dur,sfx}));
  const N=Math.round(dur*30);
  for(let f=0;f<N;f+=+step){ await p.evaluate(t=>seek(t),f/30);
    await p.screenshot({path:`${out}/f${String(f).padStart(5,'0')}.png`}); }
  await b.close();
})();
