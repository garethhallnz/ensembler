
import React from 'react';
import { Spinner as FlowbiteSpinner } from 'flowbite-react';

interface SpinnerProps {
  color?: 'blue' | 'gray' | 'green' | 'red' | 'yellow' | 'pink' | 'purple';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  light?: boolean;
  className?: string;
}

export default function Spinner({
  color = 'blue',
  size = 'md',
  light = false,
  className = '',
}: SpinnerProps) {
  return (
    <FlowbiteSpinner
      color={color}
      size={size}
      light={light}
      className={className}
    />
  );
}