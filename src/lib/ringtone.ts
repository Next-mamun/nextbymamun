// Web Audio API Ringtone & Audio Tone Synthesizer

let audioCtx: AudioContext | null = null;
let ringInterval: any = null;
let isRinging = false;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playPhoneRing() {
  if (isRinging) return;
  isRinging = true;

  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([600, 300, 600, 300, 600, 1000]);
    }
  } catch (e) {}

  const triggerChime = () => {
    if (!isRinging) return;
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      // Create pleasant dual-tone melodious phone chime
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(520, now);
      osc1.frequency.exponentialRampToValueAtTime(660, now + 0.3);
      osc2.frequency.setValueAtTime(440, now);
      osc2.frequency.exponentialRampToValueAtTime(580, now + 0.3);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.1);
      gain.gain.setValueAtTime(0.3, now + 1.2);
      gain.gain.linearRampToValueAtTime(0.01, now + 1.6);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.6);
      osc2.stop(now + 1.6);

      try {
        if ('vibrate' in navigator) {
          navigator.vibrate([600, 300, 600, 300]);
        }
      } catch (e) {}
    } catch (e) {
      console.warn("Could not play ringtone:", e);
    }
  };

  triggerChime();
  ringInterval = setInterval(triggerChime, 2500);
}

export function stopPhoneRing() {
  isRinging = false;
  if (ringInterval) {
    clearInterval(ringInterval);
    ringInterval = null;
  }
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }
  } catch (e) {}
}
