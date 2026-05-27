import React, { useState } from 'react';
import { LucideIcon } from 'lucide-react';

interface CustomIconProps {
  src: string;
  FallbackIcon: LucideIcon;
  className?: string;
}

export function CustomIcon({ src, FallbackIcon, className = 'w-6 h-6' }: CustomIconProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return <FallbackIcon className={className} />;
  }

  return (
    <img 
      src={src} 
      alt="icon" 
      className={`object-contain ${className}`}
      onError={() => setHasError(true)}
    />
  );
}
