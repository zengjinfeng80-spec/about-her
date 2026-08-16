import { useState } from 'react';
import { X } from 'lucide-react';
import type { ClaimCategory, MemoryEntry } from '../domain/types';
import { CATEGORY_LABELS } from './components';

export function ManualArchiveSheet({ entry, onSave, onClose }: {
  entry: MemoryEntry;
  onSave: (input: { category: ClaimCategory; statement: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<ClaimCategory | ''>('');
  const [statement, setStatement] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!category) return setMessage('请选择档案分类');
    if (!statement.trim()) return setMessage('请填写档案内容');
    setSubmitting(true);
    setMessage('');
    try {
      await onSave({ category, statement: statement.trim() });
      setCategory('');
      setStatement('');
      setMessage('已加入档案，可以继续添加');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '入档失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="bottom-sheet manual-archive-sheet" role="dialog" aria-modal="true" aria-label="手动入档">
      <button className="icon-button sheet-close" onClick={onClose} aria-label="关闭"><X size={20} /></button>
      <span className="sheet-category">手动整理</span>
      <h2>加入档案</h2>
      <div className="archive-source"><span>原始记录</span><p>{entry.content || '这是一条媒体记录'}</p></div>
      <form className="manual-archive-form" onSubmit={submit}>
        <label><span>档案分类</span><select aria-label="档案分类" value={category} onChange={(event) => setCategory(event.target.value as ClaimCategory | '')}>
          <option value="">请选择分类</option>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label><span>档案内容</span><textarea aria-label="档案内容" value={statement} onChange={(event) => setStatement(event.target.value)} placeholder="例如：喜欢草莓味" /></label>
        {message && <p className="form-message" role="status">{message}</p>}
        <div className="manual-archive-actions">
          <button className="secondary-button" type="button" onClick={onClose}>完成</button>
          <button className="primary-button" type="submit" disabled={submitting}>{submitting ? '正在保存…' : '保存到档案'}</button>
        </div>
      </form>
    </section>
  </div>;
}
