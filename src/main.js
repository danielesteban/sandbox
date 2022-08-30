import './main.css';
import { vec3 } from 'gl-matrix';
import Camera from './render/camera.js';
import Cursor from './render/cursor.js';
import Grid from './render/grid.js';
import Input from './render/input.js';
import Renderer from './render/renderer.js';
import Toolbar from './ui/toolbar.js';
import Volume from './compute/volume.js';
import Voxels from './render/voxels.js';

const Main = ({ adapter, device }) => {
  const camera = new Camera({ device });
  const renderer = new Renderer({ adapter, camera, device });
  const volume = new Volume({ device, size: vec3.fromValues(320, 64, 320) });
  document.getElementById('renderer').appendChild(renderer.canvas);
  renderer.setSize(window.innerWidth, window.innerHeight);
  window.addEventListener('resize', () => (
    renderer.setSize(window.innerWidth, window.innerHeight)
  ), false);

  const center = vec3.clone(volume.size);
  vec3.floor(center, vec3.scale(center, center, 0.5));
  vec3.set(camera.target, center[0], 0, center[2]);

  const opaque = new Voxels({
    camera,
    device,
    instances: volume.instances.opaque,
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
    device,
    geometry: opaque.geometry,
    instances: volume.instances.transparent,
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

  let clock = performance.now() / 1000;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      clock = performance.now() / 1000;
    }
  }, false);

  const input = new Input({ position: camera.target, target: renderer.canvas });
  const toolbar = new Toolbar({ renderer });

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
  const position = vec3.create();

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
        input.zoom.state * 128
      );
    }

    const command = device.createCommandEncoder();
    if (input.buttons.reset) {
      input.buttons.reset = false;
      volume.reset(command);
    }
    if (input.buttons.primary) {
      vec3.copy(position, cursor.position);
      const { color, noise, radius } = toolbar.tools[toolbar.tool];
      let value = 0;
      if (toolbar.tool !== 2) {
        position[1] = Math.min(position[1] + 32, volume.size[1] - 1);
        value = (color << 8) + (toolbar.tool + 1);
      }
      volume.update.compute(
        command, position, noise || 0, radius, value
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
  const check = device.createShaderModule({
    code: `const checkConstSupport : f32 = 1;`,
  });
  const { messages } = await check.compilationInfo();
  if (messages.find(({ type }) => type === 'error')) {
    throw new Error('WGSL const support');
  }
  return { adapter, device };
};

GPU()
  .then(Main)
  .catch((e) => {
    console.error(e);
    document.getElementById('canary').classList.add('enabled');
  })
  .finally(() => document.getElementById('loading').classList.remove('enabled'));
