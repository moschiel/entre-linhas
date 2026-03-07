const TOKEN_KEY = "entrelinhas_player_token";
const NAME_KEY = "entrelinhas_player_name";

function createToken() {
  const random = Math.random().toString(36).slice(2);
  return `player_${Date.now()}_${random}`;
}

function getOrCreateToken() {
  let token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    token = createToken();
    localStorage.setItem(TOKEN_KEY, token);
  }

  return token;
}

const playerToken = getOrCreateToken();
const nameInput = document.getElementById("nameInput");
const saveNameBtn = document.getElementById("saveNameBtn");
const myRole = document.getElementById("myRole");
const roomStatus = document.getElementById("roomStatus");
const gameStatus = document.getElementById("gameStatus");
const connectionStatus = document.getElementById("connectionStatus");
const hostState = document.getElementById("hostState");
const guestState = document.getElementById("guestState");
const fullWarning = document.getElementById("fullWarning");
const startGameBtn = document.getElementById("startGameBtn");
const endGameBtn = document.getElementById("endGameBtn");
const actionHint = document.getElementById("actionHint");
const boardSection = document.getElementById("boardSection");
const matrixHeadRow = document.getElementById("matrixHeadRow");
const matrixBody = document.getElementById("matrixBody");
const deckSection = document.getElementById("deckSection");
const drawPileCount = document.getElementById("drawPileCount");
const myCardValue = document.getElementById("myCardValue");
const selectedCoord = document.getElementById("selectedCoord");
const drawCardBtn = document.getElementById("drawCardBtn");
const placeCardBtn = document.getElementById("placeCardBtn");
const discardCardBtn = document.getElementById("discardCardBtn");
const invalidateCardBtn = document.getElementById("invalidateCardBtn");
const drawHint = document.getElementById("drawHint");
const discardSection = document.getElementById("discardSection");
const discardList = document.getElementById("discardList");
const summarySection = document.getElementById("summarySection");
const summaryRating = document.getElementById("summaryRating");
const summaryCorrect = document.getElementById("summaryCorrect");
const summaryDiscarded = document.getElementById("summaryDiscarded");

let myRoleValue = null;
let myPrivateCard = null;
let lastGameState = null;
let selectedBoardCoord = null;

const savedName = localStorage.getItem(NAME_KEY);
if (savedName) {
  nameInput.value = savedName;
}

