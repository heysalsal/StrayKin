import React, { useEffect, useRef } from 'react';

interface AdBannerProps {
  className?: string;
  format?: 'banner' | 'rectangle';
}

export function AdBanner({ className = '', format = 'banner' }: AdBannerProps) {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (adRef.current && adRef.current.children.length === 3 /* Only placeholder elements */) {
      // Clear placeholder
      adRef.current.innerHTML = '';
      
      const confScript = document.createElement('script');
      confScript.type = 'text/javascript';
      confScript.innerHTML = `
        var atOptions = {
          'key' : 'd28456b0fe9ac214855f0dc0be8bdef9',
          'format' : 'iframe',
          'height' : 90,
          'width' : 728,
          'params' : {}
        };
      `;
      adRef.current.appendChild(confScript);

      const invokeScript = document.createElement('script');
      invokeScript.type = 'text/javascript';
      invokeScript.async = true;
      invokeScript.src = "https://www.highperformanceformat.com/d28456b0fe9ac214855f0dc0be8bdef9/invoke.js";
      adRef.current.appendChild(invokeScript);
    }
  }, []);


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
