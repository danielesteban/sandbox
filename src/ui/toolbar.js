import './toolbar.css';

class Toolbar {
  constructor({ renderer }) {
    this.tool = 0;
    this.dom = document.getElementById('toolbar');
    const tools = document.createElement('div');
    tools.classList.add('tools');
    this.dom.appendChild(tools);
    this.tools = [
      { id: 'sand', color: 0xEEEE66, noise: 20, radius: 8 },
      { id: 'water', color: 0x6699EE, noise: 30, radius: 8 },
      { id: 'void', color: 0x5588AA, radius: 8 }
    ].map(({ id, color, noise, radius }, index) => {
      const tool = document.createElement('button');
      tool.color = color;
      tool.radius = radius;
      if (id === 'void') {
        renderer.setBackground(color);
      }
      const bar = document.createElement('span');
      bar.classList.add('bar');
      tool.appendChild(bar);
      const name = document.createElement('span');
      name.innerText = id;
      tool.appendChild(name);
      const key = document.createElement('span');
      key.innerText = `[${index + 1}]`;
      tool.appendChild(key);
      tool.addEventListener('click', () => this.setTool(index));
      if (color) {
        const input = document.createElement('input');
        input.type = 'color';
        input.value = '#' + ('000000' + color.toString(16)).slice(-6);
        input.addEventListener('input', () => {
          tool.color = parseInt(input.value.slice(1), 16);
          if (id === 'void') {
            renderer.setBackground(tool.color);
          }
        });
        tool.appendChild(input);
      }
      if (noise !== undefined) {
        tool.noise = noise;
      }
      if (index === 0) tool.classList.add('enabled');
      tools.appendChild(tool);
      return tool;
    });
    {
      const div = document.createElement('div');
      div.className = 'sliders';
      this.radius = document.createElement('input');
      this.radius.type = 'range';
      this.radius.min = 1;
      this.radius.max = 16;
      this.radius.value = this.tools[this.tool].radius;
      this.radius.addEventListener('input', () => {
        this.tools[this.tool].radius = parseInt(this.radius.value, 10);
      });
      div.appendChild(this.radius);
      this.noise = document.createElement('input');
      this.noise.type = 'range';
      this.noise.min = 0;
      this.noise.max = 64;
      this.noise.value = this.tools[this.tool].noise;
      this.noise.addEventListener('input', () => {
        this.tools[this.tool].noise = parseInt(this.noise.value, 10);
      });
      div.appendChild(this.noise);
      this.dom.appendChild(div);
    }
    window.addEventListener('keydown', this.onKeyDown.bind(this), false);
    window.addEventListener('mousemove', this.onMouseMove.bind(this), false);
  }

  onKeyDown({ key, repeat, target }) {
    const { tools } = this;
    if (repeat || target.tagName === 'INPUT') {
      return;
    }
    key = parseInt(key, 10);
    if (key >= 1 && key <= tools.length) {
      this.setTool(key - 1);
    }
  }

  onMouseMove({ clientY }) {
    const { dom } = this;
    const isShowing = clientY >= (window.innerHeight - 160);
    if (isShowing !== this.isShowing) {
      this.isShowing = isShowing;
      dom.classList[isShowing ? 'add' : 'remove']('enabled');
    }
  }

  setTool(tool) {
    const { noise, radius, tools } = this;
    tools[this.tool].classList.remove('enabled');
    this.tool = tool;
    tools[this.tool].classList.add('enabled');
    if (tools[this.tool].noise === undefined) {
      noise.disabled = true;
      noise.value = 0;
    } else {
      noise.disabled = false;
      noise.value = tools[this.tool].noise;
    }
    radius.value = tools[this.tool].radius;
  }
}

export default Toolbar;
