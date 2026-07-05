// Input: keyboard (PC) + virtual joystick / jump button / touch-look (mobile).
// Exposes a normalized move vector, camera look deltas, and a jump flag.
export function createControls(canvas) {
  const state = {
    move: { x: 0, y: 0 },        // x: strafe, y: forward (camera-relative, -1..1)
    lookDX: 0,                   // accumulated since last poll
    lookDY: 0,
    zoomDelta: 0,
    jumpQueued: false,
  };

  // ---------- keyboard ----------
  const keys = new Set();
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Space') {
      state.jumpQueued = true;
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  // ---------- mouse look ----------
  let dragging = false;
  canvas.addEventListener('mousedown', () => { dragging = true; });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    state.lookDX += e.movementX;
    state.lookDY += e.movementY;
  });
  canvas.addEventListener('wheel', (e) => {
    state.zoomDelta += Math.sign(e.deltaY);
    e.preventDefault();
  }, { passive: false });

  // ---------- touch: joystick + look + jump ----------
  const joystick = document.getElementById('joystick');
  const knob = document.getElementById('joystick-knob');
  const jumpBtn = document.getElementById('jump-btn');
  const touchMove = { x: 0, y: 0 };
  let stickPointer = null;
  let lookPointer = null;
  let lastLook = { x: 0, y: 0 };

  joystick.addEventListener('pointerdown', (e) => {
    stickPointer = e.pointerId;
    try { joystick.setPointerCapture(e.pointerId); } catch { /* synthetic events have no active pointer */ }
    updateStick(e);
    e.preventDefault();
  });
  joystick.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickPointer) updateStick(e);
  });
  const releaseStick = (e) => {
    if (e.pointerId !== stickPointer) return;
    stickPointer = null;
    touchMove.x = 0;
    touchMove.y = 0;
    knob.style.transform = 'translate(0px, 0px)';
  };
  joystick.addEventListener('pointerup', releaseStick);
  joystick.addEventListener('pointercancel', releaseStick);

  function updateStick(e) {
    const rect = joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const max = rect.width / 2;
    let dx = (e.clientX - cx) / max;
    let dy = (e.clientY - cy) / max;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    touchMove.x = dx;
    touchMove.y = -dy; // screen-down = backward
    knob.style.transform = `translate(${dx * max * 0.55}px, ${dy * max * 0.55}px)`;
  }

  jumpBtn.addEventListener('pointerdown', (e) => {
    state.jumpQueued = true;
    e.preventDefault();
  });

  // any touch on the canvas itself orbits the camera
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || lookPointer !== null) return;
    lookPointer = e.pointerId;
    lastLook = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lookPointer) return;
    state.lookDX += (e.clientX - lastLook.x) * 2;
    state.lookDY += (e.clientY - lastLook.y) * 2;
    lastLook = { x: e.clientX, y: e.clientY };
  });
  const releaseLook = (e) => {
    if (e.pointerId === lookPointer) lookPointer = null;
  };
  canvas.addEventListener('pointerup', releaseLook);
  canvas.addEventListener('pointercancel', releaseLook);

  // ---------- polling API ----------
  return {
    poll() {
      let x = 0, y = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      const kl = Math.hypot(x, y);
      if (kl > 1) { x /= kl; y /= kl; }
      // joystick takes over when active
      if (Math.hypot(touchMove.x, touchMove.y) > 0.08) {
        x = touchMove.x;
        y = touchMove.y;
      }
      state.move.x = x;
      state.move.y = y;

      const out = {
        move: { ...state.move },
        lookDX: state.lookDX,
        lookDY: state.lookDY,
        zoomDelta: state.zoomDelta,
        jump: state.jumpQueued,
      };
      state.lookDX = 0;
      state.lookDY = 0;
      state.zoomDelta = 0;
      state.jumpQueued = false;
      return out;
    },
  };
}
