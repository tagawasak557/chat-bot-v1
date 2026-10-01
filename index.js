const fs = require("fs");
const express = require("express");
const app = express();

app.get("/", (req,res)=>res.send("chat-bot-v1 Active - hi lads"));
app.listen(process.env.PORT||3000);

const ws3 = require("ws3-fca");
const login = ws3.default || ws3.login || ws3;

// Auto-fix appstate format
let appState;
try {
  const raw = fs.readFileSync("appstate.json","utf8");
  appState = JSON.parse(raw);
  // kung double-stringified pa
  if (typeof appState === "string") appState = JSON.parse(appState);
  console.log("Appstate loaded, items:", appState.length);
} catch(e){
  console.error("Mali ang appstate.json:", e.message);
  process.exit(0);
}

login({ appState }, (err, api) => {
  if(err) return console.error("Login failed:", err);
  console.log("chat-bot-v1 IS RUNNING");
  api.setOptions({listenEvents:true, selfListen:false});
  api.listenMqtt((err, event)=>{
    if(err||!event) return;
    if(event.senderID==api.getCurrentUserID()) return;
    if(event.type==="message" && event.body){
      api.sendMessage("hi lads", event.threadID);
    }
  });
});
