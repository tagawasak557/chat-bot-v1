const fs = require("fs");
const express = require("express");
const app = express();
app.get("/", (req,res)=>res.send("chat-bot-v1 Active"));
app.listen(process.env.PORT||3000, ()=>console.log("Web OK"));

const ws3 = require("ws3-fca");
const login = ws3.login || ws3.default || ws3;

const APPSTATE_PATH = "/app/data/appstate.json";
const RETRY_MS = 60000;

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


startBot();
