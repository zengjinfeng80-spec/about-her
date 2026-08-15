import { useEffect, useMemo, useState } from 'react';
import { Archive, BookHeart, Download, FileJson, FileText, Heart, Home, MessageCircleQuestion, Plus, Search, Settings, Sparkles, Trash2 } from 'lucide-react';
import { groupClaims } from '../domain/claims';
import { buildJsonExport, buildMarkdownExport } from '../domain/export';
import { readAudioDuration, validateAudioDuration, validateMediaSelection } from '../domain/media';
import type { MemoryClaim, MemoryEntry, MemorySnapshot } from '../domain/types';
import type { MemoryAnswer, MemoryService } from '../cloud/service';
import { EMPTY_SNAPSHOT } from '../data/demo';
import { listDrafts, removeDraft, saveDraft, type StoredDraft } from '../storage/drafts';
import { AudioRecorder } from './AudioRecorder';
import { CATEGORY_LABELS, ClaimRow, EmptyState, EntryRow, EvidenceSheet, PageHeader } from './components';
import { useMemoryState } from './useMemoryState';

type View = 'profile' | 'capture' | 'timeline' | 'ask' | 'settings' | 'review';

interface AppProps {
  initialSnapshot?: MemorySnapshot;
  persist?: boolean;
  service?: MemoryService;
  accountEmail?: string;
  onSignOut?: () => Promise<void>;
}

