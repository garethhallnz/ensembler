import React from 'react';
import { Tabs as FlowbiteTabs } from 'flowbite-react';

interface TabsProps {
  children: React.ReactNode;
  variant?: 'default' | 'underline' | 'pills' | 'fullWidth';
  className?: string;
}

export default function Tabs({
  children,
  variant = 'default',
  className = '',
}: TabsProps) {
  return (
    <FlowbiteTabs
      variant={variant}
      className={className}
    >
      {children}
    </FlowbiteTabs>
  );
}

interface TabProps {
  children: React.ReactNode;
  className?: string;
}

Tabs.Tab = function Tab({
  children,
  className = '',
}: TabProps) {
  return (
    <div className={className}>
      {children}
    </div>
  );
};