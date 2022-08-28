const Fragment = `
@group(0) @binding(0) var<uniform> direction : vec2<f32>;
@group(0) @binding(1) var inputTexture : texture_2d<f32>;

@fragment
fn main(@builtin(position) uv : vec4<f32>) -> @location(0) vec4<f32> {
  let off1 : vec2<f32> = vec2<f32>(1.3846153846) * direction;
  let off2 : vec2<f32> = vec2<f32>(3.2307692308) * direction;
  var color : vec3<f32>;
  color += textureLoad(inputTexture, vec2<i32>(uv.xy), 0).xyz * 0.2270270270;
  color += textureLoad(inputTexture, vec2<i32>(uv.xy + off1), 0).xyz * 0.3162162162;
  color += textureLoad(inputTexture, vec2<i32>(uv.xy - off1), 0).xyz * 0.3162162162;
  color += textureLoad(inputTexture, vec2<i32>(uv.xy + off2), 0).xyz * 0.0702702703;
  color += textureLoad(inputTexture, vec2<i32>(uv.xy - off2), 0).xyz * 0.0702702703;
  return vec4<f32>(color, 1);
}
`;

class PostprocessingBlur {
  constructor({ device, geometry, vertex }) {
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
        size: 2 * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.UNIFORM,
      });
      new Float32Array(buffer.getMappedRange()).set(direction);
      buffer.unmap();
      return buffer;
    });
    this.geometry = geometry;
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
  }

  render(command) {
    const { bindings, descriptors, geometry, pipeline } = this;
    for (let i = 0; i < 4; i++) {
      const pass = command.beginRenderPass(descriptors[i]);
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindings[i]);
      pass.setVertexBuffer(0, geometry);
      pass.draw(6, 1, 0, 0);
      pass.end();
    }
  }
  
  updateTextures({ color, size }) {
    const { device, descriptors, directions, pipeline } = this;
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
