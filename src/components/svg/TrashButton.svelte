<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let x: number;
  export let y: number;
  export let size: number = 16;

  const dispatch = createEventDispatcher<{ click: void }>();
</script>

<g
  class="trash-button"
  transform="translate({x}, {y})"
  on:click|stopPropagation={() => dispatch('click')}
  on:keydown={(e) => e.key === 'Enter' && dispatch('click')}
  role="button"
  tabindex="0"
>
  <rect
    x={-size / 2}
    y={-size / 2}
    width={size}
    height={size}
    fill="white"
    stroke="#e5e7eb"
    rx="3"
  />
  <path
    d="M{-size * 0.25},{-size * 0.25} L{size * 0.25},{size * 0.25} M{-size * 0.25},{size * 0.25} L{size * 0.25},{-size * 0.25}"
    stroke="#ef4444"
    stroke-width="2"
    stroke-linecap="round"
  />
</g>

<style>
  .trash-button {
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 150ms ease;
  }

  .trash-button:hover {
    opacity: 1;
  }
</style>
