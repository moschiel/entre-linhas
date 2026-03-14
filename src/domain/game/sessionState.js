const { PLAYER_SLOTS } = require("../../session/playerSlots");

function createSessionState() {
  const hands = {};
  PLAYER_SLOTS.forEach((slot) => {
    hands[slot.slotKey] = null;
  });

  return {
    seat1: null,
    seat2: null,
    seat3: null,
    seat4: null,
    game: {
      phase: "lobby",
      startedAt: null,
      endedAt: null,
      matrix: null,
      drawPile: [],
      boardPlacements: {},
      discardPile: [],
      hands,
      finalSummary: null,
    },
  };
}

function resetGameToLobby(sessionState) {
  sessionState.game.phase = "lobby";
  sessionState.game.startedAt = null;
  sessionState.game.endedAt = null;
  sessionState.game.matrix = null;
  sessionState.game.drawPile = [];
  sessionState.game.boardPlacements = {};
  sessionState.game.discardPile = [];
  PLAYER_SLOTS.forEach((slot) => {
    sessionState.game.hands[slot.slotKey] = null;
  });
  sessionState.game.finalSummary = null;
}

module.exports = {
  createSessionState,
  resetGameToLobby,
};
