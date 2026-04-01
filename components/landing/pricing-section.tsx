"use client";

import { useEffect, useState, useRef } from "react";

const plans = [
  {
    name: "Growth",
    price: "$520",
    period: "/mo",
    annual: "Billed annually at $6,240/yr",
    save: "save 17%",
    benefits: ["AI Pre-Consult Reports", "Menu Intelligence Chatbot", "Basic Analytics Dashboard"],
    featured: false,
  },
  {
    name: "Scale",
    price: "$980",
    period: "/mo",
    annual: "Billed annually at $11,760/yr",
    save: "save 17%",
    benefits: ["Everything in Growth", "Referral Engine", "AI Follow-Up Automation", "Priority Support"],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Talk to us",
    period: "",
    annual: "",
    save: "",
    benefits: ["Everything in Scale", "Multi-location Support", "Custom Integrations", "Dedicated Success Manager"],
    featured: false,
  },
];

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
        <div className="text-center mb-16">
          <span className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground block mb-6">
            Pricing
          </span>
          <h2 className="text-[48px] lg:text-[56px] font-display font-normal leading-[1.1] tracking-[-0.01em]">
            Simple, transparent pricing
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, index) => (
            <div
              key={plan.name}
              className={`p-8 border transition-all duration-[600ms] ${
                plan.featured
                  ? "border-foreground bg-white"
                  : "border-[#D9D5CE] bg-transparent"
              }`}
              style={{
                transitionDelay: isVisible ? `${index * 100}ms` : "0ms",
                transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
              }}
            >
              <h3 className="text-[13px] tracking-[0.05em] uppercase text-muted-foreground mb-6">
                {plan.name}
              </h3>

              <div className="mb-4">
                <span className="text-[40px] font-display font-normal leading-none">
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-[15px] text-muted-foreground">
                    {plan.period}
                  </span>
                )}
              </div>

              {plan.annual && (
                <p className="text-[13px] text-muted-foreground mb-1">
                  {plan.annual}
                </p>
              )}
              {plan.save && (
                <p className="text-[13px] text-gold mb-6">
                  {plan.save}
                </p>
              )}
              {!plan.annual && <div className="mb-6" />}

              <ul className="space-y-2 mb-8">
                {plan.benefits.map((benefit, i) => (
                  <li key={i} className="text-[14px] text-muted-foreground">
                    {benefit}
                  </li>
                ))}
              </ul>

              {plan.name === "Enterprise" && (
                <a
                  href="mailto:kayna@lluna.ai"
                  className="block text-[14px] text-muted-foreground hover:text-gold transition-colors duration-300"
                >
                  contact kayna@lluna.ai
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
