import {initializeApp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {getAuth,signInAnonymously,onAuthStateChanged,EmailAuthProvider,linkWithCredential,signInWithEmailAndPassword,reauthenticateWithCredential,signOut,setPersistence,browserLocalPersistence} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {getFirestore,doc,getDoc,setDoc,addDoc,collection,getDocs,onSnapshot,serverTimestamp,deleteDoc,updateDoc} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig={
apiKey:"AIzaSyCq6dRqw8_Zg5Hn9WjqAIeqyB9bcLKYHv4",
authDomain:"hisab-kitab-15615.firebaseapp.com",
projectId:"hisab-kitab-15615",
storageBucket:"hisab-kitab-15615.firebasestorage.app",
messagingSenderId:"1011174772797",
appId:"1:1011174772797:web:ce40eb61fb0c69fd685a54"
};

const N=["Sajeed","Asrar","Asfak","Abdus","Talib","Emteyaz"];
const $=id=>document.getElementById(id);
const M=n=>"₹"+Number(n||0).toLocaleString("en-IN",{maximumFractionDigits:2});

let db,uid,room,admin=false,expenses=[],away=[],members=[],off=[],bills=[],payments=[],budget=0,upis={},profiles={};

$("name").innerHTML=N.map(n=>`<option>${n}</option>`).join("");

const authCard=document.createElement("div");
authCard.className="card";
authCard.innerHTML='<h3 id="fk6AuthTitle">Account access</h3><p class="muted" id="fk6AuthDescription">Sign in once. Your account will stay signed in on this device until you log out.</p><input id="fk6AuthEmail" type="email" autocomplete="email" placeholder="Your email address"><input id="fk6AuthPassword" type="password" autocomplete="current-password" placeholder="Password (6+ characters)"><button id="fk6LinkAccount">Secure this device account</button><button id="fk6SignIn" class="secondary">Sign in</button><button id="fk6Logout" class="danger hidden">Log out</button><p class="muted" id="fk6AuthMsg">Your login is saved securely on this device.</p>';
function mountAuthCard(target){
if(target&&authCard.parentElement!==target)target.appendChild(authCard);
}
mountAuthCard($("join"));
$("fk6LinkAccount").onclick=async()=>{
try{
let user=auth.currentUser,email=$("fk6AuthEmail").value.trim(),password=$("fk6AuthPassword").value;
if(!user||!user.isAnonymous)throw Error("This device is not using an anonymous account. Use Sign in instead.");
if(!email||password.length<6)throw Error("Enter a valid email and password of at least 6 characters.");
await linkWithCredential(user,EmailAuthProvider.credential(email,password));
$("fk6AuthMsg").textContent="Account secured. Your existing member ID and room remain the same. Now sign in on the APK using this email and password.";
alert("Account secured successfully. Your existing room identity is preserved.");
}catch(e){$("fk6AuthMsg").textContent=e.message;alert(e.message)}
};
$("fk6Logout").onclick=async()=>{try{if(!confirm("Log out from this device? You will need to sign in again to open your flat."))return;localStorage.setItem("fk6_logged_out","1");await signOut(auth);}catch(e){alert("Could not log out: "+e.message)}};
if($("logoutMain"))$("logoutMain").onclick=$("fk6Logout").onclick;
$("fk6SignIn").onclick=async()=>{
try{
let email=$("fk6AuthEmail").value.trim(),password=$("fk6AuthPassword").value;
if(!email||!password)throw Error("Enter your email and password.");
await signInWithEmailAndPassword(auth,email,password);
$("fk6AuthMsg").textContent="Signed in. Restoring your flat…";
}catch(e){$("fk6AuthMsg").textContent=e.message;alert(e.message)}
};


function msg(t){$("status").textContent=t}

function days(a,b){
let x=new Date(a+"T12:00:00"),y=new Date(b+"T12:00:00");
return !a||!b||y<x?0:Math.floor((y-x)/86400000)+1;
}

function stay(n,a,b){
let d=days(a,b);
away.filter(x=>x.name===n).forEach(x=>{
let lo=x.start>a?x.start:a,hi=x.end<b?x.end:b;
if(hi>=lo)d-=days(lo,hi);
});
return Math.max(0,d);
}

function balances(){
let b=N.map(()=>0);
expenses.forEach(e=>{
let p=N.indexOf(e.payer);
if(p>=0)b[p]+=+e.amount;
(e.shares||[]).forEach(s=>{
let i=N.indexOf(s.name);
if(i>=0)b[i]-=+s.amount;
});
});
payments.filter(p=>p.status==="confirmed").forEach(p=>{
let i=N.indexOf(p.from),j=N.indexOf(p.to);
if(i>=0)b[i]+=+p.amount;
if(j>=0)b[j]-=+p.amount;
});
return b;
}

function settlements(){
let b=balances();
let d=b.map((v,i)=>({i,a:-v})).filter(x=>x.a>.005);
let c=b.map((v,i)=>({i,a:v})).filter(x=>x.a>.005);
let o=[],i=0,j=0;
while(i<d.length&&j<c.length){
let a=Math.min(d[i].a,c[j].a);
o.push({from:N[d[i].i],to:N[c[j].i],amount:a});
d[i].a-=a;c[j].a-=a;
if(d[i].a<.01)i++;
if(c[j].a<.01)j++;
}
return o;
}

async function payLink(to,maximum){
let from=localStorage.getItem("fk6_name")||members.find(m=>m.uid===uid)?.name;
if(!from){alert("Your member profile could not be identified.");return;}
let ownDue=settlements().find(x=>x.from===from&&x.to===to);
if(!ownDue){alert("You can only pay your own pending balance.");return;}
let pending=payments.filter(p=>p.status==="pending"&&p.from===from&&p.to===to).reduce((a,p)=>a+Number(p.amount||0),0);
let available=Math.max(0,Number(ownDue.amount)-pending);
if(available<=0){alert("Your payment is already awaiting confirmation.");return;}
let amount=Number(prompt("Enter amount to pay now. Remaining payable: ₹"+available.toFixed(2),String(Math.min(50,available))));
if(!Number.isFinite(amount)||amount<=0||amount>available){alert("Enter a valid amount up to ₹"+available.toFixed(2));return;}
let receiver=members.find(m=>m.name===to);
if(!receiver){alert("Recipient member not found.");return;}
let v=upis[to];
if(!v){alert("No UPI ID saved for "+to+". Ask Sajeed to add it.");return;}
let draft={from,to,amount,recipientUid:receiver.uid,createdAt:Date.now()};
let upiUri="upi://pay?pa="+encodeURIComponent(v)+"&am="+encodeURIComponent(amount.toFixed(2))+"&cu=INR&tn="+encodeURIComponent("Flat Khata 6 settlement");
let overlay=document.createElement("div");
overlay.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.86);z-index:100000;display:flex;align-items:center;justify-content:center;padding:14px;overflow:auto";
let panel=document.createElement("div");
panel.style.cssText="background:#fff;color:#17231e;border-radius:18px;padding:18px;width:min(100%,390px);text-align:center;max-height:92vh;overflow:auto";
panel.innerHTML='<h2 style="margin:4px 0 8px">Pay '+to+'</h2><h1 style="font-size:30px;margin:6px 0">₹'+amount.toFixed(2)+'</h1><p style="overflow-wrap:anywhere;font-weight:600;margin:8px 0">'+v+'</p><img id="fk6PayQr" alt="UPI payment QR code" style="width:240px;height:240px;max-width:100%;object-fit:contain;display:block;margin:12px auto" src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data='+encodeURIComponent(upiUri)+'"><p style="font-size:13px;color:#46554d">Scan this QR using another phone. Check the recipient name and amount in your UPI app before paying.</p><button id="fk6Copy" style="width:100%;padding:12px;border:0;border-radius:10px;background:#e9f2ed;margin:5px 0">Copy UPI ID</button><a id="fk6OpenUpi" href="'+upiUri+'" style="display:block;padding:13px;border-radius:10px;background:#167d55;color:white;text-decoration:none;font-weight:700;margin:6px 0">Open UPI app</a><button id="fk6PaidQr" style="width:100%;padding:12px;border:0;border-radius:10px;background:#d7f4e5;color:#075b3b;font-weight:700;margin:5px 0">I have paid</button><button id="fk6CloseQr" style="width:100%;padding:11px;border:0;border-radius:10px;background:#eee;margin-top:5px">I have not paid, close</button><p style="font-size:11px;color:#65736b">The app cannot verify bank payment automatically. The recipient must confirm receipt.</p>';
overlay.appendChild(panel);document.body.appendChild(overlay);
panel.querySelector("#fk6Copy").onclick=async()=>{try{await navigator.clipboard.writeText(v);alert("UPI ID copied. Open PhonePe and pay manually.")}catch(e){prompt("Copy this UPI ID",v)}};
panel.querySelector("#fk6OpenUpi").onclick=()=>localStorage.setItem("fk6_payment_draft",JSON.stringify(draft));
panel.querySelector("#fk6PaidQr").onclick=()=>{localStorage.setItem("fk6_payment_draft",JSON.stringify(draft));overlay.remove();showPaymentReturn()};
panel.querySelector("#fk6CloseQr").onclick=()=>overlay.remove();
overlay.addEventListener("click",e=>{if(e.target===overlay)overlay.remove()});
panel.querySelector("#fk6PayQr").onerror=function(){this.style.display="none";let note=document.createElement("p");note.textContent="QR image could not load. Use Copy UPI ID to pay manually.";panel.insertBefore(note,panel.querySelector("#fk6Copy"))};
}function showPaymentReturn(){
let raw=localStorage.getItem("fk6_payment_draft");
let box=document.getElementById("fk6PaymentReturn");
if(!raw||!box)return;
let d;try{d=JSON.parse(raw)}catch(e){localStorage.removeItem("fk6_payment_draft");return}
if(Date.now()-Number(d.createdAt||0)>30*60*1000){localStorage.removeItem("fk6_payment_draft");box.hidden=true;return}
box.hidden=false;
box.innerHTML=`<div style="background:#102b22;border:1px solid #2a8061;border-radius:16px;padding:16px;margin:12px;color:#fff;position:relative;z-index:9999"><b>Did you complete the payment?</b><p style="margin:8px 0;color:#c5d8d0">${d.from} → ${d.to} · ${M(d.amount)}</p><p style="font-size:13px;color:#c5d8d0">Only tap Payment Done after the UPI app shows successful payment.</p><div style="display:flex;gap:8px"><button id="fk6PaymentDone" style="flex:1;background:#25c987;color:#06271c;border:0;border-radius:10px;padding:12px;font-weight:700">Payment Done</button><button id="fk6PaymentCancel" style="flex:1;background:#59313b;color:#fff;border:0;border-radius:10px;padding:12px;font-weight:700">I didn't pay</button></div></div>`;
document.getElementById("fk6PaymentDone").onclick=async()=>{
try{
if(!uid||!room)throw Error("Room is not connected. Reopen the app and try again.");
if(d.from!==(localStorage.getItem("fk6_name")||members.find(m=>m.uid===uid)?.name))throw Error("This payment belongs to another member.");
await addDoc(collection(db,"rooms",room,"settlements"),{from:d.from,to:d.to,amount:Number(d.amount),status:"pending",recipientUid:d.recipientUid,recipientName:d.to,createdBy:uid,createdByName:d.from,createdAt:serverTimestamp(),date:new Date().toISOString().slice(0,10)});
localStorage.removeItem("fk6_payment_draft");box.hidden=true;alert("Payment claim sent. The recipient must confirm receipt before balances change.");render();
}catch(e){alert("Could not record payment: "+e.message)}
};
document.getElementById("fk6PaymentCancel").onclick=()=>{localStorage.removeItem("fk6_payment_draft");box.hidden=true;alert("No payment record was created.")};
}


