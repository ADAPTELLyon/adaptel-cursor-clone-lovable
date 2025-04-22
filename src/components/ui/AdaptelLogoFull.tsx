import React from "react";

interface LogoProps {
  className?: string;
}

export function AdaptelLogoFull({ className = "" }: LogoProps) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`}>
      <img
        src="/lovable-uploads/aef96993-219b-4605-9395-ee7283fbf87d.png"
        alt="Adaptel Logo"
        className="h-10 w-10"
      />
      <span className="text-2xl font-bold" style={{ color: "#840404" }}>
        ADAPTEL Lyon
      </span>
    </div>
  );
}
