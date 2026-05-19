const STORAGE_KEY = 'nexchat_notification_sound';

export function setNotificationSoundEnabled(enabled) {
  localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
}

export function isNotificationSoundEnabled() {
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === null) return true;
  return v === 'true';
}

export function playNotificationTone() {
  if (!isNotificationSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // ignore if audio blocked
  }
}
