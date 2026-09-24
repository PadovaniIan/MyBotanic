/* Serialise generated beds into a standalone HTML file for visual/structural inspection. */
const fs=require('fs'), path=require('path');
const H=require('./test_harness.js'); const {byId,setup,cards}=H;
const VOID=new Set(['input','br','hr','img','meta','link','area','base','col','source']);
const KEEP=new Set(['svg','path','rect','circle','text','g','ellipse','line','polygon','polyline']);
const esc = s => String(s).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
function styleStr(e){
  const parts=[];
  for(const k of Object.keys(e.style)){
    if(k==='cssText'){ parts.push(String(e.style[k]).replace(/;\s*$/,'')); continue; }
    parts.push(k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())+':'+e.style[k]);
  }
  return parts.filter(Boolean).join(';');
}
function ser(e){
  const tag = KEEP.has(e.tag) ? e.tag : e.tag.toLowerCase();
  let a='';
  if(e.className) a+=' class="'+e.className+'"';
  if(e.id) a+=' id="'+e.id+'"';
  for(const k of Object.keys(e.attrs||{})) a+=' '+k+'="'+String(e.attrs[k]).replace(/"/g,'&quot;')+'"';
  const st=styleStr(e); if(st) a+=' style="'+st+'"';
  if(e.title) a+=' title="'+String(e.title).replace(/"/g,'&quot;')+'"';
  if(e.colSpan) a+=' colspan="'+e.colSpan+'"';
  if(VOID.has(tag)) return '<'+tag+a+'>';
  const inner = e._html || ((e._text?esc(e._text):'') + e.children.map(ser).join(''));
  return '<'+tag+a+'>'+inner+'</'+tag+'>';
}
const cases=[
 ['Madison, Wisconsin \u2014 full sun, average soil, 8 \u00d7 20 ft','53703','S','M',8,20,3],
 ['Atlanta, Georgia \u2014 full shade, average soil, 6 \u00d7 14 ft','30306','H','M',6,14,2],
 ['Tucson, Arizona \u2014 full sun, dry soil, 10 \u00d7 25 ft','85719','S','D',10,25,2],
 ['Portland, Oregon \u2014 full shade, moist soil, 5 \u00d7 12 ft','97214','H','M',5,12,2],
 ['Austin, Texas \u2014 part shade, dry soil, 6 \u00d7 18 ft','78704','P','D',6,18,2],
];
let body='';
for(const [label,zip,light,soil,w,l,take] of cases){
  setup(zip,light,soil,{w,l});
  body+='<section class="block"><div class="panel"><h2>'+esc(label)+'</h2>'+
        '<div class="show" id="zipOut" style="display:block">'+byId.zipOut.innerHTML+'</div>'+
        '<p class="muted" style="margin-top:12px">'+byId.resultsSummary.innerHTML+'</p></div></section>'+
        '<section class="block">'+cards().slice(0,take).map(ser).join('')+'</section>';
}
const html='<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'+
 '<meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<title>Botanical Bed Builder \u2014 rendered output snapshot</title>'+
 '<link rel="stylesheet" href="style.css"></head><body>'+
 '<header class="site"><div class="wrap"><h1>Botanical Bed Builder</h1>'+
 '<p class="lede">Rendered-output snapshot for inspection: five real queries, showing the '+
 'combination cards exactly as the live site builds them.</p></div></header>'+
 '<main><div class="wrap">'+body+'</div></main></body></html>';
fs.writeFileSync(path.join(__dirname,'rendered-output-snapshot.html'), html);
console.log('wrote rendered-output-snapshot.html ('+(html.length/1024).toFixed(0)+' KB)');
