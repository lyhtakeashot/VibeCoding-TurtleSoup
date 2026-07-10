import { ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'neon' | 'ghost' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const cls: Record<Variant, string> = {
  neon: 'btn-neon',
  ghost: 'btn-ghost',
  danger: 'btn-ghost border-neon-pink/50 text-neon-pink hover:bg-neon-pink/10',
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'neon', className = '', ...rest }, ref) => (
    <button ref={ref} className={`${cls[variant]} ${className}`} {...rest} />
  ),
);
Button.displayName = 'Button';
