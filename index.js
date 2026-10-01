const fs = require("fs");
const login = require("ws3-fca");
const express = require("express");
const app = express();
app.get("/", (req, res) => res.send("chat-bot-v1 Active"));
app.listen(process.env.PORT || 3000);
const appState = JSON.parse(fs.readFileSync("appstate.json","utf8"));
login({appState}, (err, api) => {
  if(err) return console.error(err);
  console.log("RUNNING");
  api.setOptions({listenEvents:true, selfListen:false});
  api.listenMqtt((e, ev) => {
    if(ev && ev.type==="message") api.sendMessage("hi lads", ev.threadID);
  });
});