let personalRows=[],personalOff=null,personalUnlocked=false,personalLastTouch=0;
const personalKey=()=> "fk6_pin_"+uid;
async function pinHash(pin,salt){const bytes=new TextEncoder().encode(salt+":"+pin);const hash=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,"0")).join("")}
function personalLock(){
personalUnlocked=false;if(personalOff){personalOff();personalOff=null}
$("personalOpen").classList.add("hidden");$("personalLocked").classList.remove("hidden");
const hasPin=!!localStorage.getItem(personalKey());
$("personalPin2").style.display=hasPin?"none":"block";
$("pinPrompt").textContent=hasPin?"Enter your 6-digit MPIN.":"Create a 6-digit MPIN for this account.";
$("personalUnlock").textContent=hasPin?"Unlock Personal Expenses":"Set MPIN and unlock";
$("personalPin").placeholder=hasPin?"Enter 6-digit MPIN":"6-digit MPIN";
$("personalPin").value="";$("personalPin2").value="";
}
async function personalUnlock(){
if(!uid)throw Error("Sign in first.");
const pin=$("personalPin").value,confirmPin=$("personalPin2").value,stored=localStorage.getItem(personalKey());
if(!/^\d{6}$/.test(pin))throw Error("MPIN must contain exactly 6 digits.");
if(!stored){
if(pin!==confirmPin)throw Error("MPIN entries do not match.");
const salt=crypto.randomUUID(),hash=await pinHash(pin,salt);
localStorage.setItem(personalKey(),JSON.stringify({salt,hash}));$("personalPin2").style.display="none";
}else{
const saved=JSON.parse(stored);
if(await pinHash(pin,saved.salt)!==saved.hash)throw Error("Incorrect MPIN.");
}
personalUnlocked=true;personalLastTouch=Date.now();
$("personalLocked").classList.add("hidden");$("personalOpen").classList.remove("hidden");
if(personalOff)personalOff();
personalOff=onSnapshot(collection(db,"users",uid,"personalExpenses"),s=>{
personalRows=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
renderPersonal();
},e=>alert("Personal data could not load: "+e.message));
}
function renderPersonal(){
if(!personalUnlocked)return;
const total=personalRows.reduce((s,x)=>s+Number(x.amount||0),0);
$("personalTotal").textContent=M(total);$("personalCount").textContent=personalRows.length;
$("personalHistory").innerHTML=personalRows.map(x=>'<div class="row"><span><b>'+escapeHtml(x.title)+'</b><br><small>'+escapeHtml(x.date||"")+' · '+escapeHtml(x.category||"Other")+(x.note?' · '+escapeHtml(x.note):"")+'</small></span><b>'+M(x.amount)+'</b></div>').join("")||'<p class="muted">No personal expenses yet.</p>';
}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}


