(function initActionsModule(global) {
  const config = global.EntreLinhasConfig || {};
  const uiConfig = config.ui || {};
  const DRAW_ANIM_MS = Number(uiConfig.drawAnimationMs) || 1000;
  const DRAW_ANIM_BUFFER_MS = Number(uiConfig.drawAnimationBufferMs) || 100;
  const DRAW_ANIM_HANDOFF_MS = Number(uiConfig.drawAnimationHandoffMs) || 120;

  function bindUiActions(socket, deps) {
    const { dom, gameState, storage, render } = deps;
    let activeFlightCoordEl = null;
    let activeBoardDrag = null;
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

      if (gameState.dragState.active || gameState.placingCardInProgress) {
        return false;
      }

      if (gameState.myPrivateCard) {
        return false;
      }

      return Number(game.drawPileCount || 0) > 0;
    }

    function getMyCardVisual() {
      return getCardVisualByRole(gameState.myRoleValue);
    }

    function getBoardCellByPoint(clientX, clientY) {
      const element = document.elementFromPoint(clientX, clientY);
      if (!element) {
        return null;
      }

      return element.closest(".coord-cell");
    }

    function syncHoveredCoord(nextCoord) {
      const normalizedCoord = typeof nextCoord === "string" ? nextCoord : null;
      if (gameState.hoveredBoardCoord === normalizedCoord) {
        return;
      }

      gameState.hoveredBoardCoord = normalizedCoord;
      render.renderBoard(dom, gameState, gameState.lastGameState);
    }

    function canDragMyCard() {
      const game = gameState.lastGameState;
      return Boolean(
        game
        && game.phase === "in_game"
        && gameState.myPrivateCard
        && !gameState.drawFlightInProgress
        && !gameState.placingCardInProgress
        && !activeBoardDrag,
      );
    }

    function getPlacementByCoord(coord) {
      const game = gameState.lastGameState;
      if (!game || !Array.isArray(game.boardPlacements)) {
        return null;
      }

      return game.boardPlacements.find((placement) => placement.coord === coord) || null;
    }

    function canDragPlacedCard(coord) {
      const game = gameState.lastGameState;
      const placement = getPlacementByCoord(coord);
      return Boolean(
        game
        && game.phase === "in_game"
        && placement
        && placement.placedByRole === gameState.myRoleValue
        && !gameState.drawFlightInProgress
        && !gameState.placingCardInProgress
        && !activeBoardDrag,
      );
    }

    function cleanupBoardDrag(shouldRenderDeck) {
      if (!activeBoardDrag) {
        return;
      }

      window.removeEventListener("pointermove", handleBoardDragMove);
      window.removeEventListener("pointerup", handleBoardDragEnd);
      window.removeEventListener("pointercancel", handleBoardDragCancel);
      if (activeBoardDrag.sourceEl) {
        activeBoardDrag.sourceEl.classList.remove("dragging");
      }
      if (activeBoardDrag.ghost && activeBoardDrag.ghost.parentNode) {
        activeBoardDrag.ghost.parentNode.removeChild(activeBoardDrag.ghost);
      }
      activeBoardDrag = null;
      gameState.dragState.active = false;
      gameState.dragState.pointerId = null;
      gameState.dragState.hoverCoord = null;
      gameState.dragState.sourceType = null;
      gameState.dragState.sourceCoord = null;
      syncHoveredCoord(null);
      if (shouldRenderDeck) {
        render.renderDeck(dom, gameState, gameState.lastGameState, gameState.lastPublicState);
      }
    }

    function updateBoardDragPosition(clientX, clientY) {
      if (!activeBoardDrag) {
        return;
      }

      activeBoardDrag.lastClientX = clientX;
      activeBoardDrag.lastClientY = clientY;
      activeBoardDrag.ghost.style.left = `${clientX - activeBoardDrag.offsetX}px`;
      activeBoardDrag.ghost.style.top = `${clientY - activeBoardDrag.offsetY}px`;

      const hoverCell = getBoardCellByPoint(clientX, clientY);
      const hoverCoord = hoverCell ? hoverCell.dataset.coord || null : null;
      gameState.dragState.hoverCoord = hoverCoord;
      syncHoveredCoord(hoverCoord);
    }

    function handleBoardDragMove(event) {
      if (!activeBoardDrag || event.pointerId !== activeBoardDrag.pointerId) {
        return;
      }

      updateBoardDragPosition(event.clientX, event.clientY);
    }

    function finishBoardDragDrop(targetCoord) {
      if (!activeBoardDrag) {
        return;
      }

      const targetCell = dom.matrixBody.querySelector(`[data-coord="${targetCoord}"]`);
      const hasPlacement = Boolean(
        gameState.lastGameState
        && Array.isArray(gameState.lastGameState.boardPlacements)
        && gameState.lastGameState.boardPlacements.find(
          (placement) => placement.coord === targetCoord && placement.coord !== activeBoardDrag.sourceCoord,
        )
      );

      if (!targetCell || hasPlacement || targetCoord === activeBoardDrag.sourceCoord) {
        cleanupBoardDrag(true);
        return;
      }

      const targetRect = targetCell.getBoundingClientRect();
      const ghost = activeBoardDrag.ghost;
      ghost.animate(
        [
          {
            left: ghost.style.left,
            top: ghost.style.top,
          },
          {
            left: `${targetRect.left}px`,
            top: `${targetRect.top}px`,
          },
        ],
        {
          duration: 160,
          easing: "ease-out",
          fill: "forwards",
        },
      ).finished
        .catch(() => {})
        .finally(() => {
          gameState.placingCardInProgress = true;
          const dragMode = activeBoardDrag.mode;
          const sourceCoord = activeBoardDrag.sourceCoord;
          cleanupBoardDrag(false);
          render.renderBoard(dom, gameState, gameState.lastGameState);
          render.renderDeck(dom, gameState, gameState.lastGameState, gameState.lastPublicState);
          if (dragMode === "board" && sourceCoord) {
            socket.emit("card:move", {
              from: sourceCoord,
              to: targetCoord,
            });
            return;
          }

          socket.emit("card:place", targetCoord);
        });
    }

    function handleBoardDragEnd(event) {
      if (!activeBoardDrag || event.pointerId !== activeBoardDrag.pointerId) {
        return;
      }

      const targetCoord = gameState.dragState.hoverCoord;
      if (!targetCoord) {
        cleanupBoardDrag(true);
        return;
      }

      finishBoardDragDrop(targetCoord);
    }

    function handleBoardDragCancel(event) {
      if (!activeBoardDrag || event.pointerId !== activeBoardDrag.pointerId) {
        return;
      }

      cleanupBoardDrag(true);
    }

    function startBoardDrag(event) {
      if (!canDragMyCard()) {
        return;
      }

      const sourceEl = getMyCardVisual();
      if (event.currentTarget !== sourceEl) {
        return;
      }
      const card = gameState.myPrivateCard;
      if (!sourceEl || !card) {
        return;
      }

      const rect = sourceEl.getBoundingClientRect();
      const ghost = document.createElement("div");
      ghost.className = "board-drag-ghost";
      ghost.textContent = card.coord;
      ghost.style.left = `${rect.left}px`;
      ghost.style.top = `${rect.top}px`;
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
      document.body.appendChild(ghost);

      activeBoardDrag = {
        mode: "hand",
        pointerId: event.pointerId,
        sourceEl,
        ghost,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
      };
      gameState.dragState.active = true;
      gameState.dragState.pointerId = event.pointerId;
      gameState.dragState.sourceType = "hand";
      gameState.dragState.sourceCoord = null;
      sourceEl.classList.add("dragging");
      render.renderDeck(dom, gameState, gameState.lastGameState, gameState.lastPublicState);
      updateBoardDragPosition(event.clientX, event.clientY);

      window.addEventListener("pointermove", handleBoardDragMove);
      window.addEventListener("pointerup", handleBoardDragEnd);
      window.addEventListener("pointercancel", handleBoardDragCancel);
      event.preventDefault();
    }

    function startPlacedCardDrag(event) {
      const targetCard = event.target.closest(".board-card.movable");
      if (!targetCard) {
        return;
      }

      const coordCell = targetCard.closest(".coord-cell");
      const sourceCoord = coordCell ? coordCell.dataset.coord || null : null;
      if (!sourceCoord || !canDragPlacedCard(sourceCoord)) {
        return;
      }

      const placement = getPlacementByCoord(sourceCoord);
      if (!placement) {
        return;
      }

      const rect = targetCard.getBoundingClientRect();
      const ghost = document.createElement("div");
      ghost.className = "board-drag-ghost";
      ghost.textContent = placement.cardCoord || placement.coord;
      ghost.style.left = `${rect.left}px`;
      ghost.style.top = `${rect.top}px`;
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
      document.body.appendChild(ghost);

      activeBoardDrag = {
        mode: "board",
        pointerId: event.pointerId,
        sourceEl: targetCard,
        sourceCoord,
        ghost,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
      };
      gameState.dragState.active = true;
      gameState.dragState.pointerId = event.pointerId;
      gameState.dragState.sourceType = "board";
      gameState.dragState.sourceCoord = sourceCoord;
      render.renderBoard(dom, gameState, gameState.lastGameState);
      updateBoardDragPosition(event.clientX, event.clientY);

      window.addEventListener("pointermove", handleBoardDragMove);
      window.addEventListener("pointerup", handleBoardDragEnd);
      window.addEventListener("pointercancel", handleBoardDragCancel);
      event.preventDefault();
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
      const ghostInner = ghost.querySelector(".draw-flight-inner");

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

      // Mobile: WAAPI costuma ser mais confiavel que transition em left/top.
      if (typeof ghost.animate === "function") {
        ghost.style.transition = "none";
        if (ghostInner) {
          ghostInner.style.transition = "none";
        }

        const movement = ghost.animate(
          [
            {
              left: `${snap(source.left)}px`,
              top: `${snap(source.top)}px`,
              width: `${snap(source.width)}px`,
              height: `${snap(source.height)}px`,
              opacity: 1,
            },
            {
              left: `${snap(target.left)}px`,
              top: `${snap(target.top)}px`,
              width: `${snap(target.width)}px`,
              height: `${snap(target.height)}px`,
              opacity: 0.96,
            },
          ],
          {
            duration: DRAW_ANIM_MS,
            easing: "ease",
            fill: "forwards",
          },
        );

        if (revealForSelf && ghostInner && typeof ghostInner.animate === "function") {
          ghostInner.animate(
            [
              { transform: "rotateY(0deg)" },
              { transform: "rotateY(180deg)" },
            ],
            {
              duration: DRAW_ANIM_MS,
              easing: "ease",
              fill: "forwards",
            },
          );
        }

        movement.finished.then(cleanup).catch(() => {});
      } else {
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
      }

      window.setTimeout(cleanup, DRAW_ANIM_MS + DRAW_ANIM_BUFFER_MS);
    }

    window.addEventListener("entrelinhas:private-card", (event) => {
      gameState.placingCardInProgress = false;
      if (!gameState.drawFlightInProgress || !activeFlightCoordEl) {
        render.renderDeck(dom, gameState, gameState.lastGameState, gameState.lastPublicState);
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
      if (gameState.drawFlightsByRole[role]) {
        return;
      }

      if (role === gameState.myRoleValue) {
        gameState.drawFlightInProgress = true;
        gameState.drawFlightsByRole[role] = true;
        render.renderDeck(dom, gameState, gameState.lastGameState, gameState.lastPublicState);
        animateDrawFlight(role, {
          revealForSelf: true,
          onDone: () => {
            gameState.drawFlightInProgress = false;
            gameState.drawFlightsByRole[role] = false;
            render.renderDeck(dom, gameState, gameState.lastGameState, gameState.lastPublicState);
          },
        });
        return;
      }

      gameState.drawFlightsByRole[role] = true;
      render.renderDeck(dom, gameState, gameState.lastGameState, gameState.lastPublicState);
      animateDrawFlight(role, {
        revealForSelf: false,
        onDone: () => {
          gameState.drawFlightsByRole[role] = false;
          render.renderDeck(dom, gameState, gameState.lastGameState, gameState.lastPublicState);
        },
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

    [
      dom.currentCardHostVisual,
      dom.currentCardGuestVisual,
      dom.currentCardPlayer3Visual,
      dom.currentCardPlayer4Visual,
    ].forEach((element) => {
      element.addEventListener("pointerdown", startBoardDrag);
    });

    dom.placeCardBtn.addEventListener("click", () => {
      // Fluxo antigo mantido apenas por compatibilidade visual; o uso real agora e por drag.
    });

    dom.matrixBody.addEventListener("pointerdown", startPlacedCardDrag);

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
