<script>
  import Range from './inputs/range.svelte';
  import { brush } from './state.js';
  const { atom, noise, radius } = brush;

  const atoms = ['sand', 'water', 'void'];
  const setAtom = (id) => () => {
    $atom = id;
  };

  const onKeyDown = ({ key, repeat, target }) => {
    if (repeat || target.tagName === 'INPUT') {
      return;
    }
    key = parseInt(key, 10);
    if (key >= 1 && key <= atoms.length) {
      $atom = atoms[key - 1];
    }
  };
</script>

<svelte:window on:keydown={onKeyDown} />

<div class="atoms">
  {#each atoms as id, i}
    <button class="atom" class:enabled={$atom === id} on:click={setAtom(id)}>
      <span>{id}</span>
      <span>[{i + 1}]</span>
      <span class="bar" />
    </button>
  {/each}
</div>
<div class="inputs">
  <Range state={radius} min={1} max={24} />
  <Range state={noise} min={0} max={128} />
</div>

<style>
  .atoms, .inputs {
    display: flex;
    padding: 0.5rem 1rem;
  }
  .atom {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 0;
    background: #111;
    color: #fff;
    font-family: inherit;
    line-height: inherit;
    text-transform: uppercase;
    cursor: pointer;
    outline: none;
    padding: 0.25rem;
    gap: 0.25rem;
  }
  .atom:first-child {
    border-radius: 0.25rem 0 0 0.25rem;
  }
  .atom:last-child {
    border-radius: 0 0.25rem 0.25rem 0;
  }
  .atom.enabled {
    cursor: default;
  }
  .bar {
    width: 100%;
    height: 0.25rem;
    margin-top: 0.25rem;
    border-radius: 0.25rem;
  }
  .atom.enabled > .bar {
    background: #fff;
  }
</style>
