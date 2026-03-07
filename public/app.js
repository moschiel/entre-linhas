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
const hostState = document.getElementById("hostState");
const guestState = document.getElementById("guestState");
const fullWarning = document.getElementById("fullWarning");
const startGameBtn = document.getElementById("startGameBtn");
const endGameBtn = document.getElementById("endGameBtn");
const actionHint = document.getElementById("actionHint");
const boardSection = document.getElementById("boardSection");
const matrixHeadRow = document.getElementById("matrixHeadRow");
const matrixBody = document.getElementById("matrixBody");

let myRoleValue = null;

const savedName = localStorage.getItem(NAME_KEY);
if (savedName) {
  nameInput.value = savedName;
}

const socket = io({
  auth: {
    playerToken,
  },
});

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
    gameStatus.textContent = "Encerrado";
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

  startGameBtn.disabled = !isHost || !state.game.canStart;
  endGameBtn.disabled = !isHost || !inGame;

  if (!isHost) {
    actionHint.textContent = "Apenas o host pode iniciar/encerrar a partida.";
    return;
  }

  if (!state.game.canStart && !inGame) {
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
  const shouldShow = Boolean(game && game.phase === "in_game" && game.matrix);
  boardSection.classList.toggle("hidden", !shouldShow);

  if (!shouldShow) {
    matrixHeadRow.innerHTML = '<th class="corner-cell">-</th>';
    matrixBody.innerHTML = "";
    return;
  }

  const cols = game.matrix.cols || [];
  const rows = game.matrix.rows || [];

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
        .map((col) => `<td class="coord-cell" data-coord="${row.key}${col.key}">${row.key}${col.key}</td>`)
        .join("");

      return `<tr><th class="row-header"><span class="row-key">${row.key}</span><span class="row-word">${row.word}</span></th>${cells}</tr>`;
    })
    .join("");

  matrixBody.innerHTML = bodyRows;
}

socket.on("state:update", (state) => {
  hostState.textContent = formatSlot(state.host);
  guestState.textContent = formatSlot(state.guest);
  renderGameStatus(state.game);
  renderActionButtons(state);
  renderBoard(state.game);

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
  roomStatus.textContent = "Erro de conexao";
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
