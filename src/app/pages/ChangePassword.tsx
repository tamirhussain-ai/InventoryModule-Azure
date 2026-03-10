import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { AuthService } from '../services/auth';
import { changePassword } from '../services/api';
import { toast } from 'sonner';
import { KeyRound, CheckCircle2, Eye, EyeOff, ShieldCheck, Lock } from 'lucide-react';

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500' };
  if (score <= 2) return { score, label: 'Fair', color: 'bg-orange-500' };
  if (score <= 3) return { score, label: 'Good', color: 'bg-yellow-500' };
  if (score <= 4) return { score, label: 'Strong', color: 'bg-blue-500' };
  return { score, label: 'Very Strong', color: 'bg-green-500' };
}

export default function ChangePassword() {
  const navigate = useNavigate();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const [searchParams] = useSearchParams();
  const user = AuthService.getCurrentUser();

  // Determine if this is a forced reset, expired password, or voluntary change
  const isForced = (user as any)?.mustResetPassword === true;
  const isExpired = searchParams.get('reason') === 'expired';

  useEffect(() => {
    // If no user session, send back to login
    if (!AuthService.isAuthenticated()) {
      navigate('/');
    }
  }, [navigate]);

  const strength = getPasswordStrength(newPassword);
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const redirectToDashboard = (role?: string) => {
    switch (role) {
      case 'admin': navigate('/admin'); break;
      case 'fulfillment': navigate('/fulfillment'); break;
      case 'approver': navigate('/approver'); break;
      default: navigate('/requestor'); break;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isForced && !isExpired && !oldPassword) {
      toast.error('Please enter your current password');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (!isForced && !isExpired && oldPassword === newPassword) {
      toast.error('New password must be different from your current password');
      return;
    }

    setLoading(true);
    try {
      // Call the server endpoint — it uses the admin API to update the password
      // and clears the mustResetPassword flag in KV atomically.
      // For voluntary changes, oldPassword is sent for verification.
      // For expired passwords, bypass old password requirement (user just authenticated).
      await changePassword(newPassword, (isForced || isExpired) ? undefined : oldPassword);

      // Update local storage so the flag is reflected immediately
      const storedUser = AuthService.getCurrentUser();
      if (storedUser) {
        const updatedUser = { ...storedUser, mustResetPassword: false };
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }

      setDone(true);
      toast.success('Password changed successfully!');

      // Redirect after short delay
      setTimeout(() => {
        redirectToDashboard(user?.role);
      }, 2000);
    } catch (error: any) {
      console.error('Change password error:', error);
      toast.error(error.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-10 space-y-4">
            <div className="flex justify-center">
              <div className="bg-green-100 p-4 rounded-full">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Password Changed!</h2>
            <p className="text-gray-600">Your new password is set. Redirecting you to your dashboard…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className={`p-3 rounded-lg ${isForced ? 'bg-amber-500' : isExpired ? 'bg-orange-500' : 'bg-blue-600'}`}>
              {isForced || isExpired ? (
                <KeyRound className="h-8 w-8 text-white" />
              ) : (
                <Lock className="h-8 w-8 text-white" />
              )}
            </div>
          </div>
          <CardTitle className="text-2xl">
            {isForced ? 'Set Your Password' : isExpired ? 'Password Expired' : 'Change Password'}
          </CardTitle>
          <CardDescription>
            {isForced
              ? 'Your account requires a new password before you can continue. Please choose a strong, unique password.'
              : isExpired
              ? 'Your password has expired per your organization\'s security policy. Please set a new password to continue.'
              : 'Update your password to keep your account secure.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isForced && (
            <Alert className="mb-6 border-amber-200 bg-amber-50">
              <ShieldCheck className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-sm">
                A temporary password was assigned to your account. You must create a personal password to proceed.
              </AlertDescription>
            </Alert>
          )}
          {isExpired && (
            <Alert className="mb-6 border-orange-200 bg-orange-50">
              <ShieldCheck className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800 text-sm">
                Your password has expired per your organization's security policy. Please choose a new, strong password to regain access.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Old password — only shown for voluntary changes (not forced reset or expired) */}
            {!isForced && !isExpired && (
              <div className="space-y-2">
                <Label htmlFor="oldPassword">Current Password</Label>
                <div className="relative">
                  <Input
                    id="oldPassword"
                    type={showOld ? 'text' : 'password'}
                    placeholder="Enter your current password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowOld(!showOld)}
                    tabIndex={-1}
                  >
                    {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNew ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowNew(!showNew)}
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {/* Password strength bar */}
              {newPassword.length > 0 && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all ${
                          i <= strength.score ? strength.color : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs font-medium ${
                    strength.score <= 1 ? 'text-red-600' :
                    strength.score <= 2 ? 'text-orange-600' :
                    strength.score <= 3 ? 'text-yellow-600' :
                    strength.score <= 4 ? 'text-blue-600' : 'text-green-600'
                  }`}>
                    {strength.label}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Repeat your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className={`pr-10 ${passwordMismatch ? 'border-red-400 focus:ring-red-400' : passwordsMatch ? 'border-green-400' : ''}`}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowConfirm(!showConfirm)}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordMismatch && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
              {passwordsMatch && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Passwords match
                </p>
              )}
            </div>

            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 space-y-1">
              <p className="font-medium text-gray-700">Password requirements:</p>
              <ul className="space-y-0.5 list-disc list-inside">
                <li className={newPassword.length >= 8 ? 'text-green-600' : ''}>At least 8 characters</li>
                <li className={/[A-Z]/.test(newPassword) ? 'text-green-600' : ''}>At least one uppercase letter</li>
                <li className={/[0-9]/.test(newPassword) ? 'text-green-600' : ''}>At least one number</li>
                <li className={/[^A-Za-z0-9]/.test(newPassword) ? 'text-green-600' : ''}>At least one special character (recommended)</li>
              </ul>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || passwordMismatch || newPassword.length < 8}
            >
              {loading ? 'Updating Password…' : isForced ? 'Set New Password & Continue' : isExpired ? 'Set New Password & Continue' : 'Update Password'}
            </Button>

            {/* Cancel button for voluntary changes */}
            {!isForced && !isExpired && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => navigate(-1)}
                disabled={loading}
              >
                Cancel
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
