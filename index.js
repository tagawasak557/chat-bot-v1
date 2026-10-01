const fs = require("fs");
const express = require("express");
const app = express();

app.get("/", (req, res) => res.send("chat-bot-v1 Active - hi lads"));
app.listen(process.env.PORT || 3000, () => console.log("Web running"));

// FIX para sa bagong ws3-fca
const ws3 = require("ws3-fca");
const login = ws3.default || ws3.login || ws3;

if (!fs.existsSync("appstate.json")) {
  console.log("WALA appstate.json");
  process.exit(0);
}

const appState = JSON.parse(fs.readFileSync("appstate.json", "utf8"));
console.log("Starting chat-bot-v1...");

login({ appState }, (err, api) => {
  if (err) {
    console.error("Login failed, need new appstate:", err);
    return;
  }
  console.log("chat-bot-v1 IS RUNNING - hi lads");
  api.setOptions({ listenEvents: true, selfListen: false });

  api.listenMqtt((err, event) => {
    if (err || !event) return;
    if (event.senderID == api.getCurrentUserID()) return;
    if (event.type === "message" && event.body) {
      api.sendMessage("hi lads", event.threadID);
    }
  });
});
