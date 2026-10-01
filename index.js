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
      api.sendMessage("hi lads", event.threadID);
    }
  });
}

initAppState();
startBot();
