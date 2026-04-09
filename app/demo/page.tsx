"use client";

import { useState, FormEvent } from "react";

export default function DemoPage() {
  const [name, setName] = useState("");
  const [clinic, setClinic] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Demo request from ${name} — ${clinic}`);
    const body = encodeURIComponent(
      `Name: ${name}\nClinic: ${clinic}\nEmail: ${email}\nPhone: ${phone || "—"}`
    );
    window.location.href = `mailto:kayna@lluna.ai?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <main className="min-h-screen bg-[#F2EFE9]">
      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#F2EFE9] border-b border-[#E2DDD8]">
        <div className="flex items-center px-8 lg:px-16 h-20">
          <a href="/" className="flex items-center gap-2.5">
            <img src="/lluna-logo.png" alt="Lluna" className="h-7 w-7 object-contain" />
            <span className="font-semibold text-lg tracking-tight">Lluna</span>
          </a>
        </div>
      </header>

      <div className="pt-20 flex items-center justify-center min-h-screen px-8">
        <div className="w-full max-w-[480px] py-20">
          {sent ? (
            <div className="text-center">
              <p className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground mb-6">
                All done
              </p>
              <h1 className="text-[48px] lg:text-[56px] font-display font-normal leading-[1.1] tracking-[-0.01em] mb-6">
                We&apos;ll be in touch.
              </h1>
              <p className="text-[15px] leading-[1.75] text-muted-foreground mb-10">
                Expect to hear from us within 24 hours. Check your email client if the window didn&apos;t open automatically.
              </p>
              <a
                href="/"
                className="text-[14px] text-muted-foreground hover:text-foreground transition-colors duration-300"
              >
                ← Back to home
              </a>
            </div>
          ) : (
            <>
              <p className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground mb-6">
                Book a Demo
              </p>
              <h1 className="text-[48px] lg:text-[56px] font-display font-normal leading-[1.1] tracking-[-0.01em] mb-6">
                Let&apos;s talk.
              </h1>
              <p className="text-[15px] leading-[1.75] text-muted-foreground mb-12">
                Tell us about your clinic and we&apos;ll be in touch within 24 hours.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div>
                  <label htmlFor="name" className="block text-[12px] tracking-[0.08em] uppercase text-muted-foreground mb-2">
                    Name <span className="text-[#B87879]">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    placeholder="Jane Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 text-[15px] bg-transparent border border-[#D9D5CE] focus:border-foreground outline-none transition-colors duration-200"
                  />
                </div>

                <div>
                  <label htmlFor="clinic" className="block text-[12px] tracking-[0.08em] uppercase text-muted-foreground mb-2">
                    Clinic Name <span className="text-[#B87879]">*</span>
                  </label>
                  <input
                    id="clinic"
                    type="text"
                    required
                    placeholder="The Aesthetic Studio"
                    value={clinic}
                    onChange={(e) => setClinic(e.target.value)}
                    className="w-full px-4 py-3 text-[15px] bg-transparent border border-[#D9D5CE] focus:border-foreground outline-none transition-colors duration-200"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-[12px] tracking-[0.08em] uppercase text-muted-foreground mb-2">
                    Email <span className="text-[#B87879]">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="jane@yourclinic.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 text-[15px] bg-transparent border border-[#D9D5CE] focus:border-foreground outline-none transition-colors duration-200"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-[12px] tracking-[0.08em] uppercase text-muted-foreground mb-2">
                    Phone <span className="text-[13px] normal-case tracking-normal">(optional)</span>
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    placeholder="+44 7700 900 000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-3 text-[15px] bg-transparent border border-[#D9D5CE] focus:border-foreground outline-none transition-colors duration-200"
                  />
                </div>

                <button
                  type="submit"
                  className="mt-2 bg-foreground text-background h-12 text-[14px] hover:bg-gold transition-colors duration-300"
                >
                  Send message
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
