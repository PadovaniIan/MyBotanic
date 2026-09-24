/* Test suite: ZIP resolution, scenario coverage, hard-filter stress, structural invariants. */
const H = require('./test_harness.js');
const { byId, setLight, submit, setup, cards, cardTitle, plantTable } = H;

let fails = 0, warns = 0;
const ok   = (c,m)=>{ if(!c){ console.log('  FAIL  '+m); fails++; } };
const warn = (c,m)=>{ if(!c){ console.log('  warn  '+m); warns++; } };
const statusText = ()=> byId.status.innerHTML.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();

console.log('=== ZIP resolution ===');
[['53703','WI'],['02138','MA'],['85719','AZ'],['97214','OR'],['94110','CA'],['33139','FL'],
 ['80304','CO'],['78704','TX'],['10025','NY'],['59801','MT'],['30306','GA'],['87501','NM'],
 ['98105','WA'],['67601','KS'],['89109','NV'],['99501','ZIP 99501 is in AK'],
 ['00501','not inside'],['abcde','five-digit']
].forEach(([z,exp])=>{
  byId.zip.value=z; byId.zip.dispatch('input');
  const t = byId.zipOut.innerHTML.replace(/<[^>]*>/g,' ').replace(/&mdash;/g,'-')
              .replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
  console.log('  '+z.padEnd(7)+'-> '+t.slice(0,92));
  ok(t.indexOf(exp)>=0, z+' should mention '+JSON.stringify(exp));
});

console.log('\n=== scenario matrix (19 locations x light x soil) ===');
const scenarios = [
  ['Madison WI, sun, average','53703','S','M'],   ['Madison WI, part shade','53703','P','M'],
  ['Madison WI, full shade','53703','H','M'],     ['Madison WI, sun, wet','53703','S','W'],
  ['Madison WI, shade, dry','53703','H','D'],     ['Boston MA, part shade','02138','P','M'],
  ['Tucson AZ, sun, dry','85719','S','D'],        ['Tucson AZ, shade, dry','85719','H','D'],
  ['Portland OR, shade, moist','97214','H','M'],  ['San Francisco CA, sun, dry','94110','S','D'],
  ['Miami FL, part shade','33139','P','M'],       ['Boulder CO, sun, dry','80304','S','D'],
  ['Austin TX, sun, dry','78704','S','D'],        ['Manhattan NY, sun, average','10025','S','M'],
  ['Missoula MT, sun, average','59801','S','M'],  ['Atlanta GA, shade, average','30306','H','M'],
  ['Santa Fe NM, part shade','87501','P','M'],    ['Hays KS, sun, dry','67601','S','D'],
  ['Las Vegas NV, sun, dry','89109','S','D'],
];
let zeros=0;
scenarios.forEach(([label,zip,light,soil])=>{
  setup(zip,light,soil);
  const n = cards().length;
  const summary = byId.resultsSummary.innerHTML.replace(/<[^>]*>/g,'');
  const pm = /from (\d+) species/.exec(summary);
  const pool = n ? (pm?+pm[1]:0) : (/the (\d+) eligible/.exec(statusText())||[0,0])[1];
  console.log('  '+label.padEnd(29)+' pool '+String(pool).padStart(3)+'   designs '+n);
  if(n===0){ zeros++; console.log('      -> '+statusText().slice(0,120)); }
  warn(n>=4, label+' produced only '+n+' design(s)');
});
ok(zeros<=1, zeros+' scenarios produced nothing (at most one extreme case is acceptable)');

console.log('\n=== hard-filter stress ===');
[['deer + no spreaders + under 30in','53703','S','D',{deer:1,spread:0,maxh:30}],
 ['shade + dry + 30in + deer (extreme)','30306','H','D',{deer:1,spread:0,maxh:30}],
 ['tiny bed 3x4 ft','53703','S','M',{w:3,l:4}],
 ['large bed 20x60 ft','53703','S','M',{w:20,l:60}],
 ['under 4 ft, part shade','02138','P','M',{maxh:48}],
].forEach(([label,zip,light,soil,extra])=>{
  setup(zip,light,soil,extra);
  const n=cards().length;
  console.log('  '+label.padEnd(36)+' designs '+n);
  if(n===0) ok(/No combination could be assembled/.test(statusText()),
               label+' produced 0 designs without an explanatory message');
});

