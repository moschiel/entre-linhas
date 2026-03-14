(function initRenderModule(global) {
  const PLAYER_SEAT_ORDER = [1, 2, 3, 4];
  const config = global.EntreLinhasConfig || {};
  const uiConfig = config.ui || {};
  const BOARD_WORD_SHRINK_THRESHOLD = Number(uiConfig.boardWordShrinkThreshold) || 7;

  function getWordSizeClass(word) {
    return typeof word === "string" && word.length > BOARD_WORD_SHRINK_THRESHOLD ? " tight" : "";
  }

  function getPlayerStatusElements(dom) {
    return {
      1: dom.playerStateHost,
      2: dom.playerStateGuest,
      3: dom.playerStatePlayer3,
      4: dom.playerStatePlayer4,
    };
  }

  function getCardLabelElements(dom) {
    return {
      1: dom.currentCardLabelHost,
      2: dom.currentCardLabelGuest,
      3: dom.currentCardLabelPlayer3,
      4: dom.currentCardLabelPlayer4,
    };
  }

  function getCardVisualElements(dom) {
    return {
      1: dom.currentCardHostVisual,
      2: dom.currentCardGuestVisual,
      3: dom.currentCardPlayer3Visual,
      4: dom.currentCardPlayer4Visual,
    };
  }

  function formatSlot(slot) {
    if (!slot) {
      return "vazio";
    }

    const status = slot.online ? "online" : "offline";
    return `${slot.name} (${status})`;
  }

  function getCardPanelElements(dom) {
    return {
      1: dom.currentCardPanelHost,
      2: dom.currentCardPanelGuest,
      3: dom.currentCardPanelPlayer3,
      4: dom.currentCardPanelPlayer4,
    };
  }

  function getEditNameButtonElements(dom) {
    return {
      1: dom.editNameBtnHost,
      2: dom.editNameBtnGuest,
      3: dom.editNameBtnPlayer3,
      4: dom.editNameBtnPlayer4,
    };
  }

  function setVisibility(element, visible) {
    element.classList.toggle("hidden", !visible);
  }

  function syncSideSectionHeights(dom) {
    const boardVisible = dom.boardSection && !dom.boardSection.classList.contains("hidden");
    if (!boardVisible) {
      dom.tableLeftPlayersSection.style.height = "";
      dom.tableRightPlayersSection.style.height = "";
      return;
    }

    const boardHeight = dom.boardSection.offsetHeight;
    if (!boardHeight) {
      return;
    }

    const syncedHeight = `${boardHeight}px`;
    dom.tableLeftPlayersSection.style.height = syncedHeight;
    dom.tableRightPlayersSection.style.height = syncedHeight;
  }

  function renderDeckPileVisual(container, pileCount) {
    container.innerHTML = "";
    container.classList.toggle("empty", pileCount === 0);

    for (let i = pileCount - 1; i >= 0; i -= 1) {
      const card = document.createElement("div");
      card.className = "deck-pile-card";
      card.style.top = `${i}px`;
      card.style.left = `${i}px`;
      card.style.zIndex = String(pileCount - i);
      card.textContent = "";
      container.appendChild(card);
    }
  }

  function renderGameStatus(dom, game, statusContext) {
    if (!game) {
      dom.gameStatus.textContent = "Lobby";
      return;
    }

    if (game.phase === "in_game") {
      const disconnectedSeat = statusContext && statusContext.disconnectedSeat;
      const disconnectedName = statusContext && statusContext.disconnectedName;
      const mySeat = statusContext && statusContext.mySeat;

      if (game.pausedByDisconnect && disconnectedSeat && mySeat && disconnectedSeat === mySeat) {
        dom.gameStatus.textContent = "Em jogo: aguardando reconexao";
      } else if (game.pausedByDisconnect && disconnectedName) {
        dom.gameStatus.textContent = `Em jogo: aguardando ${disconnectedName} se reconectar`;
      } else if (game.pausedByDisconnect && disconnectedSeat) {
        dom.gameStatus.textContent = "Em jogo: aguardando jogador se reconectar";
      } else {
        dom.gameStatus.textContent = game.pausedByDisconnect ? "Em jogo (pausado por desconexao)" : "Em jogo";
      }
      dom.gameStatus.style.color = game.pausedByDisconnect ? "red" : "green";
      return;
    }

    if (game.phase === "ended") {
      dom.gameStatus.textContent = "Encerrado (resultado pronto)";
      dom.gameStatus.style.color = "gray";
      return;
    }

    dom.gameStatus.textContent = "Lobby";
  }

  function renderActionButtons(dom, state, gameState) {
    dom.startGameSection.classList.toggle("hidden", !gameState.isHost());
    const isLobby = !state || !state.game || state.game.phase === "lobby";
    dom.statusSection.classList.toggle("hidden", !isLobby);
    dom.nameSection.classList.toggle("hidden", !isLobby);
    if (isLobby) {
      dom.editNameModal.classList.add("hidden");
    }

    if (!state || !state.game) {
      dom.startGameBtn.classList.remove("hidden");
      dom.endGameBtn.classList.add("hidden");
      dom.startGameBtn.disabled = true;
      dom.endGameBtn.disabled = true;
      return;
    }

    const inGame = state.game.phase === "in_game";
    const ended = state.game.phase === "ended";
    const hasStarted = inGame || ended;

    dom.startGameBtn.classList.toggle("hidden", hasStarted);
    dom.endGameBtn.classList.toggle("hidden", !hasStarted);

    dom.startGameBtn.disabled = !gameState.isHost() || !state.game.canStart;
    dom.endGameBtn.disabled = !gameState.isHost() || (!inGame && !ended);

    if (!gameState.isHost()) {
      dom.actionHint.textContent = "Apenas o host pode iniciar/encerrar a partida.";
      return;
    }

    if (!state.game.canStart && !inGame) {
      if (ended) {
        dom.actionHint.textContent = "Partida finalizada. Use Encerrar jogo para voltar ao lobby.";
        return;
      }

      dom.actionHint.textContent = "Para iniciar, os jogadores conectados precisam estar online.";
      return;
    }

    if (inGame) {
      dom.actionHint.textContent = "Partida em andamento. Use Encerrar jogo para voltar ao lobby.";
      return;
    }

    dom.actionHint.textContent = "Pronto para iniciar quando houver pelo menos 2 jogadores online.";
  }

  function renderBoard(dom, gameState, game) {
    const shouldShow = Boolean(game && (game.phase === "in_game" || game.phase === "ended") && game.matrix);
    dom.boardSection.classList.toggle("hidden", !shouldShow);

    if (!shouldShow) {
      dom.matrixHeadRow.innerHTML = '<th class="corner-cell">-</th>';
      dom.matrixBody.innerHTML = "";
      syncSideSectionHeights(dom);
      return;
    }

    const cols = game.matrix.cols || [];
    const rows = game.matrix.rows || [];
    const placements = {};

    (game.boardPlacements || []).forEach((placement) => {
      placements[placement.coord] = placement;
    });

    const headCells = ['<th class="corner-cell">-</th>'];
    cols.forEach((col) => {
      const wordSizeClass = getWordSizeClass(col.word);
      headCells.push(
        `<th><div class="col-key">${col.key}</div><div class="col-word${wordSizeClass}">${col.word}</div></th>`,
      );
    });
    dom.matrixHeadRow.innerHTML = headCells.join("");

    const bodyRows = rows
      .map((row) => {
        const rowWordSizeClass = getWordSizeClass(row.word);
        const cells = cols
          .map((col) => {
            const coord = `${row.key}${col.key}`;
            const placed = placements[coord];
            const hoverClass = gameState.hoveredBoardCoord === coord ? " drop-hover" : "";
            const isMovingSource = gameState.dragState.active
              && gameState.dragState.sourceType === "board"
              && gameState.dragState.sourceCoord === coord;

            if (!placed || isMovingSource) {
              return `<td class="coord-cell${hoverClass}" data-coord="${coord}"><div class="coord-slot-label">${coord}</div></td>`;
            }

            const movableClass = game.phase === "in_game" ? " movable" : "";
            return `<td class="coord-cell filled${hoverClass}" data-coord="${coord}">
              <div class="board-card board-card-faceup${movableClass}" data-card-coord="${placed.cardCoord || placed.coord}">
                <div class="board-card-coord">${placed.cardCoord || placed.coord}</div>
              </div>
              ${uiConfig.showPlacedCardOwner ? `<div class="coord-mini">${placed.placedByName}</div>` : ""}
            </td>`;
          })
          .join("");

        return `<tr><th class="row-header"><span class="row-key">${row.key}</span><span class="row-word${rowWordSizeClass}">${row.word}</span></th>${cells}</tr>`;
      })
      .join("");

    dom.matrixBody.innerHTML = bodyRows;
    syncSideSectionHeights(dom);
  }

  function renderDeck(dom, gameState, game, fullState) {
    const inGame = Boolean(game && game.phase === "in_game");
    const ended = Boolean(game && game.phase === "ended");
    const hasActiveRound = inGame || ended;
    const players = fullState && Array.isArray(fullState.players) ? fullState.players : [];
    const playerBySeat = {};
    players.forEach((player) => {
      playerBySeat[player.seat] = player;
    });
    const cardVisuals = getCardVisualElements(dom);
    const cardPanels = getCardPanelElements(dom);
    const cardLabels = getCardLabelElements(dom);
    const editNameButtons = getEditNameButtonElements(dom);

    dom.tableLeftPlayersSection.classList.toggle("hidden", !hasActiveRound);
    dom.tableRightPlayersSection.classList.toggle("hidden", !hasActiveRound);

    if (!hasActiveRound) {
      gameState.drawFlightsBySeat = {};
      dom.deckPileCountLabel.textContent = "0";
      PLAYER_SEAT_ORDER.forEach((seat) => {
        const visual = cardVisuals[seat];
        const panel = cardPanels[seat];
        const editButton = editNameButtons[seat];
        if (!visual) {
          return;
        }
        visual.textContent = "--";
        visual.classList.remove("filled", "facedown");
        if (panel) {
          panel.classList.add("hidden");
        }
        if (editButton) {
          editButton.classList.add("hidden");
        }
      });
      renderDeckPileVisual(dom.deckPileVisual, 0);
      renderDeckPileVisual(dom.discardPileVisual, 0);
      setVisibility(dom.discardHistoryBtn, false);
      setVisibility(dom.discardHistoryModal, false);
      dom.discardList.innerHTML = "";
      dom.discardHistoryHint.textContent = "Detalhes das cartas descartadas ficam ocultos durante a partida.";
      dom.summarySection.classList.add("hidden");
      dom.summaryRating.textContent = "-";
      dom.summaryCorrect.textContent = "0";
      dom.summaryDiscarded.textContent = "0";
      syncSideSectionHeights(dom);
      return;
    }

    dom.deckPileCountLabel.textContent = String(game.drawPileCount || 0);
    const hasPrivateCard = Boolean(gameState.myPrivateCard);
    const hasCard = hasPrivateCard && !gameState.drawFlightInProgress;
    const myCardVisible = hasCard && !gameState.dragState.active && !gameState.placingCardInProgress;
    const pileCount = Number(game.drawPileCount || 0);
    const discardedCount = Number(game.discardPileCount || 0);
    renderDeckPileVisual(dom.deckPileVisual, pileCount);
    renderDeckPileVisual(dom.discardPileVisual, discardedCount);
    dom.discardPileVisual.classList.toggle("drag-hover", Boolean(gameState.dragState.hoverDiscard));
    const isHost = gameState.isHost();
    setVisibility(dom.discardHistoryBtn, isHost);
    if (!isHost) {
      setVisibility(dom.discardHistoryModal, false);
    }

    PLAYER_SEAT_ORDER.forEach((seat) => {
      const visual = cardVisuals[seat];
      const panel = cardPanels[seat];
      const label = cardLabels[seat];
      const editButton = editNameButtons[seat];
      if (!visual || !label) {
        return;
      }

      const player = playerBySeat[seat];
      const isOccupied = Boolean(player && player.occupied);
      if (panel) {
        panel.classList.toggle("hidden", !isOccupied);
      }
      if (player && player.occupied) {
        label.textContent = player.online ? player.name : `${player.name} (offline)`;
        label.classList.toggle("player-offline", !player.online);
      } else {
        label.textContent = player ? player.defaultName : `Jogador ${seat}`;
        label.classList.remove("player-offline");
      }

      const isMe = seat === gameState.mySeatValue;
      if (editButton) {
        editButton.classList.toggle("hidden", !isMe);
      }
      const roleHasCard = Boolean(player && player.hasCard);
      const shouldShowMyCard = isMe && myCardVisible;
      const roleFlightInProgress = Boolean(gameState.drawFlightsBySeat && gameState.drawFlightsBySeat[seat]);
      visual.classList.remove("facedown");

      if (roleFlightInProgress) {
        visual.textContent = "--";
        visual.classList.remove("filled");
      } else if (shouldShowMyCard) {
        visual.textContent = gameState.myPrivateCard.coord;
        visual.classList.add("filled");
      } else if (isMe) {
        visual.textContent = "--";
        visual.classList.remove("filled");
      } else if (roleHasCard) {
        visual.textContent = "";
        visual.classList.add("filled", "facedown");
      } else {
        visual.textContent = "--";
        visual.classList.remove("filled");
      }
    });

    const canDraw = pileCount > 0 && !hasCard && !gameState.dragState.active && !gameState.placingCardInProgress;
    dom.deckPileVisual.classList.toggle("can-draw", canDraw);

    const discardedCountForList = game.discardPileCount || 0;
    const isEnded = ended;
    const discardActivity = game.discardActivity || [];
    if (!isEnded && discardedCountForList === 0) {
      dom.discardList.innerHTML = "<li>Nenhuma carta descartada ainda.</li>";
      dom.discardHistoryHint.textContent = "Detalhes das cartas descartadas ficam ocultos durante a partida.";
    } else if (!isEnded) {
      dom.discardHistoryHint.textContent = "Durante a partida, o historico mostra apenas quem descartou.";
      dom.discardList.innerHTML = discardActivity
        .map((entry) => `<li>${entry.text}</li>`)
        .join("");
    } else {
      dom.discardHistoryHint.textContent = "Partida encerrada. Valores das cartas descartadas revelados.";
      const finalDiscardPile = (game.finalSummary && game.finalSummary.discardPile) || [];
      if (finalDiscardPile.length === 0) {
        dom.discardList.innerHTML = "<li>Nenhuma carta descartada nesta partida.</li>";
      } else {
        dom.discardList.innerHTML = finalDiscardPile
          .map((item) => {
            if (item.source === "board") {
              return `<li>${item.coord}: invalidada por ${item.discardedByName} (antes no tabuleiro de ${item.originallyPlacedByName}).</li>`;
            }

            return `<li>${item.coord}: descartada por ${item.discardedByName}.</li>`;
          })
          .join("");
      }
    }

    if (isEnded && game.finalSummary) {
      dom.summarySection.classList.remove("hidden");
      dom.summaryRating.textContent = game.finalSummary.rating;
      dom.summaryCorrect.textContent = String(game.finalSummary.correctCount);
      dom.summaryDiscarded.textContent = String(game.finalSummary.discardedCount);
    } else {
      dom.summarySection.classList.add("hidden");
      dom.summaryRating.textContent = "-";
      dom.summaryCorrect.textContent = "0";
      dom.summaryDiscarded.textContent = "0";
    }

    syncSideSectionHeights(dom);
  }

  function renderRoomStatus(dom, state) {
    const connectedCount = Number.isFinite(state.connectedCount) ? state.connectedCount : 0;
    const capacity = Number.isFinite(state.capacity) ? state.capacity : 4;
    const canStart = Boolean(state.game && state.game.canStart);
    const inLobby = Boolean(state.game && state.game.phase === "lobby");

    if (canStart && inLobby) {
      dom.roomStatus.textContent = "Aguardando Host iniciar o Jogo";
      dom.roomStatus.style.color = "orange";
      return;
    }

    if (capacity > 0 && connectedCount >= capacity) {
      dom.roomStatus.textContent = "Sala completa";
      dom.roomStatus.style.color = "green";
      return;
    }

    dom.roomStatus.textContent = `Aguardando jogadores (${connectedCount}/${capacity})`;
    dom.roomStatus.style.color = "orange";
  }

  function renderRoomIssueModal(dom, state, gameState) {
    const game = state && state.game ? state.game : null;
    const inActiveRound = Boolean(game && (game.phase === "in_game" || game.phase === "ended"));
    if (!inActiveRound) {
      dom.roomIssueModal.classList.add("hidden");
      return;
    }

    if (gameState.connectionState !== "connected") {
      dom.roomIssueTitle.textContent = "Conexao interrompida";
      dom.roomIssueMessage.textContent = "Voce perdeu a conexao com a sala. A partida fica bloqueada ate reconectar.";
      dom.roomIssueModal.classList.remove("hidden");
      return;
    }

    if (game.phase === "in_game" && game.pausedByDisconnect) {
      const statusContext = gameState.statusContext || {};
      const disconnectedName = statusContext.disconnectedName;
      const disconnectedSeat = statusContext.disconnectedSeat;
      if (disconnectedSeat && statusContext.mySeat && disconnectedSeat === statusContext.mySeat) {
        dom.roomIssueTitle.textContent = "Reconexao pendente";
        dom.roomIssueMessage.textContent = "Sua conexao com a partida foi interrompida. Aguarde reconectar para continuar.";
      } else if (disconnectedName) {
        dom.roomIssueTitle.textContent = "Partida pausada";
        dom.roomIssueMessage.textContent = `${disconnectedName} ficou offline. Aguarde a reconexao para continuar a partida.`;
      } else {
        dom.roomIssueTitle.textContent = "Partida pausada";
        dom.roomIssueMessage.textContent = "Um jogador ficou offline. Aguarde a reconexao para continuar a partida.";
      }
      dom.roomIssueModal.classList.remove("hidden");
      return;
    }

    dom.roomIssueModal.classList.add("hidden");
  }

  function renderPlayers(dom, state) {
    const gamePhase = state && state.game ? state.game.phase : "lobby";
    dom.playersSection.classList.toggle("hidden", gamePhase !== "lobby");

    const players = state && Array.isArray(state.players) ? state.players : [];
    const playerBySeat = {};
    players.forEach((player) => {
      playerBySeat[player.seat] = player;
    });

    const statusElements = getPlayerStatusElements(dom);
    PLAYER_SEAT_ORDER.forEach((seat) => {
      const target = statusElements[seat];
      if (!target) {
        return;
      }

      const player = playerBySeat[seat];
      if (!player || !player.occupied) {
        target.textContent = "vazio";
        return;
      }

      target.textContent = formatSlot(player);
    });
  }

  global.EntreLinhasRender = {
    formatSlot,
    renderGameStatus,
    renderActionButtons,
    renderBoard,
    renderDeck,
    renderPlayers,
    renderRoomIssueModal,
    renderRoomStatus,
  };
})(window);
