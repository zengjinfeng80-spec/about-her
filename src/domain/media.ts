const MAX_IMAGES = 4;
const MAX_AUDIO = 1;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export type MediaValidationResult = { ok: true } | { ok: false; message: string };

export function validateMediaSelection(files: File[]): MediaValidationResult {
  const imageCount = files.filter((file) => file.type.startsWith('image/')).length;
  const audioCount = files.filter((file) => file.type.startsWith('audio/')).length;

  if (imageCount > MAX_IMAGES) return { ok: false, message: '每条记录最多添加 4 张图片' };
  if (audioCount > MAX_AUDIO) return { ok: false, message: '每条记录最多添加 1 段语音' };
  if (files.some((file) => !file.type.startsWith('image/') && !file.type.startsWith('audio/'))) {
    return { ok: false, message: '只能添加图片或语音文件' };
  }
  if (files.some((file) => file.size > MAX_FILE_BYTES)) return { ok: false, message: '单个文件不能超过 25 MB' };
  return { ok: true };
}

export function validateAudioDuration(seconds: number): MediaValidationResult {
  return seconds > 300 ? { ok: false, message: '语音不能超过 5 分钟' } : { ok: true };
}

export function readAudioDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const audio = document.createElement('audio');
    const url = URL.createObjectURL(file);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('无法读取语音时长'));
    };
    audio.src = url;
  });
}
