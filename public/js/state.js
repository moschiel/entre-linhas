(function initStateModule(global) {
  const state = {
    myRoleValue: null,
    myPrivateCard: null,
    lastGameState: null,
    selectedBoardCoord: null,
    isHost() {
      return this.myRoleValue === "host";
    },
  };

  global.EntreLinhasState = {
    state,
  };
})(window);
