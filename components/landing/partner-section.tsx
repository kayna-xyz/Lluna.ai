"use client";

import { useEffect, useRef, useState } from "react";

const partnerBenefits = [
  {
    title: "In-clinic AI that stays with your patients for life",
    description: "Not a tool they use once. A consultant they return to.",
  },
  {
    title: "Built for teams, not just practitioners",
    description: "Collaborate across your clinic, your staff, your network.",
  },
  {
    title: "Scale Lluna across your entire ecosystem",
    description: "Every client you bring in becomes a long-term relationship — for them, and for you.",
  },
];

export function PartnerSection() {
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
      id="partner"
      className="relative z-[1] bg-[#F2EFE9]"
      style={{ paddingTop: '140px', paddingBottom: '140px' }}
    >
      <div className="max-w-[760px] mx-auto px-8">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[760px] px-8">
          <div className="h-px bg-[#D9D5CE]" />
        </div>
      </div>

      <div
        className={`max-w-[760px] mx-auto px-8 transition-all duration-[600ms] ${
          isVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-5"
        }`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="mb-20">
          <span className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground block mb-6">
            Partnership
          </span>
          <h2 className="text-[48px] lg:text-[56px] font-display font-normal leading-[1.1] tracking-[-0.01em] mb-8">
            Partner with Lluna
          </h2>
          <p className="text-[15px] leading-[1.75] text-muted-foreground mb-10 max-w-lg">
            Bring your clients closer — and keep them longer. Lluna&apos;s 24/7 AI consultant becomes an extension of your practice.
          </p>
          <button
            onClick={() => alert('Coming soon')}
            className="bg-foreground text-background px-8 h-12 text-[15px] hover:bg-gold transition-colors duration-300"
          >
            Become a Partner
          </button>
        </div>

        <div className="space-y-16">
          {partnerBenefits.map((benefit, index) => (
            <div
              key={benefit.title}
              className="transition-all duration-[600ms]"
              style={{
                transitionDelay: isVisible ? `${index * 150}ms` : "0ms",
                transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
              }}
            >
              <h3 className="text-[24px] lg:text-[28px] font-display font-normal leading-[1.2] mb-3">
                {benefit.title}
              </h3>
              <p className="text-[15px] leading-[1.75] text-muted-foreground">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
