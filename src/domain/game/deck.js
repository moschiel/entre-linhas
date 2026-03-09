const { ROW_KEYS, COL_KEYS, WORD_BANK } = require("./constants");
const { shuffleArray } = require("./shuffle");

function buildMatrixWords() {
  const selected = shuffleArray(WORD_BANK).slice(0, 10);

  return {
    rows: ROW_KEYS.map((key, index) => ({
      key,
      word: selected[index],
    })),
    cols: COL_KEYS.map((key, index) => ({
      key,
      word: selected[index + 5],
    })),
  };
}

function buildCoordinateDeck() {
  const allCoords = [];

  ROW_KEYS.forEach((row) => {
    COL_KEYS.forEach((col) => {
      allCoords.push(`${row}${col}`);
    });
  });

  return shuffleArray(allCoords);
}

module.exports = {
  buildMatrixWords,
  buildCoordinateDeck,
};
