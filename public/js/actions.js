(function initActionsModule(global) {
  function bindUiActions(socket, deps) {
    const { dom, gameState, storage, render } = deps;
    let drawInFlight = false;

    function canDrawFromPile() {
      const game = gameState.lastGameState;
      if (!game || game.phase !== "in_game") {
        return false;
      }

      if (drawInFlight) {
        return false;
      }

      if (gameState.myPrivateCard) {
        return false;
      }

      return Number(game.drawPileCount || 0) > 0;
    }

    function animateDrawFlight(onDone) {
      const topCard = dom.deckPileVisual.querySelector(".deck-pile-card:last-child");
      if (!topCard) {
        onDone();
        return;
      }

      const source = topCard.getBoundingClientRect();
      const target = dom.deckCurrentVisual.getBoundingClientRect();
      const ghost = document.createElement("div");
      ghost.className = "draw-flight-card";
      ghost.style.left = `${source.left}px`;
      ghost.style.top = `${source.top}px`;
      ghost.style.width = `${source.width}px`;
      ghost.style.height = `${source.height}px`;
      document.body.appendChild(ghost);

      const deltaX = target.left - source.left;
      const deltaY = target.top - source.top;
      const cleanup = () => {
        ghost.removeEventListener("transitionend", handleEnd);
        if (ghost.parentNode) {
          ghost.parentNode.removeChild(ghost);
        }
        onDone();
      };
      const handleEnd = () => cleanup();

      ghost.addEventListener("transitionend", handleEnd);
      window.requestAnimationFrame(() => {
        ghost.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.94)`;
        ghost.style.opacity = "0.2";
      });

      window.setTimeout(cleanup, 600);
    }

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

    dom.deckPileVisual.addEventListener("click", () => {
      if (!canDrawFromPile()) {
        return;
      }

      drawInFlight = true;
      animateDrawFlight(() => {
        socket.emit("card:draw");
        drawInFlight = false;
      });
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
