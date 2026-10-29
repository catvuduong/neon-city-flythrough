// Scroll progress (0 to 1) read straight from the ScrollControls container.
// drei's own `offset` stopped following the wheel in headless Chromium, so the scene reads the container itself.
export function readScrollProgress(scroll: { el: HTMLElement }) {
  const { el } = scroll;
  const range = el.scrollHeight - el.clientHeight;
  return range > 0 ? Math.min(1, Math.max(0, el.scrollTop / range)) : 0;
}

// Exponential approach so the camera glides instead of snapping to each wheel notch.
export function damp(current: number, target: number, rate: number, delta: number) {
  return current + (target - current) * (1 - Math.exp(-rate * delta));
}
