(function initStateModule(global) {
  const state = {
    mySeatValue: null,
    mySystemRole: null,
    connectionState: "connecting",
    statusContext: null,
    myPrivateCard: null,
    lastGameState: null,
    lastPublicState: null,
    hoveredBoardCoord: null,
    dragState: {
      active: false,
      pointerId: null,
      hoverCoord: null,
      hoverDiscard: false,
      sourceType: null,
      sourceCoord: null,
    },
    placingCardInProgress: false,
    drawFlightInProgress: false,
    drawFlightsBySeat: {},
    seatHasCardMap: {},
    pendingRemovalSeat: null,
    removedFromSession: false,
    removedMessage: "",
    isHost() {
      return this.mySystemRole === "host";
    },
  };

  global.EntreLinhasState = {
    state,
  };
})(window);
