import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { API_BASE, ApiError, apiRequest } from '../../services/backendAuth';

interface ForgotPasswordResponse {
  message: string;
  email_sent: boolean;
}

export const ForgotPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get('email') || '';
  const initialWarning = searchParams.get('warning') === 'true';

  const [email, setEmail] = useState(initialEmail);
  const [restrictedWarning, setRestrictedWarning] = useState<string | null>(
    initialWarning
      ? 'Password reset is restricted to HR and CEO/Admin accounts. For employee password resets, please contact HR or your system administrator.'
      : null
  );
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    setRestrictedWarning(null);
    const cleanEmail = email.trim().toLowerCase();

    try {
      // The backend decides whether the address belongs to an administrator and
      // never reveals that decision, so the UI cannot enumerate accounts.
      const baseUrl = window.location.href.split('#')[0].replace(/\/+$/, '');
      const data = await apiRequest<ForgotPasswordResponse>('/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          reset_url: `${baseUrl}/#/admin/auth/reset-password`,
        }),
      });
      setEmailSent(data.email_sent !== false);
      setIsSubmitted(true);
    } catch (err) {
      // A network/API failure must be visible instead of pretending the mail
      // went out.
      setRestrictedWarning(
        err instanceof ApiError && err.status === 0
          ? 'Cannot reach the backend API. Make sure the server is running and try again.'
          : err instanceof Error
            ? err.message
            : `Could not request a password reset from ${API_BASE}.`
      );
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
          Enter your admin email and we'll send you a verification code.
        </p>

        {restrictedWarning && (
          <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50/40 p-4 mb-6 text-sm text-rose-600 leading-relaxed font-normal animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{restrictedWarning}</span>
          </div>
        )}

        {isSubmitted ? (
          <div className="text-center space-y-4 py-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Request received</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              If an administrator account exists for{' '}
              <strong className="text-slate-900">{email}</strong>, a verification code has
              been sent to that mailbox.
            </p>
            {!emailSent && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 leading-relaxed text-left">
                The backend could not deliver the email because SMTP is not configured.
                Ask your system administrator to configure email delivery, or to reset the
                password from the Admin portal.
              </div>
            )}
            <div className="pt-2">
              <Link
                to={`/admin/auth/reset-password?email=${encodeURIComponent(email.trim())}`}
                className="w-full inline-flex justify-center items-center py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369a1] shadow-sm transition-all"
              >
                I have a verification code
              </Link>
            </div>
          </div>
        ) : (
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
                    if (restrictedWarning) setRestrictedWarning(null);
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
              {isSubmitting ? 'Sending code...' : 'Send verification code'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
