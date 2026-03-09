const { buildDiscardActivity } = require("./summary");

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

function getPublicState(sessionState) {
  const hasHost = Boolean(sessionState.host);
  const hasGuest = Boolean(sessionState.guest);
  const hostOnline = Boolean(sessionState.host && sessionState.host.online);
  const guestOnline = Boolean(sessionState.guest && sessionState.guest.online);
  const game = sessionState.game;

  return {
    host: slotToPublic(sessionState.host),
    guest: slotToPublic(sessionState.guest),
    connectedCount: [sessionState.host, sessionState.guest].filter((slot) => slot && slot.online).length,
    capacity: 2,
    game: {
      phase: game.phase,
      startedAt: game.startedAt,
      endedAt: game.endedAt,
      matrix: game.matrix,
      drawPileCount: game.drawPile.length,
      boardPlacements: Object.values(game.boardPlacements),
      discardPileCount: game.discardPile.length,
      discardActivity: buildDiscardActivity(game.discardPile),
      finalSummary: game.phase === "ended" ? game.finalSummary : null,
      hostHasCard: Boolean(game.hands.host),
      guestHasCard: Boolean(game.hands.guest),
      canStart: hasHost && hasGuest && hostOnline && guestOnline && game.phase === "lobby",
      pausedByDisconnect: game.phase === "in_game" && (!hostOnline || !guestOnline),
    },
  };
}

module.exports = {
  getPublicState,
};
