const Compute = ({ extents, size }) => `
struct Instance {
  origin : vec3<f32>,
  data : u32,
}

struct Instances {
  vertexCount : u32,
  instanceCount : atomic<u32>,
  firstVertex : u32,
  firstInstance : u32,
  data : array<Instance, ${Math.ceil(size[0] * size[1] * size[2] * 0.5)}>
}

@group(0) @binding(0) var<storage, read> data : array<u32, ${size[0] * size[1] * size[2]}>;
@group(0) @binding(1) var<storage, read> data_east : array<u32>;
@group(0) @binding(2) var<storage, read> data_west : array<u32>;
@group(0) @binding(3) var<storage, read> data_north : array<u32>;
@group(0) @binding(4) var<storage, read> data_south : array<u32>;
@group(0) @binding(5) var<storage, read_write> opaque : Instances;
@group(0) @binding(6) var<storage, read_write> transparent : Instances;
@group(0) @binding(7) var<uniform> chunk : vec2<i32>;

const faceNormals = array<vec3<i32>, 6>(
  vec3<i32>(0, 0, 1),
  vec3<i32>(0, 1, 0),
  vec3<i32>(0, -1, 0),
  vec3<i32>(-1, 0, 0),
  vec3<i32>(1, 0, 0),
  vec3<i32>(0, 0, -1),
);

const extents : vec3<i32> = vec3<i32>(${extents[0]}, ${extents[1]}, ${extents[2]});
const size : vec3<i32> = vec3<i32>(${size[0]}, ${size[1]}, ${size[2]});

fn getVoxel(pos : vec3<i32>) -> u32 {
  return u32(pos.z * size.x * size.y + pos.y * size.x + pos.x);
}

fn getValue(pos : vec3<i32>) -> u32 {
  let wpos : vec3<i32> = vec3<i32>(chunk.x, 0, chunk.y) + pos;
  if (any(wpos < vec3<i32>(0)) || any(wpos >= extents)) {
    if (pos.y < 0) {
      return 1;
    }
    return 0;
  }
  if (pos.x < 0) {
    return data_west[getVoxel(pos + vec3<i32>(size.x, 0, 0))];
  }
  if (pos.x >= size.x) {
    return data_east[getVoxel(pos - vec3<i32>(size.x, 0, 0))];
  }
  if (pos.z < 0) {
    return data_south[getVoxel(pos + vec3<i32>(0, 0, size.z))];
  }
  if (pos.z >= size.z) {
    return data_north[getVoxel(pos - vec3<i32>(0, 0, size.z))];
  }
  return data[getVoxel(pos)];
}

fn isTransparent(value : u32) -> bool {
  return (value & 0xFF) == 2;
}

fn instanceOpaque(data : u32, neighbor : u32, origin : vec3<f32>) {
  if (neighbor == 0 || isTransparent(neighbor)) {
    opaque.data[atomicAdd(&opaque.instanceCount, 1)] = Instance(origin, data);
  }
}

fn instanceTransparent(data : u32, neighbor : u32, origin : vec3<f32>) {
  if (neighbor == 0) {
    transparent.data[atomicAdd(&transparent.instanceCount, 1)] = Instance(origin, data);
  }
}

@compute @workgroup_size(64, 4)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
  let pos : vec3<i32> = vec3<i32>(id);
  if (any(pos >= size)) {
    return;
  }
  let value = getValue(pos);
  if (value == 0) {
    return;
  }
  let color : u32 = value & 0xFFFFFF00;
  let isOpaque : bool = !isTransparent(value);
  let origin : vec3<f32> = vec3<f32>(f32(chunk.x + pos.x) + 0.5, f32(pos.y) + 0.5, f32(chunk.y + pos.z) + 0.5);
  for (var face : u32 = 0; face < 6; face++) {
    let data : u32 = color + face;
    let neighbor : u32 = getValue(pos + faceNormals[face]);
    if (isOpaque) {
      instanceOpaque(data, neighbor, origin);
    } else {
      instanceTransparent(data, neighbor, origin);
    }
  }
}
`;

class Mesher {
  constructor({ chunks, device, extents, size }) {
    this.chunks = chunks;
    this.device = device;
    this.pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: device.createShaderModule({
          code: Compute({ extents, size }),
        }),
        entryPoint: 'main',
      },
    });
    this.workgroups = new Uint32Array([
      Math.ceil(size[0] / 64),
      Math.ceil(size[1] / 4),
      size[2],
    ]);
  }

  compute(command) {
    const { chunks, device, pipeline, workgroups } = this;
    chunks.forEach(({ bindings, data, instances, neighbors, position }) => {
      if (!bindings.mesher) {
        bindings.mesher = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            {
              binding: 0,
              resource: { buffer: data },
            },
            ...neighbors.map(({ data }, i) => ({
              binding: 1 + i,
              resource: { buffer: data },
            })),
            {
              binding: 5,
              resource: { buffer: instances.opaque },
            },
            {
              binding: 6,
              resource: { buffer: instances.transparent },
            },
            {
              binding: 7,
              resource: { buffer: position },
            },
          ],
        });
      }
      command.clearBuffer(instances.opaque, 4, 4);
      command.clearBuffer(instances.transparent, 4, 4);
      const pass = command.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindings.mesher);
      pass.dispatchWorkgroups(workgroups[0], workgroups[1], workgroups[2]);
      pass.end();
    });
  }
}

export default Mesher;