function downloadText(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function App({ initialSnapshot = EMPTY_SNAPSHOT, persist = true, service, accountEmail, onSignOut }: AppProps) {
  const [snapshot, setSnapshot] = useMemoryState(initialSnapshot, persist);
  const [view, setView] = useState<View>('profile');
  const [selectedClaim, setSelectedClaim] = useState<MemoryClaim | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const grouped = useMemo(() => groupClaims(snapshot.claims), [snapshot.claims]);

  const updateClaim = async (id: string, updates: Partial<MemoryClaim>) => {
    if (service && updates.reviewStatus) await service.updateClaim(id, updates.reviewStatus);
    setSnapshot((current) => ({ ...current, claims: current.claims.map((claim) => claim.id === id ? { ...claim, ...updates } : claim) }));
  };

  const deleteEntry = async (id: string) => {
    if (service) await service.deleteEntry(id);
    setSnapshot((current) => ({
      ...current,
      entries: current.entries.filter((entry) => entry.id !== id),
      claims: current.claims.filter((claim) => !claim.evidence.some((evidence) => evidence.entryId === id)),
    }));
  };

  return <div className="app-shell">
    <main className="app-main">
      {view === 'profile' && <ProfilePage snapshot={snapshot} claims={grouped.profile} history={snapshot.claims.filter((claim) => claim.lifecycle === 'superseded')} pendingCount={grouped.pending.length} onClaim={setSelectedClaim} onReview={() => setView('review')} onSearch={() => setSearchOpen(true)} onSettings={() => setView('settings')} />}
      {view === 'capture' && <CapturePage snapshot={snapshot} setSnapshot={setSnapshot} service={service} onDeleteEntry={deleteEntry} />}
      {view === 'timeline' && <TimelinePage entries={snapshot.entries} onDeleteEntry={deleteEntry} />}
      {view === 'ask' && <AskPage claims={grouped.profile} entries={snapshot.entries} service={service} />}
      {view === 'settings' && <SettingsPage snapshot={snapshot} setSnapshot={setSnapshot} service={service} accountEmail={accountEmail} onSignOut={onSignOut} onBack={() => setView('profile')} />}
      {view === 'review' && <ReviewPage claims={snapshot.claims} onConfirm={(id) => void updateClaim(id, { reviewStatus: 'confirmed' })} onReject={(id) => void updateClaim(id, { reviewStatus: 'rejected' })} onBack={() => setView('profile')} />}
    </main>

    {view !== 'capture' && view !== 'settings' && <button className="floating-add" aria-label="快速记录" onClick={() => setView('capture')}><Plus size={25} /></button>}
    <nav className="bottom-nav" aria-label="主要导航">
      <NavButton active={view === 'profile' || view === 'review'} icon={<Home />} label="档案" onClick={() => setView('profile')} />
      <NavButton active={view === 'capture'} icon={<BookHeart />} label="记录" onClick={() => setView('capture')} />
      <NavButton active={view === 'timeline'} icon={<Archive />} label="回忆" onClick={() => setView('timeline')} />
      <NavButton active={view === 'ask'} icon={<MessageCircleQuestion />} label="问记录" onClick={() => setView('ask')} />
    </nav>

    {selectedClaim && <EvidenceSheet claim={selectedClaim} entries={snapshot.entries} onClose={() => setSelectedClaim(null)} />}
    {searchOpen && <SearchSheet snapshot={snapshot} onClose={() => setSearchOpen(false)} onClaim={setSelectedClaim} />}
  </div>;
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button className={active ? 'active' : ''} onClick={onClick} aria-label={label}>{icon}<span>{label}</span></button>;
}

function ProfilePage({ snapshot, claims, history, pendingCount, onClaim, onReview, onSearch, onSettings }: { snapshot: MemorySnapshot; claims: MemoryClaim[]; history: MemoryClaim[]; pendingCount: number; onClaim: (claim: MemoryClaim) => void; onReview: () => void; onSearch: () => void; onSettings: () => void }) {
  const byCategory = Object.entries(CATEGORY_LABELS).map(([category, label]) => ({ label, claims: claims.filter((claim) => claim.category === category) }));
  return <section className="page profile-page">
    <PageHeader title={`关于${snapshot.profileName}`} action={<div className="header-actions"><button className="icon-button" aria-label="搜索" onClick={onSearch}><Search size={20} /></button><button className="icon-button" aria-label="设置" onClick={onSettings}><Settings size={20} /></button></div>} />
    <section className="memory-summary">
      <div className="profile-avatar">她</div>
      <div><span>已经慢慢记住</span><strong>{claims.length} 个细节</strong></div>
      <div className="summary-counts"><span>喜欢 {claims.filter((claim) => claim.category === 'like').length}</span><span>原话 {claims.filter((claim) => claim.category === 'quote').length}</span></div>
    </section>
    {pendingCount > 0 && <button className="review-banner" onClick={onReview} aria-label="查看待确认"><Sparkles size={19} /><span><strong>{pendingCount} 条待确认</strong><small>看看 AI 的推测和依据</small></span><span aria-hidden="true">›</span></button>}
    {claims.length || history.length ? <div className="profile-sections">{byCategory.filter((section) => section.claims.length).map((section) => <section className="claim-section" key={section.label}><h2>{section.label}</h2><div className="claim-list">{section.claims.map((claim) => <ClaimRow claim={claim} key={claim.id} onOpen={() => onClaim(claim)} />)}</div></section>)}{history.length > 0 && <section className="claim-section history-section"><h2>历史变化</h2><p>这些信息后来有了新的版本，原始依据仍然保留。</p><div className="claim-list">{history.map((claim) => <ClaimRow claim={claim} key={claim.id} onOpen={() => onClaim(claim)} />)}</div></section>}</div> : <EmptyState icon={<Heart />} title="从一个细节开始">她说过的一句话、喜欢的味道，或者今天发生的小事，都可以记在这里。</EmptyState>}
  </section>;
}

function CapturePage({ snapshot, setSnapshot, service, onDeleteEntry }: { snapshot: MemorySnapshot; setSnapshot: React.Dispatch<React.SetStateAction<MemorySnapshot>>; service?: MemoryService; onDeleteEntry: (id: string) => Promise<void> }) {
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState('');
  const [drafts, setDrafts] = useState<StoredDraft[]>([]);
  const [happenedAt, setHappenedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const refreshDrafts = async () => setDrafts(await listDrafts());
  useEffect(() => { void refreshDrafts(); }, []);

  const createEntry = async (draftContent: string, draftHappenedAt: string, draftFiles: File[]) => {
    if (service) {
      const entry = await service.createEntry({ content: draftContent, happenedAt: new Date(draftHappenedAt).toISOString(), files: draftFiles });
      setSnapshot((current) => ({ ...current, entries: [entry, ...current.entries.filter((item) => item.id !== entry.id)] }));
      return;
    }
    const entry: MemoryEntry = { id: crypto.randomUUID(), content: draftContent.trim(), happenedAt: new Date(draftHappenedAt).toISOString(), createdAt: new Date().toISOString(), revision: 1, analysisStatus: 'unavailable', attachments: draftFiles.map((file) => ({ id: crypto.randomUUID(), kind: file.type.startsWith('image/') ? 'image' : 'audio', name: file.name, mimeType: file.type, sizeBytes: file.size, url: URL.createObjectURL(file) })) };
    setSnapshot((current) => ({ ...current, entries: [entry, ...current.entries] }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!content.trim() && !files.length) return;
    if (!navigator.onLine) {
      await saveDraft({ id: crypto.randomUUID(), content: content.trim(), happenedAt, createdAt: new Date().toISOString(), files });
      setMessage('已保存到本机草稿，联网后可以提交');
      setContent(''); setFiles([]);
      await refreshDrafts();
      return;
    }
    try {
      setMessage(service ? '正在安全保存并分析…' : '');
      await createEntry(content, happenedAt, files);
      setContent(''); setFiles([]); setMessage(service ? '记录已保存，分析状态见下方' : '记录已保存');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败，请重试');
    }
  };
  const chooseFiles = async (nextFiles: File[]) => {
    const validation = validateMediaSelection(nextFiles);
    if (!validation.ok) return setMessage(validation.message);
    const audio = nextFiles.find((file) => file.type.startsWith('audio/'));
    if (audio) {
      try {
        const duration = validateAudioDuration(await readAudioDuration(audio));
        if (!duration.ok) return setMessage(duration.message);
      } catch {
        return setMessage('无法读取语音时长，请换一个文件');
      }
    }
    setFiles(nextFiles); setMessage('');
  };
  const addRecording = (file: File) => void chooseFiles([...files.filter((item) => !item.type.startsWith('audio/')), file]);
  const submitDraft = async (draft: StoredDraft) => {
    const restored = draft.files.map((file) => new File([file.data], file.name, { type: file.type }));
    try {
      await createEntry(draft.content, draft.happenedAt, restored);
      await removeDraft(draft.id);
      await refreshDrafts();
      setMessage('草稿已提交');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '草稿提交失败');
    }
  };
  return <section className="page capture-page">
    <PageHeader title="记下一点" />
    <form className="capture-form" onSubmit={save}>
      <textarea aria-label="记录内容" value={content} onChange={(event) => setContent(event.target.value)} placeholder="她今天说了什么，或者你又想起了什么……" />
      <label className="date-field"><span>发生时间</span><input type="datetime-local" value={happenedAt} onChange={(event) => setHappenedAt(event.target.value)} /></label>
      <div className="media-tools">
        <label className="tool-button"><Plus size={18} /><span>图片 / 语音</span><input hidden type="file" accept="image/*,audio/*" multiple onChange={(event) => void chooseFiles(Array.from(event.target.files ?? []))} /></label>
        <AudioRecorder onRecorded={addRecording} onMessage={setMessage} />
      </div>
      <div className="capture-tools">
        <span className="privacy-note">原件会和这条记录保存在一起</span>
        <button className="primary-button" type="submit">保存记录</button>
      </div>
      {files.length > 0 && <div className="selected-files">{files.map((file) => <span key={`${file.name}-${file.size}`}>{file.type.startsWith('image/') ? '图片' : '语音'} · {file.name}</span>)}</div>}
      {message && <p className="form-message" role="status">{message}</p>}
    </form>
    {drafts.length > 0 && <section className="draft-section"><h2>本机草稿</h2>{drafts.map((draft) => <article className="draft-row" key={draft.id}><div><strong>{draft.content || '媒体记录'}</strong><small>{draft.files.length} 个媒体文件</small></div><button className="secondary-button" onClick={() => void removeDraft(draft.id).then(refreshDrafts)}>删除</button><button className="primary-button" onClick={() => void submitDraft(draft)}>提交</button></article>)}</section>}
    <section className="recent-records"><h2>最近记录</h2>{snapshot.entries.length ? snapshot.entries.map((entry) => <EntryRow entry={entry} key={entry.id} onDelete={() => onDeleteEntry(entry.id)} onRetry={service && entry.analysisStatus === 'failed' ? () => service.retryAnalysis(entry.id, entry.revision) : undefined} />) : <p className="empty-copy">还没有记录</p>}</section>
  </section>;
}

function TimelinePage({ entries, onDeleteEntry }: { entries: MemoryEntry[]; onDeleteEntry: (id: string) => Promise<void> }) {
  const ordered = [...entries].sort((a, b) => b.happenedAt.localeCompare(a.happenedAt));
  return <section className="page"><PageHeader title="回忆" />{ordered.length ? <div className="timeline">{ordered.map((entry) => <div className="timeline-item" key={entry.id}><span className="timeline-dot" /><EntryRow entry={entry} onDelete={() => onDeleteEntry(entry.id)} /></div>)}</div> : <EmptyState title="回忆会慢慢长出来">每一次记录，都会按发生时间留在这里。</EmptyState>}</section>;
}

function ReviewPage({ claims, onConfirm, onReject, onBack }: { claims: MemoryClaim[]; onConfirm: (id: string) => void; onReject: (id: string) => void; onBack: () => void }) {
  const pending = claims.filter((claim) => claim.evidenceLevel === 'inferred' && claim.reviewStatus !== 'rejected');
  return <section className="page"><PageHeader title="待确认" action={<button className="text-button" onClick={onBack}>返回</button>} />{pending.length ? <div className="review-list">{pending.map((claim) => <article className="review-item" key={claim.id}><span>{CATEGORY_LABELS[claim.category]}</span><h2>{claim.statement}</h2><p>这是一条根据记录得到的推测，不会自动当成事实。</p><div><button className="secondary-button" onClick={() => onReject(claim.id)}>不是这样</button><button className="primary-button" aria-label="确认这条线索" onClick={() => onConfirm(claim.id)}>{claim.reviewStatus === 'confirmed' ? '已确认' : '确认'}</button></div></article>)}</div> : <EmptyState title="没有待确认线索">新的推测会出现在这里，由你决定是否入档。</EmptyState>}</section>;
}

function AskPage({ claims, entries, service }: { claims: MemoryClaim[]; entries: MemoryEntry[]; service?: MemoryService }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<MemoryAnswer['citations']>([]);
  const ask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!question.trim()) return;
    if (service) {
      setAnswer('正在查找已有依据…');
      try {
        const result = await service.askMemory(question.trim());
        setAnswer(result.answer); setCitations(result.citations);
      } catch (error) {
        setAnswer(error instanceof Error ? error.message : '暂时无法查询'); setCitations([]);
      }
      return;
    }
    const terms = question.trim().split(/\s+/).filter(Boolean);
    const matches = claims.filter((claim) => terms.some((term) => claim.statement.includes(term)));
    setAnswer(matches.length ? `现有记录里相关的信息：${matches.map((item) => item.statement).join('；')}。` : '现有记录不足，暂时不能判断。连接云端 AI 后仍只会根据已有依据回答。');
    setCitations(matches.flatMap((claim) => claim.evidence.map((evidence) => ({ claimId: claim.id, entryId: evidence.entryId, quote: evidence.quote }))));
  };
  return <section className="page ask-page"><PageHeader title="问记录" /><div className="ask-intro"><MessageCircleQuestion size={26} /><p>只根据你保存的记录回答，不替她说话。</p></div><form onSubmit={(event) => void ask(event)}><input value={question} onChange={(event) => setQuestion(event.target.value)} aria-label="向记录提问" placeholder="例如：她喜欢什么口味？" /><button className="primary-button" type="submit">查找依据</button></form>{answer && <div className="answer-panel"><Sparkles size={18} /><div><p>{answer}</p>{citations.length > 0 && <div className="answer-citations"><strong>依据</strong>{citations.map((citation, index) => <span key={`${citation.entryId}-${index}`}>{citation.quote || entries.find((entry) => entry.id === citation.entryId)?.content || '原始记录'}</span>)}</div>}</div></div>}</section>;
}

