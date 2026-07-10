import { lazy, Suspense } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';

const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const SoloGame = lazy(() => import('./pages/SoloGame').then(m => ({ default: m.SoloGame })));
const MultiGame = lazy(() => import('./pages/MultiGame').then(m => ({ default: m.MultiGame })));
const DiscussGame = lazy(() => import('./pages/DiscussGame').then(m => ({ default: m.DiscussGame })));
const Result = lazy(() => import('./pages/Result').then(m => ({ default: m.Result })));
const Submit = lazy(() => import('./pages/Submit').then(m => ({ default: m.Submit })));
const Admin = lazy(() => import('./pages/Admin').then(m => ({ default: m.Admin })));
const Editor = lazy(() => import('./pages/Editor').then(m => ({ default: m.Editor })));
const NotFound = lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })));

function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-white/40 animate-pulse text-sm">加载中…</div>
    </div>
  );
}

function Nav() {
  const { pathname } = useLocation();
  if (pathname === '/') return null;
  return (
    <header className="sticky top-0 z-40 glass border-x-0 border-t-0 rounded-none px-4 py-3 flex items-center justify-between">
      <Link to="/" className="font-display font-bold text-lg neon-text">
        海龟汤 · AI
      </Link>
      <nav className="flex gap-3 text-sm text-white/70">
        <Link to="/solo" className="hover:text-white">
          单人
        </Link>
        <Link to="/multi" className="hover:text-white">
          竞速
        </Link>
        <Link to="/discuss" className="hover:text-white">
          推理
        </Link>
        <Link to="/submit" className="hover:text-white">
          投稿
        </Link>
        <Link to="/admin" className="hover:text-white">
          审核台
        </Link>
      </nav>
    </header>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-ink-gradient">
      <Nav />
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/solo" element={<SoloGame />} />
            <Route path="/multi" element={<MultiGame />} />
            <Route path="/discuss" element={<DiscussGame />} />
            <Route path="/result" element={<Result />} />
            <Route path="/submit" element={<Submit />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/editor" element={<Editor />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
