"use client";

import { useEffect, useState, useRef } from "react";

export function PricingSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="pricing"
      className="relative z-[1] bg-[#F2EFE9]"
      style={{ paddingTop: '140px', paddingBottom: '140px' }}
    >
      <div className="max-w-[960px] mx-auto px-8">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[960px] px-8">
          <div className="h-px bg-[#D9D5CE]" />
        </div>
      </div>

      <div
        className={`max-w-[960px] mx-auto px-8 transition-all duration-[600ms] ${
          isVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-5"
        }`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="mb-16">
          <span className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground block mb-6">
            Pricing
          </span>
          <h2 className="text-[48px] lg:text-[56px] font-display font-normal leading-[1.1] tracking-[-0.01em]">
            Priced for clinics that want to grow
          </h2>
        </div>

        <div className="max-w-[480px]">
          <div
            className="p-8 border border-foreground bg-white"
            style={{
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 600ms cubic-bezier(0.16, 1, 0.3, 1), transform 600ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <h3 className="text-[13px] tracking-[0.05em] uppercase text-muted-foreground mb-6">
              Clinic Partner
            </h3>

            <div className="mb-6">
              <span className="text-[40px] font-display font-normal leading-none">
                Talk to us
              </span>
            </div>

            <p className="text-[14px] text-muted-foreground mb-8 leading-[1.7]">
              Pricing is scoped to your clinic&apos;s size, team, and goals. Every partner gets a dedicated onboarding and is live within an hour.
            </p>

            <ul className="space-y-2 mb-8">
              {["AI Pre-Consult Briefings", "Smart Menu Chatbot", "Patient Lifecycle Tracking", "Revenue Analytics Dashboard", "Dedicated Success Manager"].map((benefit, i) => (
                <li key={i} className="text-[14px] text-muted-foreground">
                  {benefit}
                </li>
              ))}
            </ul>

            <a
              href="/demo"
              className="inline-block bg-foreground text-background px-8 h-12 leading-[48px] text-[14px] hover:bg-gold transition-colors duration-300"
            >
              Book a Demo
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