function SearchSheet({ snapshot, onClose, onClaim }: { snapshot: MemorySnapshot; onClose: () => void; onClaim: (claim: MemoryClaim) => void }) {
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLowerCase();
  const claims = normalized ? snapshot.claims.filter((claim) => claim.reviewStatus !== 'rejected' && claim.statement.toLowerCase().includes(normalized)) : [];
  const entries = normalized ? snapshot.entries.filter((entry) => entry.content.toLowerCase().includes(normalized)) : [];
  return <div className="search-layer" role="dialog" aria-modal="true" aria-label="搜索面板"><div className="search-header"><Search size={19} /><input autoFocus aria-label="搜索记忆" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索原话、喜好或事情" /><button onClick={onClose}>取消</button></div>{normalized && <div className="search-results"><h2>档案</h2>{claims.map((claim) => <ClaimRow key={claim.id} claim={claim} onOpen={() => onClaim(claim)} />)}<h2>原始记录</h2>{entries.map((entry) => <EntryRow key={entry.id} entry={entry} />)}{!claims.length && !entries.length && <p className="empty-copy">没有找到相关记忆</p>}</div>}</div>;
}

function SettingsPage({ snapshot, setSnapshot, service, accountEmail, onSignOut, onBack }: { snapshot: MemorySnapshot; setSnapshot: React.Dispatch<React.SetStateAction<MemorySnapshot>>; service?: MemoryService; accountEmail?: string; onSignOut?: () => Promise<void>; onBack: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  const permanentlyDelete = async () => {
    try {
      if (service) await service.deleteAccount();
      setSnapshot(EMPTY_SNAPSHOT); setConfirming(false); setMessage('全部数据已删除');
    } catch (error) { setMessage(error instanceof Error ? error.message : '删除失败'); }
  };
  return <section className="page settings-page"><PageHeader title="设置" action={<button className="text-button" onClick={onBack}>返回</button>} />{accountEmail && <section><h2>账号</h2><div className="account-row"><span><strong>{accountEmail}</strong><small>邮箱验证码登录</small></span>{onSignOut && <button className="secondary-button" onClick={() => void onSignOut()}>退出登录</button>}</div></section>}<section><h2>数据备份</h2><button className="setting-row" onClick={() => downloadText('关于她.json', buildJsonExport(snapshot), 'application/json')}><FileJson /><span><strong>导出完整 JSON</strong><small>保留全部结构化数据</small></span><Download /></button><button className="setting-row" onClick={() => downloadText('关于她.md', buildMarkdownExport(snapshot), 'text/markdown')}><FileTextIcon /><span><strong>导出可读 Markdown</strong><small>适合长期保存和阅读</small></span><Download /></button></section><section className="danger-zone"><h2>永久删除</h2>{confirming ? <div className="delete-confirm"><p>{service ? '这会永久删除账号、全部记录和私有媒体，无法撤销。' : '这会删除当前设备上的全部记录，无法撤销。'}</p><button className="danger-button" onClick={() => void permanentlyDelete()}>确认永久删除</button><button className="secondary-button" onClick={() => setConfirming(false)}>取消</button></div> : <button className="setting-row danger" onClick={() => setConfirming(true)}><Trash2 /><span><strong>删除全部数据</strong><small>此操作不可撤销</small></span></button>}{message && <p className="form-message" role="status">{message}</p>}</section></section>;
}

function FileTextIcon() { return <FileText />; }
