const Fragment = `
@group(0) @binding(0) var colorTexture : texture_2d<f32>;
@group(0) @binding(1) var dataTexture : texture_2d<f32>;

const edgeColor : vec3<f32> = vec3<f32>(0, 0, 0);
const edgeIntensity : f32 = 0.2;
const depthScale : f32 = 0.3;
const normalScale : f32 = 0.3;
const offset : vec3<i32> = vec3<i32>(1, 1, 0);

fn getEdge(pixel : vec2<i32>) -> f32 {
  let pixelCenter : vec4<f32> = textureLoad(dataTexture, pixel, 0);
  let pixelLeft : vec4<f32> = textureLoad(dataTexture, pixel - offset.xz, 0);
  let pixelRight : vec4<f32> = textureLoad(dataTexture, pixel + offset.xz, 0);
  let pixelUp : vec4<f32> = textureLoad(dataTexture, pixel + offset.zy, 0);
  let pixelDown : vec4<f32> = textureLoad(dataTexture, pixel - offset.zy, 0);
  let edge : vec4<f32> = (
    abs(pixelLeft    - pixelCenter)
    + abs(pixelRight - pixelCenter) 
    + abs(pixelUp    - pixelCenter) 
    + abs(pixelDown  - pixelCenter)
  );
  return clamp(max((edge.x + edge.y + edge.z) * normalScale, edge.w * depthScale), 0, 1);
}

@fragment
fn main(@builtin(position) uv : vec4<f32>) -> @location(0) vec4<f32> {
  let pixel : vec2<i32> = vec2<i32>(floor(uv.xy));
  let color : vec3<f32> = textureLoad(colorTexture, pixel, 0).xyz;
  return vec4<f32>(mix(color, edgeColor, getEdge(pixel) * edgeIntensity), 1);
}
`;

class PostprocessingEdges {
  constructor({ device, geometry, vertex }) {
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
    const { bindings, descriptor, geometry, pipeline } = this;
    const pass = command.beginRenderPass(descriptor);
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindings);
    pass.setVertexBuffer(0, geometry);
    pass.draw(6, 1, 0, 0);
    pass.end();
  }
  
  updateTextures({ color, data, size }) {
    const { device, descriptor, pipeline } = this;
    if (this.output) {
      this.output.texture.destroy();
    }
    const texture = device.createTexture({
      format: 'rgba16float',
      size,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    const view = texture.createView();
    descriptor.colorAttachments[0].view = view;
    this.output = { texture, view };
    this.bindings = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: color,
        },
        {
          binding: 1,
          resource: data,
        },
      ],
    });
  }
}

export default PostprocessingEdges;
