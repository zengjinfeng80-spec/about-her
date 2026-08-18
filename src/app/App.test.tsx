import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import type { MemorySnapshot } from '../domain/types';
import type { MemoryService } from '../cloud/service';
import { vi } from 'vitest';
import { clearDrafts } from '../storage/drafts';

const snapshot: MemorySnapshot = {
  profileName: '她',
  entries: [{
    id: 'entry-1',
    content: '她说喜欢草莓味，但不爱太甜。',
    happenedAt: '2026-08-12T08:00:00.000Z',
    createdAt: '2026-08-12T08:00:00.000Z',
    revision: 1,
    analysisStatus: 'completed',
    attachments: [],
  }],
  claims: [
    { id: 'like-1', category: 'like', statement: '喜欢草莓味，但不爱太甜', evidenceLevel: 'explicit', reviewStatus: 'unreviewed', lifecycle: 'active', happenedAt: '2026-08-12T08:00:00.000Z', evidence: [{ entryId: 'entry-1', quote: '喜欢草莓味，但不爱太甜' }] },
    { id: 'boundary-1', category: 'boundary', statement: '可能不喜欢临时改变计划', evidenceLevel: 'inferred', reviewStatus: 'unreviewed', lifecycle: 'active', happenedAt: '2026-08-12T08:00:00.000Z', evidence: [{ entryId: 'entry-1' }] },
  ],
};

