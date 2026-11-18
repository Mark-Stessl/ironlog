import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ScannerProps } from '@/components/barcode-scanner.types';
import { C, F, R, S } from '@/lib/theme';

/** Native barcode scanner (iOS and Android builds) with expo-camera. */
export function BarcodeScanner({ onCode, paused, onAvailability }: ScannerProps) {
  const [permission, request] = useCameraPermissions();

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) request();
  }, [permission, request]);

  const ok = !permission || permission.granted;
  useEffect(() => {
    onAvailability?.(ok);
  }, [ok, onAvailability]);

  if (!permission) return <View style={styles.wrap} />;
  if (!permission.granted) {
    return (
      <View style={[styles.wrap, styles.center]}>
        <Text style={styles.text}>Ironlog needs the camera to scan barcodes.</Text>
        {permission.canAskAgain ? (
          <Pressable onPress={request} style={styles.button}>
            <Text style={styles.buttonText}>Allow camera</Text>
          </Pressable>
        ) : (
          <Text style={styles.text}>Turn it on in the system settings, or type the barcode below.</Text>
        )}
      </View>
    );
  }
  return (
    <CameraView
      style={styles.wrap}
      facing="back"
      barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
      onBarcodeScanned={paused ? undefined : (r) => onCode(r.data)}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center', gap: S.md, padding: S.xl, backgroundColor: C.bg },
  text: { color: C.textDim, fontFamily: F.medium, fontSize: 14, textAlign: 'center' },
  button: { paddingHorizontal: S.lg, height: 40, borderRadius: R.md, backgroundColor: C.accent, justifyContent: 'center' },
  buttonText: { color: C.onAccent, fontFamily: F.semi, fontSize: 14 },
});
