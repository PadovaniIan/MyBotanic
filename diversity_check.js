/* How many distinct species the generated set of designs actually uses. */
const H=require('./test_harness.js'); const {setup,cards,plantTable}=H;
console.log('scenario'.padEnd(26)+'designs  slots  distinct  variety');
[['53703','S','M','Madison sun'],['53703','P','M','Madison part shade'],
 ['53703','H','M','Madison full shade'],['30306','H','M','Atlanta shade'],
 ['85719','S','D','Tucson sun dry'],['94110','S','D','San Francisco sun dry'],
 ['78704','S','D','Austin sun dry'],['97214','H','M','Portland shade'],
 ['80304','S','D','Boulder sun dry'],['33139','P','M','Miami part shade']
].forEach(([z,l,s,label])=>{
  setup(z,l,s,{w:8,l:20});
  const set=new Set(); let slots=0;
  cards().forEach(card=>{
    plantTable(card).children.slice(1).forEach(tr=>{
      const m=/<span class='sci muted'>([^<]+)</.exec(tr.children[2].innerHTML);
      if(m){ set.add(m[1]); slots++; }
    });
  });
  console.log(label.padEnd(26)+String(cards().length).padStart(5)+
    String(slots).padStart(7)+String(set.size).padStart(10)+
    String(Math.round(100*set.size/Math.max(1,slots))+'%').padStart(9));
});
