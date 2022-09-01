import SimplexNoise from './noise.js';

const Compute = ({ size }) => `
struct Uniforms {
  colors : vec4<u32>,
  seed : vec3<i32>,
  waterColor : u32,
  waterLevel : u32,
}

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(1) @binding(0) var<storage, read_write> data : array<u32, ${size[0] * size[1] * size[2]}>;
@group(1) @binding(1) var<uniform> chunk : vec2<i32>;

const size : vec3<i32> = vec3<i32>(${size[0]}, ${size[1]}, ${size[2]});

fn getColor(c : u32) -> vec3<f32> {
  return vec3<f32>(
    f32((c >> 16) & 0xFF),
    f32((c >> 8) & 0xFF),
    f32(c & 0xFF),
  );
}

fn getVoxel(pos : vec3<i32>) -> u32 {
  return u32(pos.z * size.x * size.y + pos.y * size.x + pos.x);
}

fn getValue(color : vec3<f32>, noise : f32, value : u32) -> u32 {
  return (
    (u32(clamp(color.x - noise, 0, 0xFF)) << 24)
    + (u32(clamp(color.y - noise, 0, 0xFF)) << 16)
    + (u32(clamp(color.z - noise, 0, 0xFF)) << 8)
    + value
  );
}

${SimplexNoise}

fn FBM(p : vec3<f32>) -> f32 {
  var value : f32;
  var amplitude : f32 = 0.5;
  var q : vec3<f32> = p;
  for (var i : i32 = 0; i < 3; i++) {
    value += SimplexNoise(q) * amplitude;
    q *= 2;
    amplitude *= 0.5;
  }
  return value;
}

@compute @workgroup_size(64, 4)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
  let pos : vec3<i32> = vec3<i32>(id);
  if (any(pos >= size)) {
    return;
  }
  let wpos : vec3<f32> = vec3<f32>(vec3<i32>(chunk.x, 0, chunk.y) + uniforms.seed + pos);
  var value : u32 = 0;
  if (pos.y == 0 || f32(pos.y) <= abs(FBM(wpos * 0.005) + 0.3) * f32(size.y) * 1.2) {
    let c : f32 = (f32(pos.y) / f32(size.y + 1)) * 4;
    let color : vec3<f32> = mix(getColor(uniforms.colors[u32(floor(c))]), getColor(uniforms.colors[u32(floor(c) + 1)]), fract(c));
    value = getValue(color, abs(SimplexNoise(wpos * 0.1)) * 48, 1);
  } else if (f32(pos.y) < f32(uniforms.waterLevel)) {
    value = getValue(getColor(uniforms.waterColor), abs(SimplexNoise(wpos * 0.1)) * 32, 2);
  }
  data[getVoxel(pos)] = value;
}
`;

class Generator {
  constructor({ chunks, device, size }) {
    this.chunks = chunks;
    this.device = device;
    {
      const data = new Uint32Array(9);
      this.uniforms = {
        buffer: device.createBuffer({
          size: 9 * Uint32Array.BYTES_PER_ELEMENT,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        }),
        data,
        colors: data.subarray(0, 4),
        seed: new Int32Array(data.buffer, 4 * 4, 3),
        waterColor: data.subarray(7, 8),
        waterLevel: data.subarray(8, 9),
      };
    }
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
          resource: { buffer: this.uniforms.buffer },
        },
      ],
    });
    this.workgroups = new Uint32Array([
      Math.ceil(size[0] / 64),
      Math.ceil(size[1] / 4),
      size[2],
    ]);
  }

  compute(command, colors, seed, waterColor, waterLevel) {
    const { bindings, chunks, device, pipeline, uniforms, workgroups } = this;
    for (let i = 0; i < 6; i++) {
      uniforms.colors[i] = colors[i];
    }
    uniforms.seed[0] = seed[0];
    uniforms.seed[1] = seed[1];
    uniforms.seed[2] = seed[2];
    uniforms.waterColor[0] = waterColor;
    uniforms.waterLevel[0] = waterLevel;
    device.queue.writeBuffer(uniforms.buffer, 0, uniforms.data);
    const pass = command.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindings);
    chunks.forEach((chunk) => {
      if (!chunk.bindings.generator) {
        chunk.bindings.generator = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(1),
          entries: [
            {
              binding: 0,
              resource: { buffer: chunk.data },
            },
            {
              binding: 1,
              resource: { buffer: chunk.position },
            },
          ],
        });
      }
      pass.setBindGroup(1, chunk.bindings.generator);
      pass.dispatchWorkgroups(workgroups[0], workgroups[1], workgroups[2]);
    });
    pass.end();
  }
}

export default Generator;
