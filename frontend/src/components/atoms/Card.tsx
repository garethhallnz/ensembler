import React from 'react';
import { Card as FlowbiteCard } from 'flowbite-react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  href?: string;
  horizontal?: boolean;
  imgAlt?: string;
  imgSrc?: string;
}

export default function Card({
  children,
  className = '',
  href,
  horizontal = false,
  imgAlt,
  imgSrc,
}: CardProps) {
  return (
    <FlowbiteCard
      className={className}
      href={href}
      horizontal={horizontal}
      imgAlt={imgAlt}
      imgSrc={imgSrc}
    >
      {children}
    </FlowbiteCard>
  );
}

interface CardSubComponentProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

Card.Header = function CardHeader({ children, className = '', onClick }: CardSubComponentProps) {
  return <div className={`p-4 border-b border-gray-200 dark:border-gray-700 ${className}`} onClick={onClick}>{children}</div>;
};

Card.Body = function CardBody({ children, className = '' }: CardSubComponentProps) {
  return <div className={`p-4 ${className}`}>{children}</div>;
};

Card.Footer = function CardFooter({ children, className = '' }: CardSubComponentProps) {
  return <div className={`p-4 border-t border-gray-200 dark:border-gray-700 ${className}`}>{children}</div>;
};