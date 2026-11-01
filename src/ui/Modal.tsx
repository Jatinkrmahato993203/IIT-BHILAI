import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon, type IconName } from './icons';

export type ModalButton = { label: string; value: string; primary?: boolean; disabled?: boolean };

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Period-styled modal dialog. Traps focus while open, returns focus to the invoker on close,
 * and only closes on Escape when a cancel value is supplied.
 */
export function Modal(props: {
  title: string;
  icon?: IconName;
  children: ReactNode;
  buttons?: ModalButton[];
  onResult: (value: string) => void;
  cancelValue?: string;
  scope?: 'window' | 'desktop';
  width?: number;
  initialFocus?: 'first-input' | 'primary';
  role?: 'dialog' | 'alertdialog';
}) {
  const { title, icon, children, buttons = [{ label: 'OK', value: 'ok', primary: true }], onResult, cancelValue, scope = 'desktop', width = 360, initialFocus = 'primary', role = 'dialog' } = props;
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const resultRef = useRef(onResult);
  useEffect(() => {
    resultRef.current = onResult;
  });

  useEffect(() => {
    const invoker = document.activeElement as HTMLElement | null;
    const el = ref.current;
    if (el) {
      const target =
        (initialFocus === 'first-input' ? el.querySelector<HTMLElement>('input, textarea, select') : null) ??
        el.querySelector<HTMLElement>('[data-primary="true"]') ??
        el.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus();
    }
    return () => {
      if (!invoker || !invoker.isConnected || typeof invoker.focus !== 'function') return;
      // If the dialog's result activated a different window (e.g. "Open folder"), do not pull
      // focus back into the old, now-inactive window — that would re-activate it on top.
      const host = invoker.closest('.os-window');
      if (host && host.getAttribute('data-active') !== 'true') return;
      invoker.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      if (cancelValue !== undefined) resultRef.current(cancelValue);
      return;
    }
    if (e.key === 'Tab' && ref.current) {
      const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null || x === document.activeElement);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div className={`modal-backdrop modal-${scope}`} onPointerDown={(e) => e.stopPropagation()}>
      <div
        ref={ref}
        className="window modal"
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        style={{ width }}
        onKeyDown={onKeyDown}
      >
        <div className="title-bar">
          <div className="title-bar-text" id={titleId}>
            {title}
          </div>
          {cancelValue !== undefined && (
            <div className="title-bar-controls">
              <button aria-label="Close" onClick={() => onResult(cancelValue)} />
            </div>
          )}
        </div>
        <div className="window-body modal-body">
          <div className="modal-content" id={bodyId}>
            {icon && <Icon name={icon} size={32} className="modal-icon" />}
            <div className="modal-text">{children}</div>
          </div>
          {buttons.length > 0 && (
            <div className="modal-buttons">
              {buttons.map((b) => (
                <button key={b.value} data-primary={b.primary ? 'true' : undefined} disabled={b.disabled} onClick={() => onResult(b.value)}>
                  {b.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