const socket = io({
  auth: {
    playerToken,
  },
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

connectionStatus.textContent = "Conectando...";

function formatSlot(slot) {
  if (!slot) {
    return "vazio";
  }

  const status = slot.online ? "online" : "offline";
  return `${slot.name} (${status})`;
}

socket.on("session:assigned", (payload) => {
  myRoleValue = payload.role;
  const roleLabel = payload.role === "host" ? "Host" : "Convidado";
  myRole.textContent = roleLabel;

  if (nameInput.value.trim().length === 0) {
    nameInput.value = payload.name;
    localStorage.setItem(NAME_KEY, payload.name);
  }

  const currentName = nameInput.value.trim();
  if (currentName.length > 0) {
    socket.emit("player:setName", currentName);
  }

  connectionStatus.textContent = "Conectado";
});

function renderGameStatus(game) {
  if (!game) {
    gameStatus.textContent = "Lobby";
    return;
  }

  if (game.phase === "in_game") {
    gameStatus.textContent = game.pausedByDisconnect ? "Em jogo (pausado por desconexao)" : "Em jogo";
    return;
  }

  if (game.phase === "ended") {
    gameStatus.textContent = "Encerrado (resultado pronto)";
    return;
  }

  gameStatus.textContent = "Lobby";
}

function renderActionButtons(state) {
  if (!state || !state.game) {
    startGameBtn.disabled = true;
    endGameBtn.disabled = true;
    return;
  }

  const isHost = myRoleValue === "host";
  const inGame = state.game.phase === "in_game";
  const ended = state.game.phase === "ended";

  startGameBtn.disabled = !isHost || !state.game.canStart;
  endGameBtn.disabled = !isHost || (!inGame && !ended);

  if (!isHost) {
    actionHint.textContent = "Apenas o host pode iniciar/encerrar a partida.";
    return;
  }

  if (!state.game.canStart && !inGame) {
    if (ended) {
      actionHint.textContent = "Partida finalizada. Use Encerrar jogo para voltar ao lobby.";
      return;
    }

    actionHint.textContent = "Para iniciar, host e convidado precisam estar online.";
    return;
  }

  if (inGame) {
    actionHint.textContent = "Partida em andamento. Use Encerrar jogo para voltar ao lobby.";
    return;
  }

  actionHint.textContent = "Pronto para iniciar quando os 2 estiverem online.";
}

function renderBoard(game) {
  const shouldShow = Boolean(game && (game.phase === "in_game" || game.phase === "ended") && game.matrix);
  boardSection.classList.toggle("hidden", !shouldShow);

  if (!shouldShow) {
    matrixHeadRow.innerHTML = '<th class="corner-cell">-</th>';
    matrixBody.innerHTML = "";
    selectedBoardCoord = null;
    selectedCoord.textContent = "nenhuma";
    return;
  }

  const cols = game.matrix.cols || [];
  const rows = game.matrix.rows || [];
  const placements = {};

  (game.boardPlacements || []).forEach((placement) => {
    placements[placement.coord] = placement;
  });

  if (selectedBoardCoord && !placements[selectedBoardCoord]) {
    selectedBoardCoord = null;
  }

  selectedCoord.textContent = selectedBoardCoord || "nenhuma";

  const headCells = ['<th class="corner-cell">-</th>'];
  cols.forEach((col) => {
    headCells.push(
      `<th><div class="col-key">${col.key}</div><div class="col-word">${col.word}</div></th>`,
    );
  });
  matrixHeadRow.innerHTML = headCells.join("");

  const bodyRows = rows
    .map((row) => {
      const cells = cols
        .map((col) => {
          const coord = `${row.key}${col.key}`;
          const placed = placements[coord];

          if (!placed) {
            return `<td class="coord-cell" data-coord="${coord}">${coord}</td>`;
          }

          const selectedClass = selectedBoardCoord === coord ? " selected" : "";
          return `<td class="coord-cell filled${selectedClass}" data-coord="${coord}"><div>${coord}</div><div class="coord-mini">${placed.placedByName}</div></td>`;
        })
        .join("");

      return `<tr><th class="row-header"><span class="row-key">${row.key}</span><span class="row-word">${row.word}</span></th>${cells}</tr>`;
    })
    .join("");

  matrixBody.innerHTML = bodyRows;

  matrixBody.querySelectorAll(".coord-cell.filled").forEach((cell) => {
    cell.addEventListener("click", () => {
      selectedBoardCoord = cell.dataset.coord || null;
      selectedCoord.textContent = selectedBoardCoord || "nenhuma";
      renderBoard(game);
      renderDeck(lastGameState);
    });
  });
}

function renderDeck(game) {
  const inGame = Boolean(game && game.phase === "in_game");
  const ended = Boolean(game && game.phase === "ended");
  const hasActiveRound = inGame || ended;

  deckSection.classList.toggle("hidden", !inGame);

  if (!hasActiveRound) {
    drawPileCount.textContent = "0";
    myCardValue.textContent = "nenhuma";
    drawCardBtn.disabled = true;
    placeCardBtn.disabled = true;
    discardCardBtn.disabled = true;
    invalidateCardBtn.disabled = true;
    drawHint.textContent = "Saque manual: nao existe ordem de turno.";
    discardSection.classList.add("hidden");
    discardList.innerHTML = "";
    summarySection.classList.add("hidden");
    summaryRating.textContent = "-";
    summaryCorrect.textContent = "0";
    summaryDiscarded.textContent = "0";
    return;
  }

  drawPileCount.textContent = String(game.drawPileCount || 0);
  myCardValue.textContent = myPrivateCard ? myPrivateCard.coord : "nenhuma";

  const hasCard = Boolean(myPrivateCard);
  const canDraw = (game.drawPileCount || 0) > 0 && !hasCard;
  const isHost = myRoleValue === "host";
  invalidateCardBtn.classList.toggle("hidden", !isHost);
  drawCardBtn.disabled = !canDraw;
  placeCardBtn.disabled = !hasCard;
  discardCardBtn.disabled = !hasCard;
  invalidateCardBtn.disabled = !selectedBoardCoord;

  const discardedCount = game.discardPileCount || 0;
  const isEnded = ended;
  discardSection.classList.remove("hidden");
  if (!isEnded && discardedCount === 0) {
    discardList.innerHTML = "<li>Nenhuma carta descartada ainda.</li>";
  } else if (!isEnded) {
    discardList.innerHTML = `<li>${discardedCount} carta(s) no descarte. Coordenadas ocultas ate o fim da partida.</li>`;
  } else {
    const finalDiscardPile = (game.finalSummary && game.finalSummary.discardPile) || [];
    if (finalDiscardPile.length === 0) {
      discardList.innerHTML = "<li>Nenhuma carta descartada nesta partida.</li>";
    } else {
      discardList.innerHTML = finalDiscardPile
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
    summarySection.classList.remove("hidden");
    summaryRating.textContent = game.finalSummary.rating;
    summaryCorrect.textContent = String(game.finalSummary.correctCount);
    summaryDiscarded.textContent = String(game.finalSummary.discardedCount);
  } else {
    summarySection.classList.add("hidden");
    summaryRating.textContent = "-";
    summaryCorrect.textContent = "0";
    summaryDiscarded.textContent = "0";
  }

  if (hasCard) {
    drawHint.textContent = "Voce ja tem uma carta. Se quiser, use Colocar no tabuleiro.";
    return;
  }

  if ((game.drawPileCount || 0) === 0) {
    drawHint.textContent = "A pilha acabou.";
    return;
  }

  drawHint.textContent = "Saque quando quiser. Os dois jogadores podem sacar em paralelo.";
}

socket.on("state:update", (state) => {
  lastGameState = state.game || null;
  hostState.textContent = formatSlot(state.host);
  guestState.textContent = formatSlot(state.guest);
  renderGameStatus(state.game);
  renderActionButtons(state);
  renderBoard(state.game);
  renderDeck(state.game);

  if (state.connectedCount === state.capacity) {
    roomStatus.textContent = "Sala completa";
  } else {
    roomStatus.textContent = `Aguardando jogador (${state.connectedCount}/${state.capacity})`;
  }
});

socket.on("session:full", () => {
  fullWarning.classList.remove("hidden");
  myRole.textContent = "Sem vaga";
  roomStatus.textContent = "Sala cheia";
  startGameBtn.disabled = true;
  endGameBtn.disabled = true;
});

socket.on("connect_error", () => {
  connectionStatus.textContent = "Falha de conexao";
});

socket.on("disconnect", () => {
  connectionStatus.textContent = "Desconectado - tentando reconectar";
});

socket.io.on("reconnect_attempt", () => {
  connectionStatus.textContent = "Reconectando...";
});

socket.io.on("reconnect", () => {
  connectionStatus.textContent = "Reconectado";
});

socket.on("state:private", (state) => {
  myPrivateCard = state ? state.myCard : null;
  renderDeck(lastGameState);
});

saveNameBtn.addEventListener("click", () => {
  const name = nameInput.value.trim();
  if (!name) {
    return;
  }

  localStorage.setItem(NAME_KEY, name);
  socket.emit("player:setName", name);
});

startGameBtn.addEventListener("click", () => {
  socket.emit("game:start");
});

endGameBtn.addEventListener("click", () => {
  socket.emit("game:end");
});

drawCardBtn.addEventListener("click", () => {
  socket.emit("card:draw");
});

placeCardBtn.addEventListener("click", () => {
  socket.emit("card:place");
});

discardCardBtn.addEventListener("click", () => {
  socket.emit("card:discard");
});

invalidateCardBtn.addEventListener("click", () => {
  if (!selectedBoardCoord) {
    return;
  }

  socket.emit("card:invalidate", selectedBoardCoord);
  selectedBoardCoord = null;
  selectedCoord.textContent = "nenhuma";
});
