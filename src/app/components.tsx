import { useState, type ReactNode } from 'react';
import { Check, ChevronRight, Clock3, FileText, Image, Mic, Plus, Trash2, X } from 'lucide-react';
import type { MemoryClaim, MemoryEntry } from '../domain/types';

export const CATEGORY_LABELS = {
  like: '喜欢',
  dislike: '不喜欢',
  quote: '她说过的话',
  important: '重要的人与事',
  boundary: '习惯与边界',
  wish: '愿望',
} as const;

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return <header className="page-header"><h1>{title}</h1>{action}</header>;
}

export function ClaimRow({ claim, onOpen }: { claim: MemoryClaim; onOpen?: () => void }) {
  return (
    <button className="claim-row" onClick={onOpen} type="button">
      <span className={`claim-marker ${claim.category}`} aria-hidden="true" />
      <span className="claim-copy">
        <strong>{claim.statement}</strong>
        <small>{claim.lifecycle === 'superseded' ? '历史版本 · 已有更新' : claim.reviewStatus === 'confirmed' ? '已确认' : claim.evidenceLevel === 'explicit' ? 'AI 从记录中提取' : '推测 · 等待确认'}</small>
      </span>
      <ChevronRight size={17} aria-hidden="true" />
    </button>
  );
}

export function EntryRow({ entry, onArchive, onDelete }: { entry: MemoryEntry; onArchive?: () => void; onDelete?: () => Promise<void> }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [message, setMessage] = useState('');
  return (
    <article className="entry-row">
      <div className="entry-time"><Clock3 size={14} /><time>{new Date(entry.happenedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time></div>
      {entry.content && <p>{entry.content}</p>}
      {entry.attachments.length > 0 && <div className="attachment-summary">
        {entry.attachments.some((item) => item.kind === 'image') && <span><Image size={14} />图片</span>}
        {entry.attachments.some((item) => item.kind === 'audio') && <span><Mic size={14} />语音</span>}
      </div>}
      {entry.attachments.length > 0 && <div className="entry-media">
        {entry.attachments.map((attachment) => attachment.kind === 'image' && attachment.url
          ? <img key={attachment.id} src={attachment.url} alt={attachment.name} />
          : attachment.kind === 'audio' && attachment.url
            ? <div className="audio-attachment" key={attachment.id}><audio controls preload="metadata" src={attachment.url} />{attachment.transcript && <p>{attachment.transcript}</p>}</div>
            : null)}
      </div>}
      {(onArchive || onDelete) && <div className="entry-footer">
        {onArchive && <button className="entry-action" aria-label="加入档案" onClick={onArchive}><Plus size={14} />加入档案</button>}
        {onDelete && <button className="entry-action danger" aria-label="删除这条记录" onClick={() => setConfirmingDelete(true)}><Trash2 size={14} />删除</button>}
      </div>}
      {confirmingDelete && <div className="entry-delete-confirm"><span>删除后，依赖这条记录的档案结论也会失效。</span><button className="secondary-button" onClick={() => setConfirmingDelete(false)}>取消</button><button className="danger-button" aria-label="确认删除记录" onClick={() => void onDelete?.().catch((error: unknown) => setMessage(error instanceof Error ? error.message : '删除失败'))}>确认删除</button></div>}
      {message && <small className="entry-message" role="status">{message}</small>}
    </article>
  );
}

export function EvidenceSheet({ claim, entries, onClose }: { claim: MemoryClaim; entries: MemoryEntry[]; onClose: () => void }) {
  const evidenceEntries = claim.evidence.map((evidence) => entries.find((entry) => entry.id === evidence.entryId)).filter(Boolean) as MemoryEntry[];
  return <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="bottom-sheet" role="dialog" aria-modal="true" aria-label="结论依据">
      <button className="icon-button sheet-close" onClick={onClose} aria-label="关闭"><X size={20} /></button>
      <span className="sheet-category">{CATEGORY_LABELS[claim.category]}</span>
      <h2>{claim.statement}</h2>
      <div className="evidence-status"><Check size={15} />{claim.reviewStatus === 'confirmed' ? '你已确认' : claim.evidenceLevel === 'explicit' ? '来自明确表达' : '这是一条待确认推测'}</div>
      <h3>依据</h3>
      {evidenceEntries.length ? evidenceEntries.map((entry) => <EntryRow entry={entry} key={entry.id} />) : <p className="empty-copy">原始依据已不存在</p>}
    </section>
  </div>;
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon ?? <FileText />}</div><h2>{title}</h2><p>{children}</p></div>;
}
