import {getFirestore,collection,getDocs} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
const db=getFirestore();
const TYPES={restaurant:'مطعم',grocery:'بقالة وسوبرماركت',pharmacy:'صيدلية',bakery:'مخبز وحلويات',home:'مطبخ منزلي',other:'متجر آخر'};
let C,stores=[],flt='all';
export async function run(c){
  C=c;
  C.shell('<p class="m">جارٍ التحميل…</p>');
  try{stores=(await getDocs(collection(db,'providers'))).docs.map(d=>({id:d.id,...d.data()})).filter(s=>s.shopName)}catch(e){C.shell(`<div class="card"><p class="er">تعذّر التحميل، تأكد من الإنترنت.</p></div>${C.outBtn}`);C.bindOut();return}
  list();
}
function list(){
  const f=stores.filter(s=>flt==='all'||s.type===flt);
  C.shell(`<h1>أهلًا ${C.E(C.prof.name)}</h1>
  <div class="tabs" style="overflow:auto"><button data-f="all" class="${flt==='all'?'on':''}">الكل</button>${Object.entries(TYPES).map(([k,v])=>`<button data-f="${k}" class="${flt===k?'on':''}" style="white-space:nowrap">${v}</button>`).join('')}</div>
  ${f.map(s=>`<div class="card" data-s="${s.id}" style="cursor:pointer"><div class="r"><b>${C.E(s.shopName)}</b><span class="tg ${s.open===false?'off':''}">${s.open===false?'مغلق الآن':'مفتوح'}</span></div><div class="m">${TYPES[s.type]||''} • ${C.E(s.district||'')}</div></div>`).join('')||'<div class="card"><p class="m">لا توجد محلات حاليًا. سنضيفها قريبًا.</p></div>'}
  ${C.outBtn}`);
  C.bindOut();
  document.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{flt=b.dataset.f;list()});
  document.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>store(b.dataset.s));
}
async function store(id){
  const s=stores.find(x=>x.id===id);
  C.shell('<p class="m">جارٍ التحميل…</p>');
  let secs,items;
  try{
    secs=(await getDocs(collection(db,'providers',id,'sections'))).docs.map(d=>({id:d.id,...d.data()}));
    items=(await getDocs(collection(db,'providers',id,'items'))).docs.map(d=>({id:d.id,...d.data()}));
  }catch(e){C.shell('<div class="card"><p class="er">تعذّر التحميل.</p></div><button class="l" id="bk">رجوع</button>');document.querySelector('#bk').onclick=list;return}
  secs.sort((a,b)=>(a.order||0)-(b.order||0));
  C.shell(`<button class="l" id="bk" style="text-align:right">← رجوع</button><div class="card"><h1>${C.E(s.shopName)}</h1><div class="m">${TYPES[s.type]||''} • ${s.open===false?'مغلق الآن':'مفتوح'}</div></div>
  ${secs.map(x=>`<div class="card"><h2>${C.E(x.name)}</h2>${items.filter(i=>i.sec===x.id).map(i=>`<div class="r" style="margin:10px 0;align-items:center;${i.avail===false?'opacity:.5':''}">${i.photo?`<img src="${i.photo}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:12px">`:''}<div style="flex:1"><b>${C.E(i.name)}</b><div class="m">${C.E(i.desc||'')}</div></div><b style="color:#1D4ED8">${C.E(i.price)} ج.س</b></div>`).join('')||'<p class="m">لا توجد أصناف.</p>'}</div>`).join('')||'<div class="card"><p class="m">لم يضف المحل قائمته بعد.</p></div>'}
  <div class="card"><p class="m">السلة وإرسال الطلب تُضاف في المرحلة القادمة.</p></div>`);
  document.querySelector('#bk').onclick=list;
}
