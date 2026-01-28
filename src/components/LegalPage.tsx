import { Link } from 'react-router-dom';
import './LegalPage.css';

interface LegalPageProps {
  type: 'privacy' | 'terms';
}

export function LegalPage({ type }: LegalPageProps) {
  const isPrivacy = type === 'privacy';

  return (
    <div className="legal-page">
      <div className="legal-container">
        <Link to="/" className="legal-back">&larr; Back to StockIQ</Link>

        {isPrivacy ? <PrivacyContent /> : <TermsContent />}

        <div className="legal-footer">
          <p>Last updated: January 2025</p>
        </div>
      </div>
    </div>
  );
}

function PrivacyContent() {
  return (
    <>
      <h1>Privacy Policy</h1>

      <section>
        <h2>Introduction</h2>
        <p>
          StockIQ ("we", "our", or "us") respects your privacy and is committed to protecting
          your personal data. This privacy policy explains how we collect, use, and safeguard
          your information when you use our stock research application.
        </p>
      </section>

      <section>
        <h2>Information We Collect</h2>
        <h3>Account Information</h3>
        <p>When you sign in with Apple or Google, we collect:</p>
        <ul>
          <li>Your name (as provided by your sign-in provider)</li>
          <li>Your email address</li>
          <li>A unique user identifier</li>
        </ul>

        <h3>Usage Data</h3>
        <p>We collect information about how you use StockIQ:</p>
        <ul>
          <li>Stocks you search for and add to watchlists</li>
          <li>Watchlists you create and their contents</li>
          <li>App preferences and settings</li>
        </ul>
      </section>

      <section>
        <h2>How We Use Your Information</h2>
        <p>We use your information to:</p>
        <ul>
          <li>Provide and maintain the StockIQ service</li>
          <li>Save and sync your watchlists across devices</li>
          <li>Improve and personalize your experience</li>
          <li>Communicate with you about service updates</li>
        </ul>
      </section>

      <section>
        <h2>Data Storage and Security</h2>
        <p>
          Your data is stored securely using industry-standard encryption. Authentication
          tokens are stored in your device's secure keychain. We do not sell, trade, or
          otherwise transfer your personal information to third parties.
        </p>
      </section>

      <section>
        <h2>Third-Party Services</h2>
        <p>StockIQ uses the following third-party services:</p>
        <ul>
          <li><strong>Apple Sign-In / Google Sign-In:</strong> For authentication</li>
          <li><strong>Financial data providers:</strong> For stock information (no personal data shared)</li>
        </ul>
      </section>

      <section>
        <h2>Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access your personal data</li>
          <li>Request correction of your data</li>
          <li>Request deletion of your account and data</li>
          <li>Export your watchlist data</li>
        </ul>
        <p>
          To exercise these rights, use the "Delete Account" option in the app or contact us through our website.
        </p>
      </section>

      <section>
        <h2>Data Retention</h2>
        <p>
          We retain your data for as long as your account is active. If you delete your
          account, we will delete your personal data within 30 days, except where we are
          required to retain it for legal purposes.
        </p>
      </section>

      <section>
        <h2>Children's Privacy</h2>
        <p>
          StockIQ is not intended for users under 18 years of age. We do not knowingly
          collect personal information from children.
        </p>
      </section>

      <section>
        <h2>Changes to This Policy</h2>
        <p>
          We may update this privacy policy from time to time. We will notify you of any
          changes by posting the new policy on this page and updating the "Last updated" date.
        </p>
      </section>
    </>
  );
}

function TermsContent() {
  return (
    <>
      <h1>Terms of Service</h1>

      <section>
        <h2>Agreement to Terms</h2>
        <p>
          By accessing or using StockIQ, you agree to be bound by these Terms of Service.
          If you do not agree to these terms, please do not use our service.
        </p>
      </section>

      <section>
        <h2>Description of Service</h2>
        <p>
          StockIQ is a stock research tool that provides financial information, analysis,
          and watchlist management features. The service is provided for informational
          purposes only.
        </p>
      </section>

      <section>
        <h2>Not Financial Advice</h2>
        <p>
          <strong>Important:</strong> StockIQ does not provide financial, investment, legal,
          or tax advice. The information provided through our service is for general
          informational purposes only and should not be construed as professional advice.
        </p>
        <p>
          You should consult with qualified professionals before making any investment
          decisions. Past performance of any stock does not guarantee future results.
        </p>
      </section>

      <section>
        <h2>User Accounts</h2>
        <p>To access certain features, you must create an account by signing in with Apple or Google. You are responsible for:</p>
        <ul>
          <li>Maintaining the security of your account</li>
          <li>All activities that occur under your account</li>
          <li>Notifying us of any unauthorized use</li>
        </ul>
      </section>

      <section>
        <h2>Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the service for any illegal purpose</li>
          <li>Attempt to gain unauthorized access to our systems</li>
          <li>Interfere with or disrupt the service</li>
          <li>Scrape or collect data from the service without permission</li>
          <li>Use the service to distribute malware or spam</li>
        </ul>
      </section>

      <section>
        <h2>Intellectual Property</h2>
        <p>
          The StockIQ service, including its design, features, and content, is owned by us
          and protected by intellectual property laws. You may not copy, modify, or
          distribute our service without permission.
        </p>
      </section>

      <section>
        <h2>Data Accuracy</h2>
        <p>
          While we strive to provide accurate financial information, we cannot guarantee
          the accuracy, completeness, or timeliness of data displayed in StockIQ. Financial
          data is sourced from third-party providers and may be delayed or contain errors.
        </p>
      </section>

      <section>
        <h2>Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, StockIQ and its operators shall not be
          liable for any indirect, incidental, special, consequential, or punitive damages,
          including but not limited to loss of profits, data, or other intangible losses,
          resulting from your use of the service.
        </p>
      </section>

      <section>
        <h2>Service Availability</h2>
        <p>
          We do not guarantee that StockIQ will be available at all times. We may modify,
          suspend, or discontinue the service at any time without notice.
        </p>
      </section>

      <section>
        <h2>Termination</h2>
        <p>
          We reserve the right to terminate or suspend your account at any time for any
          reason, including violation of these terms. You may also delete your account
          at any time.
        </p>
      </section>

      <section>
        <h2>Changes to Terms</h2>
        <p>
          We may modify these terms at any time. Continued use of the service after changes
          constitutes acceptance of the new terms.
        </p>
      </section>

      <section>
        <h2>Governing Law</h2>
        <p>
          These terms shall be governed by and construed in accordance with applicable laws,
          without regard to conflict of law principles.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          For questions about these Terms of Service, contact us through our website at stockiq.me.
        </p>
      </section>
    </>
  );
}
