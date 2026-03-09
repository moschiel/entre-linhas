(function initStorageModule(global) {
  const TOKEN_KEY = "entrelinhas_player_token";
  const NAME_KEY = "entrelinhas_player_name";

  function createToken() {
    const random = Math.random().toString(36).slice(2);
    return `player_${Date.now()}_${random}`;
  }

  function getOrCreateToken() {
    let token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      token = createToken();
      localStorage.setItem(TOKEN_KEY, token);
    }

    return token;
  }

  function loadSavedName() {
    return localStorage.getItem(NAME_KEY) || "";
  }

  function saveName(name) {
    localStorage.setItem(NAME_KEY, name);
  }

  global.EntreLinhasStorage = {
    getOrCreateToken,
    loadSavedName,
    saveName,
  };
})(window);
