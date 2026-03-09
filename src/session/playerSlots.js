function getSlotByToken(sessionState, playerToken) {
  if (sessionState.host && sessionState.host.playerToken === playerToken) {
    return sessionState.host;
  }

  if (sessionState.guest && sessionState.guest.playerToken === playerToken) {
    return sessionState.guest;
  }

  return null;
}

function assignNewSlot(sessionState, playerToken, socketId) {
  if (!sessionState.host) {
    sessionState.host = {
      role: "host",
      playerToken,
      socketId,
      online: true,
      name: "Host",
    };
    return sessionState.host;
  }

  if (!sessionState.guest) {
    sessionState.guest = {
      role: "guest",
      playerToken,
      socketId,
      online: true,
      name: "Convidado",
    };
    return sessionState.guest;
  }

  return null;
}

function takeOfflineSlot(sessionState, playerToken, socketId) {
  const candidates = [sessionState.guest, sessionState.host];
  const reusable = candidates.find((slot) => slot && !slot.online);

  if (!reusable) {
    return null;
  }

  reusable.playerToken = playerToken;
  reusable.socketId = socketId;
  reusable.online = true;
  reusable.name = reusable.role === "host" ? "Host" : "Convidado";
  return reusable;
}

module.exports = {
  getSlotByToken,
  assignNewSlot,
  takeOfflineSlot,
};
