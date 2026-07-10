import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <div className="text-6xl mb-4 opacity-30">404</div>
      <h1 className="text-xl font-display font-bold text-white/80 mb-2">
        这碗汤还没熬好
      </h1>
      <p className="text-white/50 text-sm mb-6">
        你访问的页面不存在，可能已被移除或地址输入有误。
      </p>
      <Link to="/" className="btn-neon inline-block">
        返回首页
      </Link>
    </div>
  );
}
