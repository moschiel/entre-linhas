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

function computeFinalSummary(game) {
  const correctCount = Object.keys(game.boardPlacements).length;
  const discardedCount = game.discardPile.length;

  return {
    correctCount,
    discardedCount,
    totalCards: 25,
    rating: classifyPerformance(correctCount),
    discardPile: game.discardPile,
  };
}

function buildDiscardActivity(discardPile) {
  return discardPile.map((item) => {
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

module.exports = {
  computeFinalSummary,
  buildDiscardActivity,
};
