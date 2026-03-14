const PLAYER_SLOTS = [
  { slotKey: "seat1", seat: 1, systemRole: "host", defaultName: "Host" },
  { slotKey: "seat2", seat: 2, systemRole: "guest", defaultName: "Jogador 2" },
  { slotKey: "seat3", seat: 3, systemRole: "guest", defaultName: "Jogador 3" },
  { slotKey: "seat4", seat: 4, systemRole: "guest", defaultName: "Jogador 4" },
];

function getAllSlots(sessionState) {
  return PLAYER_SLOTS.map((slot) => sessionState[slot.slotKey]).filter(Boolean);
}

function getAssignedSlots(sessionState) {
  return getAllSlots(sessionState);
}

function getSlotBySeat(sessionState, seat) {
  return getAllSlots(sessionState).find((slot) => slot.seat === seat) || null;
}

function getSlotByToken(sessionState, playerToken) {
  return getAllSlots(sessionState).find((slot) => slot.playerToken === playerToken) || null;
}

function isBlockedPlayerToken(sessionState, playerToken) {
  return Boolean(sessionState.blockedPlayerTokens && sessionState.blockedPlayerTokens.has(playerToken));
}

function blockPlayerToken(sessionState, playerToken) {
  if (!playerToken || !sessionState.blockedPlayerTokens) {
    return;
  }

  sessionState.blockedPlayerTokens.add(playerToken);
}

function removeSlot(sessionState, slotKey) {
  if (!slotKey || !sessionState[slotKey]) {
    return null;
  }

  const removedSlot = sessionState[slotKey];
  sessionState[slotKey] = null;
  return removedSlot;
}

function assignNewSlot(sessionState, playerToken, socketId) {
  for (let i = 0; i < PLAYER_SLOTS.length; i += 1) {
    const slotDef = PLAYER_SLOTS[i];
    if (sessionState[slotDef.slotKey]) {
      continue;
    }

    sessionState[slotDef.slotKey] = {
      slotKey: slotDef.slotKey,
      seat: slotDef.seat,
      systemRole: slotDef.systemRole,
      playerToken,
      socketId,
      online: true,
      name: slotDef.defaultName,
    };
    return sessionState[slotDef.slotKey];
  }

  return null;
}

function takeOfflineSlot(sessionState, playerToken, socketId) {
  const reusable = getAllSlots(sessionState).find((slot) => !slot.online);
  if (!reusable) {
    return null;
  }

  const slotDef = PLAYER_SLOTS.find((slot) => slot.slotKey === reusable.slotKey);
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
  getSlotBySeat,
  getSlotByToken,
  isBlockedPlayerToken,
  blockPlayerToken,
  removeSlot,
  assignNewSlot,
  takeOfflineSlot,
};
