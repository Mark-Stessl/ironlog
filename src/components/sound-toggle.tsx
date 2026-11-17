import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { IconButton } from '@/components/ui';
import { setSetting } from '@/lib/db';
import { sound } from '@/lib/sound';
import { C } from '@/lib/theme';

/** Speaker button that turns the app's sounds on or off (remembered). */
export function SoundToggle() {
  const db = useSQLiteContext();
  const [on, setOn] = useState(sound.isEnabled());
  useEffect(() => sound.subscribe(setOn), []);

  return (
    <IconButton
      icon={on ? 'volume-medium-outline' : 'volume-mute-outline'}
      label={on ? 'Turn sounds off' : 'Turn sounds on'}
      color={on ? C.textDim : C.textFaint}
      onPress={() => {
        const next = !on;
        sound.setEnabled(next);
        setSetting(db, 'sound', next ? '1' : '0');
        if (next) sound.play('tick');
      }}
    />
  );
}
