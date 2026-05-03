const Privacy = () => {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">
          Last updated: May 3, 2026
        </p>

        <section className="space-y-6 leading-relaxed">
          <p>
            Dwayne Noe Construction ("we", "us", "our") operates the Dwayne Noe
            Construction website and mobile application (the "Service"). This
            page informs you of our policies regarding the collection, use, and
            disclosure of personal information when you use our Service.
          </p>

          <h2 className="text-2xl font-semibold mt-8">Information We Collect</h2>
          <p>
            We collect information you provide directly to us, such as your
            name, email address, phone number, and project details when you
            request a quote, contact us, or create an account. Employees and
            administrators using our portal may also provide work-related
            information such as time entries, job notes, and uploaded photos.
          </p>

          <h2 className="text-2xl font-semibold mt-8">How We Use Information</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>To provide, maintain, and improve the Service</li>
            <li>To respond to inquiries and provide customer support</li>
            <li>To send service-related notifications and updates</li>
            <li>To manage employee accounts and project workflows</li>
            <li>To comply with legal obligations</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-8">Data Storage & Security</h2>
          <p>
            Your data is stored securely using industry-standard cloud
            infrastructure with encryption in transit and at rest. Access is
            limited to authorized personnel.
          </p>

          <h2 className="text-2xl font-semibold mt-8">Sharing of Information</h2>
          <p>
            We do not sell your personal information. We may share information
            with service providers who help us operate the Service (such as
            hosting, email delivery, and analytics) under strict
            confidentiality, or when required by law.
          </p>

          <h2 className="text-2xl font-semibold mt-8">Your Rights</h2>
          <p>
            You may request access, correction, or deletion of your personal
            information at any time by contacting us. You can also unsubscribe
            from marketing emails using the link in any message.
          </p>

          <h2 className="text-2xl font-semibold mt-8">Children's Privacy</h2>
          <p>
            Our Service is not directed to children under 13, and we do not
            knowingly collect personal information from children.
          </p>

          <h2 className="text-2xl font-semibold mt-8">Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Changes will
            be posted on this page with an updated revision date.
          </p>

          <h2 className="text-2xl font-semibold mt-8">Contact Us</h2>
          <p>
            Questions about this Privacy Policy? Contact us at{" "}
            <a
              href="mailto:info@dwaynenoeconstruction.com"
              className="underline"
            >
              info@dwaynenoeconstruction.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
};

export default Privacy;
