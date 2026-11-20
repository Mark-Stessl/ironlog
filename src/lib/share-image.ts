// Share a drawing (SVG) as a picture: native share sheet with a PNG on phones
// (web app included), otherwise it's downloaded.
import { Platform } from 'react-native';

export async function shareSvgImage(
  svg: string,
  fileName: string,
  title: string,
): Promise<'shared' | 'saved' | 'failed'> {
  if (Platform.OS !== 'web') return shareNative(svg, fileName, title);
  try {
    const png = await svgToPng(svg);
    const file = new File([png], `${fileName}.png`, { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title });
        return 'shared';
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return 'shared';
      }
    }
    const url = URL.createObjectURL(png);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return 'saved';
  } catch {
    return 'failed';
  }
}

function svgToPng(svg: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('no canvas'));
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no png'))), 'image/png');
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function shareNative(svg: string, fileName: string, title: string): Promise<'shared' | 'failed'> {
  try {
    const FS = await import('expo-file-system/legacy');
    const Sharing = await import('expo-sharing');
    const path = `${FS.cacheDirectory}${fileName}.svg`;
    await FS.writeAsStringAsync(path, svg);
    await Sharing.shareAsync(path, { mimeType: 'image/svg+xml', dialogTitle: title });
    return 'shared';
  } catch {
    return 'failed';
  }
}
