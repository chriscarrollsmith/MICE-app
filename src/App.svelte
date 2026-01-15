<script lang="ts">
  import TimelineSVG from './components/svg/TimelineSVG.svelte';
  import Toolbar from './components/Toolbar.svelte';
</script>

<div class="app">
  <Toolbar />
  <main>
    <div class="content">
      <TimelineSVG />
    </div>
  </main>
</div>

<style>
  .app {
    min-height: 100vh;
    background: #f5f5f5;
  }

  main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem;
  }

  .content {
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }
</style>
