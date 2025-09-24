import { Link } from "react-router-dom";

export function TermsOfService() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-12 text-gray-800">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-green-600">Policies</p>
        <h1 className="text-3xl font-bold text-green-900">Terms of Service</h1>
        <p className="text-sm text-gray-500">
          Last updated {new Date().getFullYear()} — Please coordinate with legal counsel for final
          review before launch.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-green-900">1. Using the Thumr Marketplace</h2>
        <p>
          Thumr connects plant buyers and sellers. You agree to provide accurate account information,
          comply with applicable laws, and use the platform responsibly. We may suspend or terminate
          accounts engaged in fraud, abuse, or violations of these terms.
        </p>
        <p>
          Listings must accurately describe plant species, condition, and shipping timelines. Sellers
          are responsible for complying with regional agricultural and phytosanitary regulations.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-green-900">2. Payments, Shipping, and Liability</h2>
        <p>
          Payments are processed through integrated third-party providers. Thumr facilitates
          transactions but does not take possession of goods. Sellers bear responsibility for
          packaging and shipping plants safely, including meeting climate and import restrictions.
        </p>
        <p>
          Thumr is not liable for damages, delays, or confiscations arising from plant shipments.
          Buyers should review import requirements before ordering. Disputes are handled in
          accordance with our community guidelines and applicable law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-green-900">3. Privacy and Compliance</h2>
        <p>
          Your use of the platform is also governed by our
          <Link className="text-green-700 underline" to="/privacy">
            {" "}Privacy Policy
          </Link>
          , which explains how we collect and process personal data.
        </p>
        <p>
          We strive to comply with global privacy regulations, including the GDPR and CCPA, and will
          update our practices as laws evolve. Continued use of Thumr after updates constitutes
          acceptance of revised terms.
        </p>
      </section>

      <footer className="space-y-2 border-t border-green-100 pt-6 text-sm text-gray-600">
        <p>
          Contact <a className="text-green-700 underline" href="mailto:legal@thumr.com">legal@thumr.com</a> with
          questions or to request copies of executed agreements.
        </p>
        <p>
          Coordinate with qualified legal counsel to confirm compliance before launching or updating
          these terms.
        </p>
      </footer>
    </main>
  );
}
