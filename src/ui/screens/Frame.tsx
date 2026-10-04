import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { sfx } from '../../audio/sfx';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { modal } from '../store';

export function closeModal() {
  sfx('click');
  modal.value = null;
}

export function ModalFrame({
  title,
  eyebrow,
  icon,
  narrow,
  children,
  foot,
  onClose = closeModal,
  closable = true,
}: {
  title: string;
  eyebrow?: string;
  icon?: IconName;
  narrow?: boolean;
  children: ComponentChildren;
  foot?: ComponentChildren;
  onClose?: () => void;
  closable?: boolean;
}) {
  useEffect(() => {
    if (!closable) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose, closable]);
  return (
    <div class="modal-wrap" onClick={(e) => closable && e.target === e.currentTarget && onClose()}>
      <div class={`modal panel ${narrow ? 'narrow' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div class="modal-head">
          {icon && <Icon name={icon} size="xl" cls="accent" />}
          <div class="grow">
            {eyebrow && <div class="eyebrow">{eyebrow}</div>}
            <h1>{title}</h1>
          </div>
          {closable && (
            <button class="btn ghost" aria-label="Close" onClick={onClose}>
              <Icon name="close" size="lg" />
            </button>
          )}
        </div>
        <div class="modal-body scroll">{children}</div>
        {foot && <div class="modal-foot">{foot}</div>}
      </div>
    </div>
  );
}
