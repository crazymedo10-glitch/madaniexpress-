import {getFirestore,doc,getDoc,setDoc,updateDoc,deleteDoc,addDoc,collection,getDocs,query,where,onSnapshot,serverTimestamp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
const db=getFirestore();
const TYPES={restaurant:'مطعم',grocery:'بقالة وسوبرماركت',pharmacy:'صيدلية',bakery:'مخبز وحلويات',home:'مطبخ منزلي',other:'متجر آخر'};
const ST={new:'جديد',accepted:'قيد التحضير',ready:'جاهز بانتظار الطيار',assigned:'مع الطيار',delivered:'تم التسليم',rejected:'مرفوض'};
let C,S={},tab='o',pos=null,unsubO=null;
const shrink=f=>new Promise((ok,no)=>{const r=new FileReader();r.onerror=no;r.onload=()=>{const i=new Image();i.onerror=no;i.onload=()=>{const k=Math.min(1,480/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=Math.round(i.width*k);c.height=Math.round(i.height*k);c.getContext('2d').drawImage(i,0,0,c.width,c.height);ok(c.toDataURL('image/jpeg',.7))};i.src=r.result};r.readAsDataURL(f)});
export async function run(c){
  C=c;
  try{const d=await getDoc(doc(db,'providers',C.uid));S=d.exists()?d.data():{}}catch(e){S={}}
  tab=S.shopName?'o':'i';
  draw();
}
function draw(){
  if(unsubO){unsubO();unsubO=null}
  C.shell(`<div class="tabs"><button data-t="o" class="${tab==='o'?'on':''}">الطلبات</button><button data-t="m" class="${tab==='m'?'on':''}">القائمة</button><button data-t="i" class="${tab==='i'?'on':''}">بيانات المحل</button></div><div id="bd"></div>${C.outBtn}`);
  C.bindOut();
  document.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{if(b.dataset.t!=='i'&&!S.shopName)return;tab=b.dataset.t;draw()});
  tab==='i'?info():tab==='o'?ordersTab():menu();
}
function info(){
  const o=S.open!==false;
  C.$('#bd').innerHTML=`<div class="card"><h2>بيانات المحل</h2>
  <label>اسم المحل أو المطبخ<input id="sn" value="${C.E(S.shopName||'')}"></label>
  <label>النوع<select id="st">${Object.entries(TYPES).map(([k,v])=>`<option value="${k}" ${S.type===k?'selected':''}>${v}</option>`).join('')}</select></label>
  <button class="s" id="lc" style="width:100%">${S.lat?'تم تحديد الموقع ✓ (اضغط للتحديث)':'تحديد موقع المحل'}</button>
  <label><input type="checkbox" id="sw" ${o?'checked':''} style="width:auto"> المحل مفتوح ويستقبل الطلبات</label>
  <h2 style="margin-top:14px">طرق الدفع التي تقبلها</h2>
  <label><input type="checkbox" id="pc" ${S.payCash!==false?'checked':''} style="width:auto"> كاش عند الاستلام</label>
  <label><input type="checkbox" id="pb" ${S.payBank?'checked':''} style="width:auto"> تحويل بنكي (أول بأول)</label>
  <label>اسم صاحب الحساب<input id="bn" value="${C.E(S.bankName||'')}"></label>
  <label>رقم الحساب<input id="ba" dir="ltr" value="${C.E(S.bankNo||'')}"></label>
  <label>التطبيق البنكي (مثل بنكك)<input id="bp" value="${C.E(S.bankApp||'')}"></label>
  <p class="m">عمولة المنصة 7% من قيمة كل طلب، وتُحاسَب في التسوية.</p>
  <p id="er" class="er"></p><button class="b" id="sv">حفظ</button></div>`;
  C.$('#lc').onclick=()=>{if(!navigator.geolocation)return;navigator.geolocation.getCurrentPosition(p=>{pos={lat:p.coords.latitude,lng:p.coords.longitude};C.$('#lc').textContent='تم تحديد الموقع ✓'},()=>{C.$('#lc').textContent='تعذّر تحديد الموقع، فعّل الموقع وحاول ثانية'},{enableHighAccuracy:true,timeout:15000})};
  C.$('#sv').onclick=async()=>{
    const e=C.$('#er'),n=C.$('#sn').value.trim(),pb=C.$('#pb').checked,pc=C.$('#pc').checked;
    if(n.length<2)return e.textContent='اكتب اسم المحل';
    if(!pc&&!pb)return e.textContent='اختر طريقة دفع واحدة على الأقل';
    if(pb&&(C.$('#bn').value.trim().length<2||C.$('#ba').value.trim().length<4))return e.textContent='أكمل بيانات الحساب البنكي';
    const lat=pos?pos.lat:(S.lat??null),lng=pos?pos.lng:(S.lng??null);
    if(lat==null)return e.textContent='حدّد موقع المحل أولًا';
    const d={shopName:n,type:C.$('#st').value,district:C.prof.district||'',lat,lng,open:C.$('#sw').checked,payCash:pc,payBank:pb,bankName:C.$('#bn').value.trim(),bankNo:C.$('#ba').value.trim(),bankApp:C.$('#bp').value.trim(),updatedAt:serverTimestamp()};
    try{await setDoc(doc(db,'providers',C.uid),d,{merge:true});S={...S,...d};e.style.color='#15803D';e.textContent='تم الحفظ'}catch(x){e.style.color='#B42318';e.textContent='تعذّر الحفظ'}
  };
}
async function menu(){
  const bd=C.$('#bd');bd.innerHTML='<p class="m">جارٍ التحميل…</p>';
  let secs,items;
  try{
    secs=(await getDocs(collection(db,'providers',C.uid,'sections'))).docs.map(d=>({id:d.id,...d.data()}));
    items=(await getDocs(collection(db,'providers',C.uid,'items'))).docs.map(d=>({id:d.id,...d.data()}));
  }catch(e){bd.innerHTML='<div class="card"><p class="er">تعذّر التحميل، تأكد من الإنترنت.</p></div>';return}
  secs.sort((a,b)=>(a.order||0)-(b.order||0));
  const it=s=>items.filter(i=>i.sec===s.id).map(i=>`<div class="r" style="margin:8px 0;align-items:center">${i.photo?`<img src="${i.photo}" alt="" style="width:52px;height:52px;object-fit:cover;border-radius:10px">`:''}<div style="flex:1"><b>${C.E(i.name)}</b><div class="m">${C.E(i.price)} ج.س ${i.avail===false?'• نفد':''}</div></div><button class="s" data-tg="${i.id}" data-av="${i.avail===false?1:0}">${i.avail===false?'متوفر':'نفد'}</button><button class="s" data-di="${i.id}">حذف</button></div>`).join('')||'<p class="m">لا توجد أصناف بعد.</p>';
  bd.innerHTML=`<div class="card"><h2>إضافة قسم جديد</h2><input id="sn2" placeholder="مثال: السندوتشات"><button class="b" id="sa">إضافة القسم</button></div>`+
  secs.map(s=>`<div class="card"><div class="r"><h2 style="margin:0">${C.E(s.name)}</h2><button class="s" data-ds="${s.id}">حذف القسم</button></div>${it(s)}<button class="s" data-ai="${s.id}" style="width:100%;margin-top:8px">+ إضافة صنف</button>
  <div id="f${s.id}" style="display:none;margin-top:8px"><input id="n${s.id}" placeholder="اسم الصنف"><input id="p${s.id}" type="number" inputmode="numeric" placeholder="السعر بالجنيه"><input id="d${s.id}" placeholder="وصف مختصر (اختياري)"><label>صورة الصنف<input id="i${s.id}" type="file" accept="image/*"></label><p id="e${s.id}" class="er"></p><button class="b" data-si="${s.id}">حفظ الصنف</button></div></div>`).join('')||'<p class="m">ابدأ بإضافة أول قسم.</p>';
  C.$('#sa').onclick=async()=>{const n=C.$('#sn2').value.trim();if(!n)return;try{await addDoc(collection(db,'providers',C.uid,'sections'),{name:n,order:Date.now()});menu()}catch(e){}};
  bd.querySelectorAll('[data-ai]').forEach(b=>b.onclick=()=>{const f=C.$('#f'+b.dataset.ai);f.style.display=f.style.display==='none'?'block':'none'});
  bd.querySelectorAll('[data-ds]').forEach(b=>b.onclick=async()=>{if(items.some(i=>i.sec===b.dataset.ds))return alert('احذف أصناف القسم أولًا');if(!confirm('حذف هذا القسم؟'))return;try{await deleteDoc(doc(db,'providers',C.uid,'sections',b.dataset.ds));menu()}catch(e){}});
  bd.querySelectorAll('[data-di]').forEach(b=>b.onclick=async()=>{if(!confirm('حذف هذا الصنف؟'))return;try{await deleteDoc(doc(db,'providers',C.uid,'items',b.dataset.di));menu()}catch(e){}});
  bd.querySelectorAll('[data-tg]').forEach(b=>b.onclick=async()=>{try{await updateDoc(doc(db,'providers',C.uid,'items',b.dataset.tg),{avail:b.dataset.av==='1'});menu()}catch(e){}});
  bd.querySelectorAll('[data-si]').forEach(b=>b.onclick=async()=>{
    const s=b.dataset.si,e=C.$('#e'+s),n=C.$('#n'+s).value.trim(),p=+C.$('#p'+s).value,f=C.$('#i'+s).files[0];
    if(!n)return e.textContent='اكتب اسم الصنف';
    if(!(p>0))return e.textContent='اكتب سعرًا صحيحًا';
    b.disabled=true;e.textContent='';
    try{
      const d={sec:s,name:n,price:p,desc:C.$('#d'+s).value.trim(),avail:true,createdAt:serverTimestamp()};
      if(f)d.photo=await shrink(f);
      await addDoc(collection(db,'providers',C.uid,'items'),d);menu();
    }catch(x){b.disabled=false;e.textContent='تعذّر الحفظ، جرّب صورة أصغر'}
  });
}
function ordersTab(){
  const bd=C.$('#bd');bd.innerHTML='<p class="m">جارٍ التحميل…</p>';
  unsubO=onSnapshot(query(collection(db,'orders'),where('pid','==',C.uid)),snap=>{
    const rank={new:0,accepted:1,ready:2};
    const l=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(rank[a.status]??9)-(rank[b.status]??9)||(b.createdAt?.seconds||9e9)-(a.createdAt?.seconds||9e9));
    const act=o=>o.status==='new'?`<div class="r"><button class="s" data-st="${o.id}|rejected" style="flex:1">رفض</button><button class="b" data-st="${o.id}|accepted" style="flex:2;margin:0">${o.pay==='bank'?'تأكيد وصول التحويل وقبول الطلب':'قبول الطلب'}</button></div>`:o.status==='accepted'?`<button class="b" data-st="${o.id}|ready">جاهز للاستلام</button>`:o.status==='ready'?'<p class="m">بانتظار الطيار.</p>':'';
    bd.innerHTML=l.map(o=>`<div class="card" ${o.status==='new'?'style="border:2px solid #1D4ED8"':''}><div class="r"><span class="tg">${ST[o.status]||o.status}</span>${o.urgent?'<span class="tg" style="background:#1D4ED8;color:#fff">مستعجل</span>':''}</div>
    <b>${C.E(o.cname)}</b><div class="m">${C.E(o.addr)} • ${o.dist} كم</div>
    <a href="https://www.google.com/maps?q=${o.lat},${o.lng}" target="_blank" rel="noopener">موقع التوصيل على الخريطة</a>
    <div>${o.items.map(i=>`<div class="r"><span>${i.qty} × ${C.E(i.name)}</span><b>${i.qty*i.price}</b></div>`).join('')}</div>
    <div class="r"><b>قيمة الأصناف</b><b>${o.sub} ج.س</b></div>
    <div class="m">الدفع: ${o.pay==='bank'?'تحويل بنكي':'عند الاستلام'}</div>
    ${o.receipt?`<img src="${o.receipt}" alt="إشعار التحويل" style="max-width:100%;border-radius:12px">`:''}
    ${act(o)}</div>`).join('')||'<div class="card"><p class="m">لا توجد طلبات بعد.</p></div>';
    bd.querySelectorAll('[data-st]').forEach(b=>b.onclick=async()=>{const [id,st]=b.dataset.st.split('|');b.disabled=true;try{await updateDoc(doc(db,'orders',id),{status:st})}catch(e){b.disabled=false;alert('تعذّر التحديث')}});
  },()=>{bd.innerHTML='<div class="card"><p class="er">تعذّر تحميل الطلبات.</p></div>'});
}
