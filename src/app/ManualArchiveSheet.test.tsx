import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import type { MemoryEntry } from '../domain/types';
import { ManualArchiveSheet } from './ManualArchiveSheet';

const entry: MemoryEntry = {
  id: 'entry-1', content: '她说喜欢草莓。',
  happenedAt: '2026-08-17T08:00:00.000Z', createdAt: '2026-08-17T08:00:00.000Z',
  revision: 1, analysisStatus: 'idle', attachments: [],
};

it('提交期间禁用保存按钮', async () => {
  const user = userEvent.setup();
  let finishSave!: () => void;
  const onSave = vi.fn(() => new Promise<void>((resolve) => { finishSave = resolve; }));
  render(<ManualArchiveSheet entry={entry} onSave={onSave} onClose={vi.fn()} />);
  await user.selectOptions(screen.getByLabelText('档案分类'), 'like');
  await user.type(screen.getByLabelText('档案内容'), '喜欢草莓');
  await user.click(screen.getByRole('button', { name: '保存到档案' }));
  expect(screen.getByRole('button', { name: '正在保存…' })).toBeDisabled();
  finishSave();
  expect(await screen.findByRole('status')).toHaveTextContent('已加入档案，可以继续添加');
});

it('保存失败时保留分类和档案内容', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn().mockRejectedValue(new Error('云端入档失败'));
  render(<ManualArchiveSheet entry={entry} onSave={onSave} onClose={vi.fn()} />);
  await user.selectOptions(screen.getByLabelText('档案分类'), 'wish');
  await user.type(screen.getByLabelText('档案内容'), '想看夜场电影');
  await user.click(screen.getByRole('button', { name: '保存到档案' }));
  expect(await screen.findByRole('status')).toHaveTextContent('云端入档失败');
  expect(screen.getByLabelText('档案分类')).toHaveValue('wish');
  expect(screen.getByLabelText('档案内容')).toHaveValue('想看夜场电影');
});
