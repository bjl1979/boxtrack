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
  await video.play().catch(() => {});

  let stopped = false;
  let stopDecoder = () => {};
  const detector = await nativeDetector();
  if (detector) {
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (stopped) return;
      if (video.readyState >= 2) {
        try {
          const codes = await detector.detect(video);
          if (codes[0]?.rawValue) onText(codes[0].rawValue);
        } catch {
          /* frame not ready – try again */
        }
      }
      timer = setTimeout(tick, 150);
    };
    void tick();
    stopDecoder = () => clearTimeout(timer);
  } else {
    const { BrowserQRCodeReader } = await import('@zxing/browser');
    const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 150 });
    const controls = await reader.decodeFromVideoElement(video, (result) => {
      if (result && !stopped) onText(result.getText());
    });
    stopDecoder = () => controls.stop();
  }

  return () => {
    stopped = true;
    stopDecoder();
    for (const t of stream.getTracks()) t.stop();
    video.srcObject = null;
  };
}
