import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";

export const metadata = {
  title: "Terms of Service — Lluna AI",
};

export default function TermsPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#F2EFE9]">
      <Navigation />
      <div className="pt-32 pb-24">
        <div className="max-w-[680px] mx-auto px-6 lg:px-12">
          <h1 className="font-display text-4xl md:text-5xl tracking-tight text-foreground mb-4">
            Terms of Service
          </h1>
          <p className="text-[15px] text-muted-foreground mb-16">
            Last updated: March 17, 2026
          </p>

          <div className="space-y-0">
            <Section title="Acceptance">
              By accessing or using Lluna AI&apos;s platform, you agree to these Terms. If you do not agree,
              do not use the platform.
            </Section>

            <Section title="Platform Description">
              Lluna AI provides a SaaS platform for aesthetic medicine education and patient intake, used
              by clinics and their patients.
            </Section>

            <Section title="Not Medical Advice">
              Lluna is an educational and decision-support tool. Nothing on the platform constitutes
              medical advice, diagnosis, or treatment. Always consult a qualified medical professional
              before any aesthetic treatment.
            </Section>

            <Section title="Accounts and Access">
              You must provide accurate information when creating an account. You are responsible for all
              activity under your account.
            </Section>

            <Section title="Acceptable Use">
              You agree not to misuse the platform, upload content you do not have rights to, or use Lluna
              for any unlawful purpose.
            </Section>

            <Section title="Intellectual Property">
              All platform content, AI models, and software are owned by Lluna AI, Inc. and protected by
              applicable intellectual property law.
            </Section>

            <Section title="Clinic Partners">
              Lluna does not endorse any specific clinic or treatment. Clinical decisions are solely
              between users and their chosen providers.
            </Section>

            <Section title="Limitation of Liability">
              To the maximum extent permitted by law, Lluna AI shall not be liable for indirect or
              consequential damages arising from use of the platform.
            </Section>

            <Section title="Governing Law">
              These Terms are governed by the laws of New York, USA.
            </Section>

            <Section title="Contact">
              <span className="block">legal@lluna.ai</span>
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
