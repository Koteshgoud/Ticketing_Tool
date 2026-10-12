import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    setRestrictedWarning(null);
    const cleanEmail = email.trim().toLowerCase();

    try {
      const { data: dbUser, error: queryErr } = await supabase
        .from('users')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      // If user is a teamlead or employee, block and display restriction alert
      if (dbUser && dbUser.role === 'teamlead') {
        setIsSubmitting(false);
        setRestrictedWarning(
          'Password reset is restricted to HR and CEO/Admin accounts. For team lead password resets, please contact HR or your system administrator.'
        );
        return;
      }

      if (dbUser && dbUser.role === 'employee') {
        setIsSubmitting(false);
        setRestrictedWarning(
          'Password reset is restricted to HR and CEO/Admin accounts. For employee password resets, please contact HR or your system administrator.'
        );
        return;
      }

      // If no admin account exists for this email
      if (queryErr || !dbUser || dbUser.role !== 'admin') {
        setIsSubmitting(false);
        setRestrictedWarning(
          'Password reset is restricted to HR and CEO/Admin accounts. For employee password resets, please contact HR or your system administrator.'
        );
        return;
      }

      // Admin account: send live reset link/code
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
      await supabase
        .from('users')
        .update({ invite_token: `reset-${resetCode}` })
        .eq('email', cleanEmail);

      const baseUrl = window.location.href.split('#')[0].replace(/\/+$/, '');
      const resetUrl = `${baseUrl}/#/admin/auth/reset-password?email=${encodeURIComponent(cleanEmail)}&code=${resetCode}`;
      await fetch('http://localhost:8000/api/v1/notifications/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          name: dbUser.name || 'Admin',
          reset_code: resetCode,
          reset_url: resetUrl,
          portal: 'Admin Portal',
        }),
      });

      setIsSubmitted(true);
    } catch (err: any) {
      console.warn('Password reset error:', err);
      setIsSubmitted(true);
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
          Enter your email and we'll send you a reset link.
        </p>

        {/* Restriction Alert Box: Appears when employee/teamlead tries to enter forgot pwd */}
        {restrictedWarning && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 mb-6 text-sm text-rose-600 leading-relaxed font-normal animate-in fade-in duration-200">
            {restrictedWarning}
          </div>
        )}

        {isSubmitted ? (
          <div className="text-center space-y-4 py-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Recovery Email Sent!</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              We sent password reset instructions to <strong className="text-slate-900">{email}</strong>. Please check your inbox.
            </p>
            <div className="pt-2">
              <Link
                to={`/admin/auth/reset-password?email=${encodeURIComponent(email.trim())}`}
                className="w-full inline-flex justify-center items-center py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369a1] shadow-sm transition-all"
              >
                Proceed to Reset Password
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
              {isSubmitting ? 'Checking permissions...' : 'Send reset link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
