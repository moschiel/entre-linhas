(function initStateModule(global) {
  const state = {
    myRoleValue: null,
    myPrivateCard: null,
    lastGameState: null,
    lastPublicState: null,
    selectedBoardCoord: null,
    drawFlightInProgress: false,
    drawFlightsByRole: {},
    roleHasCardMap: {},
    isHost() {
      return this.myRoleValue === "host";
    },
  };

  global.EntreLinhasState = {
    state,
  };
})(window);
