import Blur from './blur.js';
import Composite from './composite.js';
import Edges from './edges.js';

const Vertex = `
const quad = array<vec2<f32>, 6>(
  vec2<f32>(-1, -1), vec2<f32>(1, -1), vec2<f32>(-1, 1),
  vec2<f32>(-1, 1), vec2<f32>(1, -1), vec2<f32>(1, 1)
);

@vertex
fn main(@builtin(vertex_index) index : u32) -> @builtin(position) vec4<f32> {
  return vec4<f32>(quad[index], 0, 1);
}
`;

class Postprocessing {
  constructor({ device, format, size }) {
    const vertex = {
      entryPoint: 'main',
      module: device.createShaderModule({
        code: Vertex,
      }),
    };
    this.pipelines = {
      blur: new Blur({ device, size, vertex }),
      composite: new Composite({ device, format, size, vertex }),
      edges: new Edges({ device, size, vertex }),
    };
  }

  render(command, output) {
    const { pipelines } = this;
    pipelines.edges.render(command);
    pipelines.blur.render(command);
    pipelines.composite.render(command, output);
  }

  updateTextures({ color, data }) {
    const { pipelines } = this;
    pipelines.edges.updateTextures({ color, data });
    pipelines.blur.updateTextures({ color: pipelines.edges.output.view });
    pipelines.composite.updateTextures({
      blur: pipelines.blur.output.view,
      color: pipelines.edges.output.view,
      data,
    });
  }
}

export default Postprocessing;
