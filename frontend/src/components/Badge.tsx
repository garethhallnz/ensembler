import React from 'react';
import { Badge as FlowbiteBadge } from 'flowbite-react';
import type { FC, SVGProps } from 'react';

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral' | 'running' | 'stopped' | 'update';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  color?: 'blue' | 'red' | 'green' | 'yellow' | 'gray' | 'indigo' | 'purple' | 'pink' | 'dark';
  icon?: FC<SVGProps<SVGSVGElement>>;
  size?: 'xs' | 'sm';
  className?: string;
}

const variantColorMap: Record<BadgeVariant, string> = {
  success: 'green',
  error: 'red',
  warning: 'yellow',
  info: 'blue',
  neutral: 'gray',
  running: 'green',
  stopped: 'red',
  update: 'yellow',
};

export default function Badge({
  children,
  variant,
  color,
  icon: Icon,
  size = 'xs',
  className = '',
}: BadgeProps) {
  const badgeColor = variant ? variantColorMap[variant] : (color || 'blue');
  
  return (
    <FlowbiteBadge
      color={badgeColor}
      icon={Icon}
      size={size}
      className={`font-medium ${className}`}
    >
      {children}
    </FlowbiteBadge>
  );
}