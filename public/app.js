(function bootstrapApp(global) {
  const dom = global.EntreLinhasDom.getDom();
  const { state, isHost } = global.EntreLinhasState;
  const storage = global.EntreLinhasStorage;
  const render = global.EntreLinhasRender;

  const savedName = storage.loadSavedName();
  if (savedName) {
    dom.nameInput.value = savedName;
  }

  const playerToken = storage.getOrCreateToken();
  const socket = global.EntreLinhasSocket.createSocket(playerToken);

  global.EntreLinhasSocket.bindSocketEvents(socket, {
    dom,
    gameState: state,
    isHost,
    storage,
    render,
  });

  global.EntreLinhasActions.bindUiActions(socket, {
    dom,
    gameState: state,
    storage,
    render,
    isHost,
  });
})(window);
