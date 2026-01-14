import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { initDatabase } from './lib/db';
import { loadFromDb } from './stores/story';

async function bootstrap() {
  await initDatabase();
  loadFromDb();

  const app = mount(App, {
    target: document.getElementById('app')!,
  });

  return app;
}

bootstrap().catch(console.error);
