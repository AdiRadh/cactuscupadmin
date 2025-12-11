import { type FC, useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui';
import { Input } from '@/components/ui';
import { Label } from '@/components/ui';
import { Button } from '@/components/ui';
import { useAuth } from '@/hooks';

/**
 * Admin Login page with authentication form
 */
export const LoginPage: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, loading, error } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Get return URL from location state
  const returnTo = (location.state as { returnTo?: string })?.returnTo || '/';

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setFormError(null);

    // Basic validation
    if (!email || !password) {
      setFormError('Please fill in all fields');
      return;
    }

    // Validate email format with proper regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setFormError('Please enter a valid email address');
      return;
    }

    try {
      await signIn(email, password);
      navigate(returnTo);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to sign in. Please check your credentials.'
      );
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen flex items-center justify-center">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
          <Card className="bg-white border-turquoise-200 shadow-md">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-viking text-turquoise-900">Admin Panel</CardTitle>
              <CardDescription className="text-turquoise-700">Sign in to access the Cactus Cup admin panel</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Error message */}
                {(formError || error) && (
                  <div className="bg-red-100 text-red-700 text-sm p-3 rounded-md border border-red-300">
                    {formError || error?.message}
                  </div>
                )}

                {/* Email field */}
                <div className="space-y-2">
                  <Label htmlFor="email" required className="text-turquoise-900">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    autoComplete="email"
                    required
                  />
                </div>

                {/* Password field */}
                <div className="space-y-2">
                  <Label htmlFor="password" required className="text-turquoise-900">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="current-password"
                    required
                  />
                </div>

                {/* Submit button */}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
