import type { ReactNode, TableHTMLAttributes } from 'react';

export type TableProps = TableHTMLAttributes<HTMLTableElement> & {
  children?: ReactNode;
};

export function Table({ className, children, ...rest }: TableProps) {
  const classes = ['rn-table', className].filter(Boolean).join(' ');
  return (
    <table className={classes} {...rest}>
      {children}
    </table>
  );
}
