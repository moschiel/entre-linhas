(function initStateModule(global) {
  const state = {
    myRoleValue: null,
    myPrivateCard: null,
    lastGameState: null,
    selectedBoardCoord: null,
  };

  function isHost() {
    return state.myRoleValue === "host";
  }

  global.EntreLinhasState = {
    state,
    isHost,
  };
})(window);
