import Mesher from './mesher.js';
import Raycaster from './raycaster/raycaster.js';
import Simulation from './simulation/simulation.js';
import Update from './update.js';

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

class Volume {
  constructor({ device, size }) {
    this.size = size;

    this.data = device.createBuffer({
      size: size[0] * size[1] * size[2] * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
    });

    this.instances = {
      opaque: Instances({ device, size }),
      transparent: Instances({ device, size }),
    };

    this.mesher = new Mesher({ data: this.data, device, instances: this.instances, size });
    this.raycaster = new Raycaster({ device, instances: this.instances, size });
    this.simulation = new Simulation({ data: this.data, device, size });
    this.update = new Update({ data: this.data, device, size });
  }

  compute(command) {
    const { mesher, simulation } = this;
    simulation.compute(command);
    mesher.compute(command);
  }

  reset(command) {
    const { data } = this;
    command.clearBuffer(data);
  }
}

export default Volume;
