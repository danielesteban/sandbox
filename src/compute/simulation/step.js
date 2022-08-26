const Compute = ({ size }) => `
struct Uniforms {
  offset : atomic<u32>,
  y : i32,
}

@group(0) @binding(0) var<storage, read_write> data : array<atomic<u32>, ${size[0] * size[1] * size[2]}>;
@group(0) @binding(1) var<storage, read_write> uniforms : Uniforms;

const bottom = vec3<i32>(0, -1, 0);
const top = vec3<i32>(0, 1, 0);
const neighbors = array<vec3<i32>, 4>(
  vec3<i32>(0, 0, -1),
  vec3<i32>(-1, 0, 0),
  vec3<i32>(0, 0, 1),
  vec3<i32>(1, 0, 0),
);
const size : vec3<i32> = vec3<i32>(${size[0]}, ${size[1]}, ${size[2]});

fn getVoxel(pos : vec3<i32>) -> u32 {
  return u32(pos.z * size.x * size.y + pos.y * size.x + pos.x);
}

fn moveVoxel(pos : vec3<i32>, voxel : u32, value : u32, neighbor : vec3<i32>) -> bool {
  let npos = pos + neighbor;
  if (any(npos < vec3<i32>(0)) || any(npos >= size)) {
    return false;
  }
  if (atomicCompareExchangeWeak(&data[getVoxel(npos)], 0, value).exchanged) {
    atomicStore(&data[voxel], 0);
    return true;
  }
  return false;
}

fn stepSand(pos : vec3<i32>, voxel : u32, value : u32) -> bool {
  if (pos.y == 0) {
    return false;
  }
  if (moveVoxel(pos, voxel, value, bottom)) {
    return true;
  }
  let o : u32 = atomicAdd(&uniforms.offset, 1);
  for (var n : u32 = 0; n < 4; n++) {
    let neighbor : vec3<i32> = neighbors[(n + o) % 4] + bottom;
    if (moveVoxel(pos, voxel, value, neighbor)) {
      return true;
    }
  }
  return false;
}

fn stepWater(pos : vec3<i32>, voxel : u32, value : u32) -> bool {
  if (stepSand(pos, voxel, value)) {
    return true;
  }
  let o : u32 = atomicAdd(&uniforms.offset, 1);
  for (var n : u32 = 0; n < 4; n++) {
    let neighbor : vec3<i32> = neighbors[(n + o) % 4];
    if (
      (
        pos.y == 0
        || atomicLoad(&data[getVoxel(pos + neighbor + bottom)]) != 0
      )
      && moveVoxel(pos, voxel, value, neighbor)
    ) {
      return true;
    }
  }
  if ((atomicLoad(&data[getVoxel(pos + top)]) & 0xFF) == 1) {
    atomicStore(&data[voxel], 0);
    return true;
  }
  return false;
}

@compute @workgroup_size(64, 4)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
  let pos : vec3<i32> = vec3<i32>(i32(id.x), uniforms.y, i32(id.y));
  if (any(pos >= size)) {
    return;
  }
  let voxel : u32 = getVoxel(pos);
  let value : u32 = atomicLoad(&data[voxel]);
  if (value == 0) {
    return;
  }
  switch (value & 0xFF) {
    default {
      stepSand(pos, voxel, value);
    }
    case 2 {
      stepWater(pos, voxel, value);
    }
  }
}
`;

class SimulationStep {
  constructor({ data, device, size, uniforms }) {
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
          resource: { buffer: data },
        },
        {
          binding: 1,
          resource: { buffer: uniforms },
        },
      ],
    });
    this.workgroups = new Uint32Array([
      Math.ceil(size[0] / 64),
      Math.ceil(size[2] / 4),
    ]);
  }

  compute(pass) {
    const { bindings, pipeline, workgroups } = this;
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindings);
    pass.dispatchWorkgroups(workgroups[0], workgroups[1]);
  }
}

export default SimulationStep;
