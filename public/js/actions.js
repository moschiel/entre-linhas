(function initActionsModule(global) {
  function bindUiActions(socket, deps) {
    const { dom, gameState, storage, render } = deps;

    dom.saveNameBtn.addEventListener("click", () => {
      const name = dom.nameInput.value.trim();
      if (!name) {
        return;
      }

      storage.saveName(name);
      socket.emit("player:setName", name);
    });

    dom.startGameBtn.addEventListener("click", () => {
      socket.emit("game:start");
    });

    dom.endGameBtn.addEventListener("click", () => {
      socket.emit("game:end");
    });

    dom.drawCardBtn.addEventListener("click", () => {
      socket.emit("card:draw");
    });

    dom.placeCardBtn.addEventListener("click", () => {
      socket.emit("card:place");
    });

    dom.discardCardBtn.addEventListener("click", () => {
      socket.emit("card:discard");
    });

    dom.invalidateCardBtn.addEventListener("click", () => {
      if (!gameState.selectedBoardCoord) {
        return;
      }

      socket.emit("card:invalidate", gameState.selectedBoardCoord);
      gameState.selectedBoardCoord = null;
      dom.selectedCoord.textContent = "nenhuma";
      render.renderBoard(dom, gameState, gameState.lastGameState);
      render.renderDeck(dom, gameState, gameState.lastGameState);
    });
  }

  global.EntreLinhasActions = {
    bindUiActions,
  };
})(window);
