import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicyPage() {
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
        <h2 className="text-2xl font-black text-slate-900">Privacy Policy</h2>
      </div>
      <div className="p-6 text-sm text-slate-700 space-y-4">
        <p><strong>Last Updated: May 26, 2026</strong></p>
        <h3 className="text-lg font-black text-slate-900">1. Information We Collect</h3>
        <p>We collect information you provide directly to us when you register, such as your email address and display name. Your registered pets are private by default unless you mark them as missing or public.</p>
        
        <h3 className="text-lg font-black text-slate-900">2. How We Use Information</h3>
        <p>We use the information we collect to provide, maintain, and improve our services, including to facilitate communication and coordinate stray animal care effectively with minimal disruption.</p>
        
        <h3 className="text-lg font-black text-slate-900">3. Map Data</h3>
        <p>When you check-in or add a stray, we record location data. You can toggle anonymous submissions if you prefer not to display your name alongside public reports.</p>

        <h3 className="text-lg font-black text-slate-900">4. Contact Us</h3>
        <p>If you have any questions about this Privacy Policy, please contact us at <a href="mailto:help@straykin.com" className="text-orange-500 font-bold">help@straykin.com</a>.</p>
      </div>
    </div>
  );
}
