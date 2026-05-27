import React, { useEffect, useRef } from 'react';

interface AdBannerProps {
  className?: string;
  format?: 'banner' | 'rectangle';
}

export function AdBanner({ className = '', format = 'banner' }: AdBannerProps) {
  const adRef = useRef<HTMLDivElement>(null);

  // In a real Adsterra integration, you would inject the ad script into this container.
  // Example for Adsterra:
  // useEffect(() => {
  //   if (adRef.current && !adRef.current.firstChild) {
  //     const script = document.createElement('script');
  //     script.type = 'text/javascript';
  //     script.src = `//www.highperformanceformat.com/YOUR_ADSTERRA_ID/invoke.js`;
  //     adRef.current.appendChild(script);
  //   }
  // }, []);

  return (
    <div className={`w-full overflow-hidden flex flex-col items-center justify-center bg-slate-50 border border-slate-200/60 rounded-3xl p-4 shadow-sm ${format === 'rectangle' ? 'aspect-square max-w-[300px] mx-auto' : 'min-h-[100px]'} ${className}`}>
      <div ref={adRef} className="w-full h-full flex flex-col items-center justify-center opacity-60">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Advertisement</span>
        <div className="w-8 h-8 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center">
          <span className="text-xl">✨</span>
        </div>
        <p className="text-xs text-slate-400 font-bold mt-2 text-center max-w-[200px]">Adsterra Space<br/><span className="font-medium text-[10px]">Configure your tags here</span></p>
      </div>
    </div>
  );
}
