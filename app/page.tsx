import { Navigation } from "@/components/landing/navigation";
import { HeroSection } from "@/components/landing/hero-section";
import { AccentLine } from "@/components/landing/accent-line";
import { StatsBar } from "@/components/landing/stats-bar";
import { ProblemSection } from "@/components/landing/problem-section";
import { HowLumeWorksSection } from "@/components/landing/how-lume-works-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { PartnerSection } from "@/components/landing/partner-section";
import { FaqSection } from "@/components/landing/faq-section";
import { FooterSection } from "@/components/landing/footer-section";
import { CursorRipple } from "@/components/landing/cursor-ripple";

export const metadata = {
  title: "Lluna AI — Aesthetics, meet intelligence.",
};

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#F2EFE9]">
      <CursorRipple />
      <Navigation />
      <HeroSection />
      <AccentLine />
      <StatsBar />
      <ProblemSection />
      <HowLumeWorksSection />
      <PricingSection />
      <PartnerSection />
      <FaqSection />
      <FooterSection />
    </main>
  );
}
