import './main.css';
import { vec3 } from 'gl-matrix';
import Camera from './render/camera.js';
import Cursor from './render/cursor.js';
import Grid from './render/grid.js';
import Input from './render/input.js';
import Renderer from './render/renderer.js';
import Volume from './compute/volume.js';
import Voxels from './render/voxels.js';
import UI from './ui/ui.svelte';
import * as UIState from './ui/state.js';

const Main = ({ adapter, device }) => {
  const camera = new Camera({ device });
  const renderer = new Renderer({ adapter, camera, device });
  document.getElementById('renderer').appendChild(renderer.canvas);
  renderer.setSize(window.innerWidth, window.innerHeight);
  window.addEventListener('resize', () => (
    renderer.setSize(window.innerWidth, window.innerHeight)
  ), false);

  const volume = new Volume({
    device,
    size: vec3.fromValues(512, 96, 512),
    chunkSize: vec3.fromValues(256, 96, 256),
  });
  vec3.set(camera.target, volume.size[0] * 0.5, 0, volume.size[2] * 0.5);

  const opaque = new Voxels({
    camera,
    chunks: volume.chunks,
    device,
    samples: renderer.samples,
  });
  renderer.scene.push(opaque);

  const grid = new Grid({
    background: renderer.background,
    camera,
    device,
    samples: renderer.samples,
    size: volume.size,
  });
  renderer.scene.push(grid);

  const transparent = new Voxels({
    camera,
    chunks: volume.chunks,
    device,
    geometry: opaque.geometry,
    opacity: 0.8,
    samples: renderer.samples,
  });
  renderer.scene.push(transparent);

  const cursor = new Cursor({
    camera,
    device,
    samples: renderer.samples,
  });
  renderer.scene.push(cursor);

  const atoms = { sand: 1, water: 2 };
  const brush = { position: vec3.create() };
  const colors = { sand: new Uint32Array(4) };
  const generator = { seed: new Int32Array(3) };
  const ground = [
    [
      vec3.fromValues(volume.size[0] * -1, 0, volume.size[2] * 2),
      vec3.fromValues(volume.size[0] * 2, 0, volume.size[2] * 2),
      vec3.fromValues(volume.size[0] * 2, 0, volume.size[2] * -1),
    ],
    [
      vec3.fromValues(volume.size[0] * 2, 0, volume.size[2] * -1),
      vec3.fromValues(volume.size[0] * -1, 0, volume.size[2] * -1),
      vec3.fromValues(volume.size[0] * -1, 0, volume.size[2] * 2)
    ],
  ];
  const input = new Input({ position: camera.target, target: renderer.canvas });
  {
    const map = (state, data, key) => state[key].subscribe((value) => { data[key] = value; });
    map(UIState.brush, brush, 'atom');
    map(UIState.brush, brush, 'noise');
    map(UIState.brush, brush, 'radius');
    UIState.colors.sand.forEach((v, i) => map(UIState.colors.sand, colors.sand, i));
    map(UIState.colors, colors, 'water');
    UIState.generator.seed.forEach((v, i) => map(UIState.generator.seed, generator.seed, i));
    map(UIState.generator, generator, 'waterLevel');
  }
  UIState.colors.background.subscribe((value) => (
    renderer.setBackground(value)
  ));
  UIState.generator.compute.subscribe((value) => {
    if (value) {
      const command = device.createCommandEncoder();
      volume.generator.compute(
        command,
        colors.sand,
        generator.seed,
        colors.water,
        generator.waterLevel
      );
      device.queue.submit([command.finish()]);
      UIState.generator.compute.set(false);
    }
  });
  UIState.generator.reset.subscribe((value) => {
    if (value) {
      const command = device.createCommandEncoder();
      volume.reset(command);
      device.queue.submit([command.finish()]);
      UIState.generator.reset.set(false);
    }
  });

  let clock = performance.now() / 1000;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      clock = performance.now() / 1000;
    }
  }, false);

  const animate = () => {
    requestAnimationFrame(animate);

    const time = performance.now() / 1000;
    const delta = Math.min(time - clock, 1);
    clock = time;

    input.update(delta);
    if (input.view.hasUpdated) {
      camera.setOrbit(
        input.view.state[0],
        input.view.state[1],
        input.zoom.state * 256
      );
    }

    const command = device.createCommandEncoder();
    if (input.buttons.primary) {
      const { atom, noise, position, radius } = brush;
      vec3.copy(position, cursor.position);
      let value = 0;
      if (atom === 'sand' || atom === 'water') {
        const color = atom === 'sand' ? colors[atom][0] : colors[atom];
        position[1] = Math.min(position[1] + radius * 3, volume.size[1] - 1);
        value = (color << 8) + atoms[atom];
      }
      volume.update.compute(
        command, position, atom !== 'void' ? noise : 0, radius, value
      );
    }
    volume.compute(command);
    renderer.render(command);
    device.queue.submit([command.finish()]);

    if (input.pointer.hasUpdated || input.view.hasUpdated) {
      const ray = volume.raycaster.getRay();
      ray.setFromCamera(camera, input.pointer.position);
      volume.raycaster
        .compute(ray)
        .then((hasHit) => {
          if (!hasHit && !volume.raycaster.computeCPU(ray, ground)) {
            return;
          }
          vec3.copy(cursor.position, ray.result.position);
          vec3.scaleAndAdd(cursor.position, ray.result.position, ray.result.normal, 0.5);
          vec3.floor(cursor.position, cursor.position);
          cursor.updatePosition();
          volume.raycaster.rays.push(ray);
        });
    }
  };

  requestAnimationFrame(animate);
};

const GPU = async () => {
  if (!navigator.gpu) {
    throw new Error('WebGPU support');
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error('WebGPU adapter');
  }
  const device = await adapter.requestDevice();
  return { adapter, device };
};

GPU()
  .then(Main)
  .then(() => new UI({ target: document.getElementById('ui') }))
  .catch((e) => {
    console.error(e);
    document.getElementById('support').classList.add('enabled');
  })
  .finally(() => document.getElementById('loading').classList.remove('enabled'));
