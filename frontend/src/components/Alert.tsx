import { Alert as FlowbiteAlert } from 'flowbite-react';
import { HiInformationCircle } from 'react-icons/hi';
import type { FC, SVGProps } from 'react';

interface AlertProps {
  children: React.ReactNode;
  color?: 'blue' | 'red' | 'green' | 'yellow' | 'gray' | 'dark' | 'info';
  icon?: FC<SVGProps<SVGSVGElement>>;
  onDismiss?: () => void;
  rounded?: boolean;
  withBorderAccent?: boolean;
  className?: string;
}

export default function Alert({
  children,
  color = 'blue',
  icon: Icon = HiInformationCircle,
  onDismiss,
  rounded = true,
  withBorderAccent = false,
  className = '',
}: AlertProps) {
  return (
    <FlowbiteAlert
      color={color}
      icon={Icon}
      onDismiss={onDismiss}
      rounded={rounded}
      withBorderAccent={withBorderAccent}
      className={className}
    >
      {children}
    </FlowbiteAlert>
  );
}