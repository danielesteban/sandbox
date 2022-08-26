import { glMatrix, mat4, vec3 } from 'gl-matrix';

const _offset = vec3.create();
const _worldUp = vec3.fromValues(0, 1, 0);

class Camera {
  constructor({ device, aspect = 1, fov = 75, near = 0.1, far = 1000 }) {
    this.device = device;
    this.buffer = device.createBuffer({
      size: 16 * 2 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });
    this.aspect = aspect;
    this.fov = fov;
    this.near = near;
    this.far = far;

    this.projectionMatrix = mat4.create();
    this.projectionMatrixInverse = mat4.create();
    this.viewMatrix = mat4.create();
    this.viewMatrixMatrixInverse = mat4.create();
    this.position = vec3.create();
    this.target = vec3.create();
  }

  setOrbit(phi, theta, radius) {
    const { position, target } = this;
    const sinPhiRadius = Math.sin(phi) * radius;
    vec3.add(
      position,
      target,
      vec3.set(
        _offset,
        sinPhiRadius * Math.sin(theta),
        Math.cos(phi) * radius,
        sinPhiRadius * Math.cos(theta)
      )
    );
    this.updateView();
  }

  updateProjection() {
    const { device, buffer, projectionMatrix, projectionMatrixInverse, aspect, fov, near, far } = this;
    mat4.perspective(projectionMatrix, glMatrix.toRadian(fov), aspect, near, far);
    mat4.invert(projectionMatrixInverse, projectionMatrix);
    device.queue.writeBuffer(buffer, 0, projectionMatrix);
  }

  updateView() {
    const { device, buffer, viewMatrix, viewMatrixMatrixInverse, position, target } = this;
    mat4.lookAt(viewMatrix, position, target, _worldUp);
    mat4.invert(viewMatrixMatrixInverse, viewMatrix);
    device.queue.writeBuffer(buffer, 64, viewMatrix);
  }
}

export default Camera;
