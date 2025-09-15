import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
// TODO: Replace with actual Google and Apple icons or buttons
import { Chrome } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from "../contexts/AuthContext";
import { API_ENDPOINTS, SECURITY_CONFIG } from "../config/amplify";
import { authService } from "../services/auth";

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
  const navigate = useNavigate();
  const { signup, confirmSignup, login, isAuthenticated } = useAuth();

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

    try {
      await signup(userName, password, email, name);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to sign up. Please try again.');
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
      const userId = uuidv4();
      const token = await authService.getToken();
      
      if (token) {
        await authService.authenticatedFetch(API_ENDPOINTS.USERS_WRITE, {
          method: 'POST',
          body: JSON.stringify({ userId, phone }),
          requiresAuth: true
        });
      }
      
      // Auto-login after successful confirmation
      await login(userName, password);
      
      setConfirm(true);
      setSuccess(false);
      
      // Navigate to home page after successful signup and login
      setTimeout(() => navigate('/'), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to confirm signup. Please try again.');
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
                <p className="text-green-600 text-sm">Signup successful! Please enter the confirmation code sent to your email.</p>
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
            {!success && confirm && <p className="text-center text-green-600 text-sm">Account created successfully! Redirecting...</p>}
          </div>

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