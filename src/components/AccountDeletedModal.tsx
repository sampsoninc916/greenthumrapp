import React from "react";
import { useNavigate } from "react-router-dom";

export function AccountDeletedModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();

  const handleGoHome = () => {
    onClose();
    // navigate("/");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full flex flex-col items-center">
        <h2 className="text-2xl font-bold text-green-700 mb-4">Account Deleted</h2>
        <p className="text-gray-700 mb-6 text-center">
          Your account has been successfully deleted.<br />
          Thank you for being a part of Thumr!
        </p>
        <button
          className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold shadow hover:bg-green-700 transition"
          onClick={handleGoHome}
        >
          Go to Home Page
        </button>
      </div>
    </div>
  );
}