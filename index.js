const fs = require("fs");
const express = require("express");
const app = express();

app.get("/", (req,res)=>res.send("chat-bot-v1 Active - hi lads"));
app.listen(process.env.PORT||3000, ()=>console.log("Web running"));

const login = require("fca-unofficial");

// load appstate
const appState = JSON.parse(fs.readFileSync("appstate.json","utf8"));
console.log("Loaded appstate items:", appState.length);

login({ appState }, (err, api) => {
  if(err) return console.error("Login failed:", err);
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
