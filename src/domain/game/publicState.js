const { buildDiscardActivity } = require("./summary");
const { PLAYER_SLOTS, getAssignedSlots } = require("../../session/playerSlots");

function getPublicState(sessionState) {
  const assignedSlots = getAssignedSlots(sessionState);
  const connectedSlots = assignedSlots.filter((slot) => slot.online);
  const everyoneOnline = assignedSlots.every((slot) => slot.online);
  const canStartByPlayers = connectedSlots.length >= 2;
  const game = sessionState.game;
  const players = PLAYER_SLOTS.map((slotDef) => {
    const slot = sessionState[slotDef.role];
    return {
      role: slotDef.role,
      defaultName: slotDef.defaultName,
      name: slot ? slot.name : slotDef.defaultName,
      online: Boolean(slot && slot.online),
      occupied: Boolean(slot),
      hasCard: Boolean(game.hands[slotDef.role]),
    };
  });

  return {
    players,
    connectedCount: connectedSlots.length,
    capacity: PLAYER_SLOTS.length,
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
      canStart: canStartByPlayers && game.phase === "lobby",
      pausedByDisconnect: game.phase === "in_game" && !everyoneOnline,
    },
  };
}

module.exports = {
  getPublicState,
};
