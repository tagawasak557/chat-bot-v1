const fs = require("fs");
const express = require("express");
const app = express();

app.get("/", (req,res)=>res.send("chat-bot-v1 Active"));
app.listen(process.env.PORT||3000, ()=>console.log("Web running"));

const ws3 = require("ws3-fca");
const login = ws3.default || ws3.login || ws3;

// DITO YUNG FIX - wag i-JSON.parse, string lang ipasa
const appState = fs.readFileSync("appstate.json", "utf8");
console.log("Appstate string length:", appState.length);

login({ appState }, (err, api) => {
  if(err) {
    console.error("Login failed - baka expired appstate:", err);
    return;
  }
  console.log("chat-bot-v1 IS RUNNING - hi lads");
  api.setOptions({ listenEvents: true, selfListen: false });
  api.listenMqtt((err, event) => {
    if(err || !event) return;
    if(event.senderID == api.getCurrentUserID()) return;
    if(event.type === "message" && event.body){
      api.sendMessage("hi lads", event.threadID);
    }
  });
});
