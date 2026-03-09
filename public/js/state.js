(function initStateModule(global) {
  const state = {
    myRoleValue: null,
    myPrivateCard: null,
    lastGameState: null,
    lastPublicState: null,
    selectedBoardCoord: null,
    drawFlightInProgress: false,
    isHost() {
      return this.myRoleValue === "host";
    },
  };

  global.EntreLinhasState = {
    state,
  };
})(window);
