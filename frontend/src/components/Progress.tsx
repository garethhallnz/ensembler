import React from 'react';
import { Progress as FlowbiteProgress } from 'flowbite-react';

interface ProgressProps {
  progress: number;
  color?: 'dark' | 'blue' | 'red' | 'green' | 'yellow' | 'indigo' | 'purple' | 'pink';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export default function Progress({
  progress,
  color = 'blue',
  size = 'md',
  className = '',
}: ProgressProps) {
  return (
    <FlowbiteProgress
      progress={progress}
      color={color}
      size={size}
      className={className}
    />
  );
}