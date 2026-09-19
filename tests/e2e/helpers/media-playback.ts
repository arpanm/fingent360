import { expect, type Page } from '@playwright/test';

// Decode and play bytes produced by the application's actual canvas recorder.
// Header checks alone cannot establish that a downloaded clip advances frames.
export async function expectCaptionClipPlayback(page: Page, encoded: string) {
  const playback = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) =>
      character.charCodeAt(0),
    );
    const url = URL.createObjectURL(new Blob([bytes], { type: 'video/webm' }));
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.style.width = '320px';
    video.setAttribute(
      'aria-label',
      'Acceptance playback of downloaded caption clip',
    );
    document.body.append(video);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;
    let disposed = false;
    try {
      return await new Promise<{
        width: number;
        height: number;
        currentTime: number;
        paused: boolean;
        opaqueFrame: boolean;
      }>((resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error('Downloaded caption clip did not advance playback'),
            ),
          15000,
        );
        video.onerror = () =>
          reject(new Error('Downloaded caption clip failed browser decoding'));
        const inspect = () => {
          if (disposed) return;
          if (
            video.currentTime >= 0.3 &&
            video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
          ) {
            const canvas = document.createElement('canvas');
            canvas.width = 16;
            canvas.height = 16;
            const context = canvas.getContext('2d');
            if (!context) {
              reject(new Error('Playback frame could not be inspected'));
              return;
            }
            context.drawImage(video, 0, 0, 16, 16);
            const pixels = context.getImageData(0, 0, 16, 16).data;
            resolve({
              width: video.videoWidth,
              height: video.videoHeight,
              currentTime: video.currentTime,
              paused: video.paused,
              opaqueFrame: pixels.some(
                (value, index) => index % 4 === 3 && value > 0,
              ),
            });
          } else frame = requestAnimationFrame(inspect);
        };
        video.onloadeddata = () => {
          void video.play().then(() => {
            if (!disposed) frame = requestAnimationFrame(inspect);
          }, reject);
        };
        video.src = url;
        video.load();
      });
    } finally {
      disposed = true;
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      video.onloadeddata = null;
      video.onerror = null;
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.remove();
      URL.revokeObjectURL(url);
    }
  }, encoded);
  expect(playback.width).toBe(960);
  expect(playback.height).toBe(640);
  expect(playback.currentTime).toBeGreaterThanOrEqual(0.3);
  expect(playback.paused).toBe(false);
  expect(playback.opaqueFrame).toBe(true);
}
