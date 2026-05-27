import { ArrowLeft, Mail, Globe, Instagram, Twitter, Facebook } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ContactSupportPage() {
  const navigate = useNavigate();
  return (
    <div className="h-full w-full bg-slate-100 overflow-y-auto flex flex-col font-sans">
      <div className="bg-white px-4 py-8 shadow-sm relative z-10 rounded-b-[2rem] flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 active:scale-95 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-black text-slate-900">Contact Support</h2>
      </div>
      <div className="p-6 space-y-4">
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 space-y-4">
          <a href="mailto:help@straykin.com" className="flex items-center gap-4 text-slate-700 hover:text-orange-500 transition-colors">
             <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-500 shrink-0">
               <Mail className="w-5 h-5" />
             </div>
             <div>
               <p className="font-bold">Email Us</p>
               <p className="text-sm text-slate-500">help@straykin.com</p>
             </div>
          </a>
          <a href="https://straykin.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 text-slate-700 hover:text-orange-500 transition-colors">
             <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-500 shrink-0">
               <Globe className="w-5 h-5" />
             </div>
             <div>
               <p className="font-bold">Website</p>
               <p className="text-sm text-slate-500">straykin.com</p>
             </div>
          </a>
        </div>
        
        <h3 className="text-lg font-black text-slate-900 ml-2 pt-4">Social Media</h3>
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 space-y-4">
           <div className="flex items-center gap-4 text-slate-700 hover:text-orange-500 transition-colors cursor-pointer">
             <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
               <Instagram className="w-5 h-5" />
             </div>
             <p className="font-bold">@straykin</p>
           </div>
           <div className="flex items-center gap-4 text-slate-700 hover:text-orange-500 transition-colors cursor-pointer">
             <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
               <Twitter className="w-5 h-5" />
             </div>
             <p className="font-bold">@straykinofficial</p>
           </div>
           <div className="flex items-center gap-4 text-slate-700 hover:text-orange-500 transition-colors cursor-pointer">
             <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
               <Facebook className="w-5 h-5" />
             </div>
             <p className="font-bold">Straykin</p>
           </div>
        </div>
      </div>
    </div>
  );
}
