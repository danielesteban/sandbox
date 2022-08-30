const Compute = ({ extents, size }) => `
struct Uniforms {
  offset : atomic<u32>,
  y : i32,
}

@group(0) @binding(0) var<storage, read_write> uniforms : Uniforms;
@group(1) @binding(0) var<storage, read_write> data : array<atomic<u32>, ${size[0] * size[1] * size[2]}>;
@group(1) @binding(1) var<storage, read_write> data_east : array<atomic<u32>>;
@group(1) @binding(2) var<storage, read_write> data_west : array<atomic<u32>>;
@group(1) @binding(3) var<storage, read_write> data_north : array<atomic<u32>>;
@group(1) @binding(4) var<storage, read_write> data_south : array<atomic<u32>>;
@group(1) @binding(5) var<uniform> chunk : vec2<i32>;

const bottom = vec3<i32>(0, -1, 0);
const top = vec3<i32>(0, 1, 0);
const neighbors = array<vec3<i32>, 4>(
  vec3<i32>(0, 0, -1),
  vec3<i32>(-1, 0, 0),
  vec3<i32>(0, 0, 1),
  vec3<i32>(1, 0, 0),
);

const extents : vec3<i32> = vec3<i32>(${extents[0]}, ${extents[1]}, ${extents[2]});
const size : vec3<i32> = vec3<i32>(${size[0]}, ${size[1]}, ${size[2]});

fn getVoxel(pos : vec3<i32>) -> u32 {
  return u32(pos.z * size.x * size.y + pos.y * size.x + pos.x);
}

fn getValue(pos : vec3<i32>) -> u32 {
  let wpos : vec3<i32> = vec3<i32>(chunk.x, 0, chunk.y) + pos;
  if (any(wpos < vec3<i32>(0)) || any(wpos >= extents)) {
    return 0;
  }
  if (pos.x < 0) {
    return atomicLoad(&data_west[getVoxel(pos + vec3<i32>(size.x, 0, 0))]);
  }
  if (pos.x >= size.x) {
    return atomicLoad(&data_east[getVoxel(pos - vec3<i32>(size.x, 0, 0))]);
  }
  if (pos.z < 0) {
    return atomicLoad(&data_south[getVoxel(pos + vec3<i32>(0, 0, size.z))]);
  }
  if (pos.z >= size.z) {
    return atomicLoad(&data_north[getVoxel(pos - vec3<i32>(0, 0, size.z))]);
  }
  return atomicLoad(&data[getVoxel(pos)]);
}

fn setValue(pos : vec3<i32>, value : u32) -> bool {
  let wpos : vec3<i32> = vec3<i32>(chunk.x, 0, chunk.y) + pos;
  if (any(wpos < vec3<i32>(0)) || any(wpos >= extents)) {
    return false;
  }
  if (pos.x < 0) {
    return atomicCompareExchangeWeak(&data_west[getVoxel(pos + vec3<i32>(size.x, 0, 0))], 0, value).exchanged;
  }
  if (pos.x >= size.x) {
    return atomicCompareExchangeWeak(&data_east[getVoxel(pos - vec3<i32>(size.x, 0, 0))], 0, value).exchanged;
  }
  if (pos.z < 0) {
    return atomicCompareExchangeWeak(&data_south[getVoxel(pos + vec3<i32>(0, 0, size.z))], 0, value).exchanged;
  }
  if (pos.z >= size.z) {
    return atomicCompareExchangeWeak(&data_north[getVoxel(pos - vec3<i32>(0, 0, size.z))], 0, value).exchanged;
  }
  return atomicCompareExchangeWeak(&data[getVoxel(pos)], 0, value).exchanged;
}

fn stepSand(pos : vec3<i32>, value : u32) -> bool {
  if (pos.y == 0) {
    return false;
  }
  if (setValue(pos + bottom, value)) {
    return true;
  }
  let o : u32 = atomicAdd(&uniforms.offset, 1);
  for (var n : u32 = 0; n < 4; n++) {
    let neighbor : vec3<i32> = neighbors[(n + o) % 4] + bottom;
    if (setValue(pos + neighbor, value)) {
      return true;
    }
  }
  return false;
}

fn stepWater(pos : vec3<i32>, value : u32) -> bool {
  if (stepSand(pos, value)) {
    return true;
  }
  let o : u32 = atomicAdd(&uniforms.offset, 1);
  for (var n : u32 = 0; n < 4; n++) {
    let neighbor : vec3<i32> = neighbors[(n + o) % 4];
    if (
      (
        pos.y == 0
        || getValue(pos + neighbor + bottom) != 0
      )
      && setValue(pos + neighbor, value)
    ) {
      return true;
    }
  }
  if ((atomicLoad(&data[getVoxel(pos + top)]) & 0xFF) == 1) {
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
  var hasMoved : bool;
  switch (value & 0xFF) {
    default {
      hasMoved = stepSand(pos, value);
    }
    case 2 {
      hasMoved = stepWater(pos, value);
    }
  }
  if (hasMoved) {
    atomicStore(&data[voxel], 0);
  }
}
`;

class SimulationStep {
  constructor({ device, extents, size, uniforms }) {
    this.device = device;
    this.pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: {
        entryPoint: 'main',
        module: device.createShaderModule({
          code: Compute({ extents, size }),
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
    this.workgroups = new Uint32Array([
      Math.ceil(size[0] / 64),
      Math.ceil(size[2] / 4),
    ]);
  }

  compute(pass, chunk) {
    const { bindings, device, pipeline, workgroups } = this;
    if (!chunk.bindings.simulation) {
      chunk.bindings.simulation = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(1),
        entries: [
          {
            binding: 0,
            resource: { buffer: chunk.data },
          },
          ...chunk.neighbors.map(({ data }, i) => ({
            binding: 1 + i,
            resource: { buffer: data },
          })),
          {
            binding: 5,
            resource: { buffer: chunk.position },
          },
        ],
      });
    }
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindings);
    pass.setBindGroup(1, chunk.bindings.simulation);
    pass.dispatchWorkgroups(workgroups[0], workgroups[1]);
  }
}

export default SimulationStep;
