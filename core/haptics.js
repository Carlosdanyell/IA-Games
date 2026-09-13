export function createHaptics(store) {
  let enabled = store.get('vibrate', true);
  const can = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  return {
    get enabled() { return enabled; },
    get supported() { return can; },
    setEnabled(value) { enabled = value; store.set('vibrate', value); },
    buzz(pattern = 8) {
      if (!enabled || !can) return;
      try { navigator.vibrate(pattern); } catch (_) {}
    }
  };
}