function avatarFallback(name){return "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="100%" height="100%" rx="60" fill="#1b4938"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="48" fill="#9af0c7" font-family="Arial">'+String(name||"?").slice(0,1).toUpperCase()+'</text></svg>')}
function personLabel(name){
const m=members.find(x=>x.name===name),p=m?profiles[m.uid]||{}:{};
return '<span class="person-label"><img src="'+(p.photo||avatarFallback(name))+'" alt="">'+escapeHtml(name)+'</span>';
}
function renderProfiles(){
$("memberProfiles").innerHTML=members.map(m=>{const p=profiles[m.uid]||{};return '<div class="profile-item"><img src="'+(p.photo||avatarFallback(m.name))+'" alt=""><div><strong>'+escapeHtml(m.name)+'</strong><small>'+(p.email?escapeHtml(p.email):"Email not added")+'</small><small>'+(p.phone?escapeHtml(p.phone):"Phone not added")+'</small></div></div>'}).join("");
const strip=$("homeMemberStrip");
if(strip){$("homeMemberCount").textContent=members.length+"/6";strip.innerHTML=members.map(m=>{const p=profiles[m.uid]||{};return '<div class="home-member '+(m.uid===uid?'is-me':'')+'"><img src="'+(p.photo||avatarFallback(m.name))+'" alt=""><span>'+escapeHtml(m.name)+'</span>'+(m.uid===uid?'<small>You</small>':'')+'</div>'}).join("")+(members.length<6?'<div class="home-member"><span class="home-member-add">+</span><span>Add</span></div>':"")}
const mine=profiles[uid]||{},img=$("profileAvatar");
if(img)img.src=mine.photo||avatarFallback(members.find(m=>m.uid===uid)?.name);
const homeImg=$("homeAvatar"),myName=members.find(m=>m.uid===uid)?.name||localStorage.getItem("fk6_name")||"Flatmate";
if(homeImg)homeImg.src=mine.photo||avatarFallback(myName);
if($("homeMemberName"))$("homeMemberName").textContent=myName;
if($("homeRole"))$("homeRole").textContent=admin?"Flat Admin":"Flat Member";
if($("homeRoomCode"))$("homeRoomCode").textContent=room||"-----";
if($("homeRoom"))$("homeRoom").textContent=room?"Room "+room+" · "+(admin?"Permanent admin":"Flat member"):"Shared living made simple";
}
async function loadMyProfile(){
if(!uid||!room)return;
const snap=await getDoc(doc(db,"rooms",room,"profiles",uid));
profiles[uid]=snap.exists()?snap.data():{};
const me=members.find(m=>m.uid===uid);
$("profileName").value=me?.name||localStorage.getItem("fk6_name")||"";
$("profileEmail").value=profiles[uid].email||"";
$("profilePhone").value=profiles[uid].phone||"";
renderProfiles();
}
$("profilePhotoInput").onchange=async e=>{
const file=e.target.files?.[0];if(!file)return;
if(!file.type.startsWith("image/")){alert("Choose an image.");return}
if(file.size>8*1024*1024){alert("Choose a photo smaller than 8 MB.");return}
try{
const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});
const img=new Image();img.onload=async()=>{const canvas=document.createElement("canvas"),max=360,scale=Math.min(1,max/Math.max(img.width,img.height));canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);const photo=canvas.toDataURL("image/jpeg",.72);profiles[uid]={...(profiles[uid]||{}),photo};$("profileAvatar").src=photo;};img.onerror=()=>alert("Could not read this image.");img.src=data;
}catch(err){alert("Photo processing failed: "+err.message)}
};
$("saveProfile").onclick=async()=>{
try{
if(!uid||!room)throw Error("Join your flat first.");
const me=members.find(m=>m.uid===uid);if(!me)throw Error("Member profile not found.");
const photo=profiles[uid]?.photo||"";
if(photo.length>850000)throw Error("Photo is too large. Choose another photo.");
const data={uid,name:me.name,email:$("profileEmail").value.trim().slice(0,120),phone:$("profilePhone").value.trim().slice(0,30),photo,updatedAt:serverTimestamp()};
await setDoc(doc(db,"rooms",room,"profiles",uid),data,{merge:true});
profiles[uid]=data;renderProfiles();alert("Profile saved and synced for all flatmates.");
}catch(e){alert("Could not save profile: "+e.message)}
};

function showTab(id){if(id==="profile")loadMyProfile().catch(e=>alert("Profile could not load: "+e.message));if(id==="groups")loadGroupData().catch(e=>alert(e.message));if(id==="wallet")loadWallet().catch(e=>alert(e.message));if(id==="recurring")loadRecurring().catch(e=>alert(e.message));document.querySelectorAll(".tabs button").forEach(x=>x.classList.toggle("active",x.dataset.tab===id));document.querySelectorAll(".section").forEach(x=>x.classList.toggle("active",x.id===id));window.scrollTo({top:0,behavior:"smooth"})}

