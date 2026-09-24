/* Print real generated beds as text, for eyeballing horticultural sanity. */
const H=require('./test_harness.js'); const {byId,setup,cards,cardTitle,plantTable}=H;
const strip = s => s.replace(/<br>/g,' | ').replace(/<[^>]*>/g,'')
  .replace(/&middot;/g,'.').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
function show(label,zip,light,soil,w,l,take){
  setup(zip,light,soil,{w,l});
  console.log('\n'+'='.repeat(94)+'\n'+label+'   ZIP '+zip+'   '+w+' x '+l+' ft\n'+'='.repeat(94));
  console.log(strip(byId.zipOut.innerHTML).slice(0,300));
  cards().slice(0,take).forEach(card=>{
    console.log('\n--- '+cardTitle(card));
    console.log('    '+card.children[0].children[1].textContent);
    console.log('    ['+card.children[0].children[2].children.map(c=>c.textContent).join(' | ')+']');
    plantTable(card).children.slice(1).forEach(tr=>{
      const c=tr.children;
      const nm=strip(c[2].innerHTML);
      console.log('    '+String(c[5].textContent).padStart(4)+' x '+
        c[1].textContent.padEnd(11)+' '+nm.slice(0,104));
    });
    const sc=card.children[1].children[0].children[1];
  });
}
show('MADISON, WISCONSIN - full sun, average soil','53703','S','M',8,20,3);
show('ATLANTA, GEORGIA - full shade, average soil','30306','H','M',6,14,2);
show('TUCSON, ARIZONA - full sun, dry soil','85719','S','D',10,25,2);
show('PORTLAND, OREGON - full shade, moist soil','97214','H','M',5,12,1);
