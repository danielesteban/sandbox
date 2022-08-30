const Compute = ({ size }) => `
struct Input {
  position : vec3<i32>,
  noise : i32,
  radius : i32,
  value : u32,
}

struct Noise {
  data : array<f32, 256>,
  offset : atomic<u32>,
}

@group(0) @binding(0) var<storage, read> input : Input;
@group(0) @binding(1) var<storage, read_write> noise : Noise;
@group(1) @binding(0) var<storage, read_write> data : array<u32, ${size[0] * size[1] * size[2]}>;
@group(1) @binding(1) var<uniform> chunk : vec2<i32>;

const size : vec3<i32> = vec3<i32>(${size[0]}, ${size[1]}, ${size[2]});

fn getVoxel(pos : vec3<i32>) -> u32 {
  return u32(pos.z * size.x * size.y + pos.y * size.x + pos.x);
}

fn applyNoise(color : u32) -> u32 {
  return clamp(u32(f32(color) + noise.data[atomicAdd(&noise.offset, 1) % 256] * f32(input.noise)), 0, 255);
}

@compute @workgroup_size(3, 3, 3)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
  let offset : vec3<i32> = vec3<i32>(id) - vec3<i32>(input.radius);
  let pos : vec3<i32> = input.position - vec3<i32>(chunk.x, 0, chunk.y) + offset;
  if (
    any(pos < vec3<i32>(0))
    || any(pos >= size)
    || any(offset >= vec3<i32>(input.radius))
    || length(vec3<f32>(offset)) > (f32(input.radius) - 0.5)
  ) {
    return;
  }
  if (input.noise != 0 && input.value != 0) {
    let r : u32 = applyNoise((input.value >> 24) & 0xFF);
    let g : u32 = applyNoise((input.value >> 16) & 0xFF);
    let b : u32 = applyNoise((input.value >> 8) & 0xFF);
    data[getVoxel(pos)] = (r << 24) + (g << 16) + (b << 8) + (input.value & 0xFF);
  } else {
    data[getVoxel(pos)] = input.value;
  }
}
`;

class Update {
  constructor({ chunks, device, size }) {
    this.chunks = chunks;
    this.device = device;
    {
      const data = new Int32Array(6);
      this.input = {
        buffer: device.createBuffer({
          size: data.byteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
        }),
        data,
        position: data.subarray(0, 3),
        noise: data.subarray(3, 4),
        radius: data.subarray(4, 5),
        value: new Uint32Array(data.buffer, 20, 1),
      };
    }
    const noise = device.createBuffer({
      mappedAtCreation: true,
      size: 257 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE,
    });
    const n = new Float32Array(noise.getMappedRange(0, 256 * Float32Array.BYTES_PER_ELEMENT));
    for (let i = 0; i < 256; i++) n[i] = (Math.random() - 0.5) * 2;
    noise.unmap();
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
          resource: { buffer: this.input.buffer },
        },
        {
          binding: 1,
          resource: { buffer: noise },
        },
      ],
    });
  }

  compute(command, position, noise, radius, value) {
    const { bindings, chunks, device, input, pipeline } = this;
    input.position[0] = position[0];
    input.position[1] = position[1];
    input.position[2] = position[2];
    input.noise[0] = noise;
    input.radius[0] = radius;
    input.value[0] = value;
    device.queue.writeBuffer(input.buffer, 0, input.data);
    const pass = command.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindings);
    const workgroups = Math.ceil((radius * 2 + 1) / 3);
    chunks.forEach(({ bindings, data, position }) => {
      if (!bindings.update) {
        bindings.update = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(1),
          entries: [
            {
              binding: 0,
              resource: { buffer: data },
            },
            {
              binding: 1,
              resource: { buffer: position },
            },
          ],
        });
      }
      pass.setBindGroup(1, bindings.update);
      pass.dispatchWorkgroups(workgroups, workgroups, workgroups);
    });
    pass.end();
  }
}

export default Update;
