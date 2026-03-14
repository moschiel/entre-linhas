const { getPublicState } = require("../../domain/game/publicState");
const { PLAYER_SLOTS } = require("../../session/playerSlots");

function emitState(io, sessionState) {
  io.emit("state:update", getPublicState(sessionState));
}

function emitPrivateState(io, sessionState) {
  PLAYER_SLOTS.map((slotDef) => sessionState[slotDef.slotKey]).forEach((slot) => {
    if (!slot || !slot.socketId) {
      return;
    }

    io.to(slot.socketId).emit("state:private", {
      myCard: sessionState.game.hands[slot.slotKey],
    });
  });
}

module.exports = {
  emitState,
  emitPrivateState,
};
