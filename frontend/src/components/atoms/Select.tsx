import React from 'react';
import { Select as FlowbiteSelect } from 'flowbite-react';

interface SelectProps {
  id?: string;
  name?: string;
  children: React.ReactNode;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  required?: boolean;
  color?: 'base' | 'gray' | 'info' | 'failure' | 'warning' | 'success';
  sizing?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Select({
  id,
  name,
  children,
  value,
  onChange,
  onBlur,
  disabled = false,
  required = false,
  color = 'gray',
  sizing = 'md',
  className = '',
}: SelectProps) {
  return (
    <FlowbiteSelect
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      disabled={disabled}
      required={required}
      color={color}
      sizing={sizing}
      className={className}
    >
      {children}
    </FlowbiteSelect>
  );
}