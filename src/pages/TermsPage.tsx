import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TermsPage() {
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
        <h2 className="text-2xl font-black text-slate-900">Terms & Conditions</h2>
      </div>
      <div className="p-6 text-sm text-slate-700 space-y-4">
        <p><strong>Last Updated: May 26, 2026</strong></p>
        <h3 className="text-lg font-black text-slate-900">1. Acceptance of Terms</h3>
        <p>By accessing or using Straykin, you agree to be bound by these Terms. If you disagree with any part of these terms, you may not access our services.</p>
        
        <h3 className="text-lg font-black text-slate-900">2. User Conduct</h3>
        <p>You agree not to engage in any activity that interferes with or disrupts the Services. Harassment, abuse, or misleading acts toward other community members or animals will result in an immediate ban.</p>
        
        <h3 className="text-lg font-black text-slate-900">3. Reporting Stray Animals</h3>
        <p>Information provided about stray animals must be accurate to your best knowledge. False reporting, spamming pins, or misusing the SOS feature may lead to account suspension.</p>

        <h3 className="text-lg font-black text-slate-900">4. Volunteering & Liability</h3>
        <p>Straykin acts as a facilitator for community efforts. We are not liable for any incidents, injuries, or disputes between caretakers, members, or animals on the street.</p>
      </div>
    </div>
  );
}
