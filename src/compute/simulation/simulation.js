import Setup from './setup.js';
import Step from './step.js';

class Simulation {
  constructor({ data, device, size }) {
    this.size = size;
    const uniforms = device.createBuffer({
      mappedAtCreation: true,
      size: 2 * Int32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE,
    });
    new Int32Array(uniforms.getMappedRange())[1] = size[1] - 1; 
    uniforms.unmap();
    this.pipelines = {
      setup: new Setup({ device, size, uniforms: uniforms }),
      step: new Step({ data, device, size, uniforms: uniforms }),
    };
  }

  compute(command) {
    const { pipelines, size } = this;
    const pass = command.beginComputePass();
    for (let y = 0; y < size[1]; y++) {
      pipelines.setup.compute(pass);
      pipelines.step.compute(pass);
    }
    pass.end();
  }
}

export default Simulation;
