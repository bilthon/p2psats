// chime.ts — plays a brief, soft single-tone chime via the Web Audio API.
// Used as the first-match-per-session alert sound. Pure browser API, no asset.
// added by #15

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC =
      (window as Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  return ctx
}

/**
 * Plays a brief two-note ascending chime (~250ms total).
 *
 * Tone design:
 *  - Oscillator sweeps E5 (660 Hz) → A5 (880 Hz) over 120ms — a rising perfect
 *    fourth, which reads as "notification" without sounding alarming.
 *  - Gain envelope: near-instant attack (10ms) + exponential decay (200ms).
 *    Peak gain of 0.10 keeps volume modest (won't startle a user with headphones).
 *  - Total duration: 250ms (osc stopped at +250ms so the decay tail completes
 *    naturally before silence).
 *
 * Autoplay policy: the AudioContext is lazily created on first call. If the
 * browser has not yet received a user-gesture, ctx.state will be 'suspended'.
 * We call ctx.resume() before scheduling; if it rejects (no prior gesture),
 * we return silently — the chime simply won't play. After any click, the next
 * call will resume successfully.
 */
export async function playChime(): Promise<void> {
  const c = getCtx()
  if (!c) return

  try {
    await c.resume()
  } catch {
    return
  }

  const now = c.currentTime
  const osc = c.createOscillator()
  const gain = c.createGain()

  // Ascending sweep: E5 → A5 (a perfect fourth — pleasing and recognisable)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(660, now)
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.12)

  // Attack + exponential decay envelope
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.10, now + 0.01) // 10ms attack
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22) // 220ms decay

  osc.connect(gain).connect(c.destination)
  osc.start(now)
  osc.stop(now + 0.25) // hard stop after decay tail
}
