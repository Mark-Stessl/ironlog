export type ScannerProps = {
  /** Called with the digits of an EAN-13, EAN-8, UPC-A or UPC-E barcode. */
  onCode: (code: string) => void;
  /** Ignore codes while a lookup is running. */
  paused?: boolean;
  /** Called with false when the camera can't be used (blocked, missing or failed), true when it works again. */
  onAvailability?: (ok: boolean) => void;
};
