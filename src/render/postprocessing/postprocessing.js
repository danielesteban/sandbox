import Blur from './blur.js';
import Composite from './composite.js';
import Edges from './edges.js';

const Vertex = `
@vertex
fn main(@location(0) position : vec4<f32>) -> @builtin(position) vec4<f32> {
  return position;
}
`;

const Screen = ({ device }) => {
  const buffer = device.createBuffer({
    mappedAtCreation: true,
    size: 18 * Float32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.VERTEX,
  });
  new Float32Array(buffer.getMappedRange()).set([
    -1, -1,  1,
     1, -1,  1,
     1,  1,  1,
     1,  1,  1,
    -1,  1,  1,
    -1, -1,  1,
  ]);
  buffer.unmap();
  return buffer;
};

class Postprocessing {
  constructor({ device, format }) {
    const geometry = Screen({ device });
    const vertex = {
      buffers: [
        {
          arrayStride: 3 * Float32Array.BYTES_PER_ELEMENT,
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: 'float32x3',
            },
          ],
        },
      ],
      entryPoint: 'main',
      module: device.createShaderModule({
        code: Vertex,
      }),
    };
    this.pipelines = {
      blur: new Blur({ device, geometry, vertex }),
      composite: new Composite({ device, format, geometry, vertex }),
      edges: new Edges({ device, geometry, vertex }),
    };
  }

  render(command, output) {
    const { pipelines } = this;
    pipelines.edges.render(command);
    pipelines.blur.render(command);
    pipelines.composite.render(command, output);
  }

  updateTextures({ color, data, size }) {
    const { pipelines } = this;
    pipelines.edges.updateTextures({ color, data, size });
    pipelines.blur.updateTextures({ color: pipelines.edges.output.view, size });
    pipelines.composite.updateTextures({
      blur: pipelines.blur.output.view,
      color: pipelines.edges.output.view,
      data,
    });
  }
}

export default Postprocessing;