function render(){
let b=balances();
$("total").textContent=M(expenses.reduce((a,e)=>a+(+e.amount||0),0));
$("memberCount").textContent=members.length+" / 6";
let myIndex=N.indexOf(members.find(m=>m.uid===uid)?.name||localStorage.getItem("fk6_name"));
let myBalance=myIndex>=0?(b[myIndex]||0):0;
$("yourBalance").textContent=(myBalance>0?"+":myBalance<0?"−":"")+M(Math.abs(myBalance));
$("yourBalanceLabel").textContent=myBalance>0?"You are owed":myBalance<0?"You owe":"All settled";
$("balances").innerHTML=N.map((n,i)=>`<div class="row"><span>${personLabel(n)} <small>${b[i]>=0?"gets back":"owes"}</small></span><b class="${b[i]>=0?"pos":"neg"}">${M(Math.abs(b[i]))}</b></div>`).join("");
let ss=settlements();
let me=localStorage.getItem("fk6_name")||members.find(m=>m.uid===uid)?.name;
$("settle").innerHTML=ss.map(x=>{
let pending=payments.filter(p=>p.status==="pending"&&p.from===x.from&&p.to===x.to).reduce((a,p)=>a+Number(p.amount||0),0),left=Math.max(0,x.amount-pending);
return `<div class="row"><span>${personLabel(x.from)} pays ${personLabel(x.to)} <b>${M(x.amount)}</b>${pending?`<br><small>${M(pending)} awaiting confirmation</small>`:""}</span>${x.from===me&&left>.005?`<button style="width:auto" data-pay="${x.to}" data-amount="${left}">Pay part</button>`:""}</div>`
}).join("")||"All settled.";
let exp=e=>`<div class="row"><span><b>${e.title}</b><br><small>${e.category}, paid by ${personLabel(e.payer)}, ${e.date||""}</small><br><small>${(e.shares||[]).map(s=>personLabel(s.name)+" "+M(s.amount)).join(", ")}</small></span><span><b>${M(e.amount)}</b>${admin?`<button class="danger" data-del="${e.id}">Delete</button>`:""}</span></div>`;
$("historyList").innerHTML=expenses.map(exp).join("")||"No expenses yet.";
const categoryIcon={Groceries:"🛒",Electricity:"ϟ",Food:"♨",Rent:"⌂",Water:"💧","Wi-Fi":"⌁", "Gas cylinder":"♨",Other:"▤"};
$("recentList").innerHTML=expenses.slice(0,4).map(e=>'<div class="row"><span>'+personLabel(e.payer)+'<br><small>'+(categoryIcon[e.category]||"▤")+' '+escapeHtml(e.title)+' · '+escapeHtml(e.date||"")+'</small></span><span><b>'+M(e.amount)+'</b></span></div>').join("")||'<p class="muted">No expenses yet.</p>';
$("awayList").innerHTML=away.map(a=>`<div class="row">${personLabel(a.name)}: ${a.start} to ${a.end} ${admin?`<button class="danger" data-away="${a.id}">Delete</button>`:""}</div>`).join("")||"No away records.";
document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>admin&&confirm("Delete expense?")&&deleteDoc(doc(db,"rooms",room,"expenses",b.dataset.del)));
document.querySelectorAll("[data-away]").forEach(b=>b.onclick=()=>admin&&confirm("Delete away period?")&&deleteDoc(doc(db,"rooms",room,"absences",b.dataset.away)));
document.querySelectorAll("[data-pay]").forEach(b=>b.onclick=()=>payLink(b.dataset.pay,b.dataset.amount));
renderExtras()
}

