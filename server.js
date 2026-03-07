const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(express.static("public"));

const ROW_KEYS = ["A", "B", "C", "D", "E"];
const COL_KEYS = ["1", "2", "3", "4", "5"];
const WORD_BANK = [
  "PONTE",
  "LIVRO",
  "CHUVA",
  "NEVE",
  "FAROL",
  "NINHO",
  "MEL",
  "VENTO",
  "TINTA",
  "BARCO",
  "RODA",
  "CUPIM",
  "JANELA",
  "TORRE",
  "SELVA",
  "PRAIA",
  "NUVEM",
  "PLUMA",
  "AREIA",
  "TRILHO",
  "MAPA",
  "CINEMA",
  "MUSEU",
  "LAMINA",
  "FLORESTA",
  "BALDE",
  "CANETA",
  "PORTA",
  "PAREDE",
  "TELHA",
  "FOGO",
  "RIO",
  "LAGO",
  "CAVERNA",
  "MAQUINA",
];

function shuffleArray(values) {
  const copy = [...values];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function buildMatrixWords() {
  const selected = shuffleArray(WORD_BANK).slice(0, 10);

  return {
    rows: ROW_KEYS.map((key, index) => ({
      key,
      word: selected[index],
    })),
    cols: COL_KEYS.map((key, index) => ({
      key,
      word: selected[index + 5],
    })),
  };
}

const sessionState = {
  host: null,
  guest: null,
  game: {
    phase: "lobby",
    startedAt: null,
    endedAt: null,
    matrix: null,
  },
};

function slotToPublic(slot) {
  if (!slot) {
    return null;
  }

  return {
    role: slot.role,
    name: slot.name,
    online: slot.online,
  };
}

function getPublicState() {
  const hasHost = Boolean(sessionState.host);
  const hasGuest = Boolean(sessionState.guest);
  const hostOnline = Boolean(sessionState.host && sessionState.host.online);
  const guestOnline = Boolean(sessionState.guest && sessionState.guest.online);

  return {
    host: slotToPublic(sessionState.host),
    guest: slotToPublic(sessionState.guest),
    connectedCount: [sessionState.host, sessionState.guest].filter((slot) => slot && slot.online).length,
    capacity: 2,
    game: {
      phase: sessionState.game.phase,
      startedAt: sessionState.game.startedAt,
      endedAt: sessionState.game.endedAt,
      matrix: sessionState.game.matrix,
      canStart: hasHost && hasGuest && hostOnline && guestOnline && sessionState.game.phase === "lobby",
      pausedByDisconnect: sessionState.game.phase === "in_game" && (!hostOnline || !guestOnline),
    },
  };
}

function emitState() {
  io.emit("state:update", getPublicState());
}

function getSlotByToken(playerToken) {
  if (sessionState.host && sessionState.host.playerToken === playerToken) {
    return sessionState.host;
  }

  if (sessionState.guest && sessionState.guest.playerToken === playerToken) {
    return sessionState.guest;
  }

  return null;
}

function assignNewSlot(playerToken, socketId) {
  if (!sessionState.host) {
    sessionState.host = {
      role: "host",
      playerToken,
      socketId,
      online: true,
      name: "Host",
    };

    return sessionState.host;
  }

  if (!sessionState.guest) {
    sessionState.guest = {
      role: "guest",
      playerToken,
      socketId,
      online: true,
      name: "Convidado",
    };

    return sessionState.guest;
  }

  return null;
}

io.on("connection", (socket) => {
  const rawToken = socket.handshake.auth && socket.handshake.auth.playerToken;
  const playerToken = typeof rawToken === "string" && rawToken.trim().length > 0 ? rawToken.trim() : null;

  if (!playerToken) {
    socket.emit("session:invalid", "Token de jogador ausente.");
    socket.disconnect(true);
    return;
  }

  let slot = getSlotByToken(playerToken);

  if (slot) {
    slot.socketId = socket.id;
    slot.online = true;
  } else {
    slot = assignNewSlot(playerToken, socket.id);
  }

  if (!slot) {
    socket.emit("session:full", "A sala ja esta cheia (2 jogadores).");
    socket.disconnect(true);
    return;
  }

  socket.data.playerToken = playerToken;
  socket.data.role = slot.role;

  socket.emit("session:assigned", {
    role: slot.role,
    name: slot.name,
  });

  emitState();

  socket.on("player:setName", (name) => {
    const safeName = typeof name === "string" ? name.trim().slice(0, 20) : "";
    const target = getSlotByToken(playerToken);

    if (!target || !safeName) {
      return;
    }

    target.name = safeName;
    emitState();
  });

  socket.on("game:start", () => {
    const requester = getSlotByToken(playerToken);
    const hostOnline = Boolean(sessionState.host && sessionState.host.online);
    const guestOnline = Boolean(sessionState.guest && sessionState.guest.online);

    if (!requester || requester.role !== "host") {
      return;
    }

    if (!hostOnline || !guestOnline) {
      return;
    }

    if (sessionState.game.phase !== "lobby") {
      return;
    }

    sessionState.game.phase = "in_game";
    sessionState.game.startedAt = Date.now();
    sessionState.game.endedAt = null;
    sessionState.game.matrix = buildMatrixWords();
    emitState();
  });

  socket.on("game:end", () => {
    const requester = getSlotByToken(playerToken);

    if (!requester || requester.role !== "host") {
      return;
    }

    if (sessionState.game.phase !== "in_game") {
      return;
    }

    sessionState.game.phase = "ended";
    sessionState.game.endedAt = Date.now();
    emitState();

    // Etapa 2: encerrar volta para o estado inicial de sessao, mantendo os jogadores conectados.
    sessionState.game.phase = "lobby";
    sessionState.game.startedAt = null;
    sessionState.game.endedAt = null;
    sessionState.game.matrix = null;
    emitState();
  });

  socket.on("disconnect", () => {
    const target = getSlotByToken(playerToken);

    if (!target) {
      return;
    }

    target.online = false;
    target.socketId = null;
    emitState();
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor ativo em http://0.0.0.0:${PORT}`);
});
