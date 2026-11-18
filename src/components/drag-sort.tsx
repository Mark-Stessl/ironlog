import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { Dimensions, Platform, View } from 'react-native';
import { usePanGesture } from 'react-native-gesture-handler';
import { useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';

const SPRING = { damping: 24, stiffness: 280 };

type Ctx = {
  dragId: number | null;
  step: number;
  ids: number[];
  positions: SharedValue<Record<number, number>>;
  dragY: SharedValue<number>;
  active: SharedValue<number>;
  instant: SharedValue<boolean>;
  justDragged: RefObject<boolean>;
  begin: (id: number, node: View | null) => void;
  move: (id: number, translationY: number) => void;
  end: (id: number) => void;
};

const DragCtx = createContext<Ctx | null>(null);

type Box = { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void };
const topOf = (node: unknown) =>
  new Promise<number | null>((resolve) => {
    const n = node as Box | null;
    if (!n?.measureInWindow) return resolve(null);
    n.measureInWindow((_x, y) => resolve(y));
  });
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * Hold an item and drag it straight away — no separate "reorder" screen.
 * While dragging, `dragId` is set so items can fold into a compact form of
 * height `step - gap`; the held one stays under the finger and the others slide
 * out of the way. `onReorder` gets the new order when it's dropped.
 */
export function DragSortProvider({
  ids,
  step,
  scrollRef,
  onReorder,
  roomBelow,
  children,
}: {
  /** Items get shorter while dragging: add space at the end so scrolling can make up for it. */
  roomBelow?: boolean;
  ids: number[];
  /** Height of a folded item plus the gap between items. */
  step: number;
  scrollRef?: RefObject<unknown>;
  onReorder: (ids: number[]) => Promise<void> | void;
  children: ReactNode;
}) {
  const [dragId, setDragId] = useState<number | null>(null);
  const positions = useSharedValue<Record<number, number>>({});
  const dragY = useSharedValue(0);
  const active = useSharedValue(-1);
  const instant = useSharedValue(true);
  const justDragged = useRef(false);
  const dragging = useRef(false);
  const startY = useRef(0);
  const nodes = useRef(new Map<number, View | null>());
  const pending = useRef<{ id: number; screenTop: number | null } | null>(null);

  // Positions follow the real order whenever it changes (also after a drop).
  const key = ids.join(',');
  useLayoutEffect(() => {
    instant.value = true;
    positions.value = Object.fromEntries(ids.map((id, i) => [id, i]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Phones: stop the page from scrolling while an item is held.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const block = (e: TouchEvent) => {
      if (dragging.current && e.cancelable) e.preventDefault();
    };
    document.addEventListener('touchmove', block, { passive: false });
    return () => document.removeEventListener('touchmove', block);
  }, []);

  // Web: whatever actually scrolls around the item (the list itself, or the whole page).
  const scrollNode = (item: unknown): HTMLElement | null => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
    const s = scrollRef?.current as { getScrollableNode?: () => HTMLElement } | null;
    const own = s?.getScrollableNode?.();
    if (own && own.scrollHeight > own.clientHeight + 1) return own;
    let el = (item as HTMLElement | null)?.parentElement ?? null;
    while (el) {
      const y = getComputedStyle(el).overflowY;
      if ((y === 'auto' || y === 'scroll') && el.scrollHeight > el.clientHeight + 1) return el;
      el = el.parentElement;
    }
    return (document.scrollingElement as HTMLElement | null) ?? null;
  };

  // Keep `id` where it was on screen after the list changes shape: scroll first, nudge the rest.
  const keepInPlace = async (id: number, before: number | null) => {
    await nextFrame();
    const after = await topOf(nodes.current.get(id));
    if (before == null || after == null) return 0;
    let diff = after - before;
    const el = scrollNode(nodes.current.get(id));
    if (el && diff !== 0) {
      const old = el.scrollTop;
      el.scrollTop = old + diff;
      diff -= el.scrollTop - old;
    }
    return -diff;
  };

  const begin = (id: number, node: View | null) => {
    if (ids.length < 2) return;
    nodes.current.set(id, node);
    dragging.current = true;
    justDragged.current = true;
    haptic.success();
    const slot = positions.value[id] ?? ids.indexOf(id);
    startY.current = slot * step;
    dragY.value = startY.current;
    active.value = id;
    instant.value = false;
    pending.current = { id, screenTop: null };
    topOf(node).then((screenTop) => {
      if (pending.current?.id === id) pending.current.screenTop = screenTop;
      setDragId(id);
    });
  };

  // Once folded, scroll so the held item is back under the finger (as far as the page allows;
  // otherwise it simply sits in its slot and follows the finger's movement from there).
  useEffect(() => {
    if (dragId == null || !pending.current) return;
    const { id, screenTop } = pending.current;
    pending.current = null;
    keepInPlace(id, screenTop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId]);

  const order = () =>
    Object.keys(positions.value)
      .map(Number)
      .sort((a, b) => positions.value[a] - positions.value[b]);

  const move = (id: number, ty: number) => {
    // The item stays under the finger; only the slot it aims for is kept inside the list.
    const y = startY.current + ty;
    dragY.value = y;
    const to = Math.max(0, Math.min(ids.length - 1, Math.round(y / step)));
    const from = positions.value[id];
    if (to === from) return;
    const next = order();
    next.splice(from, 1);
    next.splice(to, 0, id);
    positions.value = Object.fromEntries(next.map((x, i) => [x, i]));
    haptic.tap();
  };

  const end = async (id: number) => {
    if (!dragging.current) return;
    dragging.current = false;
    // Glide into its slot, then save and unfold.
    active.value = -1;
    await new Promise((r) => setTimeout(r, 200));
    const next = order();
    const node = nodes.current.get(id);
    const before = await topOf(node);
    if (next.join(',') !== ids.join(',')) await onReorder(next);
    setDragId(null);
    await keepInPlace(id, before);
    setTimeout(() => (justDragged.current = false), 250);
  };

  return (
    <DragCtx.Provider value={{ dragId, step, ids, positions, dragY, active, instant, justDragged, begin, move, end }}>
      {children}
      {/* Room below while folded, so the page can scroll the held item back under the finger. */}
      {dragId != null && roomBelow ? <View style={{ height: Dimensions.get('window').height }} /> : null}
    </DragCtx.Provider>
  );
}

/** For one item: the hold-to-drag gesture (put it on the handle), the item's moving style, and state. */
export function useDragItem(id: number, nodeRef: RefObject<View | null>) {
  const ctx = useContext(DragCtx);
  if (!ctx) throw new Error('useDragItem needs a DragSortProvider');
  const { positions, dragY, active, instant, step, ids } = ctx;
  const index = ids.indexOf(id);

  const gesture = usePanGesture({
    activateAfterLongPress: 350,
    minDistance: 0,
    runOnJS: true,
    onActivate: () => ctx.begin(id, nodeRef.current),
    onUpdate: (e) => ctx.move(id, e.translationY),
    onDeactivate: () => ctx.end(id),
    onFinalize: () => ctx.end(id),
  });

  const style = useAnimatedStyle(() => {
    const held = active.value === id;
    const target = ((positions.value[id] ?? index) - index) * step;
    return {
      zIndex: held ? 20 : 1,
      transform: [
        { translateY: held ? dragY.value - index * step : instant.value ? target : withSpring(target, SPRING) },
        { scale: withTiming(held ? 1.03 : 1, { duration: 140 }) },
      ],
      shadowOpacity: withTiming(held ? 0.4 : 0, { duration: 140 }),
    };
  });

  return {
    gesture,
    style,
    folded: ctx.dragId != null,
    held: ctx.dragId === id,
    /** True right after a drag: ignore the tap that ends it. */
    justDragged: () => ctx.justDragged.current,
  };
}
