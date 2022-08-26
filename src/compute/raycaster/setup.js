const Compute = `
struct Faces {
  vertexCount : u32,
  instanceCount : u32,
  firstVertex : u32,
  firstInstance : u32,
  data : array<f32>
}

struct Query {
  origin : vec3<f32>,
  direction : vec3<f32>,
  distance : u32,
  face : u32,
}

@group(0) @binding(0) var<storage, read> faces : Faces;
@group(0) @binding(1) var<storage, read_write> query : Query;
@group(0) @binding(2) var<storage, read_write> workgroups : array<u32, 3>;

@compute @workgroup_size(1)
fn main() {
  query.distance = 0xFFFFFFFF;
  workgroups[0] = u32(ceil(f32(faces.instanceCount) / 256));
  workgroups[1] = 1;
  workgroups[2] = 1;
}
`;

class RaycasterSetup {
  constructor({ device, faces, query, workgroups }) {
    this.pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: {
        entryPoint: 'main',
        module: device.createShaderModule({
          code: Compute,
        }),
      },
    });
    this.bindings = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: faces },
        },
        {
          binding: 1,
          resource: { buffer: query.buffer },
        },
        {
          binding: 2,
          resource: { buffer: workgroups },
        },
      ],
    });
  }

  compute(pass) {
    const { bindings, pipeline } = this;
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindings);
    pass.dispatchWorkgroups(1);
  }
}

export default RaycasterSetup;
