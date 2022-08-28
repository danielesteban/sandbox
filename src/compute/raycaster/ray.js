import { vec3 } from 'gl-matrix';

class RaycasterRay {
  constructor({ device }) {
    this.origin = vec3.create();
    this.direction = vec3.create();
    this.output = device.createBuffer({
      size: 2 * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    this.result = {
      distance: 0,
      position: vec3.create(),
      normal: vec3.create(),
    };
  }

  setFromCamera(camera, position) {
    const { origin, direction } = this;
    vec3.copy(origin, camera.position);
    vec3.set(direction, position[0], position[1], 0.5);
    vec3.transformMat4(direction, direction, camera.projectionMatrixInverse);
    vec3.transformMat4(direction, direction, camera.viewMatrixMatrixInverse);
    vec3.sub(direction, direction, origin);
    vec3.normalize(direction, direction);
  }
}

export default RaycasterRay;
