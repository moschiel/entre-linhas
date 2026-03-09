(function initDomModule(global) {
  function getDom() {
    return {
      nameInput: document.getElementById("nameInput"),
      saveNameBtn: document.getElementById("saveNameBtn"),
      myRole: document.getElementById("myRole"),
      roomStatus: document.getElementById("roomStatus"),
      gameStatus: document.getElementById("gameStatus"),
      connectionStatus: document.getElementById("connectionStatus"),
      hostState: document.getElementById("hostState"),
      guestState: document.getElementById("guestState"),
      fullWarning: document.getElementById("fullWarning"),
      startGameSection: document.getElementById("startGameSection"),
      startGameBtn: document.getElementById("startGameBtn"),
      endGameBtn: document.getElementById("endGameBtn"),
      actionHint: document.getElementById("actionHint"),
      boardSection: document.getElementById("boardSection"),
      tableCurrentSection: document.getElementById("tableCurrentSection"),
      tableSideSection: document.getElementById("tableSideSection"),
      matrixHeadRow: document.getElementById("matrixHeadRow"),
      matrixBody: document.getElementById("matrixBody"),
      deckSection: document.getElementById("deckSection"),
      deckPileCountLabel: document.getElementById("deckPileCountLabel"),
      myCardValue: document.getElementById("myCardValue"),
      deckPileVisual: document.getElementById("deckPileVisual"),
      deckCurrentVisual: document.getElementById("deckCurrentVisual"),
      discardPileVisual: document.getElementById("discardPileVisual"),
      selectedCoord: document.getElementById("selectedCoord"),
      drawCardBtn: document.getElementById("drawCardBtn"),
      placeCardBtn: document.getElementById("placeCardBtn"),
      discardCardBtn: document.getElementById("discardCardBtn"),
      invalidateCardBtn: document.getElementById("invalidateCardBtn"),
      drawHint: document.getElementById("drawHint"),
      discardSection: document.getElementById("discardSection"),
      discardList: document.getElementById("discardList"),
      summarySection: document.getElementById("summarySection"),
      summaryRating: document.getElementById("summaryRating"),
      summaryCorrect: document.getElementById("summaryCorrect"),
      summaryDiscarded: document.getElementById("summaryDiscarded"),
    };
  }

  global.EntreLinhasDom = {
    getDom,
  };
})(window);
