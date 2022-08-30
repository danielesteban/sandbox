const Instances = ({ device, size }) => {
  const buffer = device.createBuffer({
    mappedAtCreation: true,
    size: (4 + Math.ceil(size[0] * size[1] * size[2] * 0.5) * 4) * Uint32Array.BYTES_PER_ELEMENT,
    usage: (
      GPUBufferUsage.COPY_DST
      | GPUBufferUsage.INDIRECT
      | GPUBufferUsage.STORAGE
      | GPUBufferUsage.VERTEX
    ),
  });
  new Uint32Array(buffer.getMappedRange(0, 4))[0] = 6;
  buffer.unmap();
  return buffer;
};

class Chunk {
  constructor({ device, position, size }) {
    this.bindings = {};

    this.data = device.createBuffer({
      size: size[0] * size[1] * size[2] * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
    });

    this.instances = {
      opaque: Instances({ device, size }),
      transparent: Instances({ device, size }),
    };

    this.position = device.createBuffer({
      mappedAtCreation: true,
      size: 2 * Int32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM,
    });
    new Int32Array(this.position.getMappedRange()).set([
      position[0] * size[0],
      position[1] * size[2],
    ]);
    this.position.unmap();
  }
}

export default Chunk;
