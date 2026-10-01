const fs = require("fs");
const express = require("express");
const app = express();
app.get("/", (req,res)=>res.send("Active"));
app.listen(process.env.PORT||3000);

const ws3 = require("ws3-fca");
const login = ws3.default || ws3.login || ws3;
const raw = fs.readFileSync("appstate.json","utf8");

login({ appState: raw, autoMarkDelivery:false }, (err, api) => {
  if(err) return console.error("LOGIN FAIL:", err);
  console.log("chat-bot-v1 IS RUNNING");
  api.setOptions({ listenEvents:true, selfListen:false, updatePresence:false });
  api.listenMqtt((err, event)=>{
    if(err || !event) return;
    if(event.senderID==api.getCurrentUserID()) return;
    if(event.type==="message" && event.body){
      console.log("Message:", event.body);
      api.sendMessage("hi lads", event.threadID);
    }
  });
});
