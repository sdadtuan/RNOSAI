import type { InputHTMLAttributes } from 'react';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: boolean;
};

export function Input({ error = false, className, ...rest }: InputProps) {
  const classes = ['rn-input', error ? 'rn-input--error' : '', className].filter(Boolean).join(' ');
  return <input className={classes} {...rest} />;
}
