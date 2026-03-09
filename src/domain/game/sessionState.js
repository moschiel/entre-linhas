function createSessionState() {
  return {
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
}

function resetGameToLobby(sessionState) {
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
}

module.exports = {
  createSessionState,
  resetGameToLobby,
};
