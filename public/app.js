(function bootstrapApp(global) {
  const config = global.EntreLinhasConfig || {};
  const uiConfig = config.ui || {};
  const dom = global.EntreLinhasDom.getDom();
  const { state } = global.EntreLinhasState;
  const storage = global.EntreLinhasStorage;
  const render = global.EntreLinhasRender;

  if (Number(uiConfig.boardCellSize) > 0) {
    document.documentElement.style.setProperty("--board-cell-size", `${Number(uiConfig.boardCellSize)}px`);
  }

  if (Number(uiConfig.boardWordFontSize) > 0) {
    document.documentElement.style.setProperty("--board-word-font-size", `${Number(uiConfig.boardWordFontSize)}px`);
  }

  if (Number(uiConfig.boardWordFontSizeTight) > 0) {
    document.documentElement.style.setProperty("--board-word-font-size-tight", `${Number(uiConfig.boardWordFontSizeTight)}px`);
  }

  const savedName = storage.loadSavedName();
  if (savedName) {
    dom.nameInput.value = savedName;
  }

  const playerToken = storage.getOrCreateToken();
  const socket = global.EntreLinhasSocket.createSocket(playerToken);

  global.EntreLinhasSocket.bindSocketEvents(socket, {
    dom,
    gameState: state,
    storage,
    render,
  });

  global.EntreLinhasActions.bindUiActions(socket, {
    dom,
    gameState: state,
    storage,
    render,
  });
})(window);
