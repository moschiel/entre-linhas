const {
  getAssignedSlots,
  getSlotBySeat,
  getSlotByToken,
  isBlockedPlayerToken,
  blockPlayerToken,
  assignNewSlot,
  takeOfflineSlot,
} = require("../../session/playerSlots");
const {
  startGame,
  drawCard,
  placeCard,
  movePlacedCard,
  discardCard,
  discardPlacedCard,
  removePlayer,
  invalidateCard,
  endGame,
} = require("../../domain/game/rules");
const { emitState, emitPrivateState } = require("./emitters");

function registerSocketHandlers(io, sessionState) {
  io.on("connection", (socket) => {
    const rawToken = socket.handshake.auth && socket.handshake.auth.playerToken;
    const playerToken = typeof rawToken === "string" && rawToken.trim().length > 0 ? rawToken.trim() : null;

    if (!playerToken) {
      socket.emit("session:invalid", "Token de jogador ausente.");
      socket.disconnect(true);
      return;
    }

    if (isBlockedPlayerToken(sessionState, playerToken)) {
      socket.emit("session:removed", {
        message: "Voce foi removido da sala pelo host.",
      });
      socket.disconnect(true);
      return;
    }

    let slot = getSlotByToken(sessionState, playerToken);

    if (slot) {
      slot.socketId = socket.id;
      slot.online = true;
    } else {
      slot = assignNewSlot(sessionState, playerToken, socket.id);

      if (!slot && sessionState.game.phase !== "in_game") {
        slot = takeOfflineSlot(sessionState, playerToken, socket.id);
      }
    }

    if (!slot) {
      socket.emit("session:full", "A sala ja esta cheia (4 jogadores).");
      socket.disconnect(true);
      return;
    }

    socket.data.playerToken = playerToken;
    socket.data.slotKey = slot.slotKey;
    socket.data.systemRole = slot.systemRole;
    socket.data.seat = slot.seat;

    socket.emit("session:assigned", {
      systemRole: slot.systemRole,
      seat: slot.seat,
      name: slot.name,
    });

    emitState(io, sessionState);
    emitPrivateState(io, sessionState);

    socket.on("player:setName", (name) => {
      const safeName = typeof name === "string" ? name.trim().slice(0, 20) : "";
      const target = getSlotByToken(sessionState, playerToken);

      if (!target || !safeName) {
        return;
      }

      target.name = safeName;
      emitState(io, sessionState);
    });

    socket.on("game:start", () => {
      const requester = getSlotByToken(sessionState, playerToken);
      const assignedSlots = getAssignedSlots(sessionState);
      const connectedSlots = assignedSlots.filter((slotItem) => slotItem.online);
      const canStartByPlayers = connectedSlots.length >= 2;

      if (!requester || requester.systemRole !== "host") {
        return;
      }

      if (!canStartByPlayers) {
        return;
      }

      if (sessionState.game.phase !== "lobby") {
        return;
      }

      startGame(sessionState);
      emitState(io, sessionState);
      emitPrivateState(io, sessionState);
    });

    socket.on("card:draw", () => {
      const requester = getSlotByToken(sessionState, playerToken);

      if (!requester) {
        return;
      }

      if (!drawCard(sessionState, requester.slotKey)) {
        return;
      }

      io.emit("card:drawn", {
        seat: requester.seat,
      });
      emitState(io, sessionState);
      emitPrivateState(io, sessionState);
    });

    socket.on("card:place", (coord) => {
      const requester = getSlotByToken(sessionState, playerToken);
      const safeCoord = typeof coord === "string" ? coord.trim().toUpperCase() : "";

      if (!requester || !safeCoord) {
        return;
      }

      if (!placeCard(sessionState, requester, safeCoord)) {
        return;
      }

      emitState(io, sessionState);
      emitPrivateState(io, sessionState);
    });

    socket.on("card:discard", (payload) => {
      const requester = getSlotByToken(sessionState, playerToken);
      const source = payload && typeof payload.source === "string" ? payload.source : "hand";
      const coord = payload && typeof payload.coord === "string" ? payload.coord.trim().toUpperCase() : "";

      if (!requester) {
        return;
      }

      if (source === "board") {
        if (!discardPlacedCard(sessionState, requester, coord)) {
          return;
        }
      } else if (!discardCard(sessionState, requester)) {
        return;
      }

      emitState(io, sessionState);
      emitPrivateState(io, sessionState);
    });

    socket.on("card:move", (payload) => {
      const requester = getSlotByToken(sessionState, playerToken);
      const fromCoord = payload && typeof payload.from === "string" ? payload.from.trim().toUpperCase() : "";
      const toCoord = payload && typeof payload.to === "string" ? payload.to.trim().toUpperCase() : "";

      if (!requester || !fromCoord || !toCoord) {
        return;
      }

      if (!movePlacedCard(sessionState, requester, fromCoord, toCoord)) {
        return;
      }

      emitState(io, sessionState);
      emitPrivateState(io, sessionState);
    });

    socket.on("card:invalidate", (coord) => {
      const requester = getSlotByToken(sessionState, playerToken);
      const safeCoord = typeof coord === "string" ? coord.trim().toUpperCase() : "";

      if (!requester || !safeCoord) {
        return;
      }

      if (requester.systemRole !== "host") {
        return;
      }

      if (!invalidateCard(sessionState, requester, safeCoord)) {
        return;
      }

      emitState(io, sessionState);
      emitPrivateState(io, sessionState);
    });

    socket.on("game:end", () => {
      const requester = getSlotByToken(sessionState, playerToken);

      if (!requester || requester.systemRole !== "host") {
        return;
      }

      if (!endGame(sessionState)) {
        return;
      }

      emitState(io, sessionState);
      emitPrivateState(io, sessionState);
    });

    socket.on("player:remove", (targetSeatRaw) => {
      const requester = getSlotByToken(sessionState, playerToken);
      const targetSeat = Number(targetSeatRaw);

      if (!requester || requester.systemRole !== "host" || !Number.isInteger(targetSeat)) {
        return;
      }

      const targetBeforeRemoval = getSlotBySeat(sessionState, targetSeat);
      if (!targetBeforeRemoval || targetBeforeRemoval.systemRole === "host") {
        return;
      }

      const removedSlot = removePlayer(sessionState, requester, targetSeat);
      if (!removedSlot) {
        return;
      }

      blockPlayerToken(sessionState, removedSlot.playerToken);

      if (removedSlot.socketId) {
        io.to(removedSlot.socketId).emit("session:removed", {
          message: "Voce foi removido da sala pelo host.",
        });

        const targetSocket = io.sockets.sockets.get(removedSlot.socketId);
        if (targetSocket) {
          targetSocket.disconnect(true);
        }
      }

      emitState(io, sessionState);
      emitPrivateState(io, sessionState);
    });

    socket.on("disconnect", () => {
      const target = getSlotByToken(sessionState, playerToken);

      if (!target) {
        return;
      }

      target.online = false;
      target.socketId = null;
      emitState(io, sessionState);
    });
  });
}

module.exports = {
  registerSocketHandlers,
};
