// Web (and the iPhone home-screen app): the share sheet when the browser can share
// files (iPhone: "Save to Files"), otherwise a normal download. Restoring opens the
// browser's file picker.

/** Resolves true when the file was handed over, false if the person cancelled. */
export async function saveBackupFile(name: string, json: string): Promise<boolean> {
  const blob = new Blob([json], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  // Phones: the share sheet. Desktop browsers get a plain download (more expected there).
  const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  if (touch && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Ironlog backup' });
      return true;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false;
      // Sharing failed for another reason: fall back to a download.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

/** The chosen file's text, or null if the person cancelled. */
export function pickBackupFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    let done = false;
    const finish = (v: string | null) => {
      if (done) return;
      done = true;
      input.remove();
      resolve(v);
    };
    input.onchange = async () => {
      const f = input.files?.[0];
      finish(f ? await f.text() : null);
    };
    input.addEventListener('cancel', () => finish(null));
    document.body.appendChild(input);
    input.click();
  });
}
