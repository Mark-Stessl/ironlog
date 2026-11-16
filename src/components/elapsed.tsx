import { useEffect, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { fmtDuration } from '@/lib/format';

/** Live "12:34" counter since a timestamp. */
export function Elapsed({ since, style }: { since: number; style?: StyleProp<TextStyle> }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <Text style={style}>{fmtDuration(now - since)}</Text>;
}
