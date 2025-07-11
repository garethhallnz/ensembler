import React from 'react';
import { Badge as FlowbiteBadge } from 'flowbite-react';
import type { FC, SVGProps } from 'react';

interface BadgeProps {
  children: React.ReactNode;
  color?: 'blue' | 'red' | 'green' | 'yellow' | 'gray' | 'indigo' | 'purple' | 'pink' | 'dark';
  icon?: FC<SVGProps<SVGSVGElement>>;
  size?: 'xs' | 'sm';
  className?: string;
}

export default function Badge({
  children,
  color = 'blue',
  icon: Icon,
  size = 'xs',
  className = '',
}: BadgeProps) {
  return (
    <FlowbiteBadge
      color={color}
      icon={Icon}
      size={size}
      className={className}
    >
      {children}
    </FlowbiteBadge>
  );
}