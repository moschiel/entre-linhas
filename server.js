const express = require("express");
const http = require("http");
const os = require("os");
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

function buildCoordinateDeck() {
  const allCoords = [];

  ROW_KEYS.forEach((row) => {
    COL_KEYS.forEach((col) => {
      allCoords.push(`${row}${col}`);
    });
  });

  return shuffleArray(allCoords);
}

const sessionState = {
  host: null,
  guest: null,
  game: {
    phase: "lobby",
    startedAt: null,
    endedAt: null,
    matrix: null,
    drawPile: [],
    boardPlacements: {},
    discardPile: [],
    hands: {
      host: null,
      guest: null,
    },
    finalSummary: null,
  },
};

function classifyPerformance(correctCount) {
  if (correctCount <= 10) {
    return "Fracasso";
  }

  if (correctCount <= 18) {
    return "Mediano";
  }

  if (correctCount <= 24) {
    return "Bom";
  }

  return "Espetacular!";
}

function computeFinalSummary() {
  const correctCount = Object.keys(sessionState.game.boardPlacements).length;
  const discardedCount = sessionState.game.discardPile.length;

  return {
    correctCount,
    discardedCount,
    totalCards: 25,
    rating: classifyPerformance(correctCount),
    discardPile: sessionState.game.discardPile,
  };
}

function buildDiscardActivity() {
  return sessionState.game.discardPile.map((item) => {
    if (item.source === "board") {
      return {
        type: "invalidate",
        byName: item.discardedByName,
        text: `${item.discardedByName} invalidou uma carta do tabuleiro.`,
      };
    }

    return {
      type: "discard",
      byName: item.discardedByName,
      text: `${item.discardedByName} descartou uma carta.`,
    };
  });
}

function maybeFinishGame() {
  if (sessionState.game.phase !== "in_game") {
    return;
  }

  const noCardsInHands = !sessionState.game.hands.host && !sessionState.game.hands.guest;
  const pileEmpty = sessionState.game.drawPile.length === 0;

  if (!noCardsInHands || !pileEmpty) {
    return;
  }

  sessionState.game.phase = "ended";
  sessionState.game.endedAt = Date.now();
  sessionState.game.finalSummary = computeFinalSummary();
}

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
      drawPileCount: sessionState.game.drawPile.length,
      boardPlacements: Object.values(sessionState.game.boardPlacements),
      discardPileCount: sessionState.game.discardPile.length,
      discardActivity: buildDiscardActivity(),
      finalSummary: sessionState.game.phase === "ended" ? sessionState.game.finalSummary : null,
      hostHasCard: Boolean(sessionState.game.hands.host),
      guestHasCard: Boolean(sessionState.game.hands.guest),
      canStart: hasHost && hasGuest && hostOnline && guestOnline && sessionState.game.phase === "lobby",
      pausedByDisconnect: sessionState.game.phase === "in_game" && (!hostOnline || !guestOnline),
    },
  };
}

function emitState() {
  io.emit("state:update", getPublicState());
}

