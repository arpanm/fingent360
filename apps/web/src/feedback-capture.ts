import { feedbackLimits, type FeedbackImage } from '@fingent360/contracts';

export interface CaptureArea {
  x: number;
  y: number;
  width: number;
  height: number;
}
export const fullCapture: CaptureArea = { x: 0, y: 0, width: 100, height: 100 };
export function loadCapture(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(Error('The screenshot could not be opened. Please retake it.'));
    img.src = source;
  });
}
export async function captureViewport(): Promise<string> {
  const covers: HTMLDivElement[] = [];
  // Do not read, copy or serialize values from any form field.
  for (const field of document.querySelectorAll(
    'input,textarea,[contenteditable="true"],[data-feedback-private]',
  )) {
    const box = field.getBoundingClientRect();
    if (!box.width || !box.height || box.bottom < 0 || box.top > innerHeight)
      continue;
    const cover = document.createElement('div');
    cover.textContent = 'Hidden for privacy';
    Object.assign(cover.style, {
      position: 'fixed',
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
      background: '#24382f',
      color: '#ffffff',
      font: '12px sans-serif',
      display: 'grid',
      placeItems: 'center',
      zIndex: '2147483646',
      pointerEvents: 'none',
      borderRadius: '4px',
    });
    document.body.append(cover);
    covers.push(cover);
  }
  document.documentElement.dataset.feedbackCapture = 'true';
  try {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    if (window.FingentIOS?.captureFeedback)
      return await window.FingentIOS.captureFeedback();
    if (window.FingentAndroid?.captureFeedback)
      return await window.FingentAndroid.captureFeedback();
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(document.body, {
      backgroundColor: '#f7f9f4',
      width: innerWidth,
      height: innerHeight,
      x: scrollX,
      y: scrollY,
      scrollX,
      scrollY,
      scale: Math.min(devicePixelRatio, 1.5),
      logging: false,
      allowTaint: false,
      useCORS: false,
      imageTimeout: 5000,
      ignoreElements: (element) =>
        element.hasAttribute('data-feedback-exclude'),
      onclone: (doc) => {
        // The DOM renderer does not implement the browser's closed-details paint rule.
        for (const child of doc.querySelectorAll<HTMLElement>(
          'details:not([open]) > :not(summary)',
        ))
          child.style.display = 'none';
        for (const field of doc.querySelectorAll<
          HTMLInputElement | HTMLTextAreaElement
        >('input,textarea')) {
          field.value = '';
          field.removeAttribute('value');
          field.textContent = '';
        }
        for (const field of doc.querySelectorAll(
          '[contenteditable="true"],[data-feedback-private]',
        ))
          field.textContent = '';
      },
    });
    return canvas.toDataURL('image/png');
  } finally {
    delete document.documentElement.dataset.feedbackCapture;
    covers.forEach((cover) => cover.remove());
  }
}
export async function finishCapture(
  source: string,
  area: CaptureArea,
  redactions: CaptureArea[],
): Promise<FeedbackImage> {
  const img = await loadCapture(source);
  const sx = Math.round((img.naturalWidth * area.x) / 100),
    sy = Math.round((img.naturalHeight * area.y) / 100);
  const sw = Math.max(
    1,
    Math.min(
      img.naturalWidth - sx,
      Math.round((img.naturalWidth * area.width) / 100),
    ),
  );
  const sh = Math.max(
    1,
    Math.min(
      img.naturalHeight - sy,
      Math.round((img.naturalHeight * area.height) / 100),
    ),
  );
  let factor = Math.min(1, 1440 / Math.max(sw, sh));
  for (let attempt = 0; attempt < 6; attempt++) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw * factor));
    canvas.height = Math.max(1, Math.round(sh * factor));
    const ctx = canvas.getContext('2d');
    if (!ctx)
      throw Error(
        'Screenshot editing is unavailable. You can still send text or voice.',
      );
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#162a21';
    for (const redaction of redactions)
      ctx.fillRect(
        ((img.naturalWidth * redaction.x) / 100 - sx) * factor,
        ((img.naturalHeight * redaction.y) / 100 - sy) * factor,
        ((img.naturalWidth * redaction.width) / 100) * factor,
        ((img.naturalHeight * redaction.height) / 100) * factor,
      );
    const base64 = canvas.toDataURL('image/png').split(',')[1]!;
    if ((base64.length * 3) / 4 <= feedbackLimits.imageBytes)
      return {
        mime: 'image/png',
        base64,
        width: canvas.width,
        height: canvas.height,
      };
    factor *= 0.75;
  }
  throw Error(
    'The screenshot is too large. Crop a smaller area and try again.',
  );
}
