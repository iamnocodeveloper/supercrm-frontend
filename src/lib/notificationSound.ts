let audioContext: AudioContext | null = null;
let lastPlayedAt = 0;
let unlockBound = false;

const MUTE_KEY = 'notifications_sound_muted';

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) audioContext = new AudioContextClass();
  return audioContext;
};

export const isNotificationSoundMuted = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
};

export const setNotificationSoundMuted = (muted: boolean) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // ignore
  }
  if (!muted) unlockAudio();
};

/**
 * Los navegadores bloquean el audio hasta que hay una interacción del usuario.
 * Creamos/reanudamos el AudioContext en el primer gesto para que las alertas suenen.
 */
export const unlockAudio = () => {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => undefined);
  }
};

export const initNotificationSoundUnlock = () => {
  if (typeof window === 'undefined' || unlockBound) return;
  unlockBound = true;
  const handler = () => {
    unlockAudio();
  };
  window.addEventListener('pointerdown', handler, { passive: true });
  window.addEventListener('keydown', handler);
  window.addEventListener('touchstart', handler, { passive: true });
};

export const playIncomingMessageSound = () => {
  if (typeof window === 'undefined') return;
  if (isNotificationSoundMuted()) return;

  const now = Date.now();
  if (now - lastPlayedAt < 800) return;
  lastPlayedAt = now;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const emit = () => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = ctx.currentTime;

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, startTime);
      oscillator.frequency.exponentialRampToValueAtTime(660, startTime + 0.14);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.12, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.18);

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.2);
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(emit).catch(() => undefined);
    } else {
      emit();
    }
  } catch {
    // Browsers can block audio before user interaction; ignore safely.
  }
};
