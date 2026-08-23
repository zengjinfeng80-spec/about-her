import { describe, expect, it } from 'vitest';
import icon from '../../public/about-her-mark.svg?raw';

describe('雪梨应用图标', () => {
  it('使用浅蓝色背景和白色雪花', async () => {
    expect(icon).toContain('fill="#d9effa"');
    expect(icon).toContain('stroke="#ffffff"');
  });
});
