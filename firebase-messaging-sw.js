importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");
firebase.initializeApp({
 apiKey:"AIzaSyCq6dRqw8_Zg5Hn9WjqAIeqyB9bcLKYHv4",
 authDomain:"hisab-kitab-15615.firebaseapp.com",
 projectId:"hisab-kitab-15615",
 storageBucket:"hisab-kitab-15615.firebasestorage.app",
 messagingSenderId:"1011174772797",
 appId:"1:1011174772797:web:ce40eb61fb0c69fd685a54"
});
const messaging=firebase.messaging();
messaging.onBackgroundMessage(payload=>{
 const title=payload.notification?.title||"Flat Khata 6";
 const options={body:payload.notification?.body||"A flat activity was updated.",icon:"./icon-192.png",badge:"./icon-192.png",data:{url:"./"}};
 self.registration.showNotification(title,options);
});
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
  for(const client of list){if("focus" in client)return client.focus();}
  return clients.openWindow("./");
 }));
});
