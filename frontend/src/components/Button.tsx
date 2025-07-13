import React from 'react';
import { Button as FlowbiteButton } from 'flowbite-react';
import Spinner from './Spinner';

interface ButtonProps {
  children: React.ReactNode;
  color?: 'blue' | 'gray' | 'green' | 'red' | 'yellow' | 'purple' | 'pink';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
  disabled?: boolean;
  outline?: boolean;
  pill?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  loading?: boolean;
}

export default function Button({
  children,
  color = 'blue',
  size = 'md',
  onClick,
  disabled = false,
  outline = false,
  pill = false,
  className = '',
  type = 'button',
  loading = false,
}: ButtonProps) {
  return (
    <FlowbiteButton
      color={color}
      size={size}
      onClick={onClick}
      disabled={disabled || loading}
      outline={outline}
      pill={pill}
      className={className}
      type={type}
    >
      <span className="flex items-center justify-center">
        {children}
        {loading && <Spinner size={size} className="ml-2" />}
      </span>
    </FlowbiteButton>
  );
}