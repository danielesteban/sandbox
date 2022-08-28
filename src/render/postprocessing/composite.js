const Vertex = `
struct VertexInput {
  @location(0) position : vec2<f32>,
  @location(1) uv : vec2<f32>,
}

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) uv : vec2<f32>,
}

@vertex
fn main(vertex : VertexInput) -> VertexOutput {
  var out : VertexOutput;
  out.position = vec4<f32>(vertex.position, 1, 1);
  out.uv = vertex.uv;
  return out;
}
`;

const Fragment = `
struct FragmentInput {
  @builtin(position) position : vec4<f32>,
  @location(0) uv : vec2<f32>,
}

@group(0) @binding(0) var blurTexture : texture_2d<f32>;
@group(0) @binding(1) var colorTexture : texture_2d<f32>;
@group(0) @binding(2) var dataTexture : texture_2d<f32>;

const blurDensity : f32 = 0.006;

fn linearTosRGB(linear : vec3<f32>) -> vec3<f32> {
  if (all(linear <= vec3<f32>(0.0031308))) {
    return linear * 12.92;
  }
  return (pow(abs(linear), vec3<f32>(1.0/2.4)) * 1.055) - vec3<f32>(0.055);
}

@fragment
fn main(fragment : FragmentInput) -> @location(0) vec4<f32> {
  let pixel : vec2<i32> = vec2<i32>(floor(fragment.position.xy));
  let blur : vec3<f32> = textureLoad(blurTexture, pixel, 0).xyz;
  let color : vec3<f32> = textureLoad(colorTexture, pixel, 0).xyz;
  let depth : f32 = textureLoad(dataTexture, pixel, 0).w;
  let dist : f32 = distance(fragment.uv, vec2<f32>(0.5));
  let vignette : f32 = 0.6 + smoothstep(-0.1, 0.1, 0.6 - dist) * 0.4;
  let blurVignette : f32 = 1 - smoothstep(-0.2, 0.2, 0.4 - dist) * 0.6;
  let blurIntensity : f32 = (1 - exp(-blurDensity * blurDensity * depth * depth)) * blurVignette;
  return vec4<f32>(linearTosRGB(mix(color, blur, blurIntensity) * vignette), 1);
}
`;

class PostprocessingComposite {
  constructor({ device, geometry, format }) {
    this.device = device;
    this.descriptor = {
      colorAttachments: [{
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    };
    this.geometry = geometry;
    this.pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        buffers: [
          {
            arrayStride: 4 * Float32Array.BYTES_PER_ELEMENT,
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: 'float32x2',
              },
              {
                shaderLocation: 1,
                offset: 2 * Float32Array.BYTES_PER_ELEMENT,
                format: 'float32x2',
              },
            ],
          },
        ],
        entryPoint: 'main',
        module: device.createShaderModule({
          code: Vertex,
        }),
      },
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
  }

  render(command, output) {
    const { bindings, descriptor, geometry, pipeline } = this;
    descriptor.colorAttachments[0].view = output;
    const pass = command.beginRenderPass(descriptor);
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindings);
    pass.setVertexBuffer(0, geometry);
    pass.draw(6, 1, 0, 0);
    pass.end();
  }

  updateTextures({ blur, color, data }) {
    const { device, pipeline } = this;
    this.bindings = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
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
