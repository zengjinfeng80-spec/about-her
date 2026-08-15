import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import type { MemorySnapshot } from '../domain/types';
import type { MemoryService } from '../cloud/service';
import { vi } from 'vitest';

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
    expect(screen.getByRole('heading', { name: '关于她' })).toBeInTheDocument();
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

  it('新增文字记录时保留原文并说明本地模式不伪造分析', async () => {
    const user = userEvent.setup();
    render(<App initialSnapshot={{ profileName: '她', entries: [], claims: [] }} persist={false} />);
    await user.click(screen.getByRole('button', { name: '记录' }));
    await user.type(screen.getByLabelText('记录内容'), '她说下次想去看夜场电影。');
    await user.click(screen.getByRole('button', { name: '保存记录' }));
    expect(screen.getByText('她说下次想去看夜场电影。')).toBeInTheDocument();
    expect(screen.getByText('已保存，连接云端后才能自动分析')).toBeInTheDocument();
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

  it('云端模式通过服务提交记录并调用删除', async () => {
    const user = userEvent.setup();
    const created = { ...snapshot.entries[0], id: 'entry-cloud', content: '她想看夜场电影。', analysisStatus: 'failed' as const, analysisError: '自动分析暂时失败' };
    const service = {
      createEntry: vi.fn().mockResolvedValue(created),
      deleteEntry: vi.fn().mockResolvedValue(undefined),
      updateClaim: vi.fn(), askMemory: vi.fn(), deleteAccount: vi.fn(), loadSnapshot: vi.fn(), retryAnalysis: vi.fn(),
    } satisfies MemoryService;
    render(<App initialSnapshot={{ profileName: '她', entries: [], claims: [] }} persist={false} service={service} />);
    await user.click(screen.getByRole('button', { name: '记录' }));
    await user.type(screen.getByLabelText('记录内容'), '她想看夜场电影。');
    await user.click(screen.getByRole('button', { name: '保存记录' }));
    expect(service.createEntry).toHaveBeenCalled();
    expect(screen.getByText('自动分析暂时失败')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '删除这条记录' }));
    await user.click(screen.getByRole('button', { name: '确认删除记录' }));
    expect(service.deleteEntry).toHaveBeenCalledWith('entry-cloud');
  });
});
