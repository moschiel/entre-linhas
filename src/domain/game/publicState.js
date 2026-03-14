const { buildDiscardActivity } = require("./summary");
const { PLAYER_SLOTS, getAssignedSlots } = require("../../session/playerSlots");

function getPublicState(sessionState) {
  const assignedSlots = getAssignedSlots(sessionState);
  const connectedSlots = assignedSlots.filter((slot) => slot.online);
  const canStartByPlayers = connectedSlots.length >= 2;
  const hostSlot = assignedSlots.find((slot) => slot.systemRole === "host") || null;
  const hostOffline = Boolean(hostSlot && !hostSlot.online);
  const game = sessionState.game;
  const players = PLAYER_SLOTS.map((slotDef) => {
    const slot = sessionState[slotDef.slotKey];
    return {
      slotKey: slotDef.slotKey,
      seat: slotDef.seat,
      systemRole: slotDef.systemRole,
      defaultName: slotDef.defaultName,
      name: slot ? slot.name : slotDef.defaultName,
      online: Boolean(slot && slot.online),
      occupied: Boolean(slot),
      hasCard: Boolean(game.hands[slotDef.slotKey]),
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
      pausedByDisconnect: game.phase === "in_game" && hostOffline,
      hostOffline,
    },
  };
}

module.exports = {
  getPublicState,
};
