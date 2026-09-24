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
/* The live page shows the tab bar and one combination inside the carousel chrome, so the
   snapshot reproduces that shell. Each scenario below is rendered as it appears on screen:
   navigation bar, one combination, navigation bar again at the foot. */
function tabBar(active){
  const T=[['build','Build a Bed'],['how','How it works'],['plants','Plant Database'],
           ['sources','Data Sources'],['before','Before you plant']];
  return '<div class="tabbar"><div class="wrap"><div class="tabs" role="tablist">'+
    T.map(([id,label])=>'<button type="button" class="tab" role="tab" aria-selected="'+
      (id===active?'true':'false')+'">'+label+'</button>').join('')+
    '</div></div></div>';
}
function comboNav(i,n,name,foot){
  return '<div class="combo-nav'+(foot?' foot':'')+'">'+
    '<button type="button" class="btn nav"><span class="arw">&#8592;</span>Previous Combination</button>'+
    '<div class="combo-pos"><div class="cp-count">Combination <b>'+(i+1)+'</b> of '+n+
      '<span class="cp-name">'+name+'</span></div>'+
      (foot?'':'<label class="cp-jump"><span class="cp-jl">Jump to</span>'+
        '<select><option>Combination '+(i+1)+' \u2014 '+name+'</option></select></label>')+
    '</div>'+
    '<button type="button" class="btn nav">Next Combination<span class="arw">&#8594;</span></button>'+
    '</div>';
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
  const all = cards();                      // pages the real carousel
  const n = all.length;
  body+='<section class="block"><div class="panel"><h2>'+esc(label)+'</h2>'+
        '<div class="show" id="zipOut" style="display:block">'+byId.zipOut.innerHTML+'</div>'+
        '<p class="muted" style="margin-top:12px">'+byId.resultsSummary.innerHTML+'</p></div></section>';
  all.slice(0,take).forEach((card,i)=>{
    // already-escaped HTML text: do not run it through esc() again
    const name = (H.cardTitle ? H.cardTitle(card) : '').replace(/^\d+/,'').trim();
    body+='<section class="block">'+comboNav(i,n,name,false)+ser(card)+
          comboNav(i,n,name,true)+'</section>';
  });
}
/* A real rendered diagnosis, so the new tab can be inspected rather than guessed at.
   Five cases with deliberately different needs, to show the ranking actually changes. */
function diagnosisSections(){
  H.clickTab('dying');
  let html = '';
  const cases = [
    ['agave',        null,        null,     'Agave \u2014 a rosette succulent: expect water and drainage first'],
    ['maidenhair',   null,        null,     'Maidenhair fern \u2014 expect drying out and light first'],
    ['lowbush',      null,        null,     'Lowbush blueberry \u2014 expect soil pH first'],
    ['purple conef', 'distorted', null,     'Purple coneflower, reporting twisted new growth'],
    ['wild bergam',  'vanished',  'winter', 'Wild bergamot, reporting it vanished over winter']
  ];
  for(const [q, symptom, timing, label] of cases){
    byId.dxq.value = q; byId.dxq.dispatch('input');
    const hits = H.dxHits();
    if(!hits.length) continue;
    hits[0].children[1].click();
    if(symptom) H.dxSetAnswer('symptom', symptom);
    if(timing)  H.dxSetAnswer('timing', timing);
    html += '<section class="block"><div class="panel"><h2>'+esc(label)+'</h2></div></section>'+
            '<section class="block">'+ser(byId.dxOut)+'</section>';
  }
  H.clickTab('build');
  return html;
}
const diagBody = diagnosisSections();

const html='<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'+
 '<meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<title>Botanical Bed Builder \u2014 rendered output snapshot</title>'+
 '<link rel="stylesheet" href="style.css"></head><body>'+
 '<header class="site"><div class="wrap"><h1>Botanical Bed Builder</h1>'+
 '<p class="lede">Rendered-output snapshot for inspection. The live site shows six tabs, one '+
 'combination at a time; this file reproduces that chrome and then lays several combinations '+
 'out in sequence, followed by rendered diagnoses from the Help My Plant Keeps Dying tab, so '+
 'everything can be inspected on one page.</p></div></header>'+
 tabBar('build')+
 '<main><div class="wrap">'+body+
 '<section class="block"><div class="panel">'+
 '<h2>Help My Plant Keeps Dying \u2014 rendered diagnoses</h2>'+
 '<p class="muted">The ranking is recomputed for each plant, so the order of the tests '+
 'should differ between the cases below.</p></div></section>'+
 diagBody+
 '</div></main></body></html>';
fs.writeFileSync(path.join(__dirname,'rendered-output-snapshot.html'), html);
console.log('wrote rendered-output-snapshot.html ('+(html.length/1024).toFixed(0)+' KB)');
