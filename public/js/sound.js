(function initSoundModule(global) {
  const config = global.EntreLinhasConfig || {};
  const uiConfig = config.ui || {};
  const SOUND_ENABLED = uiConfig.enableSound !== false;
  const SOUND_VOLUME = Math.max(0, Math.min(1, Number(uiConfig.soundVolume) || 0.18));

  function createSoundSystem() {
    let audioContext = null;

    function getAudioContext() {
      if (!SOUND_ENABLED) {
        return null;
      }

      const AudioContextCtor = global.AudioContext || global.webkitAudioContext;
      if (!AudioContextCtor) {
        return null;
      }

      if (!audioContext) {
        audioContext = new AudioContextCtor();
      }

      return audioContext;
    }

    function unlock() {
      const context = getAudioContext();
      if (!context || context.state !== "suspended") {
        return;
      }

      context.resume().catch(() => {});
    }

    function makeEnvelope(context, destination, gainValue, duration) {
      const gainNode = context.createGain();
      gainNode.connect(destination);
      gainNode.gain.setValueAtTime(0.0001, context.currentTime);
      gainNode.gain.linearRampToValueAtTime(gainValue, context.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      return gainNode;
    }

    function playTone(options) {
      const context = getAudioContext();
      if (!context || context.state === "suspended") {
        return;
      }

      const settings = options || {};
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const filterNode = context.createBiquadFilter();
      const envelope = makeEnvelope(
        context,
        filterNode,
        Math.max(0.0001, (settings.volume || 1) * SOUND_VOLUME),
        settings.duration || 0.18,
      );

      oscillator.type = settings.type || "triangle";
      oscillator.frequency.setValueAtTime(settings.fromFreq || 440, now);
      if (settings.toFreq) {
        oscillator.frequency.exponentialRampToValueAtTime(settings.toFreq, now + (settings.duration || 0.18));
      }

      filterNode.type = settings.filterType || "lowpass";
      filterNode.frequency.setValueAtTime(settings.filterFreq || 2200, now);
      if (settings.filterToFreq) {
        filterNode.frequency.exponentialRampToValueAtTime(settings.filterToFreq, now + (settings.duration || 0.18));
      }

      oscillator.connect(filterNode);
      filterNode.connect(envelope);
      envelope.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + (settings.duration || 0.18));
    }

    function playSequence(sequence) {
      const context = getAudioContext();
      if (!context || context.state === "suspended" || !Array.isArray(sequence)) {
        return;
      }

      let offset = 0;
      sequence.forEach((entry) => {
        global.setTimeout(() => {
          playTone(entry);
        }, offset);
        offset += Math.max(0, entry.delayMs || 0);
      });
    }

    function playDraw() {
      playSequence([
        { fromFreq: 640, toFreq: 520, duration: 0.1, volume: 0.7, delayMs: 0 },
        { fromFreq: 520, toFreq: 430, duration: 0.12, volume: 0.55, delayMs: 55 },
      ]);
    }

    function playBoardLand() {
      playTone({
        fromFreq: 310,
        toFreq: 220,
        duration: 0.12,
        volume: 0.72,
        type: "triangle",
        filterFreq: 1800,
        filterToFreq: 900,
      });
    }

    function playDiscard() {
      playTone({
        fromFreq: 220,
        toFreq: 150,
        duration: 0.16,
        volume: 0.68,
        type: "sawtooth",
        filterFreq: 1200,
        filterToFreq: 500,
      });
    }

    function playGameStart() {
      playSequence([
        { fromFreq: 420, toFreq: 520, duration: 0.14, volume: 0.62, delayMs: 0 },
        { fromFreq: 540, toFreq: 690, duration: 0.18, volume: 0.75, delayMs: 85 },
      ]);
    }

    function playGameEnd() {
      playSequence([
        { fromFreq: 420, toFreq: 320, duration: 0.16, volume: 0.62, delayMs: 0 },
        { fromFreq: 320, toFreq: 240, duration: 0.2, volume: 0.72, delayMs: 95 },
      ]);
    }

    function bindEvents() {
      if (!SOUND_ENABLED) {
        return;
      }

      const unlockOnce = () => {
        unlock();
      };

      global.addEventListener("pointerdown", unlockOnce, { passive: true });
      global.addEventListener("keydown", unlockOnce);

      global.addEventListener("entrelinhas:card-drawn", () => {
        playDraw();
      });

      global.addEventListener("entrelinhas:drag-landed", (event) => {
        const targetType = event && event.detail ? event.detail.targetType : "";
        if (targetType === "discard") {
          playDiscard();
          return;
        }

        if (targetType === "board") {
          playBoardLand();
        }
      });

      global.addEventListener("entrelinhas:phase-changed", (event) => {
        const detail = event && event.detail ? event.detail : {};
        if (detail.to === "in_game") {
          playGameStart();
          return;
        }

        if (detail.to === "ended" || (detail.from === "in_game" && detail.to === "lobby")) {
          playGameEnd();
        }
      });
    }

    return {
      bindEvents,
      unlock,
    };
  }

  global.EntreLinhasSound = {
    createSoundSystem,
  };
})(window);
