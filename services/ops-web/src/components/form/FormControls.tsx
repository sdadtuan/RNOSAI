'use client';

import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { formClasses } from './form-utils';

export const FormInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function FormInput({ className, ...props }, ref) {
    return <input ref={ref} className={formClasses('form-input', className)} {...props} />;
  },
);

export const FormTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function FormTextarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={formClasses('form-input', className)} {...props} />;
  },
);

export const FormSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function FormSelect({ className, ...props }, ref) {
    return <select ref={ref} className={formClasses('form-input', className)} {...props} />;
  },
);
