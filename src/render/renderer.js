import Postprocessing from './postprocessing/postprocessing.js';

class Renderer {
  constructor({
    adapter,
    camera,
    device,
    samples = 4,
  }) {
    this.camera = camera;
    this.device = device;
    this.samples = samples;
    const format = navigator.gpu.getPreferredCanvasFormat(adapter);
    this.canvas = document.createElement('canvas');
    {
      // I have no idea why but if I don't do this, sometimes it crashes with:
      // D3D12 reset command allocator failed with E_FAIL
      this.canvas.width = Math.floor(window.innerWidth * (window.devicePixelRatio || 1));
      this.canvas.height = Math.floor(window.innerHeight * (window.devicePixelRatio || 1));
    }
    this.context = this.canvas.getContext('webgpu');
    this.context.configure({ alphaMode: 'opaque', device, format });
    this.background = {
      buffer: device.createBuffer({
        size: 3 * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
      }),
      data: new Float32Array(3),
    };
    this.descriptor = {
      colorAttachments: [
        {
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
        {
          clearValue: { r: 0, g: 0, b: 0, a: -camera.far },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        depthClearValue: 1,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    };
    this.postprocessing = new Postprocessing({ device, format });
    this.scene = [];
    this.size = new Uint32Array(2);
    this.textures = new Map();
  }

  render(command) {
    const {
      context,
      descriptor,
      postprocessing,
      scene,
    } = this;
    const pass = command.beginRenderPass(descriptor);
    scene.forEach((object) => object.render(pass));
    pass.end();
    postprocessing.render(command, context.getCurrentTexture().createView());
  }

  setBackground(color) {
    const { background, descriptor : { colorAttachments: [{ clearValue }] }, device } = this;
    const sRGBToLinear = (c) => (c < 0.04045) ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
    background.data[0] = clearValue.r = sRGBToLinear(((color >> 16) & 0xFF) / 0xFF);
    background.data[1] = clearValue.g = sRGBToLinear(((color >> 8) & 0xFF) / 0xFF);
    background.data[2] = clearValue.b = sRGBToLinear((color & 0xFF) / 0xFF);
    device.queue.writeBuffer(background.buffer, 0, background.data);
  }

  setSize(width, height) {
    const {
      camera,
      canvas,
      descriptor,
      postprocessing,
      size,
    } = this;
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = size[0] = Math.floor(width * pixelRatio);
    canvas.height = size[1] = Math.floor(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    camera.aspect = width / height;
    camera.updateProjection();

    this.updateTexture(descriptor.colorAttachments[0], 'rgba16float', 'color', size);
    this.updateTexture(descriptor.colorAttachments[1], 'rgba16float', 'data', size);
    this.updateTexture(descriptor.depthStencilAttachment, 'depth24plus', 'depth', size, false);
    postprocessing.updateTextures({
      color: descriptor.colorAttachments[0].resolveTarget,
      data: descriptor.colorAttachments[1].resolveTarget,
      size,
    });
  }

  updateTexture(object, format, key, size, resolve = true) {
    const { device, samples, textures } = this;
    const current = textures.get(key);
    if (current) {
      current.forEach((texture) => texture.destroy());
    }
    textures.set(key, [samples, ...(resolve ? [1] : [])].map((sampleCount) => {
      const texture = device.createTexture({
        format,
        sampleCount,
        size,
        usage: (
          GPUTextureUsage.RENDER_ATTACHMENT
          | (sampleCount === 1 ? GPUTextureUsage.TEXTURE_BINDING : 0)
        ),
      });
      if (sampleCount === 1) {
        object.resolveTarget = texture.createView();
      } else {
        object.view = texture.createView();
      }
      return texture;
    }));
  }
}

export default Renderer;
