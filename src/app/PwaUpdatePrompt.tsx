import { RefreshCw, WifiOff, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function PwaUpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!offlineReady && !needRefresh) return null;
  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };
  return <aside className="pwa-notice" role="status">
    {needRefresh ? <RefreshCw size={18} /> : <WifiOff size={18} />}
    <span>{needRefresh ? '新版本已经准备好' : '已可离线打开文字草稿'}</span>
    {needRefresh && <button className="primary-button" onClick={() => void updateServiceWorker(true)}>更新</button>}
    <button className="icon-button" aria-label="关闭更新提示" onClick={close}><X size={17} /></button>
  </aside>;
}
