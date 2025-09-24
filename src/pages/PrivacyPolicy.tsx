import { Link } from "react-router-dom";

export function PrivacyPolicy() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-12 text-gray-800">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-green-600">Policies</p>
        <h1 className="text-3xl font-bold text-green-900">Privacy Policy</h1>
        <p className="text-sm text-gray-500">
          Last updated {new Date().getFullYear()} — Please coordinate with legal counsel for final
          review before launch.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-green-900">1. Data We Collect and Process</h2>
        <p>
          We collect account information, plant listing details, transaction data, communications,
          and device information to operate the Thumr marketplace. Data is processed to fulfill
          orders, provide customer support, and improve platform performance.
        </p>
        <p>
          Third-party service providers assisting with payments, logistics, and analytics may access
          limited data under contract. We require vendors to adopt industry-standard safeguards and
          prohibit them from using personal data for unrelated purposes.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-green-900">2. Your Privacy Rights</h2>
        <p>
          Users located in the European Economic Area have rights under the GDPR, including access,
          correction, deletion, restriction, portability, and objection to certain processing. U.S.
          residents in applicable states, including California, may exercise CCPA rights to know,
          delete, and opt out of the sale or sharing of personal information.
        </p>
        <p>
          Requests can be submitted through your account settings or by emailing
          <a className="text-green-700 underline" href="mailto:privacy@thumr.com">
            privacy@thumr.com
          </a>
          . We will verify your identity and respond within the timeframes required by law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-green-900">3. Data Retention and Security</h2>
        <p>
          Personal data is retained only as long as needed to provide services, comply with legal
          obligations, resolve disputes, and enforce agreements. We implement administrative,
          technical, and physical safeguards to protect user information from unauthorized access.
        </p>
        <p>
          If we materially change how we use data, we will notify you in advance and update this
          policy. Continued use of Thumr after changes indicates acceptance of the revised policy.
        </p>
      </section>

      <footer className="space-y-2 border-t border-green-100 pt-6 text-sm text-gray-600">
        <p>
          For more details about using Thumr, please review our
          <Link className="text-green-700 underline" to="/terms">
            {" "}Terms of Service
          </Link>
          .
        </p>
        <p>
          Coordinate with qualified legal counsel to confirm compliance with local regulations prior
          to public release.
        </p>
      </footer>
    </main>
  );
}
