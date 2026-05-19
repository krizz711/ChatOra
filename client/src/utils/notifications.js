let notificationSoundEnabled = true;
let audioContext = null;

export const setNotificationSoundEnabled = (enabled) => {
  notificationSoundEnabled = enabled;
};

export const isNotificationSoundEnabled = () => notificationSoundEnabled;

const getAudioContext = async () => {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioContext) audioContext = new Ctx();
  if (audioContext.state === 'suspended') {
    try {
      await audioContext.resume();
    } catch {
      return null;
    }
  }
  return audioContext;
};

const playTone = (ctx, { freq, start, duration, type = 'sine', volume = 0.12, attack = 0.01 }) => {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now + start);

  gain.gain.setValueAtTime(0.0001, now + start);
  gain.gain.exponentialRampToValueAtTime(volume, now + start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now + start);
  osc.stop(now + start + duration + 0.02);
};

/** Soft message chime — two bright notes */
export const playNotificationSound = async () => {
  if (!notificationSoundEnabled) return;
  try {
    const ctx = await getAudioContext();
    if (!ctx) return;

    playTone(ctx, { freq: 880, start: 0, duration: 0.12, type: 'triangle', volume: 0.1 });
    playTone(ctx, { freq: 1174.66, start: 0.09, duration: 0.18, type: 'sine', volume: 0.14 });
    playTone(ctx, { freq: 1760, start: 0.09, duration: 0.08, type: 'sine', volume: 0.04 });
  } catch (err) {
    console.warn('Could not play notification sound:', err);
  }
};

/** Incoming call ring — alternating tones */
export const playCallRing = async () => {
  if (!notificationSoundEnabled) return;
  try {
    const ctx = await getAudioContext();
    if (!ctx) return;

    const pattern = [
      { freq: 440, start: 0, duration: 0.22 },
      { freq: 554.37, start: 0.24, duration: 0.22 },
      { freq: 440, start: 0.52, duration: 0.22 },
      { freq: 659.25, start: 0.76, duration: 0.28 },
    ];

    pattern.forEach(({ freq, start, duration }) => {
      playTone(ctx, { freq, start, duration, type: 'sine', volume: 0.16, attack: 0.02 });
    });
  } catch (err) {
    console.warn('Could not play call ring:', err);
  }
};

export const playNotificationTone = playCallRing;
