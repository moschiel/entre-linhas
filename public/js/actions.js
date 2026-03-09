(function initActionsModule(global) {
  const config = global.EntreLinhasConfig || {};
  const uiConfig = config.ui || {};
  const DRAW_ANIM_MS = Number(uiConfig.drawAnimationMs) || 1000;
  const DRAW_ANIM_BUFFER_MS = Number(uiConfig.drawAnimationBufferMs) || 100;
  const DRAW_ANIM_HANDOFF_MS = Number(uiConfig.drawAnimationHandoffMs) || 120;

  function bindUiActions(socket, deps) {
    const { dom, gameState, storage, render } = deps;
    let activeFlightCoordEl = null;
    document.documentElement.style.setProperty("--draw-anim-ms", `${DRAW_ANIM_MS}ms`);

    function getCardVisualByRole(role) {
      if (role === "host") {
        return dom.currentCardHostVisual;
      }
      if (role === "guest") {
        return dom.currentCardGuestVisual;
      }
      if (role === "player3") {
        return dom.currentCardPlayer3Visual;
      }
      if (role === "player4") {
        return dom.currentCardPlayer4Visual;
      }
      return dom.currentCardHostVisual;
    }

    function canDrawFromPile() {
      const game = gameState.lastGameState;
      if (!game || game.phase !== "in_game") {
        return false;
      }

      if (gameState.drawFlightInProgress) {
        return false;
      }

      if (gameState.myPrivateCard) {
        return false;
      }

      return Number(game.drawPileCount || 0) > 0;
    }

    function animateDrawFlight(role, options) {
      const drawOptions = options || {};
      const revealForSelf = Boolean(drawOptions.revealForSelf);
      const onDone = typeof drawOptions.onDone === "function" ? drawOptions.onDone : () => {};
      const snap = (value) => {
        const ratio = window.devicePixelRatio || 1;
        return Math.round(value * ratio) / ratio;
      };

      const topCard = dom.deckPileVisual.querySelector(".deck-pile-card:last-child");
      if (!topCard) {
        onDone();
        return;
      }

      const source = topCard.getBoundingClientRect();
      const target = getCardVisualByRole(role).getBoundingClientRect();
      const ghost = document.createElement("div");
      ghost.className = "draw-flight-card";
      ghost.innerHTML = `
        <div class="draw-flight-inner">
          <div class="draw-flight-face draw-flight-back"></div>
          <div class="draw-flight-face draw-flight-front"><span class="draw-flight-coord">--</span></div>
        </div>
      `;
      ghost.style.left = `${snap(source.left)}px`;
      ghost.style.top = `${snap(source.top)}px`;
      ghost.style.width = `${snap(source.width)}px`;
      ghost.style.height = `${snap(source.height)}px`;
      document.body.appendChild(ghost);
      activeFlightCoordEl = ghost.querySelector(".draw-flight-coord");

      let isDone = false;
      const cleanup = () => {
        if (isDone) {
          return;
        }
        isDone = true;
        activeFlightCoordEl = null;
        ghost.removeEventListener("transitionend", handleEnd);
        onDone();
        // Faz handoff visual: mantem o ghost por um instante sobre a carta real.
        window.setTimeout(() => {
          if (ghost.parentNode) {
            ghost.parentNode.removeChild(ghost);
          }
        }, DRAW_ANIM_HANDOFF_MS);
      };
      const handleEnd = () => cleanup();

      ghost.addEventListener("transitionend", handleEnd);
      window.requestAnimationFrame(() => {
        if (revealForSelf) {
          ghost.classList.add("is-flipping");
        }
        ghost.style.left = `${snap(target.left)}px`;
        ghost.style.top = `${snap(target.top)}px`;
        ghost.style.width = `${snap(target.width)}px`;
        ghost.style.height = `${snap(target.height)}px`;
        ghost.style.opacity = "0.96";
      });

      window.setTimeout(cleanup, DRAW_ANIM_MS + DRAW_ANIM_BUFFER_MS);
    }

    window.addEventListener("entrelinhas:private-card", (event) => {
      if (!gameState.drawFlightInProgress || !activeFlightCoordEl) {
        return;
      }

      const card = event && event.detail ? event.detail.card : null;
      if (!card || !card.coord) {
        return;
      }

      activeFlightCoordEl.textContent = card.coord;
    });

    window.addEventListener("entrelinhas:card-drawn", (event) => {
      const role = event && event.detail ? event.detail.role : null;
      if (!role) {
        return;
      }

      if (role === gameState.myRoleValue) {
        gameState.drawFlightInProgress = true;
        render.renderDeck(dom, gameState, gameState.lastGameState, gameState.lastPublicState);
        animateDrawFlight(role, {
          revealForSelf: true,
          onDone: () => {
            gameState.drawFlightInProgress = false;
            render.renderDeck(dom, gameState, gameState.lastGameState, gameState.lastPublicState);
          },
        });
        return;
      }

      animateDrawFlight(role, {
        revealForSelf: false,
      });
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
      render.renderDeck(dom, gameState, gameState.lastGameState, gameState.lastPublicState);
    });
  }

  global.EntreLinhasActions = {
    bindUiActions,
  };
})(window);
