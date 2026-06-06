import React from 'react';

interface AdBannerProps {
  className?: string;
  format?: 'banner' | 'homeBanner' | 'rectangle' | 'skyscraper';
}

export function AdBanner({ className = '', format = 'banner' }: AdBannerProps) {
  let containerClasses = "";
  let adSource = "/ad-300x250.html";

  if (format === 'homeBanner' || format === 'banner') {
    containerClasses = "w-[728px] h-[90px] min-h-[90px] max-w-full";
    adSource = "/ad-728x90.html";
  } else if (format === 'rectangle') {
     containerClasses = "w-[300px] h-[250px] min-h-[250px]";
     adSource = "/ad-300x250.html";
  } else if (format === 'skyscraper') {
     containerClasses = "w-[160px] h-[600px] min-h-[600px]";
     adSource = "/ad-160x600.html";
  }

  return (
    <div className={`relative overflow-hidden flex flex-col items-center justify-center bg-slate-50 border border-slate-200/60 rounded-xl shadow-sm group ${containerClasses} ${className}`}>
      <span className="absolute z-0 text-[10px] font-black uppercase tracking-widest text-slate-300 pointer-events-none">Sponsor</span>
      <iframe
        title="Advertisement"
        src={adSource}
        className="w-full h-full relative z-10 border-0 bg-transparent"
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin"
        scrolling="no"
      />
    </div>
  );
}

