import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
// TODO: Replace with actual Google and Apple icons or buttons
import { Chrome } from "lucide-react";
import { Amplify } from 'aws-amplify';
import { signIn } from 'aws-amplify/auth';
import { useNavigate, Link } from "react-router-dom";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'us-east-1_2uwdcZRLa',
      userPoolClientId: '58m59u2n4ddoldec2rs4oiuc6i',
    }
  }
});

export function LoginPage() {
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState(""); // Add password input if needed
  const [error, setError] = useState("");
  const navigate = useNavigate();


  const handleSignIn = async () => {
    try {
      await signIn({ username: userName, password: password });
      navigate('/'); // Redirect to home or dashboard after successful sign-in
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
          <h2 className="text-lg font-semibold">Welcome Back</h2>
          <p className="text-sm text-gray-600">Please enter your credentials to continue.</p>
          <Input
            type="text"
            placeholder="Enter username"
            className="w-full h-12 bg-gray-100 border-0 rounded-lg px-4"
            style={{ backgroundColor: '#f3f3f5' }}
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Enter password"
            className="w-full h-12 bg-gray-100 border-0 rounded-lg px-4"
            style={{ backgroundColor: '#f3f3f5' }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            className="w-full h-12 rounded-lg text-white"
            style={{ backgroundColor: '#36AE46', fontWeight: 500 }}
            onClick={handleSignIn}
          >
            Sign In
          </Button>
          {error && <p className="text-red-500 text-sm">{error}</p>}

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

          {/* Signup Button Link */}
          <div className="space-y-3">
            <Link to="/signup">
              <Button
                className="w-full h-12 rounded-lg text-white"
                style={{ backgroundColor: '#36AE46', fontWeight: 500 }}
              >
                <span>Don't have an account? Sign up</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}