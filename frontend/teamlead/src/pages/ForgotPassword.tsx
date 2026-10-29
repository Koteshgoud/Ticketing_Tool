import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiRequest } from '../services/backendAuth';

export const ForgotPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get('email') || '';

  const [email, setEmail] = useState(initialEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [emailSent, setEmailSent] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    setError(null);
    setSent(false);
    try {
      const result = await apiRequest<{ email_sent?: boolean }>('/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setEmailSent(!!result.email_sent);
      setSent(true);
    } catch (err: any) {
      const message = err?.message || '';
      // The backend always returns a generic response to avoid account enumeration
      setEmailSent(null);
      setSent(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center px-4 py-12 font-sans">
      <div className="w-full max-w-[480px] bg-white rounded-3xl p-8 sm:p-10 shadow-sm border border-slate-200/80">
        {/* Back to login */}
        <Link
          to="/login"
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
          Enter your email and we'll send a one-time verification code if your account is eligible.
        </p>

        {sent ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 text-sm text-emerald-700 leading-relaxed font-normal flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                If an account exists for this email, a verification code has been sent.
                {emailSent === false && (
                  <div className="mt-1 text-amber-700">
                    SMTP is not configured on this server, so the code could not be emailed. Contact your administrator to obtain it or configure email delivery.
                  </div>
                )}
              </div>
            </div>
            <Link
              to={`/reset-password?email=${encodeURIComponent(email)}`}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-[#0084FF] hover:bg-[#0073e6] transition-all shadow-sm flex items-center justify-center"
            >
              Enter verification code
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3 text-xs text-rose-600 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}
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
                  onChange={(e) => setEmail(e.target.value)}
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
              {isSubmitting ? 'Sending…' : 'Send verification code'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
