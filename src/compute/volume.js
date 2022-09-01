import Chunk from './chunk.js';
import Generator from './generator.js';
import Mesher from './mesher.js';
import Raycaster from './raycaster/raycaster.js';
import Simulation from './simulation/simulation.js';
import Update from './update.js';

class Volume {
  constructor({ chunkSize, device, size }) {
    {
      if (chunkSize[1] !== size[1]) {
        throw new Error('ChunkSize and Size Y must be equal');
      }
      if ((size[0] % chunkSize[0]) !== 0 || (size[2] % chunkSize[2]) !== 0) {
        throw new Error('Size must be multiple of ChunkSize');
      }
      const chunks = [size[0] / chunkSize[0], size[2] / chunkSize[2]];
      const edge = { data: device.createBuffer({ size: 4, usage: GPUBufferUsage.STORAGE }) };
      const map = new Map();
      const load = (position) => {
        if (position[0] < 0 || position[1] < 0 || position[0] >= chunks[0] || position[1] >= chunks[1]) {
          return edge;
        }
        const key = `${position[0]}:${position[1]}`;
        let chunk = map.get(key);
        if (!chunk) {
          chunk = new Chunk({ device, position, size: chunkSize });
          map.set(key, chunk);
        }
        return chunk;
      };
      const neighbors = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      this.chunks = [];
      for (let z = 0; z < chunks[1]; z++) {
        for (let x = 0; x < chunks[0]; x++) {
          const chunk = load([x, z]);
          chunk.neighbors = neighbors.map((offset) => load([x + offset[0], z + offset[1]]));
          this.chunks.push(chunk);
        }
      }
    }
    this.size = size;

    this.generator = new Generator({ chunks: this.chunks, device, size: chunkSize });
    this.mesher = new Mesher({ chunks: this.chunks, device, extents: size, size: chunkSize });
    this.raycaster = new Raycaster({ chunks: this.chunks, device, size: chunkSize });
    this.simulation = new Simulation({ chunks: this.chunks, device, extents: size, size: chunkSize });
    this.update = new Update({ chunks: this.chunks, device, size: chunkSize });
  }

  compute(command) {
    const { mesher, simulation } = this;
    simulation.compute(command);
    mesher.compute(command);
  }

  reset(command) {
    const { chunks } = this;
    chunks.forEach((chunk) => (
      command.clearBuffer(chunk.data)
    ));
  }
}

export default Volume;
