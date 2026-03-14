(function initRenderModule(global) {
  const PLAYER_ROLE_ORDER = ["host", "guest", "player3", "player4"];
  const config = global.EntreLinhasConfig || {};
  const uiConfig = config.ui || {};
  const BOARD_WORD_SHRINK_THRESHOLD = Number(uiConfig.boardWordShrinkThreshold) || 7;

  function getWordSizeClass(word) {
    return typeof word === "string" && word.length > BOARD_WORD_SHRINK_THRESHOLD ? " tight" : "";
  }

  function getPlayerStatusElements(dom) {
    return {
      host: dom.playerStateHost,
      guest: dom.playerStateGuest,
      player3: dom.playerStatePlayer3,
      player4: dom.playerStatePlayer4,
    };
  }

  function getCardLabelElements(dom) {
    return {
      host: dom.currentCardLabelHost,
      guest: dom.currentCardLabelGuest,
      player3: dom.currentCardLabelPlayer3,
      player4: dom.currentCardLabelPlayer4,
    };
  }

  function getCardVisualElements(dom) {
    return {
      host: dom.currentCardHostVisual,
      guest: dom.currentCardGuestVisual,
      player3: dom.currentCardPlayer3Visual,
      player4: dom.currentCardPlayer4Visual,
    };
  }

  function formatSlot(slot) {
    if (!slot) {
      return "vazio";
    }

    const status = slot.online ? "online" : "offline";
    return `${slot.name} (${status})`;
  }

  function setVisibility(element, visible) {
    element.classList.toggle("hidden", !visible);
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
      const disconnectedRole = statusContext && statusContext.disconnectedRole;
      const disconnectedName = statusContext && statusContext.disconnectedName;
      const myRole = statusContext && statusContext.myRole;

      if (game.pausedByDisconnect && disconnectedRole && myRole && disconnectedRole === myRole) {
        dom.gameStatus.textContent = "Em jogo: aguardando reconexao";
      } else if (game.pausedByDisconnect && disconnectedName) {
        dom.gameStatus.textContent = `Em jogo: aguardando ${disconnectedName} se reconectar`;
      } else if (game.pausedByDisconnect && disconnectedRole) {
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
  }

  function renderDeck(dom, gameState, game, fullState) {
    const inGame = Boolean(game && game.phase === "in_game");
    const ended = Boolean(game && game.phase === "ended");
    const hasActiveRound = inGame || ended;
    const players = fullState && Array.isArray(fullState.players) ? fullState.players : [];
    const playerByRole = {};
    players.forEach((player) => {
      playerByRole[player.role] = player;
    });
    const cardVisuals = getCardVisualElements(dom);
    const cardLabels = getCardLabelElements(dom);

    dom.tableLeftPlayersSection.classList.toggle("hidden", !hasActiveRound);
    dom.tableRightPlayersSection.classList.toggle("hidden", !hasActiveRound);
    dom.tableSideSection.classList.toggle("hidden", !hasActiveRound);

    if (!hasActiveRound) {
      gameState.drawFlightsByRole = {};
      dom.deckPileCountLabel.textContent = "0";
      PLAYER_ROLE_ORDER.forEach((role) => {
        const visual = cardVisuals[role];
        if (!visual) {
          return;
        }
        visual.textContent = "--";
        visual.classList.remove("filled", "facedown");
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

    PLAYER_ROLE_ORDER.forEach((role) => {
      const visual = cardVisuals[role];
      const label = cardLabels[role];
      if (!visual || !label) {
        return;
      }

      const player = playerByRole[role];
      if (player && player.occupied) {
        label.textContent = player.online ? player.name : `${player.name} (offline)`;
        label.classList.toggle("player-offline", !player.online);
      } else {
        label.textContent = player ? player.defaultName : role;
        label.classList.remove("player-offline");
      }

      const isMe = role === gameState.myRoleValue;
      const roleHasCard = Boolean(player && player.hasCard);
      const shouldShowMyCard = isMe && myCardVisible;
      const roleFlightInProgress = Boolean(gameState.drawFlightsByRole && gameState.drawFlightsByRole[role]);
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

  function renderPlayers(dom, state) {
    const gamePhase = state && state.game ? state.game.phase : "lobby";
    dom.playersSection.classList.toggle("hidden", gamePhase !== "lobby");

    const players = state && Array.isArray(state.players) ? state.players : [];
    const playerByRole = {};
    players.forEach((player) => {
      playerByRole[player.role] = player;
    });

    const statusElements = getPlayerStatusElements(dom);
    PLAYER_ROLE_ORDER.forEach((role) => {
      const target = statusElements[role];
      if (!target) {
        return;
      }

      const player = playerByRole[role];
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
    renderRoomStatus,
  };
})(window);
