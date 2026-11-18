import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { createElement, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ScannerProps } from '@/components/barcode-scanner.types';
import { C, F, S } from '@/lib/theme';

/**
 * Browser barcode scanner (works in iPhone Safari too). Uses the camera through
 * getUserMedia and decodes EAN/UPC codes on the device with ZXing (open source,
 * no server, no account).
 */
export function BarcodeScanner({ onCode, paused, onAvailability }: ScannerProps) {
  const video = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const handler = useRef(onCode);
  handler.current = onCode;
  const unavailable = useRef(onAvailability);
  unavailable.current = onAvailability;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    let stopped = false;
    let controls: { stop: () => void } | null = null;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser has no camera access. Type the barcode below instead.');
        unavailable.current?.(false);
        return;
      }
      try {
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
        ]);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120, delayBetweenScanSuccess: 1200 });
        if (stopped || !video.current) return;
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
          video.current,
          (result) => {
            if (result && !pausedRef.current) handler.current(result.getText());
          },
        );
        if (stopped) controls.stop();
      } catch (e) {
        const name = (e as { name?: string })?.name;
        setError(
          name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow it in the browser settings, or type the barcode below.'
            : 'The camera could not start. Type the barcode below instead.',
        );
        unavailable.current?.(false);
      }
    })();
    return () => {
      stopped = true;
      controls?.stop();
    };
  }, []);

  return (
    <View style={styles.wrap}>
      {createElement('video', {
        ref: video,
        playsInline: true,
        muted: true,
        autoPlay: true,
        style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
      })}
      {error ? (
        <View style={styles.error}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  error: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: S.xl,
    backgroundColor: C.bg,
  },
  errorText: { color: C.textDim, fontFamily: F.medium, fontSize: 14, textAlign: 'center' },
});
