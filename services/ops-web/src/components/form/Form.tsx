'use client';

import type { FormHTMLAttributes, HTMLAttributes, LabelHTMLAttributes, ReactNode } from 'react';
import { formClasses } from './form-utils';

type FormProps = FormHTMLAttributes<HTMLFormElement> & {
  /** Stack fields vertically without `<form>` semantics (drawers, modal bodies). */
  asDiv?: boolean;
};

export function Form({ asDiv, className, children, ...props }: FormProps) {
  if (asDiv) {
    return (
      <div className={formClasses('form-stack', className)} {...(props as HTMLAttributes<HTMLDivElement>)}>
        {children}
      </div>
    );
  }
  return (
    <form className={formClasses('form-stack', className)} noValidate {...props}>
      {children}
    </form>
  );
}

type FormSectionProps = HTMLAttributes<HTMLElement> & {
  title?: ReactNode;
  as?: 'section' | 'div';
};

export function FormSection({ title, as = 'section', className, children, ...props }: FormSectionProps) {
  const Tag = as;
  return (
    <Tag className={formClasses('form-section', className)} {...props}>
      {title ? <h2 className="form-section-title">{title}</h2> : null}
      {children}
    </Tag>
  );
}

type FormGridProps = HTMLAttributes<HTMLDivElement> & {
  cols?: 1 | 2 | 3;
};

export function FormGrid({ cols = 1, className, children, ...props }: FormGridProps) {
  return (
    <div
      className={formClasses(
        'form-grid',
        cols === 2 && 'form-grid--2',
        cols === 3 && 'form-grid--3',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type FormFieldProps = Omit<LabelHTMLAttributes<HTMLLabelElement>, 'children'> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
};

export function FormField({
  label,
  hint,
  error,
  required,
  fullWidth,
  className,
  children,
  ...props
}: FormFieldProps) {
  return (
    <label className={formClasses('form-field', fullWidth && 'form-field--full', className)} {...props}>
      <span className="form-label">
        {label}
        {required ? <span className="form-required" aria-hidden="true">
            {' '}
            *
          </span> : null}
      </span>
      {children}
      {hint ? <span className="form-hint">{hint}</span> : null}
      {error ? <span className="form-field-error" role="alert">{error}</span> : null}
    </label>
  );
}

type FormCheckProps = LabelHTMLAttributes<HTMLLabelElement> & {
  label: ReactNode;
};

export function FormCheck({ label, className, children, ...props }: FormCheckProps) {
  return (
    <label className={formClasses('form-check', className)} {...props}>
      {children}
      <span>{label}</span>
    </label>
  );
}

type FormFooterProps = HTMLAttributes<HTMLElement>;

export function FormFooter({ className, children, ...props }: FormFooterProps) {
  return (
    <footer className={formClasses('form-footer', className)} {...props}>
      {children}
    </footer>
  );
}

type FormErrorProps = HTMLAttributes<HTMLParagraphElement>;

export function FormError({ className, children, ...props }: FormErrorProps) {
  if (!children) return null;
  return (
    <p className={formClasses('form-error', className)} role="alert" {...props}>
      {children}
    </p>
  );
}
