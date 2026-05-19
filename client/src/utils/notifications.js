// Better notification sound - multi-note melody
let notificationSoundEnabled = true;

export const setNotificationSoundEnabled = (enabled) => {
  notificationSoundEnabled = enabled;
};

export const isNotificationSoundEnabled = () => notificationSoundEnabled;

export const playNotificationSound = async () => {
  if (!notificationSoundEnabled) return;
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioContext.currentTime;

    // Create a pleasant 3-note chime
    const notes = [
      { freq: 523.25, start: 0, duration: 0.15 },    // C5
      { freq: 659.25, start: 0.1, duration: 0.15 },  // E5
      { freq: 783.99, start: 0.2, duration: 0.25 },  // G5
    ];

    notes.forEach(({ freq, start, duration }) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc.connect(gain);
      gain.connect(audioContext.destination);

      osc.frequency.value = freq;
      osc.type = 'sine';

      gain.gain.setValueAtTime(0.15, now + start);
      gain.gain.exponentialRampToValueAtTime(0.01, now + start + duration);

      osc.start(now + start);
      osc.stop(now + start + duration);
    });
  } catch (err) {
    console.warn('Could not play notification sound:', err);
  }
};

// Alias for incoming calls
export const playNotificationTone = playNotificationSound;
