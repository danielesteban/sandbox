import { vec3 } from 'gl-matrix';
import Compute from './compute.js';
import Ray from './ray.js';
import Setup from './setup.js';

const _edge1 = vec3.create();
const _edge2 = vec3.create();
const _diff = vec3.create();
const _normal = vec3.create();
const intersectTriangle = (a, b, c, origin, direction) => {
  vec3.sub(_edge1, b, a);
  vec3.sub(_edge2, c, a);
  vec3.cross(_normal, _edge1, _edge2);
  const DdN = -vec3.dot(direction, _normal);
  if (DdN <= 0) return 0;
  vec3.sub(_diff, origin, a);
  const DdQxE2 = -vec3.dot(direction, vec3.cross(_edge2, _diff, _edge2));
  if (DdQxE2 < 0) return 0;
  const DdE1xQ = -vec3.dot(direction, vec3.cross(_edge1, _edge1, _diff));
  if (DdE1xQ < 0 || (DdQxE2 + DdE1xQ) > DdN) return 0;
  const QdN = vec3.dot(_diff, _normal);
  if (QdN < 0) return 0;
  return QdN / DdN;
}

const _faceNormals = [
  vec3.fromValues(0, 0, 1),
  vec3.fromValues(0, 1, 0),
  vec3.fromValues(0, -1, 0),
  vec3.fromValues(-1, 0, 0),
  vec3.fromValues(1, 0, 0),
  vec3.fromValues(0, 0, -1),
];

class Raycaster {
  constructor({ chunks, device, precision = 0.0001, size }) {
    this.chunks = chunks;
    this.device = device;
    this.precision = precision;
    {
      const data = new Float32Array(8);
      this.query = {
        buffer: device.createBuffer({
          size: 9 * Float32Array.BYTES_PER_ELEMENT,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC | GPUBufferUsage.STORAGE,
        }),
        data,
        origin: data.subarray(0, 3),
        direction: data.subarray(4, 7),
        distance: new Uint32Array(data.buffer, 7 * Float32Array.BYTES_PER_ELEMENT, 1),
      };
    }
    this.rays = [];
    const workgroups = device.createBuffer({
      size: 3 * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE,
    });
    this.pipelines = {
      compute: new Compute({ device, precision, query: this.query, size, workgroups }),
      setup: new Setup({ device, workgroups }),
    };
  }

  getRay() {
    const { device, rays } = this;
    return rays.pop() || new Ray({ device });
  }

  compute(ray) {
    const { chunks, device, pipelines, precision, query } = this;
    vec3.copy(query.origin, ray.origin);
    vec3.copy(query.direction, ray.direction);
    query.distance[0] = 0xFFFFFFFF;
    device.queue.writeBuffer(query.buffer, 0, query.data);
    const command = device.createCommandEncoder();
    const pass = command.beginComputePass();
    chunks.forEach((chunk) => {
      pipelines.setup.compute(pass, chunk);
      pipelines.compute.compute(pass, chunk);
    });
    pass.end();
    command.copyBufferToBuffer(query.buffer, 28, ray.output, 0, 8);
    device.queue.submit([command.finish()]);
    return ray.output
      .mapAsync(GPUMapMode.READ)
      .then(() => {
        const [distance, face] = new Uint32Array(ray.output.getMappedRange());
        ray.output.unmap();
        if (distance === 0xFFFFFFFF) {
          return false;
        }
        ray.result.distance = distance * precision;
        vec3.scaleAndAdd(ray.result.position, ray.origin, ray.direction, ray.result.distance);
        vec3.copy(ray.result.normal, _faceNormals[face]);
        return true;
      });
  }

  computeCPU(ray, triangles, face = 1) {
    const distance = triangles.reduce((result, triangle) => {
      const distance = intersectTriangle(triangle[0], triangle[1], triangle[2], ray.origin, ray.direction);
      if (distance) {
        return Math.min(distance, result);
      }
      return result;
    }, Infinity);
    if (distance === Infinity) {
      return false;
    }
    ray.result.distance = distance;
    vec3.scaleAndAdd(ray.result.position, ray.origin, ray.direction, distance);
    vec3.copy(ray.result.normal, _faceNormals[face]);
    return true;
  }
}

export default Raycaster;
