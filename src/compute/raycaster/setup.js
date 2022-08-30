const Compute = `
struct Instances {
  vertexCount : u32,
  instanceCount : u32,
  firstVertex : u32,
  firstInstance : u32,
}

@group(0) @binding(0) var<storage, read_write> workgroups : array<u32, 3>;
@group(1) @binding(0) var<storage, read> opaque : Instances;
@group(1) @binding(1) var<storage, read> transparent : Instances;

@compute @workgroup_size(1)
fn main() {
  workgroups[0] = u32(ceil(f32(opaque.instanceCount + transparent.instanceCount) / 256));
  workgroups[1] = 1;
  workgroups[2] = 1;
}
`;

class RaycasterSetup {
  constructor({ device, workgroups }) {
    this.device = device;
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
          resource: { buffer: workgroups },
        },
      ],
    });
  }

  compute(pass, chunk) {
    const { bindings, device, pipeline } = this;
    if (!chunk.bindings.raycasterSetup) {
      chunk.bindings.raycasterSetup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(1),
        entries: [
          {
            binding: 0,
            resource: { buffer: chunk.instances.opaque },
          },
          {
            binding: 1,
            resource: { buffer: chunk.instances.transparent },
          },
        ],
      });
    }
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindings);
    pass.setBindGroup(1, chunk.bindings.raycasterSetup);
    pass.dispatchWorkgroups(1);
  }
}

export default RaycasterSetup;
