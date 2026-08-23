import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { AppErrorBoundary } from './app/AppErrorBoundary';
import { lazyWithTimeout } from './app/lazyWithTimeout';
import { PwaUpdatePrompt } from './app/PwaUpdatePrompt';
import { readCloudConfig } from './cloud/config';
import { DEMO_SNAPSHOT, EMPTY_SNAPSHOT } from './data/demo';
import './styles.css';

const demo = new URLSearchParams(window.location.search).get('demo') === '1';
const cloudConfig = readCloudConfig(import.meta.env);
const CloudApp = lazy(() => lazyWithTimeout(
  () => import('./cloud/CloudApp').then((module) => ({ default: module.CloudApp })),
  15000,
  '页面模块加载超时，请重新加载。',
));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      {demo || !cloudConfig
        ? <App initialSnapshot={demo ? DEMO_SNAPSHOT : EMPTY_SNAPSHOT} persist={!demo} />
        : <Suspense fallback={<main className="status-screen"><p>正在打开私人档案…</p></main>}><CloudApp config={cloudConfig} /></Suspense>}
    </AppErrorBoundary>
    <PwaUpdatePrompt />
  </StrictMode>,
);
