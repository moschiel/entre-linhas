(function initSocketModule(global) {
  const DEFAULT_PLAYER_SLOTS = [
    { role: "host", defaultName: "Host" },
    { role: "guest", defaultName: "Convidado" },
    { role: "player3", defaultName: "Jogador 3" },
    { role: "player4", defaultName: "Jogador 4" },
  ];

  function normalizeState(rawState) {
    const state = rawState || {};
    const game = state.game || {};
    let players = Array.isArray(state.players) ? state.players : null;

    if (!players) {
      const legacyByRole = {
        host: state.host || null,
        guest: state.guest || null,
      };

      players = DEFAULT_PLAYER_SLOTS.map((slotDef) => {
        const legacy = legacyByRole[slotDef.role];
        return {
          role: slotDef.role,
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

    dom.connectionStatus.textContent = "Conectando...";

    socket.on("session:assigned", (payload) => {
      gameState.myRoleValue = payload.role;
      const roleLabel = payload.role === "host" ? "Host" : "Convidado";
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
    });

    socket.on("state:update", (state) => {
      const normalizedState = normalizeState(state);
      const nextRoleHasCardMap = {};
      (normalizedState.players || []).forEach((player) => {
        nextRoleHasCardMap[player.role] = Boolean(player.hasCard);
      });
      const previousRoleHasCardMap = gameState.roleHasCardMap || {};

      (normalizedState.players || []).forEach((player) => {
        const hadCard = Boolean(previousRoleHasCardMap[player.role]);
        const hasCardNow = Boolean(player.hasCard);
        if (!hadCard && hasCardNow) {
          window.dispatchEvent(new CustomEvent("entrelinhas:card-drawn", {
            detail: {
              role: player.role,
            },
          }));
        }
      });

      gameState.roleHasCardMap = nextRoleHasCardMap;
      gameState.lastPublicState = normalizedState;
      gameState.lastGameState = normalizedState.game || null;
      const disconnectedPlayer = (normalizedState.players || []).find((player) => player.occupied && !player.online) || null;
      render.renderPlayers(dom, normalizedState);
      render.renderGameStatus(dom, normalizedState.game, {
        disconnectedRole: disconnectedPlayer ? disconnectedPlayer.role : null,
        disconnectedName: disconnectedPlayer ? disconnectedPlayer.name : null,
        myRole: gameState.myRoleValue,
      });
      render.renderActionButtons(dom, normalizedState, gameState);
      render.renderBoard(dom, gameState, normalizedState.game);
      render.renderDeck(dom, gameState, normalizedState.game, normalizedState);
      render.renderRoomStatus(dom, normalizedState);
    });

    socket.on("session:full", () => {
      dom.fullWarning.classList.remove("hidden");
      dom.myRole.textContent = "Sem vaga";
      dom.roomStatus.textContent = "Sala cheia";
      dom.roomStatus.style.color = "red";
      dom.startGameBtn.disabled = true;
      dom.endGameBtn.disabled = true;
    });

    socket.on("connect_error", () => {
      dom.connectionStatus.textContent = "Falha de conexao";
      dom.connectionStatus.style.color = "red";
    });

    socket.on("disconnect", () => {
      dom.connectionStatus.textContent = "Desconectado - tentando reconectar";
      dom.connectionStatus.style.color = "orange";
    });

    socket.io.on("reconnect_attempt", () => {
      dom.connectionStatus.textContent = "Reconectando...";
      dom.connectionStatus.style.color = "orange";
    });

    socket.io.on("reconnect", () => {
      dom.connectionStatus.textContent = "Reconectado";
      dom.connectionStatus.style.color = "green";
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
      const role = payload && typeof payload.role === "string" ? payload.role : null;
      if (!role) {
        return;
      }

      window.dispatchEvent(new CustomEvent("entrelinhas:card-drawn", {
        detail: {
          role,
        },
      }));
    });

  }

  global.EntreLinhasSocket = {
    createSocket,
    bindSocketEvents,
  };
})(window);
