(function initConfigModule(global) {
  const config = {
    ui: {
      // Lado do quadrado das cartas e das celulas da matriz.
      boardCellSize: 52,
      // Fonte normal das palavras de linha/coluna do tabuleiro, em px.
      boardWordFontSize: 12,
      // Fonte reduzida para palavras que passam do limite configurado, em px.
      boardWordFontSizeTight: 10,
      // Se a palavra passar deste numero de caracteres, usa a fonte reduzida.
      boardWordShrinkThreshold: 7,
      // Duracao principal da animacao de saque (voo + flip), em milissegundos.
      drawAnimationMs: 2000,
      // Margem de seguranca somada ao timeout final (caso transitionend atrase/falhe).
      drawAnimationBufferMs: 100,
      // Tempo que o ghost permanece sobre a carta final antes de sumir (handoff visual).
      drawAnimationHandoffMs: 120,
      // Escala da carta arrastada no mobile ao "levantar" para fora do dedo.
      mobileDragScale: 1.2,
      // Distancia vertical, em px, entre o dedo e a carta levantada no mobile.
      mobileDragGhostGap: 28,
      // Duracao da vibracao curta ao iniciar o drag no mobile, em ms.
      mobileDragHapticMs: 22,
      // Intervalo minimo entre envios de posicao do drag compartilhado, em ms.
      remoteDragBroadcastMs: 50,
      // Exibe a coordenada no centro das celulas vazias do tabuleiro.
      showEmptyCellCoords: false,
      // Exibe a quantidade de cartas restante ao lado do titulo da pilha.
      showDrawPileCount: false,
      // Exibe o nome do jogador sobre a carta ja colocada no tabuleiro.
      showPlacedCardOwner: false,
    },
  };

  global.EntreLinhasConfig = config;
})(window);
