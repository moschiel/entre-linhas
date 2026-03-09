(function initRenderModule(global) {
  function formatSlot(slot) {
    if (!slot) {
      return "vazio";
    }

    const status = slot.online ? "online" : "offline";
    return `${slot.name} (${status})`;
  }

  function syncElementVisibility(element, visible) {
    if (visible) {
      element.classList.remove("hidden");
    } else {
      element.classList.add("hidden");
    }
    element.disabled = !visible;
  }

  function renderGameStatus(dom, game, statusContext) {
    if (!game) {
      dom.gameStatus.textContent = "Lobby";
      return;
    }

    if (game.phase === "in_game") {
      const disconnectedRole = statusContext && statusContext.disconnectedRole;
      const myRole = statusContext && statusContext.myRole;

      if (game.pausedByDisconnect && disconnectedRole && myRole && disconnectedRole === myRole) {
        dom.gameStatus.textContent = "Em jogo: aguardando reconexao";
      } else if (game.pausedByDisconnect && disconnectedRole) {
        dom.gameStatus.textContent = "Em jogo: aguardando o outro jogador se reconectar";
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

      dom.actionHint.textContent = "Para iniciar, host e convidado precisam estar online.";
      return;
    }

    if (inGame) {
      dom.actionHint.textContent = "Partida em andamento. Use Encerrar jogo para voltar ao lobby.";
      return;
    }

    dom.actionHint.textContent = "Pronto para iniciar quando os 2 estiverem online.";
  }

  function renderBoard(dom, gameState, game) {
    const shouldShow = Boolean(game && (game.phase === "in_game" || game.phase === "ended") && game.matrix);
    dom.boardSection.classList.toggle("hidden", !shouldShow);

    if (!shouldShow) {
      dom.matrixHeadRow.innerHTML = '<th class="corner-cell">-</th>';
      dom.matrixBody.innerHTML = "";
      gameState.selectedBoardCoord = null;
      dom.selectedCoord.textContent = "nenhuma";
      return;
    }

    const cols = game.matrix.cols || [];
    const rows = game.matrix.rows || [];
    const placements = {};

    (game.boardPlacements || []).forEach((placement) => {
      placements[placement.coord] = placement;
    });

    if (gameState.selectedBoardCoord && !placements[gameState.selectedBoardCoord]) {
      gameState.selectedBoardCoord = null;
    }

    dom.selectedCoord.textContent = gameState.selectedBoardCoord || "nenhuma";

    const headCells = ['<th class="corner-cell">-</th>'];
    cols.forEach((col) => {
      headCells.push(
        `<th><div class="col-key">${col.key}</div><div class="col-word">${col.word}</div></th>`,
      );
    });
    dom.matrixHeadRow.innerHTML = headCells.join("");

    const bodyRows = rows
      .map((row) => {
        const cells = cols
          .map((col) => {
            const coord = `${row.key}${col.key}`;
            const placed = placements[coord];

            if (!placed) {
              return `<td class="coord-cell" data-coord="${coord}">${coord}</td>`;
            }

            const selectedClass = gameState.selectedBoardCoord === coord ? " selected" : "";
            return `<td class="coord-cell filled${selectedClass}" data-coord="${coord}"><div>${coord}</div><div class="coord-mini">${placed.placedByName}</div></td>`;
          })
          .join("");

        return `<tr><th class="row-header"><span class="row-key">${row.key}</span><span class="row-word">${row.word}</span></th>${cells}</tr>`;
      })
      .join("");

    dom.matrixBody.innerHTML = bodyRows;

    if (gameState.isHost()) {
      dom.matrixBody.querySelectorAll(".coord-cell.filled").forEach((cell) => {
        cell.addEventListener("click", () => {
          if (cell.dataset.coord === gameState.selectedBoardCoord) {
            gameState.selectedBoardCoord = null;
          } else {
            gameState.selectedBoardCoord = cell.dataset.coord || null;
          }

          dom.selectedCoord.textContent = gameState.selectedBoardCoord || "nenhuma";
          renderBoard(dom, gameState, game);
          renderDeck(dom, gameState, gameState.lastGameState);
        });
      });
    }
  }

  function renderDeck(dom, gameState, game) {
    const inGame = Boolean(game && game.phase === "in_game");
    const ended = Boolean(game && game.phase === "ended");
    const hasActiveRound = inGame || ended;

    dom.deckSection.classList.toggle("hidden", !inGame);

    if (!hasActiveRound) {
      dom.drawPileCount.textContent = "0";
      dom.myCardValue.textContent = "nenhuma";
      syncElementVisibility(dom.drawCardBtn, false);
      syncElementVisibility(dom.placeCardBtn, false);
      syncElementVisibility(dom.discardCardBtn, false);
      syncElementVisibility(dom.invalidateCardBtn, false);
      dom.drawHint.textContent = "Saque manual: nao existe ordem de turno.";
      dom.discardSection.classList.add("hidden");
      dom.discardList.innerHTML = "";
      dom.summarySection.classList.add("hidden");
      dom.summaryRating.textContent = "-";
      dom.summaryCorrect.textContent = "0";
      dom.summaryDiscarded.textContent = "0";
      return;
    }

    dom.drawPileCount.textContent = String(game.drawPileCount || 0);
    dom.myCardValue.textContent = gameState.myPrivateCard ? gameState.myPrivateCard.coord : "nenhuma";

    const hasCard = Boolean(gameState.myPrivateCard);
    const canDraw = (game.drawPileCount || 0) > 0 && !hasCard;

    syncElementVisibility(dom.drawCardBtn, canDraw);
    syncElementVisibility(dom.placeCardBtn, hasCard);
    syncElementVisibility(dom.discardCardBtn, hasCard);
    syncElementVisibility(dom.invalidateCardBtn, gameState.isHost() && Boolean(gameState.selectedBoardCoord));

    const discardedCount = game.discardPileCount || 0;
    const isEnded = ended;
    const discardActivity = game.discardActivity || [];
    dom.discardSection.classList.remove("hidden");
    if (!isEnded && discardedCount === 0) {
      dom.discardList.innerHTML = "<li>Nenhuma carta descartada ainda.</li>";
    } else if (!isEnded) {
      dom.discardList.innerHTML = discardActivity
        .map((entry) => `<li>${entry.text}</li>`)
        .join("");
    } else {
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

    if (hasCard) {
      dom.drawHint.textContent = "Voce ja tem uma carta. Se quiser, use Colocar no tabuleiro.";
      return;
    }

    if ((game.drawPileCount || 0) === 0) {
      dom.drawHint.textContent = "A pilha acabou.";
      return;
    }

    dom.drawHint.textContent = "Saque quando quiser. Os dois jogadores podem sacar em paralelo.";
  }

  function renderRoomStatus(dom, state) {
    const connectedCount = state.connectedCount;
    const capacity = state.capacity;
    const canStart = Boolean(state.game && state.game.canStart);
    const inLobby = Boolean(state.game && state.game.phase === "lobby");

    if (connectedCount === capacity && canStart && inLobby) {
      dom.roomStatus.textContent = "Aguardando Host iniciar o Jogo";
      dom.roomStatus.style.color = "orange";
      return;
    }

    if (connectedCount === capacity) {
      dom.roomStatus.textContent = "Sala completa";
      dom.roomStatus.style.color = "green";
      return;
    }

    dom.roomStatus.textContent = `Aguardando jogador (${connectedCount}/${capacity})`;
    dom.roomStatus.style.color = "orange";
  }

  global.EntreLinhasRender = {
    formatSlot,
    renderGameStatus,
    renderActionButtons,
    renderBoard,
    renderDeck,
    renderRoomStatus,
  };
})(window);
