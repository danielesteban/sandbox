const Fragment = `
@group(0) @binding(0) var<uniform> size : vec2<f32>;
@group(0) @binding(1) var noiseTexture : texture_2d<f32>;
@group(1) @binding(0) var blurTexture : texture_2d<f32>;
@group(1) @binding(1) var colorTexture : texture_2d<f32>;
@group(1) @binding(2) var dataTexture : texture_2d<f32>;

const blurDensity : f32 = 0.003;

fn linearTosRGB(linear : vec3<f32>) -> vec3<f32> {
  if (all(linear <= vec3<f32>(0.0031308))) {
    return linear * 12.92;
  }
  return (pow(abs(linear), vec3<f32>(1.0/2.4)) * 1.055) - vec3<f32>(0.055);
}

@fragment
fn main(@builtin(position) uv : vec4<f32>) -> @location(0) vec4<f32> {
  let pixel : vec2<i32> = vec2<i32>(floor(uv.xy));
  let noise : f32 = textureLoad(noiseTexture, (pixel / 2) % vec2<i32>(256), 0).x;
  let blur : vec3<f32> = textureLoad(blurTexture, pixel, 0).xyz;
  let color : vec3<f32> = textureLoad(colorTexture, pixel, 0).xyz;
  let depth : f32 = textureLoad(dataTexture, pixel, 0).w;
  let dist : f32 = distance(uv.xy / size, vec2<f32>(0.5));
  let vignette : f32 = 0.6 + smoothstep(-0.1, 0.1, 0.6 - dist) * 0.4;
  let blurVignette : f32 = 1 - smoothstep(-0.2, 0.2, 0.4 - dist) * 0.6;
  let blurIntensity : f32 = (1 - exp(-blurDensity * blurDensity * depth * depth)) * blurVignette;
  let out : vec3<f32> = mix(color, blur, blurIntensity);
  return vec4<f32>(linearTosRGB(out * vignette + mix(-0.003, 0.003, noise)), 1);
}
`;

const Noise = ({ device }) => {
  const texture = device.createTexture({
    format: 'r32float',
    size: [256, 256],
    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
  });
  const data = new Float32Array(256 * 256);
  for (let i = 0; i < (256 * 256); i++) data[i] = Math.random();
  device.queue.writeTexture({ texture }, data, { bytesPerRow: 256 * Float32Array.BYTES_PER_ELEMENT }, [256, 256]);
  return texture.createView();
};

class PostprocessingComposite {
  constructor({ device, format, size, vertex }) {
    this.device = device;
    this.descriptor = {
      colorAttachments: [{
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    };
    this.pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex,
      fragment: {
        entryPoint: 'main',
        module: device.createShaderModule({
          code: Fragment,
        }),
        targets: [{ format }],
      },
      primitive: {
        topology: 'triangle-list',
      },
    });
    this.uniforms = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: size.buffer },
        },
        {
          binding: 1,
          resource: Noise({ device }),
        },
      ],
    });
  }

  render(command, output) {
    const { descriptor, pipeline, textures, uniforms } = this;
    descriptor.colorAttachments[0].view = output;
    const pass = command.beginRenderPass(descriptor);
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, uniforms);
    pass.setBindGroup(1, textures);
    pass.draw(6);
    pass.end();
  }

  updateTextures({ blur, color, data }) {
    const { device, pipeline } = this;
    this.textures = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(1),
      entries: [
        {
          binding: 0,
          resource: blur,
        },
        {
          binding: 1,
          resource: color,
        },
        {
          binding: 2,
          resource: data,
        },
      ],
    });
  }
}

export default PostprocessingComposite;
