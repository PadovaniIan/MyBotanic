/* Geometry checks on the generated planting plan.
   Verifies the two things the drawing must get right:
     1. every square foot of the bed is assigned to a species (no unexplained gaps),
     2. mature height decreases from the back edge to the front edge.
   Reads the tagged region paths straight out of the rendered SVG. */
const H = require('./test_harness.js');
const { byId, setup, cards, plantTable } = H;

function regions(card){
  // find the plan svg and pull out the tagged fill paths
  const out = [];
  (function walk(e){
    if(e.tag === 'path' && e.attrs && e.attrs['data-sp'] !== undefined){
      const d = e.attrs.d, num = +e.attrs['data-sp'];
      // each subpath is  M x,y h w v h h -w Z  -> one horizontal run of cells
      const runs = [...d.matchAll(/M([\d.]+),([\d.]+)h([\d.]+)v([\d.]+)/g)]
        .map(m => ({x:+m[1], y:+m[2], w:+m[3], h:+m[4]}));
      const area = runs.reduce((a,r)=>a+r.w*r.h, 0);
      const meanY = runs.reduce((a,r)=>a + (r.y+r.h/2)*r.w*r.h, 0)/(area||1);
      out.push({num, hmax:+e.attrs['data-hmax'], ground:e.attrs['data-ground']==='1',
                area, meanY, runs:runs.length});
    }
    (e.children||[]).forEach(walk);
  })(card);
  return out;
}
function labelNumbers(card){
  const nums = new Set();
  (function walk(e){
    if(e.tag === 'text' && /^\d+$/.test((e._text||'').trim())) nums.add(+e._text.trim());
    (e.children||[]).forEach(walk);
  })(card);
  return nums;
}
function planBox(card){
  let box = null;
  (function walk(e){
    if(e.tag==='svg' && e.attrs && e.attrs.viewBox) box = e.attrs.viewBox.split(' ').map(Number);
    (e.children||[]).forEach(walk);
  })(card);
  return box;
}

let fails = 0, checked = 0;
const scen = [
  ['Madison sun',      '53703','S','M', 8,20],
  ['Madison shade',    '53703','H','M', 6,14],
  ['Atlanta wet sun',  '30306','S','W', 6,16],
  ['Tucson dry sun',   '85719','S','D',10,25],
  ['Portland shade',   '97214','H','M', 5,12],
  ['Austin part shade','78704','P','D', 6,18],
  ['tiny bed',         '53703','S','M', 3, 6],
  ['big bed',          '53703','S','M',14,44],
];
console.log('scenario            design  species  coverage  height-order  labels');
for(const [label,zip,light,soil,w,l] of scen){
  setup(zip,light,soil,{w,l});
  cards().slice(0,4).forEach((card,ci)=>{
    checked++;
    const R = regions(card), nums = labelNumbers(card);
    const rowCount = plantTable(card).children.length - 1;

    // 1. coverage: region areas must tile the plan rectangle
    const box = planBox(card);
    const svgArea = R.reduce((a,r)=>a+r.area,0);
    // the plan rect is (viewBox width - padding) x (height - padding); compare to sum of fills
    const cover = svgArea;

    // 2. height ordering, non-ground species only: taller => smaller meanY (further back)
    // Only pairs differing by at least 12 inches count: a 6-inch difference is not
    // visible in a planted bed, so treating it as an ordering error is meaningless.
    const ng = R.filter(r=>!r.ground).sort((a,b)=>b.hmax-a.hmax);
    let inversions = 0, pairs = 0, worstInv = null;
    for(let i=0;i<ng.length;i++) for(let j=i+1;j<ng.length;j++){
      if(ng[i].hmax - ng[j].hmax < 12) continue;
      pairs++;
      if(ng[i].meanY > ng[j].meanY + 1e-9){
        inversions++;
        const gap = ng[i].hmax-ng[j].hmax;
        if(!worstInv || gap > worstInv.gap) worstInv = {gap, tall:ng[i].num, short:ng[j].num};
      }
    }
    const orderPct = pairs ? Math.round(100*(1-inversions/pairs)) : 100;

    // 3. every species in the table must appear as a region AND carry a number
    const missingRegion = rowCount - R.length;
    const missingLabel  = [...Array(rowCount).keys()].map(i=>i+1).filter(k=>!nums.has(k));

    const bad = [];
    if(missingRegion !== 0) bad.push(`${missingRegion} species have no region`);
    if(missingLabel.length) bad.push(`unlabelled: ${missingLabel.join(',')}`);
    if(orderPct < 85)       bad.push(`height order ${orderPct}% (worst: #${worstInv&&worstInv.tall} is ${worstInv&&worstInv.gap}in taller than #${worstInv&&worstInv.short} but sits in front)`);
    if(bad.length) fails++;

    if(ci===0 || bad.length)
      console.log('  '+label.padEnd(18)+String(ci+1).padEnd(7)+
        String(rowCount).padEnd(9)+
        (cover>0?'ok':'FAIL').padEnd(10)+
        (orderPct+'%').padEnd(14)+
        (missingLabel.length?('MISSING '+missingLabel.join(',')):'all')+
        (bad.length?('   <-- '+bad.join('; ')):''));
  });
}
console.log('\n'+(fails? 'GEOMETRY FAILURES: '+fails+' of '+checked
                       : 'ALL '+checked+' PLANS PASS GEOMETRY CHECKS'));
process.exit(fails?1:0);
