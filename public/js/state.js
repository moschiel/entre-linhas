(function initStateModule(global) {
  const state = {
    myRoleValue: null,
    myPrivateCard: null,
    lastGameState: null,
    lastPublicState: null,
    selectedBoardCoord: null,
    hoveredBoardCoord: null,
    dragState: {
      active: false,
      pointerId: null,
      hoverCoord: null,
    },
    placingCardInProgress: false,
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
