/**
 * Camera QR scanning. Uses the browser's BarcodeDetector where it supports QR codes (Android
 * Chrome), otherwise falls back to ZXing (loaded only when needed).
 */

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorCtor {
  new (opts: { formats: string[] }): BarcodeDetectorLike;
  getSupportedFormats(): Promise<string[]>;
}

export class CameraError extends Error {
  constructor(
    public readonly kind: 'insecure' | 'denied' | 'nocamera' | 'other',
    message: string,
  ) {
    super(message);
  }
}

function cameraError(e: unknown): CameraError {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return new CameraError('denied', 'Camera access was blocked. Allow the camera for this site in Chrome’s site settings, then try again.');
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return new CameraError('nocamera', 'No camera was found on this device.');
  return new CameraError('other', 'The camera could not be started.');
}

async function nativeDetector(): Promise<BarcodeDetectorLike | null> {
  const BD = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (!BD) return null;
  try {
    return (await BD.getSupportedFormats()).includes('qr_code') ? new BD({ formats: ['qr_code'] }) : null;
  } catch {
    return null;
  }
}

const MAX_SIDE = 960; // decoding a smaller frame is much faster and still reads labels fine

/** Returns a function that reads a QR code from the current video frame (or null). */
async function createFrameDecoder(video: HTMLVideoElement): Promise<() => Promise<string | null>> {
  const native = await nativeDetector();
  if (native) {
    return async () => (await native.detect(video))[0]?.rawValue ?? null;
  }
  const { BrowserQRCodeReader } = await import('@zxing/browser');
  const reader = new BrowserQRCodeReader();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  // Frames are decoded at changing sizes: a code that fails at one size usually reads at another.
  const SCALES = [1, 0.5, 0.75];
  let n = 0;
  return async () => {
    if (!ctx) return null;
    const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight)) * SCALES[n++ % SCALES.length];
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
      return reader.decodeFromCanvas(canvas).getText();
    } catch {
      return null; // no QR code in this frame
    }
  };
}

/** Starts the rear camera in `video` and calls `onText` for every QR code seen. Returns a stop function. */
export async function startQrScanner(video: HTMLVideoElement, onText: (text: string) => void): Promise<() => void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError('insecure', 'The camera only works when BoxTrack is opened over HTTPS (or installed from an HTTPS address).');
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch (e) {
    throw cameraError(e);
  }
  video.srcObject = stream;
  video.setAttribute('playsinline', 'true');
  video.muted = true;
  // Don't wait for play(): its promise can stay pending (e.g. while the page is busy) and the scanner
  // would never start. The frame loop below simply waits until frames arrive.
  void video.play().catch(() => {});

  // One frame loop for both decoders. (ZXing's own video helper waits for a "playing" event that may
  // already have fired, and then never decodes – so frames are fed to it from here instead.)
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const detect = await createFrameDecoder(video);
  let attempts = 0;
  const tick = async () => {
    if (stopped) return;
    video.dataset.decodeAttempts = String(attempts); // diagnostic: shows the decoder is running
    if (video.paused) void video.play().catch(() => {});
    if (video.readyState >= 2 && video.videoWidth > 0) {
      attempts++;
      const text = await detect().catch(() => null);
      if (text && !stopped) onText(text);
    }
    timer = setTimeout(tick, 150);
  };
  void tick();
  const stopDecoder = () => clearTimeout(timer);

  return () => {
    stopped = true;
    stopDecoder();
    for (const t of stream.getTracks()) t.stop();
    video.srcObject = null;
  };
}
