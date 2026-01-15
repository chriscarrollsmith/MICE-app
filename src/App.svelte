<script lang="ts">
  import TimelineSVG from './components/svg/TimelineSVG.svelte';
  import Toolbar from './components/Toolbar.svelte';
</script>

<div class="app">
  <Toolbar />
  <main>
    <section class="mice-legend" data-testid="mice-legend" aria-label="MICE node type legend">
      <h2 class="mice-legend__title" data-testid="mice-legend-title">The Four Elements of MICE</h2>

      <dl class="mice-legend__grid">
        <div class="mice-legend__item" data-testid="mice-legend-item-m">
          <dt class="mice-legend__term">
            <abbr class="mice-legend__abbr" title="Milieu">M</abbr>
            <span class="mice-legend__name">Milieu</span>
          </dt>
          <dd class="mice-legend__desc">
            A story driven by a specific place or world, beginning when a character enters it and ending when they exit; the
            conflict is exploring or escaping that environment (e.g., <em>The Hobbit</em>).
          </dd>
        </div>

        <div class="mice-legend__item" data-testid="mice-legend-item-i">
          <dt class="mice-legend__term">
            <abbr class="mice-legend__abbr" title="Inquiry">I</abbr>
            <span class="mice-legend__name">Inquiry</span>
          </dt>
          <dd class="mice-legend__desc">
            A story centered on a question or mystery, starting with the question and resolving when the answer is found
            (e.g., detective fiction).
          </dd>
        </div>

        <div class="mice-legend__item" data-testid="mice-legend-item-c">
          <dt class="mice-legend__term">
            <abbr class="mice-legend__abbr" title="Character">C</abbr>
            <span class="mice-legend__name">Character</span>
          </dt>
          <dd class="mice-legend__desc">
            A story about a character's internal struggle, identity, or transformation, beginning with a shift in
            self-perception and ending with solidified self-definition (e.g., coming-of-age).
          </dd>
        </div>

        <div class="mice-legend__item" data-testid="mice-legend-item-e">
          <dt class="mice-legend__term">
            <abbr class="mice-legend__abbr" title="Event">E</abbr>
            <span class="mice-legend__name">Event</span>
          </dt>
          <dd class="mice-legend__desc">
            A story driven by external action, focusing on an event that disrupts the status quo and resolving with the
            restoration or replacement of that order (e.g., action/adventure).
          </dd>
        </div>
      </dl>
    </section>

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

  .mice-legend {
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);
    padding: 0.75rem 1rem;
    margin-bottom: 0.75rem;
  }

  .mice-legend__title {
    margin: 0 0 0.5rem 0;
    font-size: 14px;
    font-weight: 650;
    letter-spacing: 0.2px;
    color: #111827;
  }

  .mice-legend__grid {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem 1rem;
  }

  @media (max-width: 720px) {
    .mice-legend__grid {
      grid-template-columns: 1fr;
    }
  }

  .mice-legend__item {
    margin: 0;
  }

  .mice-legend__term {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    margin: 0;
  }

  .mice-legend__abbr {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    font-weight: 700;
    font-size: 12px;
    color: #111827;
    text-decoration: none;
  }

  .mice-legend__name {
    font-weight: 600;
    font-size: 13px;
    color: #111827;
  }

  .mice-legend__desc {
    margin: 0.25rem 0 0 0;
    font-size: 12px;
    color: #374151;
  }

  .content {
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }
</style>
