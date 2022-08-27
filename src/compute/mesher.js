const Compute = ({ size }) => `
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
@group(0) @binding(1) var<storage, read_write> opaque : Instances;
@group(0) @binding(2) var<storage, read_write> transparent : Instances;

const faceNormals = array<vec3<i32>, 6>(
  vec3<i32>(0, 0, 1),
  vec3<i32>(0, 1, 0),
  vec3<i32>(0, -1, 0),
  vec3<i32>(-1, 0, 0),
  vec3<i32>(1, 0, 0),
  vec3<i32>(0, 0, -1),
);

const size : vec3<i32> = vec3<i32>(${size[0]}, ${size[1]}, ${size[2]});

fn getVoxel(pos : vec3<i32>) -> u32 {
  return u32(pos.z * size.x * size.y + pos.y * size.x + pos.x);
}

fn getValue(pos : vec3<i32>) -> u32 {
  if (pos.y < 0) {
    return 1;
  }
  if (any(pos < vec3<i32>(0)) || any(pos >= size)) {
    return 0;
  }
  return data[getVoxel(pos)];
}

fn isTransparent(value : u32) -> bool {
  return (value & 0xFF) == 2;
}

fn instanceOpaque(neighbor : u32, origin : vec3<f32>, value : u32) {
  if (neighbor == 0 || isTransparent(neighbor)) {
    opaque.data[atomicAdd(&opaque.instanceCount, 1)] = Instance(
      origin,
      value
    );
  }
}

fn instanceTransparent(neighbor : u32, origin : vec3<f32>, value : u32) {
  if (neighbor == 0) {
    transparent.data[atomicAdd(&transparent.instanceCount, 1)] = Instance(
      origin,
      value
    );
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
  let origin : vec3<f32> = vec3<f32>(f32(pos.x) + 0.5, f32(pos.y) + 0.5, f32(pos.z) + 0.5);
  for (var face : u32 = 0; face < 6; face++) {
    let neighbor : u32 = getValue(pos + faceNormals[face]);
    if (isOpaque) {
      instanceOpaque(neighbor, origin, color + face);
    } else {
      instanceTransparent(neighbor, origin, color + face);
    }
  }
}
`;

class Mesher {
  constructor({ data, device, instances, size }) {
    this.instances = instances;
    this.pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: device.createShaderModule({
          code: Compute({ size }),
        }),
        entryPoint: 'main',
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
          resource: { buffer: instances.opaque },
        },
        {
          binding: 2,
          resource: { buffer: instances.transparent },
        },
      ],
    });
    this.workgroups = new Uint32Array([
      Math.ceil(size[0] / 64),
      Math.ceil(size[1] / 4),
      size[2],
    ]);
  }

  compute(command) {
    const { bindings, instances, pipeline, workgroups } = this;
    command.clearBuffer(instances.opaque, 4, 4);
    command.clearBuffer(instances.transparent, 4, 4);
    const pass = command.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindings);
    pass.dispatchWorkgroups(workgroups[0], workgroups[1], workgroups[2]);
    pass.end();
  }
}

export default Mesher;