function emitPrivateState() {
  [sessionState.host, sessionState.guest].forEach((slot) => {
    if (!slot || !slot.socketId) {
      return;
    }

    const role = slot.role;
    io.to(slot.socketId).emit("state:private", {
      myCard: sessionState.game.hands[role],
    });
  });
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

function takeOfflineSlot(playerToken, socketId) {
  // Prioriza reaproveitar convidado offline para manter o host atual sempre que possivel.
  const candidates = [sessionState.guest, sessionState.host];
  const reusable = candidates.find((slot) => slot && !slot.online);

  if (!reusable) {
    return null;
  }

  reusable.playerToken = playerToken;
  reusable.socketId = socketId;
  reusable.online = true;
  reusable.name = reusable.role === "host" ? "Host" : "Convidado";
  return reusable;
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

    if (!slot && sessionState.game.phase !== "in_game") {
      slot = takeOfflineSlot(playerToken, socket.id);
    }
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
  emitPrivateState();

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
    sessionState.game.drawPile = buildCoordinateDeck();
    sessionState.game.boardPlacements = {};
    sessionState.game.discardPile = [];
    sessionState.game.hands.host = null;
    sessionState.game.hands.guest = null;
    sessionState.game.finalSummary = null;
    emitState();
    emitPrivateState();
  });

  socket.on("card:draw", () => {
    const requester = getSlotByToken(playerToken);

    if (!requester) {
      return;
    }

    if (sessionState.game.phase !== "in_game") {
      return;
    }

    if (sessionState.game.hands[requester.role]) {
      return;
    }

    const nextCard = sessionState.game.drawPile.shift();
    if (!nextCard) {
      return;
    }

    sessionState.game.hands[requester.role] = {
      coord: nextCard,
      drawnAt: Date.now(),
    };

    emitState();
    emitPrivateState();
  });

  socket.on("card:place", () => {
    const requester = getSlotByToken(playerToken);

    if (!requester) {
      return;
    }

    if (sessionState.game.phase !== "in_game") {
      return;
    }

    const card = sessionState.game.hands[requester.role];
    if (!card) {
      return;
    }

    const coord = card.coord;
    if (sessionState.game.boardPlacements[coord]) {
      return;
    }

    sessionState.game.boardPlacements[coord] = {
      coord,
      placedByRole: requester.role,
      placedByName: requester.name,
      placedAt: Date.now(),
    };

    sessionState.game.hands[requester.role] = null;
    maybeFinishGame();
    emitState();
    emitPrivateState();
  });

  socket.on("card:discard", () => {
    const requester = getSlotByToken(playerToken);

    if (!requester) {
      return;
    }

    if (sessionState.game.phase !== "in_game") {
      return;
    }

    const card = sessionState.game.hands[requester.role];
    if (!card) {
      return;
    }

    sessionState.game.discardPile.push({
      coord: card.coord,
      source: "hand",
      discardedByRole: requester.role,
      discardedByName: requester.name,
      discardedAt: Date.now(),
    });

    sessionState.game.hands[requester.role] = null;
    maybeFinishGame();
    emitState();
    emitPrivateState();
  });

  socket.on("card:invalidate", (coord) => {
    const requester = getSlotByToken(playerToken);
    const safeCoord = typeof coord === "string" ? coord.trim().toUpperCase() : "";

    if (!requester || !safeCoord) {
      return;
    }

    if (requester.role !== "host") {
      return;
    }

    if (sessionState.game.phase !== "in_game") {
      return;
    }

    const placement = sessionState.game.boardPlacements[safeCoord];
    if (!placement) {
      return;
    }

    delete sessionState.game.boardPlacements[safeCoord];

    sessionState.game.discardPile.push({
      coord: placement.coord,
      source: "board",
      discardedByRole: requester.role,
      discardedByName: requester.name,
      originallyPlacedByName: placement.placedByName,
      discardedAt: Date.now(),
    });

    emitState();
    emitPrivateState();
  });

  socket.on("game:end", () => {
    const requester = getSlotByToken(playerToken);

    if (!requester || requester.role !== "host") {
      return;
    }

    if (sessionState.game.phase !== "in_game" && sessionState.game.phase !== "ended") {
      return;
    }

    // Encerrar jogo volta para o estado inicial de sessao, mantendo os jogadores conectados.
    sessionState.game.phase = "lobby";
    sessionState.game.startedAt = null;
    sessionState.game.endedAt = null;
    sessionState.game.matrix = null;
    sessionState.game.drawPile = [];
    sessionState.game.boardPlacements = {};
    sessionState.game.discardPile = [];
    sessionState.game.hands.host = null;
    sessionState.game.hands.guest = null;
    sessionState.game.finalSummary = null;
    emitState();
    emitPrivateState();
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
