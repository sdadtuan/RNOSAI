import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  children?: ReactNode;
};

export function Chip({ active = false, className, type = 'button', children, ...rest }: ChipProps) {
  const classes = ['rn-chip', active ? 'rn-chip--active' : '', className].filter(Boolean).join(' ');
  return (
    <button type={type} className={classes} aria-pressed={active} {...rest}>
      {children}
    </button>
  );
}
