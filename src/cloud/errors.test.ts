import { describe, expect, it } from 'vitest';
import { toFriendlyMessage } from './errors';

describe('toFriendlyMessage', () => {
  it('把网络类英文报错换成中文提示', () => {
    expect(toFriendlyMessage(new TypeError('Failed to fetch'), '读取失败')).toBe('后端连接失败，请稍后重试');
    expect(toFriendlyMessage(new Error('TypeError: Failed to fetch'), '读取失败')).toBe('后端连接失败，请稍后重试');
    expect(toFriendlyMessage(new Error('Load failed'), '读取失败')).toBe('后端连接失败，请稍后重试');
  });

  it('把频率限制报错换成中文提示', () => {
    expect(toFriendlyMessage(new Error('Email rate limit exceeded'), '发送失败')).toBe('操作过于频繁，请等几分钟再试');
  });

  it('保留已有的中文提示', () => {
    expect(toFriendlyMessage(new Error('验证码无效或已过期'), '验证失败')).toBe('验证码无效或已过期');
    expect(toFriendlyMessage(new Error('读取云端档案超时，请检查网络后重试'), '读取失败')).toBe('读取云端档案超时，请检查网络后重试');
  });

  it('没有可用信息时使用兜底文案', () => {
    expect(toFriendlyMessage(undefined, '保存失败，请重试')).toBe('保存失败，请重试');
    expect(toFriendlyMessage(new Error('   '), '保存失败，请重试')).toBe('保存失败，请重试');
  });
});
