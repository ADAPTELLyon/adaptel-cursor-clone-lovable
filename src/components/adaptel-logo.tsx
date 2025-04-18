
import React from 'react';

interface LogoProps {
  className?: string;
}

export function AdaptelLogo({ className = "w-40" }: LogoProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="font-semibold text-2xl">
        <span className="text-adaptel">Adaptel</span>
        <span className="text-gray-800"> Lyon</span>
      </div>
    </div>
  );
}
