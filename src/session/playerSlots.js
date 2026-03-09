const PLAYER_SLOTS = [
  { role: "host", defaultName: "Host" },
  { role: "guest", defaultName: "Convidado" },
  { role: "player3", defaultName: "Jogador 3" },
  { role: "player4", defaultName: "Jogador 4" },
];

function getAllSlots(sessionState) {
  return PLAYER_SLOTS.map((slot) => sessionState[slot.role]).filter(Boolean);
}

function getAssignedSlots(sessionState) {
  return getAllSlots(sessionState);
}

function getSlotByToken(sessionState, playerToken) {
  return getAllSlots(sessionState).find((slot) => slot.playerToken === playerToken) || null;
}

function assignNewSlot(sessionState, playerToken, socketId) {
  for (let i = 0; i < PLAYER_SLOTS.length; i += 1) {
    const slotDef = PLAYER_SLOTS[i];
    if (sessionState[slotDef.role]) {
      continue;
    }

    sessionState[slotDef.role] = {
      role: slotDef.role,
      playerToken,
      socketId,
      online: true,
      name: slotDef.defaultName,
    };
    return sessionState[slotDef.role];
  }

  return null;
}

function takeOfflineSlot(sessionState, playerToken, socketId) {
  const reusable = getAllSlots(sessionState).find((slot) => !slot.online);
  if (!reusable) {
    return null;
  }

  const slotDef = PLAYER_SLOTS.find((slot) => slot.role === reusable.role);
  reusable.playerToken = playerToken;
  reusable.socketId = socketId;
  reusable.online = true;
  reusable.name = slotDef ? slotDef.defaultName : reusable.name;
  return reusable;
}

module.exports = {
  PLAYER_SLOTS,
  getAllSlots,
  getAssignedSlots,
  getSlotByToken,
  assignNewSlot,
  takeOfflineSlot,
};
