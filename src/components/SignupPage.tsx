import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
// TODO: Replace with actual Google and Apple icons or buttons
import { Chrome } from "lucide-react";
import { Amplify } from 'aws-amplify';
import { signUp, confirmSignUp, signIn } from 'aws-amplify/auth';
import { useNavigate, Link } from "react-router-dom";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'us-east-1_2uwdcZRLa',
      userPoolClientId: '58m59u2n4ddoldec2rs4oiuc6i',
    }
  }
});

export function SignupPage() {
  const [name, setName] = useState("");
  const [userName, setUserName] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); // Add password input if needed
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async () => {
    try {
      await signUp({
        username: userName,
        password: password,
        options: {
          userAttributes: { preferred_username: userName, email: email, name: name }
        }
      });
      setSuccess(true);
      // Show confirmation step, etc.
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleConfirm = async () => {
    try {
      await confirmSignUp({ username: userName, confirmationCode: code });
      setConfirm(true);
      setSuccess(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-green-600 px-4 py-4 flex items-center">
        <h1 className="text-white text-lg" style={{ color: '#ffffff', fontWeight: 500 }}>
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
            >
              Continue
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
                >
                  Confirm
                </Button>
              </div>
            )}
            {!success && confirm && <p className="text-center text-green-600 text-sm">Confirmation confirmed! You may now login.</p>}
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