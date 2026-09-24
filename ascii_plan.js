const H=require('./test_harness.js'); const {setup,cards,plantTable}=H;
function plan(card){
  const R=[];
  (function w(e){ if(e.tag==='path'&&e.attrs&&e.attrs['data-sp']!==undefined){
    const runs=[...e.attrs.d.matchAll(/M([\d.]+),([\d.]+)h([\d.]+)v([\d.]+)/g)]
      .map(m=>({x:+m[1],y:+m[2],w:+m[3],h:+m[4]}));
    R.push({num:+e.attrs['data-sp'],hmax:+e.attrs['data-hmax'],ground:e.attrs['data-ground']==='1',runs});
  } (e.children||[]).forEach(w); })(card);
  let vb=null; (function w(e){ if(e.tag==='svg'&&e.attrs.viewBox) vb=e.attrs.viewBox.split(' ').map(Number); (e.children||[]).forEach(w);})(card);
  return {R,vb};
}
function render(card,label){
  const {R,vb}=plan(card);
  const W=vb[2], Hh=vb[3];
  const CO=104, RO=26;
  const grid=Array.from({length:RO},()=>Array(CO).fill(' '));
  const sym='123456789ABCDEF';
  R.forEach(r=>{
    r.runs.forEach(q=>{
      const x0=Math.round(q.x/W*CO), x1=Math.round((q.x+q.w)/W*CO);
      const y0=Math.round(q.y/Hh*RO), y1=Math.max(y0+1,Math.round((q.y+q.h)/Hh*RO));
      for(let y=y0;y<y1&&y<RO;y++) for(let x=x0;x<x1&&x<CO;x++)
        grid[y][x]= r.ground ? sym[r.num-1].toLowerCase() : sym[r.num-1];
    });
  });
  console.log('\n'+'='.repeat(CO));
  console.log(label);
  console.log('='.repeat(CO));
  console.log('  BACK  |'+grid.slice(0,RO).map(r=>r.join('')).join('|\n        |').replace(/\|$/,''));
  console.log('        '+'-'.repeat(CO)+'  FRONT');
  const rows=plantTable(card).children.slice(1);
  R.sort((a,b)=>b.hmax-a.hmax).forEach(r=>{
    const nm=rows[r.num-1].children[2].innerHTML.replace(/<br>[\s\S]*/,'').replace(/<[^>]*>/g,'');
    console.log('   '+(r.ground?sym[r.num-1].toLowerCase():sym[r.num-1])+' = '+nm.padEnd(26)+
      String(r.hmax).padStart(3)+' in max'+(r.ground?'   [groundcover layer]':''));
  });
}
setup('53703','S','M',{w:8,l:20});
render(cards()[0],'MADISON WI - full sun, average soil, 8 x 20 ft  (UPPERCASE = feature plants, lowercase = groundcover)');
