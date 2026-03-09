(function initSocketModule(global) {
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
      gameState.lastGameState = state.game || null;
      const disconnectedRole = state.host && !state.host.online
        ? state.host.role
        : state.guest && !state.guest.online
          ? state.guest.role
          : null;
      dom.hostState.textContent = render.formatSlot(state.host);
      dom.guestState.textContent = render.formatSlot(state.guest);
      render.renderGameStatus(dom, state.game, {
        disconnectedRole,
        myRole: gameState.myRoleValue,
      });
      render.renderActionButtons(dom, state, gameState);
      render.renderBoard(dom, gameState, state.game);
      render.renderDeck(dom, gameState, state.game);
      render.renderRoomStatus(dom, state);
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
      render.renderDeck(dom, gameState, gameState.lastGameState);
      window.dispatchEvent(new CustomEvent("entrelinhas:private-card", {
        detail: {
          card: gameState.myPrivateCard,
        },
      }));
    });
  }

  global.EntreLinhasSocket = {
    createSocket,
    bindSocketEvents,
  };
})(window);
