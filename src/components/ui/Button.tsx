import { Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { forwardRef, useCallback, useRef, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'outline' | 'text';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'fab';

type ButtonClassOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  active?: boolean;
  loading?: boolean;
  iconOnly?: boolean;
  fullWidth?: boolean;
  className?: string;
};

export function buttonClassName({
  variant = 'secondary',
  size = 'md',
  active = false,
  loading = false,
  iconOnly = false,
  fullWidth = false,
  className
}: ButtonClassOptions = {}) {
  return clsx(
    'ui-button',
    `ui-button--${variant}`,
    `ui-button--${size}`,
    {
      'is-active': active,
      'is-loading': loading,
      'is-icon-only': iconOnly || size === 'icon' || size === 'fab',
      'is-full-width': fullWidth
    },
    className
  );
}

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> &
  ButtonClassOptions & {
    children: ReactNode;
    rotateIconOnHover?: boolean;
    magnetic?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    active = false,
    loading = false,
    iconOnly = false,
    fullWidth = false,
    rotateIconOnHover = false,
    magnetic = false,
    className,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref
) {
  const resolvedDisabled = disabled || loading;
  const btnRef = useRef<HTMLButtonElement>(null);
  const combinedRef = useCallback((node: HTMLButtonElement | null) => {
    (btnRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }, [ref]);

  const handleClick = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    const btn = btnRef.current;
    if (!btn || resolvedDisabled) return;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
    props.onClick?.(e);
  }, [resolvedDisabled, props.onClick]);

  return (
    <button
      {...props}
      ref={combinedRef}
      type={type}
      className={buttonClassName({
        variant,
        size,
        active,
        loading,
        iconOnly,
        fullWidth,
        className: clsx(className, magnetic && 'magnetic')
      })}
      disabled={resolvedDisabled}
      aria-busy={loading || undefined}
      data-rotate-icon={rotateIconOnHover ? 'true' : undefined}
      onClick={handleClick}
    >
      <span className="ui-button__content">{children}</span>
      {loading ? <Loader2 className="ui-button__spinner" size={16} aria-hidden="true" /> : null}
    </button>
  );
});
