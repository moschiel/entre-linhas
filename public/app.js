(function bootstrapApp(global) {
  const dom = global.EntreLinhasDom.getDom();
  const { state } = global.EntreLinhasState;
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
