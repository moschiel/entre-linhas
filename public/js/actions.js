(function initActionsModule(global) {
  const config = global.EntreLinhasConfig || {};
  const uiConfig = config.ui || {};
  const DRAW_ANIM_MS = Number(uiConfig.drawAnimationMs) || 1000;
  const DRAW_ANIM_BUFFER_MS = Number(uiConfig.drawAnimationBufferMs) || 100;
  const DRAW_ANIM_HANDOFF_MS = Number(uiConfig.drawAnimationHandoffMs) || 120;
  const MOBILE_DRAG_SCALE = Number(uiConfig.mobileDragScale) || 1.38;
  const MOBILE_DRAG_GHOST_GAP = Number(uiConfig.mobileDragGhostGap) || 28;
  const MOBILE_DRAG_HAPTIC_MS = Number(uiConfig.mobileDragHapticMs) || 22;
  const REMOTE_DRAG_BROADCAST_MS = Number(uiConfig.remoteDragBroadcastMs) || 50;

  function bindUiActions(socket, deps) {
    const { dom, gameState, storage, render } = deps;
    let activeFlightCoordEl = null;
    let activeBoardDrag = null;
    document.documentElement.style.setProperty("--draw-anim-ms", `${DRAW_ANIM_MS}ms`);

    function isTouchMobileUi(event) {
      if (event && event.pointerType === "touch") {
        return true;
      }

      return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    }

    function triggerDragHaptic(isTouchMobile) {
      if (typeof navigator.vibrate !== "function" || !isTouchMobile) {
        return;
      }

      navigator.vibrate(MOBILE_DRAG_HAPTIC_MS);
    }

    function submitPlayerName(name) {
      const trimmedName = String(name || "").trim();
      if (!trimmedName) {
        return false;
      }

      dom.nameInput.value = trimmedName;
      dom.editNameInput.value = trimmedName;
      storage.saveName(trimmedName);
      socket.emit("player:setName", trimmedName);
      return true;
    }

    function openEditNameModal() {
      const players = (gameState.lastPublicState && gameState.lastPublicState.players) || [];
      const myPlayer = players.find((player) => player.seat === gameState.mySeatValue);
      dom.editNameInput.value = myPlayer && myPlayer.name ? myPlayer.name : dom.nameInput.value.trim();
      dom.editNameModal.classList.remove("hidden");
      dom.editNameInput.focus();
      dom.editNameInput.select();
    }

    function closeEditNameModal() {
      dom.editNameModal.classList.add("hidden");
    }

    function getPlayerBySeat(seat) {
      const players = (gameState.lastPublicState && gameState.lastPublicState.players) || [];
      return players.find((player) => player.seat === seat) || null;
    }

    function getPlayerNameBySeat(seat) {
      const player = getPlayerBySeat(seat);
      return player && player.name ? player.name : `Jogador ${seat}`;
    }

    function openRemovePlayerModal(seat) {
      if (!gameState.isHost()) {
        return;
      }

      const player = getPlayerBySeat(seat);
      if (!player || !player.occupied || seat === 1) {
        return;
      }

      gameState.pendingRemovalSeat = seat;
      dom.removePlayerModalMessage.textContent = `Tem certeza que deseja remover ${player.name} da sala?`;
      dom.removePlayerModal.classList.remove("hidden");
      render.renderPlayers(dom, gameState.lastPublicState, gameState);
      render.renderDeck(dom, gameState, gameState.lastGameState, gameState.lastPublicState);
    }

    function closeRemovePlayerModal() {
      gameState.pendingRemovalSeat = null;
      dom.removePlayerModal.classList.add("hidden");
      render.renderPlayers(dom, gameState.lastPublicState, gameState);
      render.renderDeck(dom, gameState, gameState.lastGameState, gameState.lastPublicState);
    }

    function getCardVisualBySeat(seat) {
      if (seat === 1) {
        return dom.currentCardHostVisual;
      }
      if (seat === 2) {
        return dom.currentCardPlayer2Visual;
      }
      if (seat === 3) {
        return dom.currentCardPlayer3Visual;
      }
      if (seat === 4) {
        return dom.currentCardPlayer4Visual;
      }
      return dom.currentCardHostVisual;
    }

    function getGameLayoutRect() {
      if (!dom.gameLayout) {
        return null;
      }

      const rect = dom.gameLayout.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return null;
      }

      return rect;
    }

    function buildNormalizedDragPosition() {
      if (!activeBoardDrag || !activeBoardDrag.ghost) {
        return null;
      }

      const frameRect = getGameLayoutRect();
      if (!frameRect) {
        return null;
      }

      const ghostLeft = Number.parseFloat(activeBoardDrag.ghost.style.left) || 0;
      const ghostTop = Number.parseFloat(activeBoardDrag.ghost.style.top) || 0;
      const centerX = ghostLeft + (activeBoardDrag.ghostWidth / 2);
      const centerY = ghostTop + (activeBoardDrag.ghostHeight / 2);

      return {
        relX: Math.max(0, Math.min(1, (centerX - frameRect.left) / frameRect.width)),
        relY: Math.max(0, Math.min(1, (centerY - frameRect.top) / frameRect.height)),
      };
    }

    function flushRemoteDragMove() {
      if (!activeBoardDrag || !activeBoardDrag.remoteBroadcastStarted) {
        return;
      }

      if (activeBoardDrag.remoteBroadcastTimer) {
        window.clearTimeout(activeBoardDrag.remoteBroadcastTimer);
        activeBoardDrag.remoteBroadcastTimer = null;
      }

      const normalizedPosition = activeBoardDrag.pendingRemotePosition || buildNormalizedDragPosition();
      activeBoardDrag.pendingRemotePosition = null;
      if (!normalizedPosition) {
        return;
      }

      activeBoardDrag.lastRemoteBroadcastAt = Date.now();
      socket.emit("drag:move", normalizedPosition);
    }

    function queueRemoteDragMove() {
      if (!activeBoardDrag || !activeBoardDrag.remoteBroadcastStarted) {
        return;
      }

      activeBoardDrag.pendingRemotePosition = buildNormalizedDragPosition();
      if (!activeBoardDrag.pendingRemotePosition) {
        return;
      }

      const now = Date.now();
      const elapsed = now - (activeBoardDrag.lastRemoteBroadcastAt || 0);
      if (elapsed >= REMOTE_DRAG_BROADCAST_MS) {
        flushRemoteDragMove();
        return;
      }

      if (activeBoardDrag.remoteBroadcastTimer) {
        return;
      }

      activeBoardDrag.remoteBroadcastTimer = window.setTimeout(() => {
        flushRemoteDragMove();
      }, REMOTE_DRAG_BROADCAST_MS - elapsed);
    }

    function emitRemoteDragStartForOthers() {
      if (!activeBoardDrag || activeBoardDrag.remoteBroadcastStarted) {
        return;
      }

      const payload = {
        sourceType: activeBoardDrag.mode === "board" ? "board" : "hand",
      };

      if (activeBoardDrag.mode === "board" && activeBoardDrag.sourceCoord) {
        payload.sourceCoord = activeBoardDrag.sourceCoord;
        payload.cardCoord = activeBoardDrag.cardCoord || activeBoardDrag.sourceCoord;
      }

      socket.emit("drag:start", payload);
      activeBoardDrag.remoteBroadcastStarted = true;
      activeBoardDrag.lastRemoteBroadcastAt = 0;
      queueRemoteDragMove();
    }

    function emitRemoteDragEndForOthers() {
      if (!activeBoardDrag || !activeBoardDrag.remoteBroadcastStarted) {
        return;
      }

      if (activeBoardDrag.remoteBroadcastTimer) {
        window.clearTimeout(activeBoardDrag.remoteBroadcastTimer);
        activeBoardDrag.remoteBroadcastTimer = null;
      }
      activeBoardDrag.pendingRemotePosition = null;
      activeBoardDrag.remoteBroadcastStarted = false;
      socket.emit("drag:end");
    }

    function spawnImpactRipple(target, rippleClass) {
      if (!target || !rippleClass) {
        return;
      }

      const targetRect = target.getBoundingClientRect();
      const ripple = document.createElement("span");
      ripple.className = `impact-ripple impact-ripple-fixed ${rippleClass}`;
      ripple.style.left = `${targetRect.left}px`;
      ripple.style.top = `${targetRect.top}px`;
      ripple.style.width = `${targetRect.width}px`;
      ripple.style.height = `${targetRect.height}px`;
      document.body.appendChild(ripple);
      ripple.addEventListener("animationend", () => {
        if (ripple.parentNode) {
          ripple.parentNode.removeChild(ripple);
        }
      }, { once: true });
    }

    function clearRemoteDragGhost(seat) {
      const remoteDrag = gameState.remoteDragBySeat[seat];
      if (!remoteDrag) {
        return;
      }

      if (remoteDrag.ghost && remoteDrag.ghost.parentNode) {
        remoteDrag.ghost.parentNode.removeChild(remoteDrag.ghost);
      }

      delete gameState.remoteDragBySeat[seat];
      render.renderBoard(dom, gameState, gameState.lastGameState);
      render.renderDeck(dom, gameState, gameState.lastGameState, gameState.lastPublicState);
    }

    function clearAllRemoteDragGhosts() {
      Object.keys(gameState.remoteDragBySeat).forEach((seatKey) => {
        clearRemoteDragGhost(Number(seatKey));
      });
    }

    function createRemoteDragGhost(payload) {
      const seat = payload && Number(payload.seat);
      const sourceType = payload && payload.sourceType === "board" ? "board" : "hand";
      if (!Number.isInteger(seat) || seat === gameState.mySeatValue) {
        return;
      }

      clearRemoteDragGhost(seat);

      const baseRect = getCardVisualBySeat(seat).getBoundingClientRect();
      const ghost = document.createElement("div");
      const isBoardSource = sourceType === "board";
      ghost.className = `board-drag-ghost remote-drag-ghost${isBoardSource ? "" : " is-facedown"} seat-ghost-${seat}`;
      ghost.style.width = `${baseRect.width}px`;
      ghost.style.height = `${baseRect.height}px`;
      ghost.style.left = `${baseRect.left}px`;
      ghost.style.top = `${baseRect.top}px`;
      ghost.innerHTML = `
        <div class="remote-drag-name seat-name-${seat}">${getPlayerNameBySeat(seat)}</div>
        <div class="remote-drag-card-value">${isBoardSource ? (payload.cardCoord || payload.sourceCoord || "") : ""}</div>
      `;
      document.body.appendChild(ghost);

      gameState.remoteDragBySeat[seat] = {
        seat,
        sourceType,
        sourceCoord: payload.sourceCoord || null,
        ghost,
      };
      render.renderBoard(dom, gameState, gameState.lastGameState);
      render.renderDeck(dom, gameState, gameState.lastGameState, gameState.lastPublicState);
    }

    function updateRemoteDragGhostPosition(payload) {
      const seat = payload && Number(payload.seat);
      const relX = Number(payload && payload.relX);
      const relY = Number(payload && payload.relY);
      const remoteDrag = seat ? gameState.remoteDragBySeat[seat] : null;
      const frameRect = getGameLayoutRect();

      if (!remoteDrag || !remoteDrag.ghost || !frameRect || !Number.isFinite(relX) || !Number.isFinite(relY)) {
        return;
      }

      const ghostWidth = remoteDrag.ghost.offsetWidth;
      const ghostHeight = remoteDrag.ghost.offsetHeight;
      const centerX = frameRect.left + (Math.max(0, Math.min(1, relX)) * frameRect.width);
      const centerY = frameRect.top + (Math.max(0, Math.min(1, relY)) * frameRect.height);
      remoteDrag.ghost.style.left = `${centerX - (ghostWidth / 2)}px`;
      remoteDrag.ghost.style.top = `${centerY - (ghostHeight / 2)}px`;
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
      return getCardVisualBySeat(gameState.mySeatValue);
    }

    function getBoardCellByPoint(clientX, clientY) {
      const element = document.elementFromPoint(clientX, clientY);
      if (!element) {
        return null;
      }

      return element.closest(".coord-cell");
    }

    function isDiscardPileHit(clientX, clientY) {
      const element = document.elementFromPoint(clientX, clientY);
      if (!element) {
        return false;
      }

      return Boolean(element.closest("#discardPileVisual"));
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
        && !gameState.drawFlightInProgress
        && !gameState.placingCardInProgress
        && !activeBoardDrag,
      );
    }

    function cleanupBoardDrag(shouldRenderDeck) {
      if (!activeBoardDrag) {
        return;
      }

      emitRemoteDragEndForOthers();
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
      gameState.dragState.hoverDiscard = false;
      gameState.dragState.sourceType = null;
      gameState.dragState.sourceCoord = null;
      syncHoveredCoord(null);
      if (shouldRenderDeck) {
        render.renderDeck(dom, gameState, gameState.lastGameState, gameState.lastPublicState);
      }
    }

    function getDragTargetPoint(clientX, clientY) {
      if (!activeBoardDrag || !activeBoardDrag.isTouchMobile) {
        return { x: clientX, y: clientY };
      }

      const ghostLeft = Number.parseFloat(activeBoardDrag.ghost.style.left) || 0;
      const ghostTop = Number.parseFloat(activeBoardDrag.ghost.style.top) || 0;
      return {
        x: ghostLeft + (activeBoardDrag.ghostWidth / 2),
        y: ghostTop + (activeBoardDrag.ghostHeight / 2),
      };
    }

    function updateBoardDragPosition(clientX, clientY) {
      if (!activeBoardDrag) {
        return;
      }

      activeBoardDrag.lastClientX = clientX;
      activeBoardDrag.lastClientY = clientY;
      if (activeBoardDrag.isTouchMobile) {
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
        const ghostLeft = Math.max(
          8,
          Math.min(clientX - (activeBoardDrag.ghostWidth / 2), viewportWidth - activeBoardDrag.ghostWidth - 8),
        );
        const ghostTop = Math.max(8, clientY - activeBoardDrag.ghostHeight - MOBILE_DRAG_GHOST_GAP);
        activeBoardDrag.ghost.style.left = `${ghostLeft}px`;
        activeBoardDrag.ghost.style.top = `${ghostTop}px`;
      } else {
        activeBoardDrag.ghost.style.left = `${clientX - activeBoardDrag.offsetX}px`;
        activeBoardDrag.ghost.style.top = `${clientY - activeBoardDrag.offsetY}px`;
      }

      const targetPoint = getDragTargetPoint(clientX, clientY);
      const hoverCell = getBoardCellByPoint(targetPoint.x, targetPoint.y);
      const hoverCoord = hoverCell ? hoverCell.dataset.coord || null : null;
      const hoverDiscard = isDiscardPileHit(targetPoint.x, targetPoint.y);
      gameState.dragState.hoverCoord = hoverCoord;
      gameState.dragState.hoverDiscard = hoverDiscard;
      syncHoveredCoord(hoverCoord);
      render.renderDeck(dom, gameState, gameState.lastGameState, gameState.lastPublicState);
      queueRemoteDragMove();
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

    function finishDiscardDrop() {
      if (!activeBoardDrag) {
        return;
      }

      const discardRect = dom.discardPileVisual.getBoundingClientRect();
      const ghost = activeBoardDrag.ghost;
      ghost.animate(
        [
          {
            left: ghost.style.left,
            top: ghost.style.top,
          },
          {
            left: `${discardRect.left}px`,
            top: `${discardRect.top}px`,
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
            socket.emit("card:discard", {
              source: "board",
              coord: sourceCoord,
            });
            return;
          }

          socket.emit("card:discard", {
            source: "hand",
          });
        });
    }

    function handleBoardDragEnd(event) {
      if (!activeBoardDrag || event.pointerId !== activeBoardDrag.pointerId) {
        return;
      }

      const targetCoord = gameState.dragState.hoverCoord;
      if (gameState.dragState.hoverDiscard) {
        finishDiscardDrop();
        return;
      }

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

      event.preventDefault();

      const rect = sourceEl.getBoundingClientRect();
      const isTouchMobile = isTouchMobileUi(event);
      const ghostWidth = isTouchMobile ? rect.width * MOBILE_DRAG_SCALE : rect.width;
      const ghostHeight = isTouchMobile ? rect.height * MOBILE_DRAG_SCALE : rect.height;
      const ghost = document.createElement("div");
      ghost.className = `board-drag-ghost${isTouchMobile ? " mobile-lifted" : ""}`;
      ghost.textContent = card.coord;
      ghost.style.left = `${rect.left}px`;
      ghost.style.top = `${rect.top}px`;
      ghost.style.width = `${ghostWidth}px`;
      ghost.style.height = `${ghostHeight}px`;
      document.body.appendChild(ghost);

      activeBoardDrag = {
        mode: "hand",
        pointerId: event.pointerId,
        sourceEl,
        ghost,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        ghostWidth,
        ghostHeight,
        isTouchMobile,
        remoteBroadcastStarted: false,
        remoteBroadcastTimer: null,
        lastRemoteBroadcastAt: 0,
        pendingRemotePosition: null,
      };
      gameState.dragState.active = true;
      gameState.dragState.pointerId = event.pointerId;
      gameState.dragState.sourceType = "hand";
      gameState.dragState.sourceCoord = null;
      sourceEl.classList.add("dragging");
      triggerDragHaptic(isTouchMobile);
      render.renderDeck(dom, gameState, gameState.lastGameState, gameState.lastPublicState);
      emitRemoteDragStartForOthers();
      updateBoardDragPosition(event.clientX, event.clientY);

      window.addEventListener("pointermove", handleBoardDragMove);
      window.addEventListener("pointerup", handleBoardDragEnd);
      window.addEventListener("pointercancel", handleBoardDragCancel);
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

      event.preventDefault();

      const rect = targetCard.getBoundingClientRect();
      const isTouchMobile = isTouchMobileUi(event);
      const ghostWidth = isTouchMobile ? rect.width * MOBILE_DRAG_SCALE : rect.width;
      const ghostHeight = isTouchMobile ? rect.height * MOBILE_DRAG_SCALE : rect.height;
      const ghost = document.createElement("div");
      ghost.className = `board-drag-ghost${isTouchMobile ? " mobile-lifted" : ""}`;
      ghost.textContent = placement.cardCoord || placement.coord;
      ghost.style.left = `${rect.left}px`;
      ghost.style.top = `${rect.top}px`;
      ghost.style.width = `${ghostWidth}px`;
      ghost.style.height = `${ghostHeight}px`;
      document.body.appendChild(ghost);

      activeBoardDrag = {
        mode: "board",
        pointerId: event.pointerId,
        sourceEl: targetCard,
        sourceCoord,
        cardCoord: placement.cardCoord || placement.coord,
        ghost,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        ghostWidth,
        ghostHeight,
        isTouchMobile,
        remoteBroadcastStarted: false,
        remoteBroadcastTimer: null,
        lastRemoteBroadcastAt: 0,
        pendingRemotePosition: null,
      };
      gameState.dragState.active = true;
      gameState.dragState.pointerId = event.pointerId;
      gameState.dragState.sourceType = "board";
      gameState.dragState.sourceCoord = sourceCoord;
      triggerDragHaptic(isTouchMobile);
      render.renderBoard(dom, gameState, gameState.lastGameState);
      emitRemoteDragStartForOthers();
      updateBoardDragPosition(event.clientX, event.clientY);

      window.addEventListener("pointermove", handleBoardDragMove);
      window.addEventListener("pointerup", handleBoardDragEnd);
      window.addEventListener("pointercancel", handleBoardDragCancel);
    }

    function animateDrawFlight(seat, options) {
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
      const target = getCardVisualBySeat(seat).getBoundingClientRect();
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
      const seat = event && event.detail ? event.detail.seat : null;
      if (!seat) {
        return;
      }
      if (gameState.drawFlightsBySeat[seat]) {
        return;
      }

      if (seat === gameState.mySeatValue) {
        gameState.drawFlightInProgress = true;
        gameState.drawFlightsBySeat[seat] = true;
        render.renderDeck(dom, gameState, gameState.lastGameState, gameState.lastPublicState);
        animateDrawFlight(seat, {
          revealForSelf: true,
          onDone: () => {
            gameState.drawFlightInProgress = false;
            gameState.drawFlightsBySeat[seat] = false;
            render.renderDeck(dom, gameState, gameState.lastGameState, gameState.lastPublicState);
          },
        });
        return;
      }

      gameState.drawFlightsBySeat[seat] = true;
      render.renderDeck(dom, gameState, gameState.lastGameState, gameState.lastPublicState);
      animateDrawFlight(seat, {
        revealForSelf: false,
        onDone: () => {
          gameState.drawFlightsBySeat[seat] = false;
          render.renderDeck(dom, gameState, gameState.lastGameState, gameState.lastPublicState);
        },
      });
    });

    window.addEventListener("entrelinhas:remote-drag-start", (event) => {
      const payload = event && event.detail ? event.detail : null;
      createRemoteDragGhost(payload);
    });

    window.addEventListener("entrelinhas:remote-drag-move", (event) => {
      const payload = event && event.detail ? event.detail : null;
      updateRemoteDragGhostPosition(payload);
    });

    window.addEventListener("entrelinhas:remote-drag-end", (event) => {
      const payload = event && event.detail ? event.detail : null;
      const seat = payload && Number(payload.seat);
      if (!Number.isInteger(seat)) {
        clearAllRemoteDragGhosts();
        return;
      }

      clearRemoteDragGhost(seat);
    });

    window.addEventListener("entrelinhas:drag-landed", (event) => {
      const payload = event && event.detail ? event.detail : null;
      const targetType = payload && payload.targetType;
      const coord = payload && typeof payload.coord === "string" ? payload.coord : "";

      window.requestAnimationFrame(() => {
        if (targetType === "board" && coord) {
          const targetCell = dom.matrixBody.querySelector(`[data-coord="${coord}"]`);
          spawnImpactRipple(targetCell, "impact-ripple-board");
          return;
        }

        if (targetType === "discard") {
          spawnImpactRipple(dom.discardPileVisual, "impact-ripple-discard");
        }
      });
    });

    dom.saveNameBtn.addEventListener("click", () => {
      submitPlayerName(dom.nameInput.value);
    });

    [dom.editNameBtnHost, dom.editNameBtnPlayer2, dom.editNameBtnPlayer3, dom.editNameBtnPlayer4].forEach((button) => {
      button.addEventListener("click", () => {
        openEditNameModal();
      });
    });

    [
      [dom.removePlayerBtnHost, 1],
      [dom.removePlayerBtnPlayer2, 2],
      [dom.removePlayerBtnPlayer3, 3],
      [dom.removePlayerBtnPlayer4, 4],
      [dom.removeLobbyPlayerBtnHost, 1],
      [dom.removeLobbyPlayerBtnPlayer2, 2],
      [dom.removeLobbyPlayerBtnPlayer3, 3],
      [dom.removeLobbyPlayerBtnPlayer4, 4],
    ].forEach(([button, seat]) => {
      button.addEventListener("click", () => {
        openRemovePlayerModal(seat);
      });
    });

    dom.editNameSaveBtn.addEventListener("click", () => {
      if (submitPlayerName(dom.editNameInput.value)) {
        closeEditNameModal();
      }
    });

    dom.editNameCloseBtn.addEventListener("click", () => {
      closeEditNameModal();
    });

    dom.editNameModal.addEventListener("click", (event) => {
      if (event.target === dom.editNameModal) {
        closeEditNameModal();
      }
    });

    dom.editNameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (submitPlayerName(dom.editNameInput.value)) {
          closeEditNameModal();
        }
      }
    });

    dom.startGameBtn.addEventListener("click", () => {
      socket.emit("game:start");
    });

    dom.hostMenuBtn.addEventListener("click", () => {
      if (!gameState.isHost()) {
        return;
      }
      dom.endGameModal.classList.remove("hidden");
    });

    dom.endGameModalCloseBtn.addEventListener("click", () => {
      dom.endGameModal.classList.add("hidden");
    });

    dom.endGameModalCancelBtn.addEventListener("click", () => {
      dom.endGameModal.classList.add("hidden");
    });

    dom.endGameModalConfirmBtn.addEventListener("click", () => {
      dom.endGameModal.classList.add("hidden");
      socket.emit("game:end");
    });

    dom.endGameModal.addEventListener("click", (event) => {
      if (event.target === dom.endGameModal) {
        dom.endGameModal.classList.add("hidden");
      }
    });

    dom.removePlayerModalCloseBtn.addEventListener("click", () => {
      closeRemovePlayerModal();
    });

    dom.removePlayerModalCancelBtn.addEventListener("click", () => {
      closeRemovePlayerModal();
    });

    dom.removePlayerModalConfirmBtn.addEventListener("click", () => {
      if (!Number.isInteger(gameState.pendingRemovalSeat)) {
        closeRemovePlayerModal();
        return;
      }

      const targetSeat = gameState.pendingRemovalSeat;
      closeRemovePlayerModal();
      socket.emit("player:remove", targetSeat);
    });

    dom.removePlayerModal.addEventListener("click", (event) => {
      if (event.target === dom.removePlayerModal) {
        closeRemovePlayerModal();
      }
    });

    dom.discardHistoryBtn.addEventListener("click", () => {
      if (!gameState.isHost()) {
        dom.discardHistoryModal.classList.add("hidden");
        return;
      }
      dom.discardHistoryModal.classList.remove("hidden");
    });

    dom.discardHistoryCloseBtn.addEventListener("click", () => {
      dom.discardHistoryModal.classList.add("hidden");
    });

    dom.discardHistoryModal.addEventListener("click", (event) => {
      if (event.target === dom.discardHistoryModal) {
        dom.discardHistoryModal.classList.add("hidden");
      }
    });

    dom.deckPileVisual.addEventListener("click", () => {
      if (!canDrawFromPile()) {
        return;
      }
      socket.emit("card:draw");
    });

    [
      dom.currentCardHostVisual,
      dom.currentCardPlayer2Visual,
      dom.currentCardPlayer3Visual,
      dom.currentCardPlayer4Visual,
    ].forEach((element) => {
      element.addEventListener("pointerdown", startBoardDrag);
    });

    dom.matrixBody.addEventListener("pointerdown", startPlacedCardDrag);

    [dom.matrixBody, dom.currentCardHostVisual, dom.currentCardPlayer2Visual, dom.currentCardPlayer3Visual, dom.currentCardPlayer4Visual]
      .forEach((element) => {
        element.addEventListener("contextmenu", (event) => {
          event.preventDefault();
        });
        element.addEventListener("selectstart", (event) => {
          event.preventDefault();
        });
      });
  }

  global.EntreLinhasActions = {
    bindUiActions,
  };
})(window);
