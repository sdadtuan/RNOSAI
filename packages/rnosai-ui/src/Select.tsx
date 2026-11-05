import type { ReactNode, SelectHTMLAttributes } from 'react';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  error?: boolean;
  children?: ReactNode;
};

export function Select({ error = false, className, children, ...rest }: SelectProps) {
  const classes = ['rn-select', error ? 'rn-select--error' : '', className].filter(Boolean).join(' ');
  return (
    <select className={classes} {...rest}>
      {children}
    </select>
  );
}
