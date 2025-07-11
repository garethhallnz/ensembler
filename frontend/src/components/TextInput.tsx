import React from 'react';
import { TextInput as FlowbiteTextInput } from 'flowbite-react';

interface TextInputProps {
  id?: string;
  name?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  type?: string;
  disabled?: boolean;
  required?: boolean;
  color?: 'base' | 'gray' | 'info' | 'failure' | 'warning' | 'success';
  sizing?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function TextInput({
  id,
  name,
  placeholder,
  value,
  onChange,
  onBlur,
  type = 'text',
  disabled = false,
  required = false,
  color = 'gray',
  sizing = 'md',
  className = '',
}: TextInputProps) {
  return (
    <FlowbiteTextInput
      id={id}
      name={name}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      type={type}
      disabled={disabled}
      required={required}
      color={color}
      sizing={sizing}
      className={className}
    />
  );
}