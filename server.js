const express = require("express");
const http = require("http");
const os = require("os");
const { Server } = require("socket.io");
const { createSessionState } = require("./src/domain/game/sessionState");
const { registerSocketHandlers } = require("./src/transport/socket/registerSocketHandlers");

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(express.static("public"));

const sessionState = createSessionState();
registerSocketHandlers(io, sessionState);

server.listen(PORT, "0.0.0.0", () => {
  const interfaces = os.networkInterfaces();
  const lanUrls = [];

  Object.values(interfaces).forEach((entries) => {
    (entries || []).forEach((entry) => {
      if (entry && entry.family === "IPv4" && !entry.internal) {
        lanUrls.push(`http://${entry.address}:${PORT}`);
      }
    });
  });

  console.log(`Servidor ativo em http://localhost:${PORT}`);

  if (lanUrls.length > 0) {
    console.log("Acesso na rede local:");
    lanUrls.forEach((url) => {
      console.log(`- ${url}`);
    });
  }
});
