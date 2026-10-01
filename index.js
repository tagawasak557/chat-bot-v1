const fs = require("fs");
const path = require("path");
const express = require("express");

const ADMIN_ID = process.env.ADMIN_ID || "61594431842879";
const PREFIX = process.env.BOT_PREFIX || "!";
const RETRY_MS = Number(process.env.RETRY_MS || 60000);
const APPSTATE_PATH = process.env.APPSTATE_PATH || path.resolve(process.cwd(), "appstate.json");
const STATE_PATH = process.env.STATE_PATH || path.resolve(process.cwd(), "bot-state.json");

const app = express();
app.get("/", (req, res) => res.send("chat-bot-v1 Active"));
app.listen(process.env.PORT || 3000, () => console.log("Web OK"));

const ws3 = require("ws3-fca");
const login = ws3.login || ws3.default || ws3;

const startTime = Date.now();
let messageCount = 0;
let retryScheduled = false;
let botState = loadBotState();

function ensureDir(filePath) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  } catch (error) {
    console.error("Hindi ma-create ang folder ng file:", filePath, error.message || error);
  }
}

function resolveAppStatePath() {
  if (process.env.APPSTATE_PATH) return process.env.APPSTATE_PATH;

  const candidates = [
    path.resolve(process.cwd(), "appstate.json"),
    "/app/data/appstate.json",
    path.join(__dirname, "appstate.json")
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return path.resolve(process.cwd(), "appstate.json");
}

function normalizeAppState(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Invalid appState JSON string:", error.message || error);
      return [];
    }
  }

  return [];
}

function loadAppStateFromEnv() {
  const raw = process.env.FB_APPSTATE || process.env.APPSTATE_JSON;
  if (!raw) return null;
  return normalizeAppState(raw);
}

function loadAppStateFromFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    const appState = normalizeAppState(data);
    if (!appState.length) {
      console.warn("Appstate file exists but is empty or invalid:", filePath);
      return null;
    }
    return appState;
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("appstate.json invalid o hindi mabasa:", error.message || error);
    }
    return null;
  }
}

function initAppState() {
  const appStatePath = resolveAppStatePath();
  if (fs.existsSync(appStatePath)) return appStatePath;

  try {
    ensureDir(appStatePath);
    fs.writeFileSync(appStatePath, "[]", "utf8");
    console.log("Created empty appstate.json at", appStatePath);
  } catch (error) {
    console.error("Hindi ma-create ang appstate.json:", error.message || error);
  }

  return appStatePath;
}

function loadBotState() {
  try {
    const data = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    return { active: data.active !== false };
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("bot-state.json invalid o hindi mabasa:", error.message || error);
    }
    return { active: true };
  }
}

function saveBotState() {
  try {
    ensureDir(STATE_PATH);
    fs.writeFileSync(STATE_PATH, JSON.stringify(botState, null, 2));
  } catch (error) {
    console.error("Hindi ma-save ang bot-state.json:", error.message || error);
  }
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return (d ? d + "d " : "") + h + "h " + m + "m " + sec + "s";
}

const REACTIONS = ["🔥", "🤣", "😆", "🔝"];

const COMMANDS = {
  status: {
    description: "Show bot status, uptime and messages processed",
    run: () => [
      "Status: online",
      "Active: " + (botState.active ? "yes" : "no"),
      "Uptime: " + formatUptime(Date.now() - startTime),
      "Messages processed: " + messageCount
    ].join("\n")
  },
  commands: {
    description: "List all available commands",
    run: () => Object.keys(COMMANDS).map((name) => PREFIX + name + " - " + COMMANDS[name].description).join("\n")
  },
  on: {
    description: "Turn the bot on",
    run: () => {
      botState.active = true;
      saveBotState();
      return "Bot is now ON";
    }
  },
  off: {
    description: "Turn the bot off (ignores messages until !on)",
    run: () => {
      botState.active = false;
      saveBotState();
      return "Bot is now OFF. Send " + PREFIX + "on to turn it back on.";
    }
  },
  react: {
    description: "Bot sends a message and reacts to it with a random emoji",
    run: (api, event) => {
      const emoji = REACTIONS[Math.floor(Math.random() * REACTIONS.length)];
      api.sendMessage("Reacting to my own message " + emoji, event.threadID, (err, info) => {
        if (err) {
          console.error("Hindi ma-send ang !react message:", err.errorSummary || err.error || err);
          return;
        }
        const messageID = info && info.messageID;
        if (!messageID) return;
        api.setMessageReaction(emoji, messageID, (reactErr) => {
          if (reactErr) {
            console.error("Hindi ma-react sa message:", reactErr.errorSummary || reactErr.error || reactErr);
          }
        }, true);
      });
      return null;
    }
  }
};

function scheduleRetry() {
  if (retryScheduled) return;
  retryScheduled = true;
  setTimeout(() => {
    retryScheduled = false;
    startBot();
  }, RETRY_MS);
}

function startBot() {
  const appStatePath = initAppState();
  const envAppState = loadAppStateFromEnv();
  const fileAppState = envAppState || loadAppStateFromFile(appStatePath);

  if (!fileAppState || !fileAppState.length) {
    console.error("No valid appstate available. Set FB_APPSTATE or create a valid appstate.json file.");
    return scheduleRetry();
  }

  try {
    login({ appState: fileAppState }, (err, api) => {
      if (err) {
        console.error("LOGIN FAILED:", err && (err.error || err.errorSummary || err.message || err));
        return scheduleRetry();
      }
      onLogin(api);
    });
  } catch (error) {
    console.error("LOGIN FAILED:", error.message || error);
    scheduleRetry();
  }
}

function onLogin(api) {
  console.log("chat-bot-v1 IS RUNNING -", api.getCurrentUserID());
  api.setOptions({ listenEvents: true, selfListen: false, updatePresence: false });

  api.listenMqtt((err, event) => {
    if (err) {
      console.log("Listen error, retrying...", err.errorSummary || err.error || err.message || err);
      scheduleRetry();
      return;
    }

    if (!event) return;
    if (event.type === "message" && event.body && event.senderID != api.getCurrentUserID()) {
      handleMessage(api, event);
    }
  });
}

function handleMessage(api, event) {
  const body = String(event.body).trim();
  let command = null;

  if (body.startsWith(PREFIX)) {
    command = body.slice(PREFIX.length).split(/\s+/)[0].toLowerCase();
  }

  const isAdmin = String(event.senderID) === ADMIN_ID;

  if (!botState.active && !(isAdmin && command === "on")) return;

  messageCount++;

  if (isAdmin && command && Object.prototype.hasOwnProperty.call(COMMANDS, command)) {
    const reply = COMMANDS[command].run(api, event);
    if (reply) api.sendMessage(reply, event.threadID);
    return;
  }

  api.sendMessage("hi lads", event.threadID);
}

startBot();
