// iPhone Safari only opens the keyboard when a field is focused during the tap
// itself. Screens that open after a tap (like the exercise picker) come too late.
// The trick: during the tap, focus an invisible field (the keyboard opens); when the
// new screen focuses its real field a moment later, the keyboard simply stays up.
let field: HTMLInputElement | null = null;

export function primeKeyboard(): void {
  if (typeof document === 'undefined') return;
  if (!matchMedia('(pointer: coarse)').matches) return; // computers don't need this
  if (!field) {
    field = document.createElement('input');
    field.setAttribute('aria-hidden', 'true');
    field.tabIndex = -1;
    // Off to the side but "visible" (iOS ignores focus on hidden fields); 16px avoids zooming.
    Object.assign(field.style, {
      position: 'fixed',
      top: '0',
      left: '-100px',
      width: '1px',
      height: '1px',
      opacity: '0',
      fontSize: '16px',
    });
    document.body.appendChild(field);
  }
  field.focus({ preventScroll: true });
  // If no screen takes over the focus, let the keyboard go again.
  setTimeout(() => {
    if (document.activeElement === field) field?.blur();
  }, 1500);
}
