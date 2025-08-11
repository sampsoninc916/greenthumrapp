import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
// TODO: Replace with actual Google and Apple icons or buttons
import { Chrome, Apple } from "lucide-react";

export function SignupPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-[#36AE46] px-4 py-4 flex items-center">
        <h1 className="text-white text-lg" style={{ color: '#ffffff', fontWeight: 500 }}>
          Thumr
        </h1>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-[375px] max-w-sm space-y-6">
          {/* Question */}
          <div className="text-center">
            <h2 className="text-gray-900" style={{ fontSize: '18px', fontWeight: 500, lineHeight: '1.4' }}>
              What's your email?
            </h2>
          </div>

          {/* Input */}
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Enter email"
              className="w-full h-12 bg-gray-100 border-0 rounded-lg px-4"
              style={{ backgroundColor: '#f3f3f5' }}
            />

            {/* Continue Button */}
            <Button 
              className="w-full h-12 rounded-lg text-white"
              style={{ backgroundColor: '#36AE46', fontWeight: 500 }}
            >
              Continue
            </Button>
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
        </div>
      </div>
    </div>
  );
}