const {onDocumentCreated,onDocumentUpdated}=require("firebase-functions/v2/firestore");
const {initializeApp}=require("firebase-admin/app");
const {getFirestore}=require("firebase-admin/firestore");
const {getMessaging}=require("firebase-admin/messaging");
initializeApp();
const db=getFirestore();
const REGION="asia-south2";
const SKIP=new Set(["pushTokens","profiles"]);
function actorOf(d){
 return d.createdBy||d.updatedBy||d.confirmedBy||d.cancelledBy||null;
}
function noticeFor(collection,data,eventType){
 const who=data.createdByName||data.name||data.from||"A flatmate";
 if(collection==="expenses")return {title:"New shared expense",body:who+" added "+(data.title||"an expense")+" (₹"+Number(data.amount||0).toFixed(2)+")"};
 if(collection==="absences")return {title:"Away mode updated",body:(data.name||who)+" added away dates."};
 if(collection==="fixedBills")return {title:"Fixed bill added",body:(data.title||"A fixed bill")+" · ₹"+Number(data.amount||0).toFixed(2)};
 if(collection==="settlements"){
  if(eventType==="created")return {title:"Payment confirmation needed",body:(data.from||who)+" says they paid ₹"+Number(data.amount||0).toFixed(2)+" to "+(data.to||"you")+". Confirm after receiving it."};
  if(data.status==="confirmed")return {title:"Payment confirmed",body:(data.to||who)+" confirmed ₹"+Number(data.amount||0).toFixed(2)+"."};
  if(data.status==="cancelled")return {title:"Payment cancelled",body:(data.from||who)+" cancelled a payment request."};
 }
 if(collection==="groups")return {title:"New flat group",body:(data.name||"A group")+" was created."};
 if(collection==="groupExpenses")return {title:"Group expense added",body:(data.title||"A group expense")+" · ₹"+Number(data.amount||0).toFixed(2)};
 if(collection==="recurringBills")return {title:"Recurring bill added",body:(data.title||"A recurring bill")+" was added."};
 if(collection==="settings")return {title:"Flat settings updated",body:"A shared flat setting was changed."};
 return {title:"Flat Khata activity",body:"A flatmate updated "+collection+"."};
}
async function sendRoomNotice(event,kind){
 const {roomId,docId}=event.params;
 const collection=event.data?.after?.ref?.parent?.id||event.data?.ref?.parent?.id;
 if(!collection||SKIP.has(collection))return;
 const before=event.data?.before?.data?.()||null;
 const data=event.data?.after?.data?.()||event.data?.data?.()||{};
 if(kind==="updated"&&before&&before.status===data.status&&collection==="settlements")return;
 const actor=actorOf(data);
 const tokensSnap=await db.collection("rooms").doc(roomId).collection("pushTokens").get();
 const targets=tokensSnap.docs.filter(x=>x.id!==actor&&x.data().token);
 if(!targets.length)return;
 const note=noticeFor(collection,data,kind);
 const tokens=targets.map(x=>x.data().token);
 const result=await getMessaging().sendEachForMulticast({
  tokens,
  notification:{title:note.title,body:note.body},
  data:{roomId,collection,docId,eventType:kind,url:"./"},
  webpush:{fcmOptions:{link:"./"}}
 });
 const invalid=[];
 result.responses.forEach((r,i)=>{if(!r.success&&["messaging/registration-token-not-registered","messaging/invalid-registration-token"].includes(r.error?.code))invalid.push(targets[i].ref)});
 if(invalid.length)await Promise.all(invalid.map(ref=>ref.delete()));
}
exports.notifyOnFlatActivityCreated=onDocumentCreated({document:"rooms/{roomId}/{collection}/{docId}",region:REGION},event=>sendRoomNotice(event,"created"));
exports.notifyOnFlatActivityUpdated=onDocumentUpdated({document:"rooms/{roomId}/{collection}/{docId}",region:REGION},event=>sendRoomNotice(event,"updated"));
