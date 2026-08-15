import { describe, expect, it } from 'vitest';
import { validateAudioDuration, validateMediaSelection } from './media';

const file = (name: string, type: string, size = 1024) => new File([new Uint8Array(size)], name, { type });

describe('validateMediaSelection', () => {
  it('拒绝超过四张图片', () => {
    const files = Array.from({ length: 5 }, (_, index) => file(`${index}.jpg`, 'image/jpeg'));
    expect(validateMediaSelection(files)).toEqual({ ok: false, message: '每条记录最多添加 4 张图片' });
  });

  it('拒绝超过一段语音', () => {
    const files = [file('a.m4a', 'audio/mp4'), file('b.m4a', 'audio/mp4')];
    expect(validateMediaSelection(files)).toEqual({ ok: false, message: '每条记录最多添加 1 段语音' });
  });

  it('接受四张图片和一段语音', () => {
    const files = [
      ...Array.from({ length: 4 }, (_, index) => file(`${index}.webp`, 'image/webp')),
      file('voice.webm', 'audio/webm'),
    ];
    expect(validateMediaSelection(files)).toEqual({ ok: true });
  });
});

describe('validateAudioDuration', () => {
  it('拒绝超过五分钟的语音', () => {
    expect(validateAudioDuration(301)).toEqual({ ok: false, message: '语音不能超过 5 分钟' });
  });

  it('接受五分钟以内的语音', () => {
    expect(validateAudioDuration(300)).toEqual({ ok: true });
  });
});
