import { describe, expect, it } from 'vitest';
import { lazyWithTimeout } from './lazyWithTimeout';

describe('lazyWithTimeout', () => {
  it('懒加载模块卡住时返回可显示的错误', async () => {
    await expect(lazyWithTimeout(() => new Promise<never>(() => {}), 1, '页面模块加载超时')).rejects.toThrow('页面模块加载超时');
  });
});
