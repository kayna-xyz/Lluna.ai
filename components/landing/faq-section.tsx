"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Minus } from "lucide-react";

const faqs = [
  {
    question: "Why Lluna?",
    answer: "Lluna is the only AI platform built specifically for aesthetics clinics. We don't just give you software — we show up as a functioning member of your team, handling the work so you can focus on your patients.",
  },
  {
    question: "How long does setup take?",
    answer: "Immediately. Our onboarding gets you live in under an hour. No technical experience needed.",
  },
  {
    question: "What support do partners get?",
    answer: "24/7 direct access to our founding team. We're not a help desk — we're your dedicated partner.",
  },
  {
    question: "Is my clinic code permanent?",
    answer: "Yes. Once you register, you'll receive a permanent QR code. We'll also send you a physical Code Kit to display in your clinic.",
  },
  {
    question: "Can Lluna work alongside our existing tools?",
    answer: "Yes. Lluna integrates with popular booking systems, CRMs, and patient management platforms. Integrations are currently in development — we handle the setup so you don't need to change your workflow.",
  },
  {
    question: "How does Lluna handle our data?",
    answer: "We never share your clinic or patient data with any third party. That's our commitment to you.",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
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
      id="faq"
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
        <div className="mb-16">
          <span className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground block mb-6">
            FAQ
          </span>
          <h2 className="text-[48px] lg:text-[56px] font-display font-normal leading-[1.1] tracking-[-0.01em]">
            Questions
          </h2>
        </div>

        <div>
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="border-b border-[#D9D5CE] transition-all duration-[600ms]"
              style={{
                transitionDelay: isVisible ? `${index * 100}ms` : "0ms",
                transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
              }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full py-6 flex items-center justify-between text-left group"
              >
                <span className="text-[15px] pr-8 group-hover:text-gold transition-colors duration-300">
                  {faq.question}
                </span>
                {openIndex === index ? (
                  <Minus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <Plus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  openIndex === index ? "max-h-48 pb-6" : "max-h-0"
                }`}
              >
                <p className="text-[15px] leading-[1.75] text-muted-foreground">
                  {faq.answer}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8">
          <p className="text-[15px] leading-[1.75] text-muted-foreground">
            Questions? Reach out at{" "}
            <a href="mailto:kayna@lluna.ai" className="text-foreground hover:text-gold transition-colors duration-300">
              kayna@lluna.ai
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
