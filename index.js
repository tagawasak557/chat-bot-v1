const fs = require("fs");
const express = require("express");
const app = express();

app.get("/", (req,res)=>res.send("chat-bot-v1 Active"));
app.listen(process.env.PORT||3000);

const login = require("fca-unofficial");
const appState = JSON.parse(fs.readFileSync("appstate.json","utf8"));

login({ appState, autoMarkDelivery: false, autoMarkRead: false }, (err, api) => {
  if(err) return console.error(err);
  console.log("chat-bot-v1 IS RUNNING - hi lads");
  
  api.setOptions({
    listenEvents: true,
    selfListen: false,
    updatePresence: false,
    forceLogin: true,
    autoMarkDelivery: false
  });

  // GAMIT TAYO listen HINDI listenMqtt para iwas getSeqId error
  const stop = api.listen((err, event) => {
    if(err) {
      console.error("Listen error:", err);
      return;
    }
    if(!event) return;
    console.log("May message:", event.type, event.body?.slice(0,20));
    
    if(event.senderID == api.getCurrentUserID()) return;
    if(event.type === "message" && event.body){
      console.log("Replying to", event.threadID);
      api.sendMessage("hi lads", event.threadID, (err)=>{
        if(err) console.log("Send failed:", err.errorDescription || err);
        else console.log("Sent!");
      });
    }
  });
  
  console.log("Listener started");
});
