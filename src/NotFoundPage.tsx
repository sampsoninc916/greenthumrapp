export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <div className="bg-green-600 px-6 py-4 rounded-lg shadow-lg flex items-center mb-8">
        <h1 className="text-white text-2xl font-bold">Thumr</h1>
      </div>
      <div className="text-center">
        <h2 className="text-4xl font-bold text-green-700 mb-4">404</h2>
        <p className="text-gray-700 text-lg mb-6">
          Oops! The page you’re looking for doesn’t exist.
        </p>
        <a
          href="/"
          className="inline-block bg-green-600 text-white px-6 py-2 rounded-lg font-semibold shadow hover:bg-green-700 transition"
        >
          Go Home
        </a>
      </div>
    </div>
  );
}