/** Saves a generated file: a normal download (lands in the phone's Downloads folder). */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** True when the phone can hand the file to another app (Drive, WhatsApp, email…). */
export function canShareFiles(): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'x.zip', { type: 'application/zip' })] });
  } catch {
    return false;
  }
}

/** Opens the Android share sheet with the file. Returns false if the user cancelled. */
export async function shareBlob(blob: Blob, fileName: string, title: string): Promise<boolean> {
  try {
    await navigator.share({ files: [new File([blob], fileName, { type: blob.type })], title });
    return true;
  } catch {
    return false;
  }
}
