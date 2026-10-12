import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, AlertCircle } from 'lucide-react';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    // Simulating instant verification response aligned with restriction policy
    setTimeout(() => {
      setIsSubmitting(false);
      setNotice('Password reset request blocked: As stated above, self-service reset is restricted to HR and CEO/Admin accounts. Please contact HR or your system administrator.');
    }, 400);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center px-4 py-12 font-sans">
      <div className="w-full max-w-[480px] bg-white rounded-3xl p-8 sm:p-10 shadow-sm border border-slate-200/80">
        {/* Back to login */}
        <Link
          to="/signin"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 font-normal transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:text-slate-900 transition-colors" />
          <span>Back to login</span>
        </Link>

        {/* Title & Subtitle */}
        <h1 className="text-2xl sm:text-[26px] font-bold text-slate-900 tracking-tight mb-2">
          Reset password
        </h1>
        <p className="text-sm text-slate-500 mb-6 font-normal">
          Enter your email and we'll send you a reset link.
        </p>

        {/* Restriction Alert Box */}
        <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 mb-6 text-sm text-rose-600 leading-relaxed font-normal">
          Password reset is restricted to HR and CEO/Admin accounts. For employee password resets, please contact HR or your system administrator.
        </div>

        {/* Notice on submission */}
        {notice && (
          <div className="mb-6 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{notice}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (notice) setNotice(null);
                }}
                placeholder="name@company.com"
                className="block w-full pl-10 pr-3.5 py-2.5 text-sm bg-[#EEF4FB] border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-[#0084FF] hover:bg-[#0073e6] active:bg-[#0066cc] transition-all shadow-sm flex items-center justify-center cursor-pointer disabled:opacity-60"
          >
            {isSubmitting ? 'Checking permissions...' : 'Send reset link'}
          </button>
        </form>
      </div>
    </div>
  );
};
