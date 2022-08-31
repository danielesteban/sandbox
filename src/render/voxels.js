import { vec3 } from 'gl-matrix';

const Vertex = `
struct VertexInput {
  @location(0) position : vec3<f32>,
  @location(1) origin : vec3<f32>,
  @location(2) data : u32,
}

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) color : vec3<f32>,
  @location(1) normal : vec3<f32>,
  @location(2) depth : f32,
}

struct Camera {
  projection : mat4x4<f32>,
  view : mat4x4<f32>,
}

@group(0) @binding(0) var<uniform> camera : Camera;

const rotations = array<mat3x3<f32>, 6>(
  mat3x3<f32>(vec3<f32>(1, 0, 0), vec3<f32>(0, 1, 0), vec3<f32>(0, 0, 1)),
  mat3x3<f32>(vec3<f32>(1, 0, 0), vec3<f32>(0, 0, -1), vec3<f32>(0, 1, 0)),
  mat3x3<f32>(vec3<f32>(1, 0, 0), vec3<f32>(0, 0, 1), vec3<f32>(0, -1, 0)),
  mat3x3<f32>(vec3<f32>(0, 0, 1), vec3<f32>(0, 1, 0), vec3<f32>(-1, 0, 0)),
  mat3x3<f32>(vec3<f32>(0, 0, -1), vec3<f32>(0, 1, 0), vec3<f32>(1, 0, 0)),
  mat3x3<f32>(vec3<f32>(-1, 0, 0), vec3<f32>(0, 1, 0), vec3<f32>(0, 0, -1)),
);

fn sRGBToLinear(color : u32) -> vec3<f32> {
  let srgb : vec3<f32> = vec3<f32>(
    f32((color >> 16) & 0xFF) / 0xFF,
    f32((color >> 8) & 0xFF) / 0xFF,
    f32(color & 0xFF) / 0xFF,
  );
  if (all(srgb <= vec3<f32>(0.04045))) {
    return srgb * 0.0773993808;
  }
  return pow(srgb * 0.9478672986 + 0.0521327014, vec3<f32>(2.4));
}

@vertex
fn main(voxel : VertexInput) -> VertexOutput {
  let rotation : mat3x3<f32> = rotations[voxel.data & 0xFF];
  let position : vec3<f32> = rotation * voxel.position + voxel.origin;
  let mvPosition : vec4<f32> = camera.view * vec4<f32>(position, 1);
  var out : VertexOutput;
  out.position = camera.projection * mvPosition;
  out.color = sRGBToLinear(voxel.data >> 8);
  out.normal = rotation[2];
  out.depth = -mvPosition.z;
  return out;
}
`;

const Fragment = ({ opacity }) => `
struct FragmentInput {
  @location(0) color : vec3<f32>,
  @location(1) normal : vec3<f32>,
  @location(2) depth : f32,
}

struct FragmentOutput {
  @location(0) color : vec4<f32>,
  @location(1) data : vec4<f32>,
}

@fragment
fn main(face : FragmentInput) -> FragmentOutput {
  var output : FragmentOutput;
  output.color = vec4<f32>(face.color, ${opacity});
  output.data = vec4<f32>(normalize(face.normal), face.depth);
  return output;
}
`;

const Face = ({ device }) => {
  const buffer = device.createBuffer({
    mappedAtCreation: true,
    size: 18 * Float32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.VERTEX,
  });
  new Float32Array(buffer.getMappedRange()).set([
    -0.5, -0.5,  0.5,
     0.5, -0.5,  0.5,
     0.5,  0.5,  0.5,
     0.5,  0.5,  0.5,
    -0.5,  0.5,  0.5,
    -0.5, -0.5,  0.5,
  ]);
  buffer.unmap();
  return buffer;
};


const _origin = vec3.create();

class Voxels {
  constructor({
    camera,
    chunks,
    device,
    geometry = null,
    opacity = 1, 
    samples,
  }) {
    this.camera = camera;
    this.device = device;
    this.geometry = geometry || Face({ device });
    this.transparent = opacity !== 1;
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
          {
            arrayStride: 4 * Float32Array.BYTES_PER_ELEMENT,
            stepMode: 'instance',
            attributes: [
              {
                shaderLocation: 1,
                offset: 0,
                format: 'float32x3',
              },
              {
                shaderLocation: 2,
                offset: Float32Array.BYTES_PER_ELEMENT * 3,
                format: 'uint32',
              },
            ],
          }
        ],
        entryPoint: 'main',
        module: device.createShaderModule({
          code: Vertex,
        }),
      },
      fragment: {
        entryPoint: 'main',
        module: device.createShaderModule({
          code: Fragment({ opacity }),
        }),
        targets: [
          {
            format: 'rgba16float',
            ...(this.transparent ? {
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
            } : {}),
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
    this.bindings = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: camera.buffer },
        },
      ],
    });
    this.instances = chunks.reduce((instances, { instances: { [this.transparent ? 'transparent' : 'opaque']: buffer }, origin }) => {
      instances.push({ buffer, distance: 0, origin });
      return instances;
    }, []);
  }

  render(pass) {
    const { bindings, camera, geometry, instances, pipeline, transparent } = this;
    instances.forEach((instance) => {
      vec3.set(_origin, instance.origin[0], camera.position[1], instance.origin[1]);
      instance.distance = vec3.distance(camera.position, _origin);
    });
    instances.sort(({ distance: a }, { distance: b }) => transparent ? b - a : a - b);
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindings);
    pass.setVertexBuffer(0, geometry);
    instances.forEach((instance) => {
      pass.setVertexBuffer(1, instance.buffer, 16);
      pass.drawIndirect(instance.buffer, 0);
    });
  }
}

export default Voxels;
