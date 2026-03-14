(function initConfigModule(global) {
  const config = {
    ui: {
      // Duracao principal da animacao de saque (voo + flip), em milissegundos.
      drawAnimationMs: 2000,
      // Margem de seguranca somada ao timeout final (caso transitionend atrase/falhe).
      drawAnimationBufferMs: 100,
      // Tempo que o ghost permanece sobre a carta final antes de sumir (handoff visual).
      drawAnimationHandoffMs: 120,
      // Exibe o nome do jogador sobre a carta ja colocada no tabuleiro.
      showPlacedCardOwner: false,
    },
  };

  global.EntreLinhasConfig = config;
})(window);
