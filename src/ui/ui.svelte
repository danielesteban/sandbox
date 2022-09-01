<script>
  import Brush from './brush.svelte';
  import Generator from './generator.svelte';

  let isEnabled = false;
  const onMouseMove = ({ clientX }) => {
    isEnabled = clientX <= 300;
  };
</script>

<svelte:window on:mousemove={onMouseMove} />

<div class="wrapper" class:enabled={isEnabled}>
  <h4>Brush</h4>
  <Brush />
  <h4>Generator</h4>
  <Generator />
</div>

<style>
  .wrapper {
    position: fixed;
    left: 0;
    top: 50%;
    width: 250px;
    transform: translate(-100%, -50%);
    background: #222;
    box-shadow: 0 0 0.5rem rgba(0, 0, 0, 0.5);
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
    border-radius: 0 0.5rem 0.5rem 0;
    transition: transform ease-in-out 0.15s;
  }
  .enabled {
    transform: translate(0, -50%);
  }
  h4 {
    margin: 0;
    padding: 0.5rem 1rem;
    background: #000;
  }
  h4:first-child {
    border-radius: 0 0.5rem 0 0;
  }
</style>
