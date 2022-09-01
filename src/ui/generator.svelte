<script>
  import Color from './inputs/color.svelte';
  import Number from './inputs/number.svelte';
  import { colors, generator } from './state.js';

  const { compute, reset, seed, waterLevel } = generator;
  const generate = () => {
    $compute = true;
  };
  const wipe = () => {
    $reset = true;
  };
  const randomize = () => {
    colors.background.set(Math.floor(Math.random() * 0xFFFFFF));
    colors.sand.forEach((color) => (
      color.set(Math.floor(Math.random() * 0xFFFFFF))
    ));
    colors.water.set(Math.floor(Math.random() * 0xFFFFFF));
    seed[0].set(Math.floor(Math.random() * 65536));
    seed[1].set(Math.floor(Math.random() * 65536));
    seed[2].set(Math.floor(Math.random() * 65536));
    waterLevel.set(Math.floor(16 + Math.random() * 32));
    generate();
  };
</script>

<div class="generator">
  <div class="inputs">
    <div>
      Seed
      <div class="group">
        <Number state={seed[0]} />
        <Number state={seed[1]} />
        <Number state={seed[2]} />
      </div>
    </div>
    <div>
      Background
      <div>
        <Color state={colors.background} />
      </div>
    </div>
    <div>
      Sand
      <div class="group">
        <Color state={colors.sand[0]} />
        <Color state={colors.sand[1]} />
        <Color state={colors.sand[2]} />
        <Color state={colors.sand[3]} />
      </div>
    </div>
    <div>
      Water
      <div class="group">
        <Color state={colors.water} />
        <Number state={waterLevel} />
      </div>
    </div>
  </div>
  <div class="actions">
    <div class="group">
      <button disabled={$reset} on:click={wipe}>
        Wipe
      </button>
      <button disabled={$compute} on:click={randomize}>
        Randomize
      </button>
    </div>
    <button disabled={$compute} on:click={generate}>
      Generate
    </button>
  </div>
</div>

<style>
  .generator {
    display: flex;
    flex-direction: column;
    padding: 0.5rem 1rem;
  }
  .inputs {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .inputs > div > div {
    margin-top: 0.25rem;
  }
  .group {
    display: flex;
    width: 100%;
    gap: 0.5rem;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    margin: 1rem 0 0.5rem;
    flex-wrap: wrap;
  }
  .actions button {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 0;
    background: #000;
    color: #fff;
    font-family: inherit;
    line-height: inherit;
    text-transform: uppercase;
    cursor: pointer;
    outline: none;
    width: 100%;
    height: 2rem;
    border-radius: 0.25rem;
  }
  .actions button:active {
    transform: translate(0, 1px);
  }
</style>
