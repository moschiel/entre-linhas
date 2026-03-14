const { buildMatrixWords, buildCoordinateDeck } = require("./deck");
const { computeFinalSummary } = require("./summary");
const { resetGameToLobby } = require("./sessionState");
const { PLAYER_SLOTS } = require("../../session/playerSlots");

function maybeFinishGame(sessionState) {
  if (sessionState.game.phase !== "in_game") {
    return;
  }

  const noCardsInHands = PLAYER_SLOTS.every((slot) => !sessionState.game.hands[slot.role]);
  const pileEmpty = sessionState.game.drawPile.length === 0;

  if (!noCardsInHands || !pileEmpty) {
    return;
  }

  sessionState.game.phase = "ended";
  sessionState.game.endedAt = Date.now();
  sessionState.game.finalSummary = computeFinalSummary(sessionState.game);
}

function startGame(sessionState) {
  sessionState.game.phase = "in_game";
  sessionState.game.startedAt = Date.now();
  sessionState.game.endedAt = null;
  sessionState.game.matrix = buildMatrixWords();
  sessionState.game.drawPile = buildCoordinateDeck();
  sessionState.game.boardPlacements = {};
  sessionState.game.discardPile = [];
  PLAYER_SLOTS.forEach((slot) => {
    sessionState.game.hands[slot.role] = null;
  });
  sessionState.game.finalSummary = null;
}

function drawCard(sessionState, role) {
  if (sessionState.game.phase !== "in_game") {
    return false;
  }

  if (sessionState.game.hands[role]) {
    return false;
  }

  const nextCard = sessionState.game.drawPile.shift();
  if (!nextCard) {
    return false;
  }

  sessionState.game.hands[role] = {
    coord: nextCard,
    drawnAt: Date.now(),
  };

  return true;
}

function placeCard(sessionState, requester, targetCoord) {
  if (sessionState.game.phase !== "in_game") {
    return false;
  }

  const card = sessionState.game.hands[requester.role];
  if (!card) {
    return false;
  }

  const coord = typeof targetCoord === "string" ? targetCoord.trim().toUpperCase() : "";
  if (!coord) {
    return false;
  }

  if (sessionState.game.boardPlacements[coord]) {
    return false;
  }

  sessionState.game.boardPlacements[coord] = {
    coord,
    cardCoord: card.coord,
    placedByRole: requester.role,
    placedByName: requester.name,
    placedAt: Date.now(),
  };

  sessionState.game.hands[requester.role] = null;
  maybeFinishGame(sessionState);
  return true;
}

function movePlacedCard(sessionState, requester, fromCoord, targetCoord) {
  if (sessionState.game.phase !== "in_game") {
    return false;
  }

  const from = typeof fromCoord === "string" ? fromCoord.trim().toUpperCase() : "";
  const target = typeof targetCoord === "string" ? targetCoord.trim().toUpperCase() : "";
  if (!from || !target || from === target) {
    return false;
  }

  const placement = sessionState.game.boardPlacements[from];
  if (!placement) {
    return false;
  }

  if (sessionState.game.boardPlacements[target]) {
    return false;
  }

  delete sessionState.game.boardPlacements[from];
  sessionState.game.boardPlacements[target] = {
    ...placement,
    coord: target,
  };
  return true;
}

function discardCard(sessionState, requester) {
  if (sessionState.game.phase !== "in_game") {
    return false;
  }

  const card = sessionState.game.hands[requester.role];
  if (!card) {
    return false;
  }

  sessionState.game.discardPile.push({
    coord: card.coord,
    source: "hand",
    discardedByRole: requester.role,
    discardedByName: requester.name,
    discardedAt: Date.now(),
  });

  sessionState.game.hands[requester.role] = null;
  maybeFinishGame(sessionState);
  return true;
}

function discardPlacedCard(sessionState, requester, sourceCoord) {
  if (sessionState.game.phase !== "in_game") {
    return false;
  }

  const coord = typeof sourceCoord === "string" ? sourceCoord.trim().toUpperCase() : "";
  if (!coord) {
    return false;
  }

  const placement = sessionState.game.boardPlacements[coord];
  if (!placement) {
    return false;
  }

  delete sessionState.game.boardPlacements[coord];
  sessionState.game.discardPile.push({
    coord: placement.cardCoord || placement.coord,
    source: "board",
    discardedByRole: requester.role,
    discardedByName: requester.name,
    originallyPlacedByName: placement.placedByName,
    discardedAt: Date.now(),
  });
  maybeFinishGame(sessionState);
  return true;
}

function invalidateCard(sessionState, requester, safeCoord) {
  if (sessionState.game.phase !== "in_game") {
    return false;
  }

  const placement = sessionState.game.boardPlacements[safeCoord];
  if (!placement) {
    return false;
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

  return true;
}

function endGame(sessionState) {
  if (sessionState.game.phase !== "in_game" && sessionState.game.phase !== "ended") {
    return false;
  }

  resetGameToLobby(sessionState);
  return true;
}

module.exports = {
  startGame,
  drawCard,
  placeCard,
  movePlacedCard,
  discardCard,
  discardPlacedCard,
  invalidateCard,
  endGame,
};
