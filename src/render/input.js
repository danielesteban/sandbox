import { vec2, vec3 } from 'gl-matrix';

const _forward = vec3.create();
const _movement = vec3.create();
const _right = vec3.create();
const _worldUp = vec3.fromValues(0, 1, 0);

class Input {
  constructor({ position, target }) {
    this.buttons = {
      primary: false,
      secondary: false,
      reset: false,
    };
    this.view = {
      hasUpdated: false,
      state: vec2.fromValues(Math.PI * 0.3 - 0.001, 0),
      target: vec2.fromValues(Math.PI * 0.3, 0),
    };
    this.position = {
      state: position,
      target: vec3.clone(position),
    };
    this.keyboard = vec3.create();
    this.pointer = {
      hasUpdated: false,
      movement: vec2.create(),
      position: vec2.fromValues(-1, -1),
    };
    this.zoom = {
      state: 0.75,
      target: 0.75,
    };
    window.addEventListener('blur', this.onBlur.bind(this), false);
    target.addEventListener('contextmenu', this.onContextMenu.bind(this), false);
    window.addEventListener('keydown', this.onKeyDown.bind(this), false);
    window.addEventListener('keyup', this.onKeyUp.bind(this), false);
    target.addEventListener('mousedown', this.onMouseDown.bind(this), false);
    window.addEventListener('mousemove', this.onMouseMove.bind(this), false);
    window.addEventListener('mouseup', this.onMouseUp.bind(this), false);
    window.addEventListener('wheel', this.onMouseWheel.bind(this), { passive: false });
  }

  onBlur() {
    const { buttons, keyboard } = this;
    buttons.primary = buttons.secondary = false;
    vec3.set(keyboard, 0, 0, 0);
  }

  onContextMenu(e) {
    e.preventDefault();
  }

  onKeyDown({ key, repeat, target }) {
    const { buttons, keyboard } = this;
    if (repeat || target.tagName === 'INPUT') {
      return;
    }
    switch (key.toLowerCase()) {
      case 'w':
        keyboard[2] = -1;
        break;
      case 's':
        keyboard[2] = 1;
        break;
      case 'a':
        keyboard[0] = 1;
        break;
      case 'd':
        keyboard[0] = -1;
        break;
      case 'escape':
        if (confirm('Are you sure?')) buttons.reset = true;
        break;
      default:
        break;
    }
  }

  onKeyUp({ key }) {
    const { keyboard } = this;
    switch (key.toLowerCase()) {
      case 'w':
        if (keyboard[2] < 0) keyboard[2] = 0;
        break;
      case 's':
        if (keyboard[2] > 0) keyboard[2] = 0;
        break;
      case 'a':
        if (keyboard[0] > 0) keyboard[0] = 0;
        break;
      case 'd':
        if (keyboard[0] < 0) keyboard[0] = 0;
        break;
      default:
        break;
    }
  }

  onMouseDown({ button }) {
    const { buttons } = this;
    switch (button) {
      case 0:
        buttons.primary = true;
        break;
      case 2:
        buttons.secondary = true;
        break;
    }
  }

  onMouseMove({ clientX, clientY, movementX, movementY }) {
    const { sensitivity } = Input;
    const { pointer: { movement, position } } = this;
    movement[0] -= movementX * sensitivity.view;
    movement[1] -= movementY * sensitivity.view;
    vec2.set(
      position,
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1
    );
  }

  onMouseUp({ button }) {
    const { buttons } = this;
    switch (button) {
      case 0:
        buttons.primary = false;
        break;
      case 2:
        buttons.secondary = false;
        break;
    }
  }

  onMouseWheel(e) {
    if (e.ctrlKey) {
      e.preventDefault();
    }
    const { sensitivity, minZoom, zoomRange } = Input;
    const { zoom } = this;
    const logZoom = Math.min(
      Math.max(
        ((Math.log(zoom.target) - minZoom) / zoomRange) + (e.deltaY * sensitivity.zoom),
        0
      ),
      1
    );
    zoom.target = Math.exp(minZoom + logZoom * zoomRange);
  }

  update(delta) {
    const { minPhi, maxPhi } = Input;
    const { buttons, keyboard, pointer, position, view, zoom } = this;

    pointer.hasUpdated = pointer.movement[0] !== 0 || pointer.movement[1] !== 0;
    view.hasUpdated = false;

    if (buttons.secondary) {
      view.target[1] += pointer.movement[0];
      view.target[0] = Math.min(Math.max(view.target[0] + pointer.movement[1], minPhi), maxPhi);
    }
    vec2.set(pointer.movement, 0, 0);

    const damp = 1 - Math.exp(-10 * delta);
    if (Math.max(Math.abs(view.state[0] - view.target[0]), Math.abs(view.state[1] - view.target[1])) > 0.001) {
      vec2.lerp(view.state, view.state, view.target, damp);
      view.hasUpdated = true;
    }
    if (Math.abs(zoom.state - zoom.target) > 0.001) {
      zoom.state = zoom.state * (1 - damp) + zoom.target * damp;
      view.hasUpdated = true;
    }

    if (keyboard[0] !== 0 || keyboard[1] !== 0 || keyboard[2] !== 0) {
      vec3.set(
        _forward,
        Math.sin(view.state[0]) * Math.sin(view.state[1]),
        0,
        Math.sin(view.state[0]) * Math.cos(view.state[1])
      );
      vec3.normalize(_forward, _forward);
      vec3.normalize(_right, vec3.cross(_right, _forward, _worldUp));
      vec3.zero(_movement);
      vec3.scaleAndAdd(_movement, _movement, _right, keyboard[0]);
      vec3.scaleAndAdd(_movement, _movement, _worldUp, keyboard[1]);
      vec3.scaleAndAdd(_movement, _movement, _forward, keyboard[2]);
      vec3.normalize(_movement, _movement);
      vec3.scaleAndAdd(
        position.target,
        position.target,
        _movement,
        delta * 100 * zoom.state
      );
    }
    if (Math.max(
      Math.abs(position.state[0] - position.target[0]),
      Math.abs(position.state[1] - position.target[1]),
      Math.abs(position.state[2] - position.target[2]),
    ) > 0.001) {
      vec3.lerp(position.state, position.state, position.target, damp);
      view.hasUpdated = true;
    }
  }
}

Input.sensitivity = {
  view: 0.003,
  zoom: 0.0003,
};
Input.minPhi = 0.01;
Input.maxPhi = Math.PI * 0.5 - 0.01;
Input.minZoom = Math.log(0.1);
Input.maxZoom = Math.log(2);
Input.zoomRange = Input.maxZoom - Input.minZoom;

export default Input;
