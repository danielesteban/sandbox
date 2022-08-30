const Compute = ({ size }) => `
struct Uniforms {
  offset : u32,
  y : i32,
}

@group(0) @binding(0) var<storage, read_write> uniforms : Uniforms;

@compute @workgroup_size(1)
fn main() {
  uniforms.y = (uniforms.y + 1) % ${size[1]};
}
`;

class SimulationSetup {
  constructor({ device, size, uniforms }) {
    this.pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: {
        entryPoint: 'main',
        module: device.createShaderModule({
          code: Compute({ size }),
        }),
      },
    });
    this.bindings = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: uniforms },
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

export default SimulationSetup;
