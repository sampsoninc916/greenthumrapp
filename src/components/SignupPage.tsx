import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
// TODO: Replace with actual Google and Apple icons or buttons
import { Chrome } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { API_ENDPOINTS, SECURITY_CONFIG } from "../config/amplify";
import { authService } from "../services/auth";
import { analyticsService } from "../services/analytics";

export function SignupPage() {
  const [name, setName] = useState("");
  const [userName, setUserName] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [selectedRole, setSelectedRole] = useState<"buyer" | "seller" | "">("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [termsAcceptedAt, setTermsAcceptedAt] = useState<string | null>(null);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [privacyAcceptedAt, setPrivacyAcceptedAt] = useState<string | null>(null);
  const [marketingEmailOptIn, setMarketingEmailOptIn] = useState(false);
  const [marketingSmsOptIn, setMarketingSmsOptIn] = useState(false);
  const navigate = useNavigate();
  const { signup, confirmSignup, login, isAuthenticated } = useAuth();

  const buildSignupPayload = (stage?: string) => ({
    username: userName || undefined,
    email: email || undefined,
    role: selectedRole || undefined,
    marketingEmailOptIn,
    marketingSmsOptIn,
    stage,
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Validate password strength
  const validatePassword = (pass: string): string | null => {
    if (pass.length < SECURITY_CONFIG.PASSWORD_MIN_LENGTH) {
      return `Password must be at least ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} characters`;
    }
    if (SECURITY_CONFIG.PASSWORD_REQUIRE_UPPERCASE && !/[A-Z]/.test(pass)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (SECURITY_CONFIG.PASSWORD_REQUIRE_LOWERCASE && !/[a-z]/.test(pass)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (SECURITY_CONFIG.PASSWORD_REQUIRE_NUMBERS && !/\d/.test(pass)) {
      return 'Password must contain at least one number';
    }
    if (SECURITY_CONFIG.PASSWORD_REQUIRE_SPECIAL && !/[!@#$%^&*(),.?":{}|<>]/.test(pass)) {
      return 'Password must contain at least one special character';
    }
    return null;
  };

  // Validate email format
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSignup = async () => {
    // Validation
    if (!name || !userName || !email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (!selectedRole) {
      setError('Please select whether you are signing up as a buyer or seller');
      return;
    }

    if (!acceptTerms || !acceptPrivacy) {
      setError('You must accept the Terms of Service and Privacy Policy to create an account.');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setIsLoading(true);
    setError('');
    analyticsService.trackSignupStarted(buildSignupPayload('signup'));

    try {
      await signup(userName, password, email, name, selectedRole as "buyer" | "seller");
      setSuccess(true);
      analyticsService.trackSignupSucceeded({
        ...buildSignupPayload('signup'),
        method: 'email_password',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to sign up. Please try again.';
      setError(message);
      analyticsService.trackSignupFailed({
        ...buildSignupPayload('signup'),
        error: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!code) {
      setError('Please enter the confirmation code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await confirmSignup(userName, code);

      // Create user profile in backend with authentication
      const token = await authService.getToken();

      if (token) {
        await authService.authenticatedFetch(API_ENDPOINTS.USERS_WRITE, {
          method: 'POST',
          body: JSON.stringify({
            phone,
            role: selectedRole || undefined,
            consents: {
              termsAcceptedAt: termsAcceptedAt ?? new Date().toISOString(),
              privacyAcceptedAt: privacyAcceptedAt ?? new Date().toISOString(),
              marketingEmailOptIn,
              marketingSmsOptIn,
              marketingGlobalUnsubscribed: false,
            },
          }),
          requiresAuth: true
        });
      }
      
      // Auto-login after successful confirmation
      await login(userName, password);

      setConfirm(true);
      setSuccess(false);

      analyticsService.trackSignupConfirmed(buildSignupPayload('confirm'));

      // Navigate to home page after successful signup and login
      setTimeout(() => navigate('/'), 1500);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to confirm signup. Please try again.';
      setError(message);
      analyticsService.trackSignupFailed({
        ...buildSignupPayload('confirm'),
        error: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-green-600 px-4 py-4 flex items-center">
        <h1 className="cursor-pointer text-white text-lg" style={{ color: '#ffffff', fontWeight: 500 }} onClick={() => navigate('/')}>
          Thumr
        </h1>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-6">
          {/* Question */}
          <div className="text-center">
            <h2 className="text-gray-900" style={{ fontSize: '18px', fontWeight: 500, lineHeight: '1.4' }}>
              Signup for Thumr
            </h2>
          </div>

          {/* Input */}
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Enter name"
              className="w-full h-12 bg-gray-100 border-0 rounded-lg px-4"
              style={{ backgroundColor: '#f3f3f5' }}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              type="text"
              placeholder="Enter username"
              className="w-full h-12 bg-gray-100 border-0 rounded-lg px-4"
              style={{ backgroundColor: '#f3f3f5' }}
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />
            <Input
              type="text"
              placeholder="Enter email"
              className="w-full h-12 bg-gray-100 border-0 rounded-lg px-4"
              style={{ backgroundColor: '#f3f3f5' }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              type="text"
              placeholder="Enter phone number (optional)"
              className="w-full h-12 bg-gray-100 border-0 rounded-lg px-4"
              style={{ backgroundColor: '#f3f3f5' }}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Enter password"
              className="w-full h-12 bg-gray-100 border-0 rounded-lg px-4"
              style={{ backgroundColor: '#f3f3f5' }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">I want to:</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`flex-1 h-12 rounded-lg border px-4 text-sm font-medium transition-colors ${
                    selectedRole === "buyer"
                      ? "border-green-600 bg-green-50 text-green-700"
                      : "border-gray-200 bg-white text-gray-700"
                  }`}
                  onClick={() => setSelectedRole("buyer")}
                  aria-pressed={selectedRole === "buyer"}
                >
                  Buy Plants
                </button>
                <button
                  type="button"
                  className={`flex-1 h-12 rounded-lg border px-4 text-sm font-medium transition-colors ${
                    selectedRole === "seller"
                      ? "border-green-600 bg-green-50 text-green-700"
                      : "border-gray-200 bg-white text-gray-700"
                  }`}
                  onClick={() => setSelectedRole("seller")}
                  aria-pressed={selectedRole === "seller"}
                >
                  Sell Plants
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
            <div className="flex items-start gap-3">
              <Checkbox
                id="accept-terms"
                checked={acceptTerms}
                onCheckedChange={(checked) => {
                  const value = checked === true;
                  setAcceptTerms(value);
                  setTermsAcceptedAt(value ? new Date().toISOString() : null);
                  if (value && acceptPrivacy) {
                    setError("");
                  }
                }}
              />
              <Label htmlFor="accept-terms" className="text-sm font-medium text-gray-700">
                I agree to the{" "}
                <Link to="/terms" className="text-green-700 underline">
                  Terms of Service
                </Link>
              </Label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="accept-privacy"
                checked={acceptPrivacy}
                onCheckedChange={(checked) => {
                  const value = checked === true;
                  setAcceptPrivacy(value);
                  setPrivacyAcceptedAt(value ? new Date().toISOString() : null);
                  if (value && acceptTerms) {
                    setError("");
                  }
                }}
              />
              <Label htmlFor="accept-privacy" className="text-sm font-medium text-gray-700">
                I have read and accept the{" "}
                <Link to="/privacy" className="text-green-700 underline">
                  Privacy Policy
                </Link>
              </Label>
            </div>
            <Separator />
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Optional communications
              </p>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="marketing-email" className="text-sm font-medium text-gray-700">
                    Email updates
                  </Label>
                  <p className="text-xs text-gray-500">
                    Get seasonal tips, product launches, and curated plant guides.
                  </p>
                </div>
                <Switch
                  id="marketing-email"
                  checked={marketingEmailOptIn}
                  onCheckedChange={(checked) => setMarketingEmailOptIn(checked)}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="marketing-sms" className="text-sm font-medium text-gray-700">
                    Text messages
                  </Label>
                  <p className="text-xs text-gray-500">
                    Receive limited-time offers and alerts about plants on your wishlist.
                  </p>
                </div>
                <Switch
                  id="marketing-sms"
                  checked={marketingSmsOptIn}
                  onCheckedChange={(checked) => setMarketingSmsOptIn(checked)}
                />
              </div>
            </div>
          </div>

          {/* Continue Button */}
          <Button
            className="w-full h-12 rounded-lg text-white"
            style={{ backgroundColor: '#36AE46', fontWeight: 500 }}
            onClick={handleSignup}
            disabled={isLoading}
          >
            {isLoading ? 'Creating Account...' : 'Continue'}
          </Button>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {success && (
            <div className="flex flex-col items-center justify-center space-y-4">
              <p className="text-green-600 text-sm">
                Signup successful! Please enter the confirmation code sent to your email.
              </p>
              <Input
                type="text"
                placeholder="Enter confirmation code"
                className="w-1/4 h-12 bg-gray-100 border-0 rounded-lg px-4"
                style={{ backgroundColor: '#f3f3f5' }}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <Button
                className="w-1/4 h-12 rounded-lg text-white"
                style={{ backgroundColor: '#36AE46', fontWeight: 500 }}
                onClick={handleConfirm}
                disabled={isLoading}
              >
                {isLoading ? 'Confirming...' : 'Confirm'}
              </Button>
            </div>
          )}
          {!success && confirm && (
            <p className="text-center text-green-600 text-sm">
              Account created successfully! Redirecting...
            </p>
          )}

          {/* Divider */}
          <div className="flex items-center space-x-4">
            <Separator className="flex-1" />
            <span className="text-gray-500 text-sm">or</span>
            <Separator className="flex-1" />
          </div>

          {/* Social Login Buttons */}
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full h-12 rounded-lg border-gray-200 bg-white text-gray-700 flex items-center justify-center space-x-3"
              style={{ fontWeight: 500 }}
            >
              <Chrome className="w-5 h-5" />
              <span>Continue with Google</span>
            </Button>
          </div>
          <div className="space-y-3">
            <Link to="/login">
              <Button
                className="w-full h-12 rounded-lg text-white"
                style={{ backgroundColor: '#36AE46', fontWeight: 500 }}
              >
                Already have an account? Sign In.
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