function renderExtras(){
let month=$("reportMonth").value||new Date().toISOString().slice(0,7),list=expenses.filter(e=>(e.date||"").slice(0,7)===month),sum=list.reduce((s,e)=>s+(+e.amount||0),0),cats={};
list.forEach(e=>cats[e.category||"Other"]=(cats[e.category||"Other"]||0)+(+e.amount||0));
$("monthTotal").textContent=M(sum);
$("monthCount").textContent=list.length;
$("categoryReport").innerHTML=Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="row"><span>${k}</span><b>${M(v)}</b></div>`).join("")||"No expenses this month.";
let spent=sum;
$("budgetStatus").textContent=budget?`Budget ${M(budget)} · Used ${M(spent)} · Remaining ${M(budget-spent)}${spent>budget?" · Budget exceeded!":""}`:"No monthly budget set.";
if(budget&&spent>budget&&localStorage.getItem("fk6_budget_alert_"+month)!=="yes"){alert("Monthly budget exceeded. Spent "+M(spent)+" of "+M(budget));localStorage.setItem("fk6_budget_alert_"+month,"yes")}
let acts=[...expenses.map(e=>({t:e.createdAt?.toDate?.()||new Date(e.date||Date.now()),s:`${e.createdByName||e.payer} added ${e.title} · ${M(e.amount)}`})),...away.map(a=>({t:new Date(a.start),s:`${a.name} recorded away days ${a.start} to ${a.end}`}))].sort((a,b)=>b.t-a.t);
$("activityList").innerHTML=acts.slice(0,25).map(a=>`<div class="row">${a.s}</div>`).join("")||"No activity yet.";
$("billList").innerHTML=bills.map(x=>`<div class="row"><span><b>${x.title}</b><br><small>${x.category}, paid by ${x.payer}</small></span><b>${M(x.amount)}</b></div>`).join("")||"No fixed bills saved.";
$("settlementList").innerHTML=payments.map(x=>`<div class="row"><span>${personLabel(x.from)} → ${personLabel(x.to)} ${M(x.amount)}<br><small>${x.date||""} · ${x.status||"legacy record"}</small></span>${x.status==="pending"&&x.recipientUid===uid?`<button style="width:auto" data-confirm="${x.id}">Confirm received</button>`:""}${x.status==="pending"&&x.createdBy===uid?`<button class="danger" style="width:auto" data-cancel="${x.id}">Cancel request</button>`:""}</div>`).join("")||"No payments recorded.";
document.querySelectorAll("[data-confirm]").forEach(b=>b.onclick=async()=>{
if(!confirm("Confirm that you received this payment?"))return;
try{await updateDoc(doc(db,"rooms",room,"settlements",b.dataset.confirm),{status:"confirmed",confirmedAt:serverTimestamp(),confirmedBy:uid});alert("Payment confirmed. Balances updated.")}
catch(e){alert("Could not confirm. Update Firestore Rules first. "+e.message)}
});
document.querySelectorAll("[data-cancel]").forEach(b=>b.onclick=async()=>{
if(!confirm("Cancel this pending payment request?"))return;
try{await updateDoc(doc(db,"rooms",room,"settlements",b.dataset.cancel),{status:"cancelled",cancelledAt:serverTimestamp(),cancelledBy:uid});alert("Payment request cancelled.")}
catch(e){alert("Could not cancel. Update Firestore Rules first. "+e.message)}
});
let personBox=$("personWiseList");
if(personBox){
personBox.innerHTML=N.map(name=>{
let paidExpenses=expenses.filter(e=>e.payer===name).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
let sentPayments=payments.filter(p=>p.from===name&&p.status==="confirmed").sort((a,b)=>(b.date||"").localeCompare(a.date||""));
let expenseTotal=paidExpenses.reduce((sum,e)=>sum+Number(e.amount||0),0);
let transferTotal=sentPayments.reduce((sum,p)=>sum+Number(p.amount||0),0);
let expenseRows=paidExpenses.map(e=>'<div class="row"><span><b>'+e.title+'</b><br><small>'+((e.date)||"Date not available")+' · '+(e.category||"Expense")+'</small></span><b>'+M(e.amount)+'</b></div>').join("");
let transferRows=sentPayments.map(p=>'<div class="row"><span><b>Settlement to '+p.to+'</b><br><small>'+(p.date||"Date not available")+' · Confirmed payment</small></span><b>'+M(p.amount)+'</b></div>').join("");
return '<div class="card" style="margin:12px 0"><h3>'+name+'</h3><div class="grid"><div class="metric"><span>Expenses paid</span><strong>'+M(expenseTotal)+'</strong></div><div class="metric"><span>Settlements sent</span><strong>'+M(transferTotal)+'</strong></div></div><p class="muted">Expenses paid by '+name+'</p>'+(expenseRows||'<p class="muted">No paid expenses recorded.</p>')+'<p class="muted">Confirmed settlements sent</p>'+(transferRows||'<p class="muted">No confirmed settlements yet.</p>')+'</div>'
}).join("");
}
$("upiList").innerHTML=N.map(n=>`<div class="row">${n}<small>${upis[n]||"UPI ID not added"}</small></div>`).join("")
}

function csv(){
let m=$("reportMonth").value||new Date().toISOString().slice(0,7),rows=[["Date","Title","Category","Paid by","Amount","Split","Shares"],...expenses.filter(e=>(e.date||"").slice(0,7)===m).map(e=>[e.date,e.title,e.category,e.payer,e.amount,e.splitMode,(e.shares||[]).map(s=>s.name+":"+s.amount).join("; ")])],data=rows.map(r=>r.map(v=>'"'+String(v??"").replaceAll('"','""')+'"').join(",")).join("\n"),u=URL.createObjectURL(new Blob([data],{type:"text/csv"})),a=document.createElement("a");
a.href=u;a.download=`flat-khata-${m}.csv`;a.click();URL.revokeObjectURL(u)
  }function listen(){
off.forEach(f=>f());off=[];
off.push(
onSnapshot(collection(db,"rooms",room,"expenses"),s=>{
expenses=s.docs.map(d=>({id:d.id,...d.data()}));
render();notifyActivity("expense",s.docChanges())
}),
onSnapshot(collection(db,"rooms",room,"absences"),s=>{
away=s.docs.map(d=>({id:d.id,...d.data()}));
render();notifyActivity("away",s.docChanges())
}),
onSnapshot(collection(db,"rooms",room,"members"),s=>{
members=s.docs.map(d=>({...d.data(),uid:d.id}));
$("memberCount").textContent=members.length+"/6";
const currentMemberName=members.find(m=>m.uid===uid)?.name||localStorage.getItem("fk6_name")||"";
const priorityNames=currentMemberName?[currentMemberName,...N.filter(n=>n!==currentMemberName)]:N;
["payer","awayName","billPayer","settleFrom","settleTo","upiMember","name"].forEach(id=>{
let el=$(id);if(!el)return;
let previous=el.value;
el.innerHTML=priorityNames.map(n=>'<option value="'+n+'">'+n+'</option>').join("");
if(id==="payer"||id==="billPayer")el.value=currentMemberName||previous||N[0];
else if(previous&&priorityNames.includes(previous))el.value=previous;
else if(id==="name"&&currentMemberName)el.value=currentMemberName;
});
$("checks").innerHTML=N.map(n=>`<label><input type="checkbox" class="part" value="${n}" checked> ${n}</label>`).join("");
$("groupMemberChecks").innerHTML=N.map(n=>`<label><input type="checkbox" class="groupMember" value="${n}" checked> ${n}</label>`).join("");
["groupExpensePayer","recurringPayer"].forEach(id=>$(id).innerHTML=N.map(n=>`<option>${n}</option>`).join(""));
$("custom").innerHTML=N.map(n=>`<label>${n}<input class="share" data-name="${n}" type="number" placeholder="₹"></label>`).join("");
render();renderProfiles()
}),
onSnapshot(collection(db,"rooms",room,"profiles"),s=>{profiles={};s.docs.forEach(d=>profiles[d.id]=d.data());renderProfiles()}),
onSnapshot(collection(db,"rooms",room,"fixedBills"),s=>{
bills=s.docs.map(d=>({id:d.id,...d.data()}));renderExtras()
}),
onSnapshot(collection(db,"rooms",room,"settlements"),s=>{
if(firstSettlementSnapshot){firstSettlementSnapshot=false;payments=s.docs.map(d=>({id:d.id,...d.data()}));render();return}
for(const c of s.docChanges()){if(c.type!=="added"&&c.type!=="modified")continue;const p=c.doc.data();if(c.type==="added"&&p.recipientUid===uid&&p.status==="pending")priorityNotice("high","Payment confirmation needed",p.from+" says they paid "+M(p.amount)+". Confirm only after receiving it.");if(c.type==="modified"&&p.createdBy===uid&&p.status==="confirmed")priorityNotice("high","Payment confirmed",p.to+" confirmed your payment of "+M(p.amount)+".");}
payments=s.docs.map(d=>({id:d.id,...d.data()}));render()
}),
onSnapshot(doc(db,"rooms",room,"settings","budget"),s=>{
budget=s.exists()?+s.data().amount:0;renderExtras()
}),
onSnapshot(doc(db,"rooms",room,"settings","upi"),s=>{
upis=s.exists()?(s.data().ids||{}):{};renderExtras()
})
);
$("join").classList.add("hidden");
$("app").classList.remove("hidden");
mountAuthCard($("settings"));
$("roomLabel").textContent="Room code: "+room+(admin?" · Permanent Admin":" · Member")
}

let firstExpenseSnapshot=true,firstAwaySnapshot=true,firstSettlementSnapshot=true;

function priorityNotice(level,title,body){
msg((level==='high'?'Important: ':'')+body);
if('Notification'in window&&Notification.permission==='granted'&&!document.hidden){try{new Notification(title,{body,tag:'fk6-'+level,renotify:true})}catch(e){}}
}
function notifyActivity(type,changes){
let first=type==="expense"?firstExpenseSnapshot:firstAwaySnapshot;
if(type==="expense")firstExpenseSnapshot=false;
else firstAwaySnapshot=false;
if(first)return;
for(const c of changes){
if(c.type!=="added")continue;
let d=c.doc.data();
if(d.createdBy===uid)continue;
let message=type==="expense"?`${d.createdByName||d.payer} added ${d.title||"an expense"} (${M(d.amount)})`:`${d.name} added away dates`;
priorityNotice(type==="expense"?"normal":"low",type==="expense"?"New shared expense":"Away mode updated",message)
}
}

async function join(code,name){
let r=await getDoc(doc(db,"rooms",code));
if(!r.exists())throw Error("Room code not found.");
let ref=doc(db,"rooms",code,"members",uid),old=await getDoc(ref);
if(old.exists()){
if(old.data().name!==name)throw Error("This phone is already registered as "+old.data().name+".");
room=code;admin=r.data().adminUid===uid;
localStorage.setItem("fk6_room",code);
localStorage.setItem("fk6_name",name);
listen();msg("Welcome back, "+name+". Your flat is connected.");return
}
let ms=await getDocs(collection(db,"rooms",code,"members"));
if(ms.docs.some(d=>d.data().name===name))throw Error(name+" is already registered on another device. Use that member's original phone/browser.");
if(ms.size>=6)throw Error("All six member slots are filled.");
await setDoc(ref,{uid,name,role:r.data().adminUid===uid?"admin":"member",joinedAt:serverTimestamp()});
room=code;admin=r.data().adminUid===uid;
localStorage.setItem("fk6_room",code);
localStorage.setItem("fk6_name",name);
listen()
}

$("createBtn").onclick=async()=>{
try{
if($("name").value!=="Sajeed")throw Error("Select Sajeed to create the room.");
let code=Array.from(crypto.getRandomValues(new Uint8Array(5))).map(x=>"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x%32]).join("");
await setDoc(doc(db,"rooms",code),{name:"Flat Khata 6",adminUid:uid,createdAt:serverTimestamp()});
await setDoc(doc(db,"rooms",code,"members",uid),{uid,name:"Sajeed",role:"admin",joinedAt:serverTimestamp()});
room=code;admin=true;
localStorage.setItem("fk6_room",code);
localStorage.setItem("fk6_name","Sajeed");
listen();alert("Room code: "+code)
}catch(e){alert(e.message)}
};

$("joinBtn").onclick=async()=>{
try{await join($("code").value.trim().toUpperCase(),$("name").value)}
catch(e){alert(e.message)}
};

document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{if(b.dataset.tab==="personal"&&!personalUnlocked)personalLock();showTab(b.dataset.tab)});
$("personalUnlock").onclick=()=>personalUnlock().catch(e=>alert(e.message));
$("personalLock").onclick=personalLock;
$("personalSave").onclick=async()=>{try{if(!personalUnlocked)throw Error("Unlock Personal Expenses first.");const title=$("personalTitle").value.trim(),amount=Number($("personalAmount").value),date=$("personalDate").value||new Date().toISOString().slice(0,10);if(!title||!Number.isFinite(amount)||amount<=0)throw Error("Enter a title and valid amount.");await addDoc(collection(db,"users",uid,"personalExpenses"),{title,amount,date,category:$("personalCategory").value,note:$("personalNote").value.trim(),ownerUid:uid,createdAt:serverTimestamp()});$("personalTitle").value="";$("personalAmount").value="";$("personalNote").value="";}catch(e){alert(e.message)}};
$("personalChangePin").onclick=()=>{const next=prompt("Enter a new 6-digit MPIN");if(!/^\\d{6}$/.test(next||"")){alert("MPIN must contain exactly 6 digits.");return}const again=prompt("Confirm new MPIN");if(next!==again){alert("MPINs do not match.");return}crypto.randomUUID&&pinHash(next,crypto.randomUUID()).then(hash=>{const salt=crypto.randomUUID();return pinHash(next,salt).then(h=>localStorage.setItem(personalKey(),JSON.stringify({salt,hash:h}))) }).then(()=>alert("MPIN changed."))};
$("personalReset").onclick=async()=>{try{const email=prompt("Enter your account email"),password=prompt("Enter your account password");if(!email||!password) return;await reauthenticateWithCredential(auth.currentUser,EmailAuthProvider.credential(email,password));localStorage.removeItem(personalKey());$("pinPrompt").textContent="Set a new 6-digit MPIN.";alert("Account verified. Set a new MPIN now.");}catch(e){alert("Account verification failed: "+e.message)}};
document.addEventListener("visibilitychange",()=>{if(document.hidden&&personalUnlocked)personalLock()});
["click","keydown","touchstart"].forEach(ev=>document.addEventListener(ev,()=>{if(personalUnlocked)personalLastTouch=Date.now()},{passive:true}));
setInterval(()=>{if(personalUnlocked&&Date.now()-personalLastTouch>120000)personalLock()},10000);

document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>showTab(b.dataset.go));
$("notifyBtnHome").onclick=()=>$("notifyBtn").click();
$("copyRoomCode").onclick=()=>{if(room&&navigator.clipboard?.writeText)navigator.clipboard.writeText(room).then(()=>alert("Room code copied: "+room)).catch(()=>alert("Room code: "+room));else alert("Room code: "+room)};

$("mode").onchange=()=>$("custom").classList.toggle("hidden",$("mode").value!=="custom");

$("saveExpense").onclick=async()=>{
try{
let amount=+$("amount").value,date=$("date").value,end=$("endDate").value||date,selected=[...document.querySelectorAll(".part:checked")].map(x=>x.value),mode=$("mode").value;
if(!$("title").value.trim()||amount<=0||!date||end<date||!selected.length)throw Error("Fill all fields and select members.");
let shares=[];
if(mode==="custom"){
shares=[...document.querySelectorAll(".share")].filter(x=>selected.includes(x.dataset.name)).map(x=>({name:x.dataset.name,amount:+x.value||0}));
if(Math.abs(shares.reduce((a,x)=>a+x.amount,0)-amount)>.01)throw Error("Custom shares must equal total.")
}else{
let w=selected.map(name=>({name,days:mode==="perday"?stay(name,date,end):1})),total=w.reduce((a,x)=>a+x.days,0),used=0;
if(!total)throw Error("No stay days in selected period.");
w.forEach((x,i)=>{
let v=i===w.length-1?Math.round((amount-used)*100)/100:Math.round(amount*x.days/total*100)/100;
shares.push({name:x.name,amount:v});used+=v
})
}
await addDoc(collection(db,"rooms",room,"expenses"),{title:$("title").value.trim(),amount,payer:$("payer").value,category:$("category").value,date,endDate:end,splitMode:mode,shares,createdBy:uid,createdByName:members.find(m=>m.uid===uid)?.name||"Member",createdAt:serverTimestamp()});
$("title").value="";$("amount").value="";
alert("Expense added and synced.")
}catch(e){alert(e.message)}
};

$("saveAway").onclick=async()=>{
try{
let start=$("awayStart").value,end=$("awayEnd").value;
if(!start||!end||end<start)throw Error("Enter valid dates.");
await addDoc(collection(db,"rooms",room,"absences"),{name:$("awayName").value,start,end,reason:$("reason").value,createdBy:uid,createdAt:serverTimestamp()});
$("reason").value="";alert("Away dates synced.")
}catch(e){alert(e.message)}
};

$("reportMonth").value=new Date().toISOString().slice(0,7);
$("reportMonth").onchange=renderExtras;
$("exportCsv").onclick=csv;

$("saveBudget").onclick=async()=>{
try{
let amount=+$("budgetAmount").value;
if(amount<=0)throw Error("Enter a valid budget.");
await setDoc(doc(db,"rooms",room,"settings","budget"),{amount,updatedBy:uid,updatedAt:serverTimestamp()});
alert("Budget saved.")
}catch(e){alert(e.message)}
};

$("saveBill").onclick=async()=>{
try{
let title=$("billTitle").value.trim(),amount=+$("billAmount").value;
if(!title||amount<=0)throw Error("Enter bill name and amount.");
await addDoc(collection(db,"rooms",room,"fixedBills"),{title,amount,category:$("billCategory").value,payer:$("billPayer").value,createdBy:uid,createdAt:serverTimestamp()});
$("billTitle").value="";$("billAmount").value="";
alert("Fixed bill saved.")
}catch(e){alert(e.message)}
};

$("recordSettlement").onclick=()=>alert("To record a UPI payment, use Pay part in the Balance section. The payment entry will appear only after you return and tap Payment Done.");

$("saveUpi").onclick=async()=>{
try{
if(!admin)throw Error("Only Sajeed can manage UPI IDs.");
let who=$("upiMember").value,id=$("upiValue").value.trim();
if(!/^[\w.\-]{2,}@[\w]{2,}$/.test(id))throw Error("Enter a valid UPI ID, for example name@okaxis.");
let next={...upis,[who]:id};
await setDoc(doc(db,"rooms",room,"settings","upi"),{ids:next,updatedBy:uid,updatedAt:serverTimestamp()});
$("upiValue").value="";alert("UPI ID saved.")
}catch(e){alert(e.message)}
};

$("notifyBtn").onclick=async()=>{
if(!("Notification"in window)){alert("This browser does not support notifications.");return}
let p=await Notification.requestPermission();
alert(p==="granted"?"Notifications enabled on this device.":"Notification permission was not granted.")
};

const paymentReturnBox=document.createElement("div");
paymentReturnBox.id="fk6PaymentReturn";
paymentReturnBox.hidden=true;
paymentReturnBox.style.cssText="position:fixed;left:0;right:0;bottom:82px;z-index:99999";
document.body.appendChild(paymentReturnBox);

document.addEventListener("visibilitychange",()=>{if(!document.hidden)showPaymentReturn()});
window.addEventListener("focus",showPaymentReturn);
window.addEventListener("pageshow",showPaymentReturn);

const app=initializeApp(firebaseConfig),auth=getAuth(app);
db=getFirestore(app);
await setPersistence(auth,browserLocalPersistence);

onAuthStateChanged(auth,async u=>{
if(!u){
uid=undefined;room=undefined;admin=false;
$("app").classList.add("hidden");$("join").classList.remove("hidden");
mountAuthCard($("join"));
$("fk6LinkAccount").classList.remove("hidden");
$("fk6SignIn").classList.remove("hidden");
$("fk6Logout").classList.add("hidden");
$("fk6AuthTitle").textContent="Account access";
$("fk6AuthDescription").textContent="Sign in once. Your account will stay signed in on this device until you log out.";
if(localStorage.getItem("fk6_logged_out"))msg("You are logged out. Sign in to continue.");
return;
}
localStorage.removeItem("fk6_logged_out");
uid=u.uid;
$("fk6LinkAccount").classList.toggle("hidden",!u.isAnonymous);
$("fk6SignIn").classList.toggle("hidden",!u.isAnonymous);
$("fk6Logout").classList.toggle("hidden",u.isAnonymous);
if($("logoutMain"))$("logoutMain").classList.toggle("hidden",u.isAnonymous);
$("fk6AuthTitle").textContent=u.isAnonymous?"Secure your account":"You are signed in";
$("fk6AuthDescription").textContent=u.isAnonymous?"Secure this account once to keep the same flat identity across devices.":"You are signed in on this device. The app will open directly next time.";
$("fk6AuthMsg").textContent=u.isAnonymous?"Secure your account to use the same identity on another device.":"Login saved. You do not need to sign in again unless you log out.";
let c=localStorage.getItem("fk6_room"),n=localStorage.getItem("fk6_name");
if(c&&n){
try{
let r=await getDoc(doc(db,"rooms",c)),m=await getDoc(doc(db,"rooms",c,"members",uid));
if(r.exists()&&m.exists()&&m.data().name===n){
room=c;admin=r.data().adminUid===uid;
listen();msg("Welcome back, "+n+". Your flat is connected.");
showPaymentReturn();return
}
}catch(e){msg("Could not restore your room: "+e.message);return}
}
$("app").classList.add("hidden");$("join").classList.remove("hidden");mountAuthCard($("join"));
msg("Signed in. Join with your flat room code.");
});
if(!auth.currentUser&&!localStorage.getItem("fk6_logged_out"))signInAnonymously(auth).catch(e=>msg(e.message));


/* Master upgrade: groups, private wallet receipts and recurring bill scheduler */
let groupRows=[],groupExpenseRows=[],walletRows=[],recurringRows=[],selectedGroupId="";
function renderGroupLedger(){const id=$("groupSelect")?.value||selectedGroupId,rows=groupExpenseRows.filter(x=>x.groupId===id),bal={};rows.forEach(e=>{bal[e.payer]=(bal[e.payer]||0)+Number(e.amount||0);(e.shares||[]).forEach(s=>bal[s.name]=(bal[s.name]||0)-Number(s.amount||0))});$("groupBalanceList").innerHTML=Object.entries(bal).map(([n,v])=>'<div class="row"><span>'+personLabel(n)+'</span><b class="'+(v>=0?"pos":"neg")+'">'+M(Math.abs(v))+(v>=0?" gets back":" owes")+'</b></div>').join("")||'<p class="muted">Choose a group to see balances.</p>';$("groupActivityList").innerHTML=rows.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map(e=>'<div class="feature-item"><span><strong>'+escapeHtml(e.title)+'</strong><small>'+escapeHtml(e.date||"")+' · '+escapeHtml(e.payer)+'</small></span><b>'+M(e.amount)+'</b></div>').join("")||'<p class="muted">No group activity yet.</p>'}
function renderGroups(){const sel=$("groupSelect"),old=sel.value;sel.innerHTML='<option value="">Select a group</option>'+groupRows.map(g=>'<option value="'+g.id+'">'+escapeHtml(g.name)+'</option>').join("");if(groupRows.some(g=>g.id===old))sel.value=old;$("groupsList").innerHTML=groupRows.map(g=>'<div class="feature-item"><span><strong>'+escapeHtml(g.name)+'</strong><small>Created by '+escapeHtml(g.createdByName||"Member")+'</small></span><span class="feature-pill">'+groupExpenseRows.filter(x=>x.groupId===g.id).length+' entries</span></div>').join("")||'<p class="muted">No groups yet.</p>';renderGroupLedger()}
async function loadGroupData(){if(!room)return;const [g,e]=await Promise.all([getDocs(collection(db,"rooms",room,"groups")),getDocs(collection(db,"rooms",room,"groupExpenses"))]);groupRows=g.docs.map(d=>({id:d.id,...d.data()}));groupExpenseRows=e.docs.map(d=>({id:d.id,...d.data()}));renderGroups()}
async function loadWallet(){if(!uid)return;const s=await getDocs(collection(db,"users",uid,"walletEntries"));walletRows=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.date||"").localeCompare(a.date||""));const incoming=walletRows.filter(x=>x.type==="in").reduce((a,x)=>a+Number(x.amount||0),0),outgoing=walletRows.filter(x=>x.type==="out").reduce((a,x)=>a+Number(x.amount||0),0);$("walletIn").textContent=M(incoming);$("walletOut").textContent=M(outgoing);$("walletHistory").innerHTML=walletRows.map(x=>'<div class="feature-item"><span><strong>'+escapeHtml(x.title)+'</strong><small>'+escapeHtml(x.date||"")+' · '+(x.type==="in"?"Money in":"Money out")+'</small></span><span style="display:flex;align-items:center;gap:8px">'+(x.receipt?'<a href="'+x.receipt+'" target="_blank" rel="noopener"><img class="receipt-thumb" src="'+x.receipt+'" alt="Receipt"></a>':"")+'<b>'+M(x.amount)+'</b></span></div>').join("")||'<p class="muted">No wallet entries yet.</p>'}
async function loadRecurring(){if(!room)return;const s=await getDocs(collection(db,"rooms",room,"recurringBills"));recurringRows=s.docs.map(d=>({id:d.id,...d.data()}));$("recurringList").innerHTML=recurringRows.map(x=>'<div class="feature-item"><span><strong>'+escapeHtml(x.title)+'</strong><small>'+M(x.amount)+' monthly · Day '+x.day+' · '+escapeHtml(x.payer)+'</small></span><button style="width:auto" data-rec="'+x.id+'">Record due</button></div>').join("")||'<p class="muted">No recurring bills yet.</p>';document.querySelectorAll("[data-rec]").forEach(b=>b.onclick=async()=>{const x=recurringRows.find(z=>z.id===b.dataset.rec);if(!x||!confirm("Add "+x.title+" as a shared expense for "+M(x.amount)+"?"))return;try{const date=new Date().toISOString().slice(0,10),shares=N.map(n=>({name:n,amount:Math.round((Number(x.amount)/N.length)*100)/100}));shares[5].amount=Math.round((Number(x.amount)-shares.slice(0,5).reduce((a,z)=>a+z.amount,0))*100)/100;await addDoc(collection(db,"rooms",room,"expenses"),{title:x.title,amount:Number(x.amount),payer:x.payer,category:"Other",date,endDate:date,splitMode:"equal",shares,createdBy:uid,createdByName:members.find(m=>m.uid===uid)?.name||"Member",createdAt:serverTimestamp(),recurringBillId:x.id});priorityNotice("normal","Recurring expense recorded",x.title+" was added to shared expenses.");}catch(e){alert(e.message)}})}
$("createGroup").onclick=async()=>{try{const name=$("groupName").value.trim();if(!name)throw Error("Enter a group name.");await addDoc(collection(db,"rooms",room,"groups"),{name,createdBy:uid,createdByName:members.find(m=>m.uid===uid)?.name||"Member",createdAt:serverTimestamp()});$("groupName").value="";await loadGroupData()}catch(e){alert("Could not create group: "+e.message)}};
$("groupSelect").onchange=()=>{selectedGroupId=$("groupSelect").value;renderGroupLedger()};
$("addGroupExpense").onclick=async()=>{try{const groupId=$("groupSelect").value,title=$("groupExpenseTitle").value.trim(),amount=Number($("groupExpenseAmount").value),date=$("groupExpenseDate").value||new Date().toISOString().slice(0,10),payer=$("groupExpensePayer").value,selected=[...document.querySelectorAll(".groupMember:checked")].map(x=>x.value);if(!groupId||!title||amount<=0||!selected.length)throw Error("Choose group, title, amount and members.");const shares=selected.map((name,i)=>({name,amount:i===selected.length-1?0:Math.round(amount/selected.length*100)/100}));shares[shares.length-1].amount=Math.round((amount-shares.slice(0,-1).reduce((a,z)=>a+z.amount,0))*100)/100;await addDoc(collection(db,"rooms",room,"groupExpenses"),{groupId,title,amount,payer,date,shares,createdBy:uid,createdAt:serverTimestamp()});$("groupExpenseTitle").value="";$("groupExpenseAmount").value="";await loadGroupData()}catch(e){alert(e.message)}};
$("walletSave").onclick=async()=>{try{const title=$("walletTitle").value.trim(),amount=Number($("walletAmount").value),file=$("walletReceipt").files?.[0];if(!title||amount<=0)throw Error("Enter description and valid amount.");let receipt="";if(file){if(!file.type.startsWith("image/")||file.size>5*1024*1024)throw Error("Receipt must be an image under 5 MB.");const raw=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});const im=new Image();await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=reject;im.src=raw});const c=document.createElement("canvas"),scale=Math.min(1,900/Math.max(im.width,im.height));c.width=Math.round(im.width*scale);c.height=Math.round(im.height*scale);c.getContext("2d").drawImage(im,0,0,c.width,c.height);receipt=c.toDataURL("image/jpeg",.65)}await addDoc(collection(db,"users",uid,"walletEntries"),{title,amount,type:$("walletType").value,date:$("walletDate").value||new Date().toISOString().slice(0,10),receipt,ownerUid:uid,createdAt:serverTimestamp()});$("walletTitle").value="";$("walletAmount").value="";$("walletReceipt").value="";await loadWallet()}catch(e){alert("Wallet entry failed: "+e.message)}};
$("recurringSave").onclick=async()=>{try{const title=$("recurringTitle").value.trim(),amount=Number($("recurringAmount").value),day=Number($("recurringDay").value),payer=$("recurringPayer").value;if(!title||amount<=0||day<1||day>28)throw Error("Enter bill name, amount and day 1 to 28.");await addDoc(collection(db,"rooms",room,"recurringBills"),{title,amount,day,payer,createdBy:uid,createdAt:serverTimestamp()});$("recurringTitle").value="";$("recurringAmount").value="";await loadRecurring()}catch(e){alert("Could not save recurring bill: "+e.message)}};

