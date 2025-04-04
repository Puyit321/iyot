const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const login = require("chatbox-fca-remake");
const fs = require("fs");
const detectTyping = require("./handle/detectTyping");
const app = express();

const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static("public"));

global.NashBoT = {
  commands: new Map(),
  events: new Map(),
  onlineUsers: new Map(),
};

const configPath = path.join(__dirname, "config.json");
let config = { adminUID: "", prefix: "!" };

if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath, "utf8"));
}

global.adminUID = config.adminUID;
global.prefix = config.prefix;

global.NashBot = {
  ENDPOINT: "https://ccprojectsapis.zetsu.xyz/api/",
  END: "https://deku-rest-api.gleeze.com/",
  KEN: "https://api.kenliejugarap.com/",
  MONEY: "https://frizzyelectricclients-production.up.railway.app/",
};

async function loadCommands() {
  const commandPath = path.join(__dirname, "commands");
  const commandFiles = fs.readdirSync(commandPath).filter(file => file.endsWith(".js"));

  commandFiles.forEach(file => {
    const cmdFile = require(path.join(commandPath, file));
    if (cmdFile && cmdFile.name && cmdFile.execute) {
      cmdFile.nashPrefix = cmdFile.nashPrefix !== undefined ? cmdFile.nashPrefix : true;
      global.NashBoT.commands.set(cmdFile.name, cmdFile);
    }
  });
}

async function loadEvents() {
  const eventPath = path.join(__dirname, "events");
  const eventFiles = fs.readdirSync(eventPath).filter(file => file.endsWith(".js"));

  eventFiles.forEach(file => {
    const evntFile = require(path.join(eventPath, file));
    if (evntFile && evntFile.name && typeof evntFile.onEvent === 'function') {
      global.NashBoT.events.set(evntFile.name, evntFile);
    }
  });
}

async function init() {
  await loadCommands();
  await loadEvents();
  await autoLogin();
}

function getRandomProxy() {
  const proxies = fs.readFileSync(path.join(__dirname, "proxy.txt"), "utf8").split("\n");
  const randomProxy = proxies[Math.floor(Math.random() * proxies.length)].trim();
  updateProxies();
  return randomProxy;
}

function updateProxies() {
  const proxies = fs.readFileSync(path.join(__dirname, "proxy.txt"), "utf8").split("\n");
  const updatedProxies = [...new Set(proxies)];
  fs.writeFileSync(path.join(__dirname, "proxy.txt"), updatedProxies.join("\n"));
}

async function autoLogin() {
  const appStatePath = path.join(__dirname, "appstate.json");
  if (fs.existsSync(appStatePath)) {
    const appState = JSON.parse(fs.readFileSync(appStatePath, "utf8"));
    const proxy = getRandomProxy();

    login({ appState, proxy }, (err, api) => {
      if (err) {
        console.error("Failed to login automatically:", err);
        return;
      }

      const cuid = api.getCurrentUserID();
      if (!global.NashBoT.onlineUsers.has(cuid)) {
        global.NashBoT.onlineUsers.set(cuid, { userID: cuid, prefix: config.prefix });
        setupBot(api, config.prefix);
      }
    });
  }
}

app.post("/login", (req, res) => {
  const { botState, prefix, adminUID } = req.body;

  try {
    const appState = JSON.parse(botState);
    fs.writeFileSync(path.join(__dirname, "appstate.json"), JSON.stringify(appState));

    global.adminUID = adminUID;
    config.adminUID = adminUID;
    config.prefix = prefix;
    fs.writeFileSync(configPath, JSON.stringify(config));

    const proxy = getRandomProxy();
    login({ appState, proxy }, (err, api) => {
      if (err) {
        return res.status(500).send("Failed to login");
      }

      const cuid = api.getCurrentUserID();
      api.getUserInfo(cuid, (err, userInfo) => {
        if (err) {
          console.error("Failed to get user info:", err);
          return res.status(500).send("Failed to get user info");
        }
        
        if (userInfo[cuid]) {
          const realName = userInfo[cuid].name;
          global.NashBoT.onlineUsers.set(cuid, {
            userID: cuid,
            realName: realName,
            sessionStart: new Date(),
            prefix: prefix,
          });

          setupBot(api, prefix);
          res.sendStatus(200);
        } else {
          console.error("User info not found for userID:", cuid);
          res.status(500).send("User info not found");
        }
      });
    });
  } catch (error) {
    res.status(400).send("Invalid appState");
  }
});

function setupBot(api, prefix) {
  api.setOptions({
    forceLogin: false,
    listenEvents: true,
    logLevel: "silent",
    selfListen: false,
    online: true,
    autoMarkDelivery: false,
    autoMarkRead: false,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  });

  setInterval(() => {
    api.getFriendsList(() => {
      console.log("Keep-alive signal sent");
    });
  }, 1000 * 60 * 15);

  api.listenMqtt((err, event) => {
    if (err) {
      return;
    }

    handleMessage(api, event, prefix);
    handleEvent(api, event, prefix);
    detectTyping(api, event);
  });
}

async function handleEvent(api, event, prefix) {
  const { events } = global.NashBoT;
  try {
    for (const { name, onEvent } of events.values()) {
      await onEvent({ prefix, api, event });
    }
  } catch (error) {
    console.error("Error handling event:", error);
  }
}

async function handleMessage(api, event, prefix) {
  if (!event.body) return;
  let [command, ...args] = event.body.trim().split(" ");

  if (command.startsWith(prefix)) {
    command = command.slice(prefix.length);
  }

  const cmdFile = global.NashBoT.commands.get(command.toLowerCase());
  if (cmdFile) {
    const nashPrefix = cmdFile.nashPrefix !== false;
    const isAdminCommand = cmdFile.role === "admin";
    const isAdmin = event.senderID === global.adminUID;

    if (isAdminCommand && !isAdmin) {
      return api.sendMessage("You do not have permission to use this command.", event.threadID);
    }

    if (nashPrefix && !event.body.toLowerCase().startsWith(prefix)) {
      return;
    }

    try {
      cmdFile.execute(api, event, args, prefix);
    } catch (error) {
      api.sendMessage(`Error executing command: ${error.message}`, event.threadID);
    }
  }
}

app.get("/active-sessions", async (req, res) => {
  const json = {};
  global.NashBoT.onlineUsers.forEach(({ userID, prefix, realName }, uid) => {
    json[uid] = { userID, realName, prefix };
  });
  res.json(json);
});

app.get("/commands", (req, res) => {
  const commands = {};
  global.NashBoT.commands.forEach((command, name) => {
    commands[name] = {
      description: command.description || "No description available",
      role: command.role || "user",
      nashPrefix: command.nashPrefix,
    };
  });
  res.json(commands);
});

init().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
});
