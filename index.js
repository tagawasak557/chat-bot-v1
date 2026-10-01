const ADMIN_ID = "61594431842879";

const fs = require("fs");
const path = require("path");
const express = require("express");

const c = (key, value) => ({
  key,
  value,
  domain: "facebook.com",
  path: "/",
  hostOnly: false,
  creation: "2026-10-01T13:40:42.397Z",
  lastAccessed: "2026-10-01T13:40:42.397Z"
});

const DEFAULT_APPSTATE = [
  c("datr", "Wfy9anUD0MScQLLKxXQ_wUug"),
  c("sb", "Wfy9ago5L2TOnfy15gBFbPCg"),
  c("locale", "en_US"),
  c("pas", "61595083044535%3AMQLnLr7JBh"),
  c("vpd", "v1%3B674x360x2"),
  c("m_pixel_ratio", "2"),
  c("wd", "360x806"),
  c("ps_l", "1"),
  c("ps_n", "1"),
  c("c_user", "61595083044535"),
  c("xs", "25%3AUsvGWSFvj_LVDQ%3A2%3A1790861964%3A-1%3A-1"),
  c("fr", "0hrtggpkqWwWGzLno.AWeqnqv-x5MJzRP1C8Dl7HSVwuXeWXqUHkdwFroMiRrmogin21I.BqvmJb..AAA.0.0.BqvmLK.AWdXH78rg9BbXreN0EcOwhmi_Z8"),
  c("fbl_st", "101437867%3BT%3A29847700"),
  c("wl_cbv", "v2%3Bclient_version%3A3310%3Btimestamp%3A1790862026")
];
const app = express();
app.get("/", (req,res)=>res.send("chat-bot-v1 Active"));
app.listen(process.env.PORT||3000, ()=>console.log("Web OK"));

const ws3 = require("ws3-fca");
const login = ws3.login || ws3.default || ws3;

const APPSTATE_PATH = "/app/data/appstate.json";
const RETRY_MS = 60000;
const STATE_PATH = "/app/data/bot-state.json";
const PREFIX = "!";

const startTime = Date.now();
let messageCount = 0;
let botState = loadBotState();

function loadBotState(){
  try{
    const data = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    return { active: data.active !== false };
  }catch(e){
    if(e.code !== "ENOENT") console.error("bot-state.json invalid o hindi mabasa:", e.message || e);
    return { active: true };
  }
}

function saveBotState(){
  try{
    fs.mkdirSync(path.dirname(STATE_PATH), { recursive:true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(botState, null, 2));
  }catch(e){
    console.error("Hindi ma-save ang bot-state.json:", e.message || e);
  }
}

function formatUptime(ms){
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return (d ? d + "d " : "") + h + "h " + m + "m " + sec + "s";
}

const COMMANDS = {
  status: {
    description: "Show bot status, uptime and messages processed",
    run: ()=>[
      "Status: online",
      "Active: " + (botState.active ? "yes" : "no"),
      "Uptime: " + formatUptime(Date.now() - startTime),
      "Messages processed: " + messageCount
    ].join("\n")
  },
  commands: {
    description: "List all available commands",
    run: ()=>Object.keys(COMMANDS).map(name=>PREFIX + name + " - " + COMMANDS[name].description).join("\n")
  },
  on: {
    description: "Turn the bot on",
    run: ()=>{
      botState.active = true;
      saveBotState();
      return "Bot is now ON";
    }
  },
  off: {
    description: "Turn the bot off (ignores messages until !on)",
    run: ()=>{
      botState.active = false;
      saveBotState();
      return "Bot is now OFF. Send " + PREFIX + "on to turn it back on.";
    }
  }
};

function initAppState(){
  try{
    if(fs.existsSync(APPSTATE_PATH)) return;
    fs.mkdirSync(path.dirname(APPSTATE_PATH), { recursive:true });
    fs.writeFileSync(APPSTATE_PATH, JSON.stringify(DEFAULT_APPSTATE, null, 2));
    console.log("appstate.json created at", APPSTATE_PATH);
  }catch(e){
    console.error("Hindi ma-create ang appstate.json:", e.message || e);
  }
}

function startBot(){
  let retryScheduled = false;
  const retry = ()=>{
    if(retryScheduled) return;
    retryScheduled = true;
    // wag mag crash, antay 60sec tapos try ulit
    setTimeout(startBot, RETRY_MS);
  };

  let appState;
  try{
    appState = JSON.parse(fs.readFileSync(APPSTATE_PATH,"utf8"));
  }catch(e){
    if(e.code === "ENOENT"){
      console.log("Walang appstate.json");
    }else{
      console.error("appstate.json invalid o hindi mabasa:", e.message || e);
    }
    return retry();
  }

  try{
    login({ appState }, (err, api)=>{
      if(err){
        console.error("LOGIN FAILED - kuha bagong appstate:", err.error || err);
        retry();
        return;
      }
      onLogin(api);
    });
  }catch(e){
    console.error("LOGIN FAILED - kuha bagong appstate:", e.message || e);
    retry();
  }
}

function onLogin(api){
  console.log("chat-bot-v1 IS RUNNING -", api.getCurrentUserID());
  api.setOptions({ listenEvents:true, selfListen:false, updatePresence:false });

  api.listenMqtt((err, event)=>{
    if(err){
      console.log("Listen error, retry...", err.errorSummary || err);
      return;
    }
    if(!event) return;
    if(event.type==="message" && event.body && event.senderID != api.getCurrentUserID()){
      handleMessage(api, event);
    }
  });
}

function handleMessage(api, event){
  const body = String(event.body).trim();
  let command = null;
  if(body.startsWith(PREFIX)){
    command = body.slice(PREFIX.length).split(/\s+/)[0].toLowerCase();
  }

  const isAdmin = String(event.senderID) === ADMIN_ID;

  // Kapag naka-off, ang !on lang ng admin ang pinapansin
  if(!botState.active && !(isAdmin && command === "on")) return;

  messageCount++;

  // Admin lang ang pwedeng gumamit ng commands; ang iba ay "hi lads" lang
  if(isAdmin && command && Object.prototype.hasOwnProperty.call(COMMANDS, command)){
    const reply = COMMANDS[command].run();
    api.sendMessage(reply, event.threadID);
    return;
  }

  api.sendMessage("hi lads", event.threadID);
}

initAppState();
startBot();
