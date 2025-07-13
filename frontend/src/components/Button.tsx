import React from 'react';
import { Button as FlowbiteButton } from 'flowbite-react';
import Spinner from './Spinner';

type ButtonProps = {
  color?: 'blue' | 'gray' | 'green' | 'red' | 'yellow' | 'purple' | 'pink';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  outline?: boolean;
  pill?: boolean;
  loading?: boolean;
  className?: string;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export default function Button({
  children,
  color = 'blue',
  size = 'md',
  outline = false,
  pill = false,
  loading = false,
  className = '',
  disabled = false,
  ...rest
}: ButtonProps) {
  return (
    <FlowbiteButton
      color={color}
      size={size}
      outline={outline}
      pill={pill}
      className={className}
      disabled={disabled || loading}
      {...rest}
    >
      <span className="flex items-center justify-center">
        {children}
        {loading && <Spinner size={size} className="ml-2" />}
      </span>
    </FlowbiteButton>
  );
}