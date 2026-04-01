import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";

export const metadata = {
  title: "Privacy Policy — Lluna AI",
};

export default function PrivacyPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#F2EFE9]">
      <Navigation />
      <div className="pt-32 pb-24">
        <div className="max-w-[680px] mx-auto px-6 lg:px-12">
          <h1 className="font-display text-4xl md:text-5xl tracking-tight text-foreground mb-4">
            Privacy Policy
          </h1>
          <p className="text-[15px] text-muted-foreground mb-16">
            Last updated: March 17, 2026
          </p>

          <div className="space-y-0">
            <Section title="Overview">
              Lluna AI, Inc. operates a SaaS platform for aesthetic medicine education and patient intake.
              This policy describes how we handle information collected through our platform.
            </Section>

            <Section title="Information We Collect">
              We collect information you provide when using Lluna, including contact details, responses to
              intake questionnaires, and uploaded photos. We also collect standard usage and device data
              automatically.
            </Section>

            <Section title="How We Use Information">
              We use collected information to operate and improve the Lluna platform, generate AI-powered
              treatment reports, deliver educational content, and communicate with users and clinic partners
              about the platform.
            </Section>

            <Section title="Information Sharing">
              We may share information with clinic partners who use the Lluna platform, service providers
              who support our operations, and as required by law. By using Lluna, you acknowledge that
              information may be shared with relevant clinic partners as part of normal platform operation.
            </Section>

            <Section title="Data Security">
              We implement reasonable technical and organizational measures to protect information against
              unauthorized access or disclosure.
            </Section>

            <Section title="Your Choices">
              You may contact us to request access to or deletion of your information. Requests can be
              sent to privacy@lluna.ai.
            </Section>

            <Section title="Changes">
              We may update this policy periodically. Continued use of the platform constitutes acceptance
              of the current policy.
            </Section>

            <Section title="Contact">
              <span className="block">Lluna AI, Inc.</span>
              <span className="block">privacy@lluna.ai</span>
              <span className="block">New York, NY</span>
            </Section>
          </div>
        </div>
      </div>
      <FooterSection />
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-0">
      <h2 className="text-[15px] font-semibold text-foreground mb-2 mt-8 first:mt-0">
        {title}
      </h2>
      <p className="text-[15px] leading-[1.75] text-[#4A4A4A]">
        {children}
      </p>
    </div>
  );
}
