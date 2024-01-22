const Vertex = `
struct VertexInput {
  @location(0) position : vec3<f32>,
  @location(1) normal : vec3<f32>,
}

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) normal : vec3<f32>,
  @location(1) depth : f32,
}

struct Camera {
  projection : mat4x4<f32>,
  view : mat4x4<f32>,
}

@group(0) @binding(0) var<uniform> camera : Camera;
@group(0) @binding(1) var<uniform> cursor : vec3<f32>;

@vertex
fn main(vertex : VertexInput) -> VertexOutput {
  let mvPosition : vec4<f32> = camera.view * vec4<f32>(vertex.position + cursor, 1);
  var out : VertexOutput;
  out.position = camera.projection * mvPosition;
  out.normal = vertex.normal;
  out.depth = -mvPosition.z;
  return out;
}
`;

const Fragment = `
struct FragmentInput {
  @location(0) normal : vec3<f32>,
  @location(1) depth : f32,
}

struct FragmentOutput {
  @location(0) color : vec4<f32>,
  @location(1) data : vec4<f32>,
}

@fragment
fn main(face : FragmentInput) -> FragmentOutput {
  var output : FragmentOutput;
  output.color = vec4<f32>(1, 1, 1, 0.2);
  output.data = vec4<f32>(normalize(face.normal), face.depth);
  return output;
}
`;

const Cube = ({ device }) => {
  const index = device.createBuffer({
    mappedAtCreation: true,
    size: 36 * Uint16Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.INDEX,
  });
  const indices = new Uint16Array(index.getMappedRange());
  for (let i = 0, j = 0, k = 0; i < 6; i++, j += 6, k += 4) {
    indices[j] = k;
    indices[j + 1] = k + 1; 
    indices[j + 2] = k + 2;
    indices[j + 3] = k + 2; 
    indices[j + 4] = k + 3; 
    indices[j + 5] = k;
  }
  index.unmap();
  const vertex = device.createBuffer({
    mappedAtCreation: true,
    size: 144 * Float32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.VERTEX,
  });
  new Float32Array(vertex.getMappedRange()).set([
    0, 0, 1,     0,  0,  1,
    1, 0, 1,     0,  0,  1,
    1, 1, 1,     0,  0,  1,
    0, 1, 1,     0,  0,  1,

    1, 0, 0,     0,  0,  -1,
    0, 0, 0,     0,  0,  -1,
    0, 1, 0,     0,  0,  -1,
    1, 1, 0,     0,  0,  -1,

    0, 1, 1,     0,  1,  0,
    1, 1, 1,     0,  1,  0,
    1, 1, 0,     0,  1,  0,
    0, 1, 0,     0,  1,  0,

    0, 0, 0,     0, -1,  0,
    1, 0, 0,     0, -1,  0,
    1, 0, 1,     0, -1,  0,
    0, 0, 1,     0, -1,  0,

    1, 0, 1,     1,  0,  0,
    1, 0, 0,     1,  0,  0,
    1, 1, 0,     1,  0,  0,
    1, 1, 1,     1,  0,  0,

    0, 0, 0,    -1,  0,  0,
    0, 0, 1,    -1,  0,  0,
    0, 1, 1,    -1,  0,  0,
    0, 1, 0,    -1,  0,  0,
  ]);
  vertex.unmap();
  return { index, vertex };
};

class Cursor {
  constructor({ camera, device, samples }) {
    this.device = device;
    this.geometry = Cube({ device });
    this.pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        buffers: [
          {
            arrayStride: 6 * Float32Array.BYTES_PER_ELEMENT,
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: 'float32x3',
              },
              {
                shaderLocation: 1,
                offset: 3 * Float32Array.BYTES_PER_ELEMENT,
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
          {
            format: 'rgba16float',
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
          { format: 'rgba16float' },
        ],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back',
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
    this.position = new Float32Array(3);
    this.positionBuffer = device.createBuffer({
      size: this.position.byteLength,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });
    this.bindings = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: camera.buffer },
        },
        {
          binding: 1,
          resource: { buffer: this.positionBuffer },
        },
      ],
    });
  }

  render(pass) {
    const { bindings, geometry, pipeline } = this;
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindings);
    pass.setIndexBuffer(geometry.index, 'uint16');
    pass.setVertexBuffer(0, geometry.vertex);
    pass.drawIndexed(36, 1, 0, 0, 0);
  }

  updatePosition() {
    const { device, position, positionBuffer } = this;
    device.queue.writeBuffer(positionBuffer, 0, position);
  }
}

export default Cursor;
