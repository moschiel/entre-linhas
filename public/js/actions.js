(function initActionsModule(global) {
  const DRAW_ANIM_MS = 1000;
  const DRAW_ANIM_BUFFER_MS = 100;

  function bindUiActions(socket, deps) {
    const { dom, gameState, storage, render } = deps;
    let drawInFlight = false;
    let activeFlightCoordEl = null;
    document.documentElement.style.setProperty("--draw-anim-ms", `${DRAW_ANIM_MS}ms`);

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
      ghost.innerHTML = `
        <div class="draw-flight-inner">
          <div class="draw-flight-face draw-flight-back"></div>
          <div class="draw-flight-face draw-flight-front"><span class="draw-flight-coord">--</span></div>
        </div>
      `;
      ghost.style.left = `${source.left}px`;
      ghost.style.top = `${source.top}px`;
      ghost.style.width = `${source.width}px`;
      ghost.style.height = `${source.height}px`;
      document.body.appendChild(ghost);
      activeFlightCoordEl = ghost.querySelector(".draw-flight-coord");

      const deltaX = target.left - source.left;
      const deltaY = target.top - source.top;
      let isDone = false;
      const cleanup = () => {
        if (isDone) {
          return;
        }
        isDone = true;
        activeFlightCoordEl = null;
        ghost.removeEventListener("transitionend", handleEnd);
        if (ghost.parentNode) {
          ghost.parentNode.removeChild(ghost);
        }
        onDone();
      };
      const handleEnd = () => cleanup();

      ghost.addEventListener("transitionend", handleEnd);
      window.requestAnimationFrame(() => {
        ghost.classList.add("is-flipping");
        ghost.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.94)`;
        ghost.style.opacity = "0.96";
      });

      window.setTimeout(cleanup, DRAW_ANIM_MS + DRAW_ANIM_BUFFER_MS);
    }

    window.addEventListener("entrelinhas:private-card", (event) => {
      if (!drawInFlight || !activeFlightCoordEl) {
        return;
      }

      const card = event && event.detail ? event.detail.card : null;
      if (!card || !card.coord) {
        return;
      }

      activeFlightCoordEl.textContent = card.coord;
    });

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
        drawInFlight = false;
      });
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
