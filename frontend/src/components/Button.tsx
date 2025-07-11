import React from 'react';
import { Button as FlowbiteButton } from 'flowbite-react';

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
}: ButtonProps) {
  return (
    <FlowbiteButton
      color={color}
      size={size}
      onClick={onClick}
      disabled={disabled}
      outline={outline}
      pill={pill}
      className={className}
      type={type}
    >
      {children}
    </FlowbiteButton>
  );
}