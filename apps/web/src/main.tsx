import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import './experience.css';
import './device.css';
import { initializeRuntime } from './runtime';
const root = createRoot(document.getElementById('root')!);
void initializeRuntime()
  .then(() =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )
  .catch((error) =>
    root.render(
      <main className="app-settings">
        <h1>Your workspace could not open.</h1>
        <p role="alert">
          {error instanceof Error
            ? error.message
            : 'Device initialization failed.'}
        </p>
        <p>
          Your saved data has not been reset. Close other app windows, check
          available storage and reopen.
        </p>
        <button onClick={() => window.location.reload()}>Try again</button>
      </main>,
    ),
  );
