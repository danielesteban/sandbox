const Fragment = `
@group(0) @binding(0) var<uniform> direction : vec2<i32>;
@group(0) @binding(1) var inputTexture : texture_2d<f32>;

@fragment
fn main(@builtin(position) uv : vec4<f32>) -> @location(0) vec4<f32> {
  let pixel : vec2<i32> = vec2<i32>(floor(uv.xy));
  var color : vec3<f32>;
  color += textureLoad(inputTexture, pixel, 0).xyz * 0.2270270270;
  color += textureLoad(inputTexture, pixel + direction, 0).xyz * 0.3162162162;
  color += textureLoad(inputTexture, pixel - direction, 0).xyz * 0.3162162162;
  color += textureLoad(inputTexture, pixel + direction * 3, 0).xyz * 0.0702702703;
  color += textureLoad(inputTexture, pixel - direction * 3, 0).xyz * 0.0702702703;
  return vec4<f32>(color, 1);
}
`;

class PostprocessingBlur {
  constructor({ device, size, vertex }) {
    this.device = device;
    this.descriptors = Array.from({ length: 4 }, () => ({
      colorAttachments: [{
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    }));
    this.directions = [[1, 0], [0, 1]].map((direction) => {
      const buffer = device.createBuffer({
        mappedAtCreation: true,
        size: 2 * Int32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.UNIFORM,
      });
      new Int32Array(buffer.getMappedRange()).set(direction);
      buffer.unmap();
      return buffer;
    });
    this.pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex,
      fragment: {
        entryPoint: 'main',
        module: device.createShaderModule({
          code: Fragment,
        }),
        targets: [{ format: 'rgba16float' }],
      },
      primitive: {
        topology: 'triangle-list',
      },
    });
    this.size = size.data;
  }

  render(command) {
    const { bindings, descriptors, pipeline } = this;
    for (let i = 0; i < 4; i++) {
      const pass = command.beginRenderPass(descriptors[i]);
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindings[i]);
      pass.draw(6);
      pass.end();
    }
  }
  
  updateTextures({ color }) {
    const { device, descriptors, directions, pipeline, size } = this;
    if (this.buffer) {
      this.buffer.texture.destroy();
    }
    if (this.output) {
      this.output.texture.destroy();
    }
    const createTexture = () => {
      const texture = device.createTexture({
        format: 'rgba16float',
        size,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      return { texture, view: texture.createView() };
    };
    this.buffer = createTexture();
    this.output = createTexture();
    this.bindings = [
      [color, this.buffer.view],
      [this.buffer.view, this.output.view],
      [this.output.view, this.buffer.view],
      [this.buffer.view, this.output.view],
    ].map(([input, output], i) => {
      descriptors[i].colorAttachments[0].view = output
      return device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: { buffer: directions[i % 2] },
          },
          {
            binding: 1,
            resource: input,
          },
        ],
      });
    });
  }
}

export default PostprocessingBlur;
