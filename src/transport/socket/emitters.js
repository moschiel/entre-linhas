const { getPublicState } = require("../../domain/game/publicState");

function emitState(io, sessionState) {
  io.emit("state:update", getPublicState(sessionState));
}

function emitPrivateState(io, sessionState) {
  [sessionState.host, sessionState.guest].forEach((slot) => {
    if (!slot || !slot.socketId) {
      return;
    }

    io.to(slot.socketId).emit("state:private", {
      myCard: sessionState.game.hands[slot.role],
    });
  });
}

module.exports = {
  emitState,
  emitPrivateState,
};
