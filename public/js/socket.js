(function initSocketModule(global) {
  const DEFAULT_PLAYER_SLOTS = [
    { slotKey: "seat1", seat: 1, systemRole: "host", defaultName: "Host" },
    { slotKey: "seat2", seat: 2, systemRole: "guest", defaultName: "Jogador 2" },
    { slotKey: "seat3", seat: 3, systemRole: "guest", defaultName: "Jogador 3" },
    { slotKey: "seat4", seat: 4, systemRole: "guest", defaultName: "Jogador 4" },
  ];

  function normalizeState(rawState) {
    const state = rawState || {};
    const game = state.game || {};
    let players = Array.isArray(state.players) ? state.players : null;

    if (!players) {
      const legacyByRole = {
        seat1: state.seat1 || state.host || null,
        seat2: state.seat2 || state.guest || null,
        seat3: state.seat3 || null,
        seat4: state.seat4 || null,
      };

      players = DEFAULT_PLAYER_SLOTS.map((slotDef) => {
        const legacy = legacyByRole[slotDef.slotKey];
        return {
          slotKey: slotDef.slotKey,
          seat: slotDef.seat,
          systemRole: slotDef.systemRole,
          defaultName: slotDef.defaultName,
          name: legacy && legacy.name ? legacy.name : slotDef.defaultName,
          online: Boolean(legacy && legacy.online),
          occupied: Boolean(legacy),
          hasCard: false,
        };
      });
    }

    const connectedCount = Number.isFinite(state.connectedCount)
      ? state.connectedCount
      : players.filter((player) => player.occupied && player.online).length;
    const capacity = Number.isFinite(state.capacity) ? state.capacity : DEFAULT_PLAYER_SLOTS.length;

    return {
      ...state,
      players,
      connectedCount,
      capacity,
      game: {
        ...game,
        canStart: Boolean(game.canStart),
      },
    };
  }

  function createSocket(playerToken) {
    return io({
      auth: {
        playerToken,
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }

  function bindSocketEvents(socket, deps) {
    const { dom, gameState, storage, render } = deps;

    function renderIssueModal() {
      render.renderRoomIssueModal(dom, gameState.lastPublicState, gameState);
    }

    dom.connectionStatus.textContent = "Conectando...";
    gameState.connectionState = "connecting";

    socket.on("session:assigned", (payload) => {
      gameState.mySystemRole = payload.systemRole;
      gameState.mySeatValue = payload.seat;
      const roleLabel = payload.systemRole === "host" ? "Host" : "Convidado";
      dom.myRole.textContent = roleLabel;

      if (dom.nameInput.value.trim().length === 0) {
        dom.nameInput.value = payload.name;
        storage.saveName(payload.name);
      }

      const currentName = dom.nameInput.value.trim();
      if (currentName.length > 0) {
        socket.emit("player:setName", currentName);
      }

      dom.connectionStatus.textContent = "Conectado";
      dom.connectionStatus.style.color = "green";
      gameState.connectionState = "connected";
      renderIssueModal();
    });

    socket.on("state:update", (state) => {
      const normalizedState = normalizeState(state);
      gameState.placingCardInProgress = false;
      const nextSeatHasCardMap = {};
      (normalizedState.players || []).forEach((player) => {
        nextSeatHasCardMap[player.seat] = Boolean(player.hasCard);
      });
      const previousSeatHasCardMap = gameState.seatHasCardMap || {};

      (normalizedState.players || []).forEach((player) => {
        const hadCard = Boolean(previousSeatHasCardMap[player.seat]);
        const hasCardNow = Boolean(player.hasCard);
        if (!hadCard && hasCardNow) {
          window.dispatchEvent(new CustomEvent("entrelinhas:card-drawn", {
            detail: {
              seat: player.seat,
            },
          }));
        }
      });

      gameState.seatHasCardMap = nextSeatHasCardMap;
      gameState.lastPublicState = normalizedState;
      gameState.lastGameState = normalizedState.game || null;
      if (!normalizedState.game || normalizedState.game.phase !== "in_game") {
        window.dispatchEvent(new CustomEvent("entrelinhas:remote-drag-end", {
          detail: {},
        }));
      }
      const disconnectedPlayer = (normalizedState.players || []).find((player) => player.occupied && !player.online) || null;
      gameState.statusContext = {
        disconnectedSeat: disconnectedPlayer ? disconnectedPlayer.seat : null,
        disconnectedName: disconnectedPlayer ? disconnectedPlayer.name : null,
        mySeat: gameState.mySeatValue,
      };
      render.renderPlayers(dom, normalizedState, gameState);
      render.renderGameStatus(dom, normalizedState.game, gameState.statusContext);
      render.renderActionButtons(dom, normalizedState, gameState);
      render.renderBoard(dom, gameState, normalizedState.game);
      render.renderDeck(dom, gameState, normalizedState.game, normalizedState);
      render.renderRoomStatus(dom, normalizedState);
      renderIssueModal();
    });

    socket.on("session:full", () => {
      dom.fullWarning.classList.remove("hidden");
      dom.myRole.textContent = "Sem vaga";
      dom.roomStatus.textContent = "Sala cheia";
      dom.roomStatus.style.color = "red";
      dom.startGameBtn.disabled = true;
      dom.hostMenuBtn.classList.add("hidden");
    });

    socket.on("session:removed", (payload) => {
      const message = payload && typeof payload.message === "string" && payload.message.trim().length > 0
        ? payload.message.trim()
        : "O host removeu voce da sala.";

      gameState.removedFromSession = true;
      gameState.removedMessage = message;
      gameState.connectionState = "removed";
      dom.connectionStatus.textContent = "Removido da sala";
      dom.connectionStatus.style.color = "red";
      dom.removedFromSessionMessage.textContent = message;
      dom.removedFromSessionModal.classList.remove("hidden");
      socket.disconnect();
    });

    socket.on("connect_error", () => {
      if (gameState.removedFromSession) {
        return;
      }
      dom.connectionStatus.textContent = "Falha de conexao";
      dom.connectionStatus.style.color = "red";
      gameState.connectionState = "error";
      renderIssueModal();
    });

    socket.on("disconnect", () => {
      if (gameState.removedFromSession) {
        return;
      }
      dom.connectionStatus.textContent = "Desconectado - tentando reconectar";
      dom.connectionStatus.style.color = "orange";
      gameState.connectionState = "disconnected";
      renderIssueModal();
    });

    socket.io.on("reconnect_attempt", () => {
      if (gameState.removedFromSession) {
        return;
      }
      dom.connectionStatus.textContent = "Reconectando...";
      dom.connectionStatus.style.color = "orange";
      gameState.connectionState = "reconnecting";
      renderIssueModal();
    });

    socket.io.on("reconnect", () => {
      if (gameState.removedFromSession) {
        return;
      }
      dom.connectionStatus.textContent = "Reconectado";
      dom.connectionStatus.style.color = "green";
      gameState.connectionState = "connected";
      renderIssueModal();
    });

    socket.on("state:private", (state) => {
      gameState.myPrivateCard = state ? state.myCard : null;
      render.renderDeck(dom, gameState, gameState.lastGameState, gameState.lastPublicState);
      window.dispatchEvent(new CustomEvent("entrelinhas:private-card", {
        detail: {
          card: gameState.myPrivateCard,
        },
      }));
    });

    socket.on("card:drawn", (payload) => {
      const seat = payload && Number.isFinite(payload.seat) ? payload.seat : null;
      if (!seat) {
        return;
      }

      window.dispatchEvent(new CustomEvent("entrelinhas:card-drawn", {
        detail: {
          seat,
        },
      }));
    });

    socket.on("drag:remoteStart", (payload) => {
      window.dispatchEvent(new CustomEvent("entrelinhas:remote-drag-start", {
        detail: payload || {},
      }));
    });

    socket.on("drag:remoteMove", (payload) => {
      window.dispatchEvent(new CustomEvent("entrelinhas:remote-drag-move", {
        detail: payload || {},
      }));
    });

    socket.on("drag:remoteEnd", (payload) => {
      window.dispatchEvent(new CustomEvent("entrelinhas:remote-drag-end", {
        detail: payload || {},
      }));
    });

  }

  global.EntreLinhasSocket = {
    createSocket,
    bindSocketEvents,
  };
})(window);
