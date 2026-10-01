const fs = require("fs");
const express = require("express");
const app = express();
app.get("/", (req,res)=>res.send("chat-bot-v1 Active"));
app.listen(process.env.PORT||3000, ()=>console.log("Web OK"));

const ws3 = require("ws3-fca");
const login = ws3.login || ws3.default || ws3;

function startBot(){
  let appState;
  try{
    appState = fs.readFileSync("appstate.json","utf8");
  }catch(e){ return console.log("Walang appstate.json"); }

  login({ appState }, (err, api)=>{
    if(err){
      console.error("LOGIN FAILED - kuha bagong appstate:", err.error || err);
      // wag mag crash, antay 60sec tapos try ulit
      setTimeout(startBot, 60000);
      return;
    }
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
  });
}

startBot();
