import {getFirestore,doc,getDoc,collection,getDocs,addDoc,query,where,onSnapshot,serverTimestamp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
const db=getFirestore();
const TYPES={restaurant:'مطعم',grocery:'بقالة وسوبرماركت',pharmacy:'صيدلية',bakery:'مخبز وحلويات',home:'مطبخ منزلي',other:'متجر آخر'};
const ST={new:'بانتظار المحل',accepted:'قبل المحل طلبك',ready:'جاهز للاستلام',assigned:'الطيار في الطريق',delivered:'تم التسليم',rejected:'رفض المحل الطلب'};
let C,stores=[],flt='all',cfg={pricePerKm:700,factor:1.3,urgentFactor:1.5},cart={sid:null,items:{}},cache={},pos=null,unsub=null;
const km=(a,b,c,d)=>{const r=x=>x*Math.PI/180,h=Math.sin(r(c-a)/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(r(d-b)/2)**2;return 12742*Math.asin(Math.sqrt(h))};
const fmt=n=>Number(n).toLocaleString('en-US');
const shrink=f=>new Promise((ok,no)=>{const r=new FileReader();r.onerror=no;r.onload=()=>{const i=new Image();i.onerror=no;i.onload=()=>{const k=Math.min(1,900/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=Math.round(i.width*k);c.height=Math.round(i.height*k);c.getContext('2d').drawImage(i,0,0,c.width,c.height);ok(c.toDataURL('image/jpeg',.6))};i.src=r.result};r.readAsDataURL(f)});
const count=()=>Object.values(cart.items).reduce((a,i)=>a+i.qty,0);
const sub=()=>Object.values(cart.items).reduce((a,i)=>a+i.qty*i.price,0);
export async function run(c){
  C=c;
  C.shell('<p class="m">جارٍ التحميل…</p>');
  try{
    stores=(await getDocs(collection(db,'providers'))).docs.map(d=>({id:d.id,...d.data()})).filter(s=>s.shopName);
    const s=await getDoc(doc(db,'settings','main'));if(s.exists())cfg={...cfg,...s.data()};
  }catch(e){C.shell(`<div class="card"><p class="er">تعذّر التحميل، تأكد من الإنترنت.</p></div>${C.outBtn}`);C.bindOut();return}
  list();
}
function stop(){if(unsub){unsub();unsub=null}}
function list(){
  stop();
  const f=stores.filter(s=>flt==='all'||s.type===flt);
  C.shell(`<div class="r"><h1 style="margin:0">أهلًا ${C.E(C.prof.name)}</h1><button class="s" id="mo">طلباتي</button></div>
  <div class="tabs" style="overflow:auto;margin-top:12px"><button data-f="all" class="${flt==='all'?'on':''}">الكل</button>${Object.entries(TYPES).map(([k,v])=>`<button data-f="${k}" class="${flt===k?'on':''}" style="white-space:nowrap">${v}</button>`).join('')}</div>
  ${f.map(s=>`<div class="card" data-s="${s.id}" style="cursor:pointer"><div class="r"><b>${C.E(s.shopName)}</b><span class="tg ${s.open===false?'off':''}">${s.open===false?'مغلق الآن':'مفتوح'}</span></div><div class="m">${TYPES[s.type]||''} • ${C.E(s.district||'')}</div></div>`).join('')||'<div class="card"><p class="m">لا توجد محلات حاليًا. سنضيفها قريبًا.</p></div>'}
  ${C.outBtn}`);
  C.bindOut();
  C.$('#mo').onclick=myOrders;
  document.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{flt=b.dataset.f;list()});
  document.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>openStore(b.dataset.s));
}
async function openStore(id){
  if(!cache[id]){
    C.shell('<p class="m">جارٍ التحميل…</p>');
    try{
      const secs=(await getDocs(collection(db,'providers',id,'sections'))).docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.order||0)-(b.order||0));
      const items=(await getDocs(collection(db,'providers',id,'items'))).docs.map(d=>({id:d.id,...d.data()}));
      cache[id]={secs,items};
    }catch(e){C.shell('<div class="card"><p class="er">تعذّر التحميل.</p></div><button class="l" id="bk">رجوع</button>');C.$('#bk').onclick=list;return}
  }
  drawStore(id);
}
function drawStore(id){
  const s=stores.find(x=>x.id===id),{secs,items}=cache[id],closed=s.open===false;
  const qty=i=>cart.sid===id&&cart.items[i.id]?cart.items[i.id].qty:0;
  C.shell(`<button class="l" id="bk" style="text-align:right">← رجوع</button><div class="card"><h1>${C.E(s.shopName)}</h1><div class="m">${TYPES[s.type]||''} • ${closed?'مغلق الآن':'مفتوح'}</div></div>
  ${secs.map(x=>`<div class="card"><h2>${C.E(x.name)}</h2>${items.filter(i=>i.sec===x.id).map(i=>{const off=i.avail===false||closed;return `<div class="r" style="margin:10px 0;align-items:center;${off?'opacity:.5':''}">${i.photo?`<img src="${i.photo}" alt="" style="width:60px;height:60px;object-fit:cover;border-radius:12px">`:''}<div style="flex:1"><b>${C.E(i.name)}</b><div class="m">${C.E(i.desc||'')}</div><b style="color:#1D4ED8">${fmt(i.price)} ج.س</b></div>${off?`<span class="m">${i.avail===false?'نفد':'مغلق'}</span>`:`<div class="r" style="gap:6px"><button class="s" data-m="${i.id}">−</button><b>${qty(i)}</b><button class="s" data-p="${i.id}">+</button></div>`}</div>`}).join('')||'<p class="m">لا توجد أصناف.</p>'}</div>`).join('')||'<div class="card"><p class="m">لم يضف المحل قائمته بعد.</p></div>'}
  ${cart.sid===id&&count()?`<button class="b" id="ck" style="position:sticky;bottom:10px">عرض الطلب (${count()}) • ${fmt(sub())} ج.س</button>`:''}`);
  C.$('#bk').onclick=list;
  document.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{
    const i=items.find(x=>x.id===b.dataset.p);
    if(cart.sid&&cart.sid!==id&&count()){if(!confirm('سلتك فيها أصناف من محل آخر. هل تفرّغها؟'))return;cart={sid:null,items:{}}}
    cart.sid=id;const e=cart.items[i.id]||(cart.items[i.id]={name:i.name,price:i.price,qty:0});e.qty++;drawStore(id);
  });
  document.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{
    const e=cart.items[b.dataset.m];if(!e||cart.sid!==id)return;e.qty--;if(e.qty<=0)delete cart.items[b.dataset.m];drawStore(id);
  });
  if(C.$('#ck'))C.$('#ck').onclick=()=>checkout(id);
}
function feeOf(s,urg){
  if(!pos||s.lat==null)return null;
  const d=km(s.lat,s.lng,pos.lat,pos.lng)*cfg.factor;
  let f=Math.max(cfg.pricePerKm,Math.round(d*cfg.pricePerKm/100)*100);
  if(urg)f=Math.round(f*cfg.urgentFactor/100)*100;
  return {d,f};
}
function checkout(id){
  const s=stores.find(x=>x.id===id);
  let urg=false,pay=s.payCash!==false?'cash':'bank',receipt=null;
  const lines=Object.values(cart.items).map(i=>`<div class="r"><span>${i.qty} × ${C.E(i.name)}</span><b>${fmt(i.qty*i.price)}</b></div>`).join('');
  C.shell(`<button class="l" id="bk" style="text-align:right">← رجوع للقائمة</button>
  <div class="card"><h2>ملخص الطلب من ${C.E(s.shopName)}</h2>${lines}</div>
  <div class="card"><label>العنوان أو أقرب معلم<input id="ad" placeholder="مثال: حي الدرجة، بجوار السوق"></label>
  <button class="s" id="lc" style="width:100%">مشاركة موقعي للتوصيل</button>
  <label style="margin-top:10px"><input type="checkbox" id="ur" style="width:auto"> طلب مستعجل (رسوم التوصيل ×${cfg.urgentFactor})</label></div>
  <div class="card"><h2>طريقة الدفع</h2>
  ${s.payCash!==false?'<label><input type="radio" name="pm" value="cash" id="pc" style="width:auto"> الدفع عند الاستلام</label>':''}
  ${s.payBank?'<label><input type="radio" name="pm" value="bank" id="pb" style="width:auto"> تحويل بنكي للمحل أولًا</label>':''}
  <div id="bk2" style="display:none" class="m"></div></div>
  <div class="card" id="sm"></div>
  <div class="card" style="background:#EAF1FF"><b>تنبيه:</b> لا يمكن إلغاء الطلب بعد تأكيده.</div>
  <p id="er" class="er"></p><button class="b" id="go">تأكيد الطلب</button>`);
  C.$('#bk').onclick=()=>drawStore(id);
  const upd=()=>{
    const r=feeOf(s,urg),t=sub();
    C.$('#sm').innerHTML=`<div class="r"><span class="m">المجموع</span><b>${fmt(t)}</b></div><div class="r"><span class="m">رسوم التوصيل ${r?`(${(r.d).toFixed(1)} كم)`:''}</span><b>${r?fmt(r.f):'حدّد موقعك'}</b></div><div class="r"><b>الإجمالي</b><b style="color:#1D4ED8;font-size:20px">${r?fmt(t+r.f):'—'} ج.س</b></div><p class="m">ثمن الطعام يُدفع حسب الطريقة المختارة، ورسوم التوصيل تُدفع للطيار عند التسليم.</p>`;
  };
  const pm=()=>{
    const bx=C.$('#bk2');
    if(pay==='bank'){bx.style.display='block';bx.innerHTML=`حوّل ${fmt(sub())} ج.س إلى:<br><b>${C.E(s.bankName||'')}</b> • <b dir="ltr">${C.E(s.bankNo||'')}</b> • ${C.E(s.bankApp||'')}<label>صورة إشعار التحويل<input type="file" id="rc" accept="image/*"></label><p id="rm" class="m"></p>`;
      C.$('#rc').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{receipt=await shrink(f);C.$('#rm').textContent='تم إرفاق الصورة ✓'}catch(x){C.$('#rm').textContent='تعذّر قراءة الصورة'}};
    }else bx.style.display='none';
  };
  document.querySelectorAll('input[name=pm]').forEach(r=>{r.checked=r.value===pay;r.onchange=()=>{pay=r.value;pm()}});
  C.$('#ur').onchange=e=>{urg=e.target.checked;upd()};
  C.$('#lc').onclick=()=>{
    if(!navigator.geolocation)return;
    navigator.geolocation.getCurrentPosition(p=>{pos={lat:p.coords.latitude,lng:p.coords.longitude};C.$('#lc').textContent='تم تحديد موقعك ✓';upd()},()=>{C.$('#lc').textContent='تعذّر تحديد الموقع، فعّله وحاول ثانية'},{enableHighAccuracy:true,timeout:15000});
  };
  upd();pm();
  C.$('#go').onclick=async()=>{
    const e=C.$('#er'),addr=C.$('#ad').value.trim(),r=feeOf(s,urg);
    if(s.open===false)return e.textContent='المحل مغلق الآن';
    if(addr.length<3)return e.textContent='اكتب عنوانك';
    if(!r)return e.textContent='شارك موقعك أولًا لحساب رسوم التوصيل';
    if(pay==='bank'&&!receipt)return e.textContent='أرفق صورة إشعار التحويل';
    C.$('#go').disabled=true;e.textContent='';
    const o={cid:C.uid,cname:String(C.prof.name).split(' ')[0],pid:id,shop:s.shopName,items:Object.entries(cart.items).map(([k,i])=>({id:k,name:i.name,price:i.price,qty:i.qty})),sub:sub(),fee:r.f,urgent:urg,total:sub()+r.f,pay,addr,lat:pos.lat,lng:pos.lng,dist:+r.d.toFixed(1),status:'new',createdAt:serverTimestamp()};
    if(pay==='bank')o.receipt=receipt;
    try{await addDoc(collection(db,'orders'),o);cart={sid:null,items:{}};myOrders()}
    catch(x){C.$('#go').disabled=false;e.textContent='تعذّر إرسال الطلب، تأكد من الإنترنت وحاول ثانية'}
  };
}
function myOrders(){
  stop();
  C.shell('<p class="m">جارٍ التحميل…</p>');
  unsub=onSnapshot(query(collection(db,'orders'),where('cid','==',C.uid)),snap=>{
    const l=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||9e9)-(a.createdAt?.seconds||9e9));
    C.shell(`<button class="l" id="bk" style="text-align:right">← الرئيسية</button><h1>طلباتي</h1>
    ${l.map(o=>`<div class="card"><div class="r"><b>${C.E(o.shop)}</b><span class="tg ${o.status==='rejected'?'off':''}">${ST[o.status]||o.status}</span></div><div class="m">${o.items.map(i=>`${i.qty} × ${C.E(i.name)}`).join('، ')}</div><div class="r"><span class="m">الإجمالي ${o.urgent?'(مستعجل)':''}</span><b>${fmt(o.total)} ج.س</b></div></div>`).join('')||'<div class="card"><p class="m">لا توجد طلبات بعد.</p></div>'}`);
    C.$('#bk').onclick=list;
  },()=>{C.shell('<div class="card"><p class="er">تعذّر تحميل طلباتك.</p></div><button class="l" id="bk">رجوع</button>');C.$('#bk').onclick=list});
}
