const keys = new Set();
const pressed = new Set();

window.addEventListener('keydown', (e) => {
  if (!keys.has(e.code)) pressed.add(e.code);
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
});

window.addEventListener('blur', () => {
  keys.clear();
});

export const Input = {
  isDown(code) { return keys.has(code); },

  /** True only on the frame the key was first pressed. Clear after read. */
  wasPressed(code) {
    if (pressed.has(code)) { pressed.delete(code); return true; }
    return false;
  },

  /** Movement vector from WASD/arrows (not normalized). */
  moveVec() {
    let x = 0, z = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp'))    z -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown'))  z += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft'))  x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    return { x, z };
  },

  endFrame() {
    pressed.clear();
  },
};
