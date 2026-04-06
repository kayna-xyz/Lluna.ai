"use client";

const footerLinks = {
  Product: [
    { name: "How It Works", href: "#how-it-works" },
    { name: "Partner", href: "#partner" },
    { name: "FAQ", href: "#faq" },
  ],
  Legal: [
    { name: "Terms", href: "/terms" },
    { name: "Privacy", href: "/privacy" },
  ],
};

export function FooterSection() {
  return (
    <footer className="relative z-[1] bg-[#0D0D0D]">
      <div className="max-w-[1200px] mx-auto px-8 pt-[60px] pb-[40px]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-2 md:col-span-2">
            <a href="/" className="inline-block mb-5">
              <span className="text-white font-semibold text-lg tracking-tight">Lluna</span>
            </a>
            <p className="text-[13px] text-white/40 max-w-xs leading-relaxed">
              The AI layer between great clinics and the patients who trust them.
            </p>
          </div>

          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="text-[11px] tracking-[0.15em] uppercase text-white/40 mb-6">
                {title}
              </h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className="text-[14px] text-white/75 hover:text-white transition-colors duration-300"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-[12px] text-white/30">
          @ 2026 Lluna AI Inc.
        </p>
      </div>
    </footer>
  );
}
