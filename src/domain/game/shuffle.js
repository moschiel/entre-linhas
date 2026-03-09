const { randomInt } = require("crypto");

function shuffleArray(values) {
  const copy = [...values];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

module.exports = {
  shuffleArray,
};
