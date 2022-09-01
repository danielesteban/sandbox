<script>
  export let state;
  $: value = '#' + ('000000' + $state.toString(16)).slice(-6);
  const update = ({ target: { value } }) => {
    $state = parseInt(value.slice(1), 16);
  };
</script>

<input type="color" on:input={update} value={value} />

<style>
  input {
    box-sizing: border-box;
    display: block;
    width: 100%;
    background: #111;
    border-radius: 0.25rem;
    border: 0;
    outline: 0;
  }
</style>