describe('App', () => {
  it('首页区分已入档细节和待确认推测', () => {
    render(<App initialSnapshot={snapshot} persist={false} />);
    expect(screen.getByRole('heading', { name: '雪梨' })).toBeInTheDocument();
    expect(screen.getByText('喜欢草莓味，但不爱太甜')).toBeInTheDocument();
    expect(screen.getByText('1 条待确认')).toBeInTheDocument();
  });

  it('确认推测后将它显示在档案中', async () => {
    const user = userEvent.setup();
    render(<App initialSnapshot={snapshot} persist={false} />);
    await user.click(screen.getByRole('button', { name: '查看待确认' }));
    await user.click(screen.getByRole('button', { name: '确认这条线索' }));
    expect(screen.getByText('已确认')).toBeInTheDocument();
  });

  it('文字记录必须先选择分类，并在保存后自动加入档案', async () => {
    const user = userEvent.setup();
    render(<App initialSnapshot={{ profileName: '她', entries: [], claims: [] }} persist={false} />);
    await user.click(screen.getByRole('button', { name: '记录' }));
    await user.type(screen.getByLabelText('记录内容'), '她说下次想去看夜场电影。');
    await user.click(screen.getByRole('button', { name: '保存记录' }));
    expect(screen.getByRole('status')).toHaveTextContent('请选择档案分类');

    await user.selectOptions(screen.getByLabelText('档案分类'), 'wish');
    await user.click(screen.getByRole('button', { name: '保存记录' }));
    expect(screen.getByText('她说下次想去看夜场电影。')).toBeInTheDocument();
    expect(screen.getByText('记录已保存并自动加入档案')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '档案' }));
    expect(screen.getByText('她说下次想去看夜场电影。')).toBeInTheDocument();
    expect(screen.getAllByText('已确认')).toHaveLength(1);
    expect(screen.queryByText('已保存，连接云端后才能自动分析')).not.toBeInTheDocument();
  });

  it('隐藏问记录和全部分析状态入口', async () => {
    const user = userEvent.setup();
    render(<App initialSnapshot={{
      ...snapshot,
      entries: [{ ...snapshot.entries[0], analysisStatus: 'failed', analysisError: '自动分析暂时失败' }],
    }} persist={false} />);

    expect(screen.queryByRole('button', { name: '问记录' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '记录' }));
    expect(screen.queryByText('分析失败')).not.toBeInTheDocument();
    expect(screen.queryByText('自动分析暂时失败')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重试' })).not.toBeInTheDocument();
  });

  it('搜索同时匹配档案和原始记录', async () => {
    const user = userEvent.setup();
    render(<App initialSnapshot={snapshot} persist={false} />);
    await user.click(screen.getByRole('button', { name: '搜索' }));
    await user.type(screen.getByLabelText('搜索记忆'), '草莓');
    const results = within(screen.getByRole('dialog', { name: '搜索面板' }));
    expect(results.getByText('喜欢草莓味，但不爱太甜')).toBeInTheDocument();
    expect(results.getByText('她说喜欢草莓味，但不爱太甜。')).toBeInTheDocument();
  });

  it('设置页说明当前使用邮箱链接登录', async () => {
    const user = userEvent.setup();
    render(<App initialSnapshot={snapshot} persist={false} accountEmail="user@example.com" />);
    await user.click(screen.getByRole('button', { name: '设置' }));
    expect(screen.getByText('邮箱链接登录')).toBeInTheDocument();
  });

  it('云端模式通过服务提交记录并调用删除', async () => {
    const user = userEvent.setup();
    const created = { ...snapshot.entries[0], id: 'entry-cloud', content: '她想看夜场电影。', analysisStatus: 'failed' as const, analysisError: '自动分析暂时失败' };
    const service = {
      createEntry: vi.fn().mockResolvedValue(created),
      deleteEntry: vi.fn().mockResolvedValue(undefined),
      createManualClaim: vi.fn().mockResolvedValue({ id: 'claim-cloud', category: 'wish', statement: created.content, evidenceLevel: 'explicit', reviewStatus: 'confirmed', lifecycle: 'active', happenedAt: created.happenedAt, evidence: [{ entryId: created.id, quote: created.content }] }),
      updateClaim: vi.fn(), askMemory: vi.fn(), deleteAccount: vi.fn(), loadSnapshot: vi.fn(), retryAnalysis: vi.fn(),
    } satisfies MemoryService;
    render(<App initialSnapshot={{ profileName: '她', entries: [], claims: [] }} persist={false} service={service} />);
    await user.click(screen.getByRole('button', { name: '记录' }));
    await user.type(screen.getByLabelText('记录内容'), '她想看夜场电影。');
    await user.selectOptions(screen.getByLabelText('档案分类'), 'wish');
    await user.click(screen.getByRole('button', { name: '保存记录' }));
    expect(service.createEntry).toHaveBeenCalled();
    expect(service.createManualClaim).toHaveBeenCalled();
    expect(screen.getByText('记录已保存并自动加入档案')).toBeInTheDocument();
    expect(screen.queryByText('自动分析暂时失败')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '删除这条记录' }));
    await user.click(screen.getByRole('button', { name: '确认删除记录' }));
    expect(service.deleteEntry).toHaveBeenCalledWith('entry-cloud');
  });

  it('只有媒体的记录不需要分类且不会自动入档', async () => {
    const user = userEvent.setup();
    const created = { ...snapshot.entries[0], id: 'media-entry', content: '', attachments: [{ id: 'image-1', kind: 'image' as const, name: 'photo.png', mimeType: 'image/png', sizeBytes: 5 }] };
    const service = {
      createEntry: vi.fn().mockResolvedValue(created),
      createManualClaim: vi.fn(), deleteEntry: vi.fn(), updateClaim: vi.fn(),
      askMemory: vi.fn(), deleteAccount: vi.fn(), loadSnapshot: vi.fn(), retryAnalysis: vi.fn(),
    } satisfies MemoryService;
    render(<App initialSnapshot={{ profileName: '她', entries: [], claims: [] }} persist={false} service={service} />);
    await user.click(screen.getByRole('button', { name: '记录' }));
    await user.upload(screen.getByLabelText('图片 / 语音'), new File(['image'], 'photo.png', { type: 'image/png' }));
    await user.click(screen.getByRole('button', { name: '保存记录' }));

    expect(screen.getByText('记录已保存')).toBeInTheDocument();
    expect(service.createManualClaim).not.toHaveBeenCalled();
  });

  it('云端自动入档按顺序调用服务，入档失败仍保留原始记录', async () => {
    const user = userEvent.setup();
    const created = { ...snapshot.entries[0], id: 'entry-auto', content: '她想看夜场电影。', attachments: [] };
    const service = {
      createEntry: vi.fn().mockResolvedValue(created),
      createManualClaim: vi.fn().mockRejectedValue(new Error('自动入档失败')),
      deleteEntry: vi.fn(), updateClaim: vi.fn(), askMemory: vi.fn(), deleteAccount: vi.fn(), loadSnapshot: vi.fn(), retryAnalysis: vi.fn(),
    } satisfies MemoryService;
    render(<App initialSnapshot={{ profileName: '她', entries: [], claims: [] }} persist={false} service={service} />);
    await user.click(screen.getByRole('button', { name: '记录' }));
    await user.type(screen.getByLabelText('记录内容'), '她想看夜场电影。');
    await user.selectOptions(screen.getByLabelText('档案分类'), 'wish');
    await user.click(screen.getByRole('button', { name: '保存记录' }));

    expect(service.createEntry).toHaveBeenCalledBefore(service.createManualClaim);
    expect(screen.getByText('她想看夜场电影。')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('记录已保存，但自动入档失败，可在下方点击加入档案补录');
  });

  it('离线文字草稿保存分类并在联网提交后自动入档', async () => {
    await clearDrafts();
    let online = false;
    const onlineSpy = vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
    try {
      const user = userEvent.setup();
      render(<App initialSnapshot={{ profileName: '她', entries: [], claims: [] }} persist={false} />);
      await user.click(screen.getByRole('button', { name: '记录' }));
      await user.type(screen.getByLabelText('记录内容'), '她喜欢安静的周末。');
      await user.selectOptions(screen.getByLabelText('档案分类'), 'like');
      await user.click(screen.getByRole('button', { name: '保存记录' }));
      expect(await screen.findByText('已保存到本机草稿，联网后可以提交')).toBeInTheDocument();

      online = true;
      await user.click(screen.getByRole('button', { name: '提交' }));
      expect(await screen.findByText('草稿已提交并自动加入档案')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '档案' }));
      expect(screen.getByText('她喜欢安静的周末。')).toBeInTheDocument();
      expect(screen.getByText('已确认')).toBeInTheDocument();
    } finally {
      onlineSpy.mockRestore();
      await clearDrafts();
    }
  });

  it('可以从同一条记录连续手动加入多个档案分类', async () => {
    const user = userEvent.setup();
    render(<App initialSnapshot={{ ...snapshot, claims: [] }} persist={false} />);
    await user.click(screen.getByRole('button', { name: '记录' }));
    await user.click(screen.getByRole('button', { name: '加入档案' }));

    const dialog = screen.getByRole('dialog', { name: '手动入档' });
    expect(within(dialog).getByText('她说喜欢草莓味，但不爱太甜。')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('档案内容')).toHaveValue('');

    await user.selectOptions(within(dialog).getByLabelText('档案分类'), 'like');
    await user.type(within(dialog).getByLabelText('档案内容'), '喜欢草莓味');
    await user.click(within(dialog).getByRole('button', { name: '保存到档案' }));
    expect(within(dialog).getByRole('status')).toHaveTextContent('已加入档案，可以继续添加');
    expect(within(dialog).getByLabelText('档案分类')).toHaveValue('');
    expect(within(dialog).getByLabelText('档案内容')).toHaveValue('');

    await user.selectOptions(within(dialog).getByLabelText('档案分类'), 'dislike');
    await user.type(within(dialog).getByLabelText('档案内容'), '不喜欢太甜');
    await user.click(within(dialog).getByRole('button', { name: '保存到档案' }));
    await user.click(within(dialog).getByRole('button', { name: '完成' }));
    await user.click(screen.getByRole('button', { name: '档案' }));

    expect(screen.getByText('喜欢草莓味')).toBeInTheDocument();
    expect(screen.getByText('不喜欢太甜')).toBeInTheDocument();
    expect(screen.getAllByText('已确认')).toHaveLength(2);
  });

  it('手动入档要求选择分类并填写内容', async () => {
    const user = userEvent.setup();
    render(<App initialSnapshot={{ ...snapshot, claims: [] }} persist={false} />);
    await user.click(screen.getByRole('button', { name: '记录' }));
    await user.click(screen.getByRole('button', { name: '加入档案' }));
    const dialog = screen.getByRole('dialog', { name: '手动入档' });

    await user.click(within(dialog).getByRole('button', { name: '保存到档案' }));
    expect(within(dialog).getByRole('status')).toHaveTextContent('请选择档案分类');
    await user.selectOptions(within(dialog).getByLabelText('档案分类'), 'wish');
    await user.click(within(dialog).getByRole('button', { name: '保存到档案' }));
    expect(within(dialog).getByRole('status')).toHaveTextContent('请填写档案内容');
  });

  it('正式账号手动入档时调用云端服务并立即更新档案', async () => {
    const user = userEvent.setup();
    const createdClaim = {
      id: 'manual-claim-1', category: 'wish' as const, statement: '想看夜场电影',
      evidenceLevel: 'explicit' as const, reviewStatus: 'confirmed' as const,
      lifecycle: 'active' as const, happenedAt: snapshot.entries[0].happenedAt,
      evidence: [{ entryId: 'entry-1', quote: snapshot.entries[0].content }],
    };
    const service = {
      createManualClaim: vi.fn().mockResolvedValue(createdClaim),
      createEntry: vi.fn(), deleteEntry: vi.fn(), updateClaim: vi.fn(),
      askMemory: vi.fn(), deleteAccount: vi.fn(), loadSnapshot: vi.fn(), retryAnalysis: vi.fn(),
    } satisfies MemoryService;
    render(<App initialSnapshot={{ ...snapshot, claims: [] }} persist={false} service={service} />);
    await user.click(screen.getByRole('button', { name: '记录' }));
    await user.click(screen.getByRole('button', { name: '加入档案' }));
    const dialog = screen.getByRole('dialog', { name: '手动入档' });
    await user.selectOptions(within(dialog).getByLabelText('档案分类'), 'wish');
    await user.type(within(dialog).getByLabelText('档案内容'), '想看夜场电影');
    await user.click(within(dialog).getByRole('button', { name: '保存到档案' }));

    expect(service.createManualClaim).toHaveBeenCalledWith({
      entryId: 'entry-1', entryRevision: 1,
      entryContent: snapshot.entries[0].content,
      happenedAt: snapshot.entries[0].happenedAt,
      category: 'wish', statement: '想看夜场电影',
    });
    await user.click(within(dialog).getByRole('button', { name: '完成' }));
    await user.click(screen.getByRole('button', { name: '档案' }));
    expect(screen.getByText('想看夜场电影')).toBeInTheDocument();
  });
});
