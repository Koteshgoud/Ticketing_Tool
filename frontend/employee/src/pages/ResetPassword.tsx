import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Ticket, Lock, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { apiRequest } from '../services/backendAuth';

export const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const hashQuery = typeof window !== 'undefined' && window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
  const queryParams = new URLSearchParams(hashQuery || (typeof window !== 'undefined' ? window.location.search : ''));
  const [email, setEmail] = useState(queryParams.get('email') || '');
  const [code, setCode] = useState(queryParams.get('code') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = 'Registered email is required';
    }

    if (!code.trim()) {
      newErrors.code = '6-digit verification code is required';
    }

    if (!password) {
      newErrors.password = 'New Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    const cleanEmail = email.trim().toLowerCase();

    try {
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          code: code.trim(),
          new_password: password,
        }),
      });
      setIsSuccess(true);
    } catch (err: any) {
      const message = err?.message || '';
      if (message.toLowerCase().includes('code')) {
        setErrors({ code: 'Invalid or expired verification code. Please check your email.' });
      } else if (message.toLowerCase().includes('not found')) {
        setErrors({ email: 'No account found with this email address.' });
      } else if (message.toLowerCase().includes('restricted')) {
        setErrors({ general: 'Password reset is restricted to administrator accounts.' });
      } else {
        setErrors({ general: message || 'Failed to update password. Please try again.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <div className="w-12 h-12 rounded-xl bg-[#0284C7] flex items-center justify-center text-white mx-auto shadow-sm">
          <Ticket className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Reset Employee Password
        </h2>
        <p className="text-xs text-slate-500">
          Enter your verification code and set a new password.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 sm:rounded-xl sm:px-10">
          {isSuccess ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Password Reset Complete!</h3>
              <p className="text-xs text-slate-600">
                Your employee password has been updated in the database.
              </p>
              <Button
                variant="primary"
                className="w-full justify-center py-2.5 font-semibold mt-2"
                onClick={() => navigate('/signin')}
              >
                Sign In With New Password
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              {errors.general && (
                <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                  {errors.general}
                </div>
              )}

              <Input
                label="Registered Work Email *"
                type="email"
                placeholder="employee@company.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                }}
                error={errors.email}
              />

              <Input
                label="Verification Code (from email) *"
                type="text"
                placeholder="6-digit code e.g. 123456"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (errors.code) setErrors((prev) => ({ ...prev, code: '' }));
                }}
                error={errors.code}
              />

              <Input
                label="New Password *"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                }}
                error={errors.password}
                icon={<Lock className="w-4 h-4" />}
              />

              <Input
                label="Confirm New Password *"
                type="password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: '' }));
                }}
                error={errors.confirmPassword}
                icon={<Lock className="w-4 h-4" />}
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full justify-center py-2.5 font-semibold mt-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Resetting Password...' : 'Reset Password'}
              </Button>
            </form>
          )}

          <div className="mt-6 border-t border-slate-100 pt-4 text-center">
            <Link to="/signin" className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 font-medium">
              <ArrowLeft className="w-3.5 h-3.5" /> Return to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