console.log('\n=== structural invariants (Madison, sun, average, 8x20) ===');
setup('53703','S','M',{w:8,l:20});
const list = cards();
ok(list.length>0,'cards rendered');
const titles = new Set();
list.forEach((card,i)=>{
  const txt = card.textContent, tag='card '+(i+1);
  ok(card.children.length>=3, tag+': missing head/body/foot');
  ok(/Structural|Seasonal|Groundcover|Grass|Fern|Shrub|Filler/.test(txt), tag+': no layer tags');
  ok(/caterpillar/.test(txt), tag+': no scorecard');
  ok(/o\.c\./.test(txt), tag+': no spacing column');
  ok(/Schematic plan/.test(txt), tag+': no plan');
  ok(/Bloom sequence/.test(txt), tag+': no bloom calendar');
  ok(/Plant-by-plant notes/.test(txt), tag+': no per-plant notes');
  const bad = txt.match(/undefined|NaN|\[object \w+/);
  ok(!bad, tag+': output contains '+(bad?bad[0]:''));
  const rows = plantTable(card).children.length-1;
  ok(rows>=5, tag+': only '+rows+' plant rows');
  titles.add(cardTitle(card).replace(/^\d+/,''));
});
console.log('  '+list.length+' cards, '+titles.size+' distinct design templates');
ok(titles.size>=6,'at least 6 distinct templates appear, got '+titles.size);

console.log('\n=== quantities are sane ===');
let qtyIssues=0, totalPlants=0;
list.forEach(card=>{
  plantTable(card).children.slice(1).forEach(tr=>{
    const q = parseInt(tr.children[5].textContent,10);
    if(!(q>=1 && q<=400)) qtyIssues++;
    totalPlants += q;
  });
});
ok(qtyIssues===0, qtyIssues+' quantities outside the range 1-400');
const avg = Math.round(totalPlants/list.length);
console.log('  average '+avg+' plants per 160 sq ft design');
warn(avg>40 && avg<400,'average plant count per design is '+avg+', which looks unusual');

console.log('\n=== determinism and shuffle ===');
setup('53703','S','M',{w:8,l:20});
const a = cards().map(c=>c.textContent.slice(0,300)).join('|');
setup('53703','S','M',{w:8,l:20});
const b = cards().map(c=>c.textContent.slice(0,300)).join('|');
ok(a===b,'same inputs must produce identical designs');
byId.shuffle.dispatch('click');
const c2 = cards().map(c=>c.textContent.slice(0,300)).join('|');
ok(a!==c2,'shuffle must change the selection');

console.log('\n=== plant browser and sources ===');
ok(byId.browseTable.children.length>1,'browse table populated ('+(byId.browseTable.children.length-1)+' rows)');
ok(byId.srcCards.children.length>=10,'source cards populated ('+byId.srcCards.children.length+')');
ok(/species/.test(byId.footStats.textContent),'footer stats populated');
byId.bq.value='monarch'; byId.bq.dispatch('input');
const mrows = byId.browseTable.children.length-1;
console.log('  search "monarch" -> '+mrows+' rows');
ok(mrows>=4,'monarch search should return several plants');
byId.bq.value=''; byId.blight.value='H'; byId.blight.dispatch('change');
const srows = byId.browseTable.children.length-1;
console.log('  light = full shade -> '+srows+' rows');
ok(srows>40,'shade filter should return a substantial list');
byId.blight.value=''; byId.breg.value='SW'; byId.breg.dispatch('change');
console.log('  region = Southwest -> '+(byId.browseTable.children.length-1)+' rows');
byId.breg.value='';

console.log('\n'+(fails? 'FAILURES: '+fails : 'ALL CHECKS PASSED')+
            (warns? '   warnings: '+warns : ''));
process.exit(fails?1:0);
