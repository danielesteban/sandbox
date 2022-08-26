const Compute = ({ precision, size }) => `
struct Face {
  origin : vec3<f32>,
  data : u32,
}

struct Faces {
  vertexCount : u32,
  instanceCount : u32,
  firstVertex : u32,
  firstInstance : u32,
  data : array<Face, ${Math.ceil(size[0] * size[1] * size[2] * 0.5)}>
}

struct Query {
  origin : vec3<f32>,
  direction : vec3<f32>,
  distance : atomic<u32>,
  face : u32,
}

@group(0) @binding(0) var<storage, read> faces : Faces;
@group(0) @binding(1) var<storage, read_write> query : Query;

const quad = array<mat3x3<f32>, 2>(
  mat3x3<f32>(vec3<f32>(-0.5, -0.5, 0.5), vec3<f32>(0.5, -0.5, 0.5), vec3<f32>(0.5, 0.5, 0.5)),
  mat3x3<f32>(vec3<f32>(0.5, 0.5, 0.5), vec3<f32>(-0.5, 0.5, 0.5), vec3<f32>(-0.5, -0.5, 0.5)),
);

const rotations = array<mat3x3<f32>, 6>(
  mat3x3<f32>(vec3<f32>(1, 0, 0), vec3<f32>(0, 1, 0), vec3<f32>(0, 0, 1)),
  mat3x3<f32>(vec3<f32>(1, 0, 0), vec3<f32>(0, 0, -1), vec3<f32>(0, 1, 0)),
  mat3x3<f32>(vec3<f32>(1, 0, 0), vec3<f32>(0, 0, 1), vec3<f32>(0, -1, 0)),
  mat3x3<f32>(vec3<f32>(0, 0, 1), vec3<f32>(0, 1, 0), vec3<f32>(-1, 0, 0)),
  mat3x3<f32>(vec3<f32>(0, 0, -1), vec3<f32>(0, 1, 0), vec3<f32>(1, 0, 0)),
  mat3x3<f32>(vec3<f32>(-1, 0, 0), vec3<f32>(0, 1, 0), vec3<f32>(0, 0, -1)),
);

fn intersectTriangle(a : vec3<f32>, b : vec3<f32>, c : vec3<f32>) -> f32 {
  let edge1 = b - a;
  let edge2 = c - a;
  let normal = cross(edge1, edge2);
  let DdN = -dot(query.direction, normal);
  if (DdN <= 0) {
    return 0;
  }
  let diff = query.origin - a;
  let DdQxE2 = -dot(query.direction, cross(diff, edge2));
  if (DdQxE2 < 0) {
    return 0;
  }
  let DdE1xQ = -dot(query.direction, cross(edge1, diff));
  if (DdE1xQ < 0 || (DdQxE2 + DdE1xQ) > DdN) {
    return 0;
  }
  let QdN = dot(diff, normal);
  if (QdN < 0) {
    return 0;
  }
  return QdN / DdN;
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
  let pos : vec3<i32> = vec3<i32>(id);
  if (id.x >= faces.instanceCount) {
    return;
  }
  let instance : Face = faces.data[id.x];
  let face : u32 = instance.data & 0xFF;
  let rotation : mat3x3<f32> = rotations[face];
  let position : vec3<f32> = instance.origin;
  for (var i : i32 = 0; i < 2; i++) {
    let d = intersectTriangle(
      rotation * quad[i][0] + position,
      rotation * quad[i][1] + position,
      rotation * quad[i][2] + position
    );
    if (d != 0) {
      let distance = u32(round(d * ${precision}));
      if (atomicMin(&query.distance, distance) > distance) {
        query.face = face;
      }
    }
  }
}
`;

class RaycasterCompute {
  constructor({ device, faces, precision, query, size, workgroups }) {
    this.pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: {
        entryPoint: 'main',
        module: device.createShaderModule({
          code: Compute({ precision, size }),
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
      ],
    });
    this.workgroups = workgroups;
  }

  compute(pass) {
    const { bindings, pipeline, workgroups } = this;
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindings);
    pass.dispatchWorkgroupsIndirect(workgroups, 0);
  }
}

export default RaycasterCompute;
