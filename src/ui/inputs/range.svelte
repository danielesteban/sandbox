<script>
  export let max;
  export let min;
  export let state;
  const update = ({ target: { value } }) => {
    $state = parseInt(value, 10);
  };
</script>

<input type="range" min={min} max={max} on:input={update} value={$state} />

<style>
  input {
    box-sizing: border-box;
    display: block;
    width: 100%;
    accent-color: #111;
    border: 0;
    outline: 0;
  }
</style>
