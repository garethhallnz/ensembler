import React from 'react';
import { Button as FlowbiteButton } from 'flowbite-react';
import Spinner from './Spinner';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'neutral';

type ButtonProps = {
  variant?: ButtonVariant;
  color?: 'blue' | 'gray' | 'green' | 'red' | 'yellow' | 'purple' | 'pink';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  outline?: boolean;
  pill?: boolean;
  loading?: boolean;
  className?: string;
  children: React.ReactNode;
  tooltip?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const variantColorMap: Record<ButtonVariant, string> = {
  primary: 'blue',
  secondary: 'gray',
  success: 'green',
  danger: 'red',
  warning: 'yellow',
  info: 'blue',
  neutral: 'gray',
};

export default function Button({
  children,
  variant,
  color,
  size = 'md',
  outline = false,
  pill = false,
  loading = false,
  className = '',
  disabled = false,
  tooltip,
  ...rest
}: ButtonProps) {
  const buttonColor = variant ? variantColorMap[variant] : (color || 'blue');
  const baseClasses = 'transition-all duration-200 font-medium focus:ring-2 focus:ring-offset-2';
  
  return (
    <FlowbiteButton
      color={buttonColor}
      size={size}
      outline={outline}
      pill={pill}
      className={`${baseClasses} ${className}`}
      disabled={disabled || loading}
      title={tooltip}
      {...rest}
    >
      <span className="flex items-center justify-center">
        {children}
        {loading && <Spinner size={size} className="ml-2" />}
      </span>
    </FlowbiteButton>
  );
}