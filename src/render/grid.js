const Vertex = `
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

@vertex
fn main(vertex : VertexInput) -> VertexOutput {
  let mvPosition : vec4<f32> = camera.view * vec4<f32>(vertex.position, 1);
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

@group(0) @binding(0) var<uniform> background : vec3<f32>;

const lineDensity : f32 = 0.01;

fn getLine(pos : vec2<f32>, depth : f32) -> f32 {
  let p : vec2<f32> = abs(fract(pos - 0.5) - 0.5) / fwidth(pos);
  let intensity : f32 = 1.0 - min(min(p.x, p.y), 1.0);
  return intensity * 0.5 * exp(-lineDensity * lineDensity * depth * depth);
}

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

const Plane = ({ device, size }) => {
  const buffer = device.createBuffer({
    mappedAtCreation: true,
    size: 18 * Float32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.VERTEX,
  });
  new Float32Array(buffer.getMappedRange()).set([
    0, 0, size[2],
    size[0], 0, size[2],
    size[0], 0, 0,
    size[0], 0, 0,
    0, 0, 0,
    0, 0, size[2],
  ]);
  buffer.unmap();
  return buffer;
};

class Grid {
  constructor({ background, camera, device, samples, size }) {
    this.device = device;
    this.geometry = Plane({ device, size });
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
          code: Vertex,
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
