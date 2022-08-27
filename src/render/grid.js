const Vertex = ({ position }) => `
struct VertexInput {
  @location(0) position : vec3<f32>,
}

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) grid : vec2<f32>,
  @location(1) mvPosition : vec3<f32>,
}

struct Camera {
  projection : mat4x4<f32>,
  view : mat4x4<f32>,
}

@group(0) @binding(1) var<uniform> camera : Camera;

const origin : vec3<f32> = vec3<f32>(${position[0]}, ${position[1]}, ${position[2]});

@vertex
fn main(vertex : VertexInput) -> VertexOutput {
  let mvPosition : vec4<f32> = camera.view * vec4<f32>(vertex.position + origin, 1);
  var out : VertexOutput;
  out.position = camera.projection * mvPosition;
  out.grid = vertex.position.xz;
  out.mvPosition = mvPosition.xyz;
  return out;
}
`;

const Fragment = `
struct FragmentInput {
  @location(0) grid : vec2<f32>,
  @location(1) mvPosition : vec3<f32>,
}

struct FragmentOutput {
  @location(0) color : vec4<f32>,
  @location(1) data : vec4<f32>,
}

fn getLine(pos : vec2<f32>, depth : f32) -> f32 {
  let p : vec2<f32> = abs(fract(pos - 0.5) - 0.5) / fwidth(pos);
  let intensity : f32 = 1.0 - min(min(p.x, p.y), 1.0);
  let density : f32 = 0.01;
  return intensity * exp(-density * density * depth * depth);
}

@group(0) @binding(0) var<uniform> background : vec3<f32>;

@fragment
fn main(face : FragmentInput) -> FragmentOutput {
  var output : FragmentOutput;
  output.color = vec4<f32>(
    background * (1 + getLine(face.grid, -face.mvPosition.z)),
    1
  );
  output.data = vec4<f32>(0, 1, 0, -face.mvPosition.z);
  return output;
}
`;

const Plane = ({ device }) => {
  const buffer = device.createBuffer({
    mappedAtCreation: true,
    size: 18 * Float32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.VERTEX,
  });
  new Float32Array(buffer.getMappedRange()).set([
    -128, 0, 128,
    128, 0, 128,
    128, 0, -128,
    128, 0, -128,
    -128, 0, -128,
    -128, 0, 128,
  ]);
  buffer.unmap();
  return buffer;
};

class Grid {
  constructor({ background, camera, device, position, samples }) {
    this.device = device;
    this.geometry = Plane({ device });
    this.pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
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
          code: Vertex({ position }),
        }),
      },
      fragment: {
        entryPoint: 'main',
        module: device.createShaderModule({
          code: Fragment,
        }),
        targets: [
          { format: 'rgba16float' },
          { format: 'rgba16float' },
        ],
      },
      primitive: {
        topology: 'triangle-list',
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus',
      },
      multisample: {
        count: samples,
      },
    });
    this.bindings = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: background.buffer },
        },
        {
          binding: 1,
          resource: { buffer: camera.buffer },
        },
      ],
    });
  }

  render(pass) {
    const { bindings, geometry, pipeline } = this;
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindings);
    pass.setVertexBuffer(0, geometry);
    pass.draw(6, 1, 0, 0);
  }
}

export default Grid;
