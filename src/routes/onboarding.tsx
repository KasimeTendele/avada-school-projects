import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { MobileShell } from "@/components/MobileShell";
import onb1 from "@/assets/onboarding-1.jpg";
import onb2 from "@/assets/onboarding-2.jpg";
import onb3 from "@/assets/onboarding-3.jpg";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Bienvenue sur Avada School" },
      { name: "description", content: "Découvrez Avada School : paiement de frais scolaires, gestion d'école, suivi de scolarité." },
    ],
  }),
  component: OnboardingPage,
});

const slides = [
  {
    image: onb1,
    title: "Paiement de frais scolaires simplifié",
    subtitle: "Payez les frais scolaires en quelques clics, rapidement et en toute sécurité.",
    cta: "Suivant",
  },
  {
    image: onb2,
    title: "Gestion et suivi en toute sérénité",
    subtitle: "Utilisez Mobile Money ou votre carte bancaire pour régler les frais scolaires en toute confiance.",
    cta: "Suivant",
  },
  {
    image: onb3,
    title: "Gérez les encaissements de votre école",
    subtitle: "Encaissez les frais scolaires (Mobile Money, carte, espèces), suivez les paiements et éditez des reçus. Pour secrétaires et caissiers.",
    cta: "Commencer",
  },
];

function SplashScreen({ leaving }: { leaving: boolean }) {
  return (
    <div
      className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0E1A2B] transition-opacity duration-500 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
        <div className="flex flex-col items-center animate-[fade-in_0.8s_ease-out]">
        <p className="mt-2 text-2xl md:text-4xl font-semibold text-primary/90 text-center px-6">Paiement des frais scolaires</p>
        <div className="mt-10 flex gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary/80 animate-bounce [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary/80 animate-bounce [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary/80 animate-bounce" />
        </div>
      </div>
    </div>
  );
}

function OnboardingPage() {
  const [index, setIndex] = useState(0);
  const [showSplash, setShowSplash] = useState(true);
  const [splashLeaving, setSplashLeaving] = useState(false);
  const navigate = useNavigate();
  const slide = slides[index];
  const isLast = index === slides.length - 1;

  useEffect(() => {
    const fadeTimer = setTimeout(() => setSplashLeaving(true), 600);
    const removeTimer = setTimeout(() => setShowSplash(false), 1000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  // Auto-slide après le splash, sauf sur la dernière slide
  useEffect(() => {
    if (showSplash || isLast) return;
    const t = setTimeout(() => setIndex((i) => i + 1), 4000);
    return () => clearTimeout(t);
  }, [index, showSplash, isLast]);

  const finish = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("avada.onboarding.seen", "1");
    }
    navigate({ to: "/login" });
  };

  const next = () => (isLast ? finish() : setIndex(index + 1));

  return (
    <>
      {/* Mobile / Tablet layout */}
      <div className="md:hidden">
        <MobileShell>
          <div className="relative flex h-screen sm:h-[calc(100vh-3rem)] flex-col">
        {showSplash && <SplashScreen leaving={splashLeaving} />}

        {/* Slider plein écran */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="flex h-full w-full transition-transform duration-700 ease-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {slides.map((s, i) => (
              <div key={i} className="relative h-full w-full shrink-0">
                <img src={s.image} alt={s.title} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        </div>

        {/* Skip */}
        {!isLast && (
          <button
            onClick={finish}
            className="absolute right-5 top-6 z-10 rounded-full bg-black/30 px-4 py-1.5 text-xs font-medium text-white backdrop-blur-sm"
          >
            Passer
          </button>
        )}

        {/* Contenu bas */}
        <div className="relative z-10 mt-auto px-6 pb-8 pt-16 text-white">
          <h1 className="text-3xl font-bold leading-tight">{slide.title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/85">{slide.subtitle}</p>

          <div className="mt-6 flex items-center justify-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-primary" : "w-1.5 bg-white/40"
                }`}
                aria-label={`Aller à la slide ${i + 1}`}
              />
            ))}
          </div>

          <Button
            onClick={next}
            size="lg"
            className="mt-6 h-14 w-full rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-[var(--shadow-elevated)] hover:bg-primary-glow"
          >
            {slide.cta}
          </Button>
        </div>
          </div>
        </MobileShell>
      </div>

      {/* Desktop layout (lg+) : split-screen */}
      <div className="relative hidden md:flex h-screen w-full bg-background">
        {showSplash && <SplashScreen leaving={splashLeaving} />}

        {/* Image side */}
        <div className="relative h-full w-1/2 overflow-hidden">
          <div
            className="flex h-full w-full transition-transform duration-700 ease-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {slides.map((s, i) => (
              <div key={i} className="relative h-full w-full shrink-0">
                <img src={s.image} alt={s.title} className="h-full w-full object-cover object-top bg-muted" />
              </div>
            ))}
          </div>
        </div>

        {/* Content side */}
        <div className="relative flex h-full w-1/2 flex-col justify-center px-16 lg:px-24">
          {!isLast && (
            <button
              onClick={finish}
              className="absolute right-8 top-8 rounded-full border border-border bg-background px-4 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              Passer
            </button>
          )}

          <div className="max-w-lg">
            <h1 className="text-4xl lg:text-5xl font-bold leading-tight text-foreground">
              {slide.title}
            </h1>
            <p className="mt-5 text-base lg:text-lg leading-relaxed text-muted-foreground">
              {slide.subtitle}
            </p>

            <div className="mt-10 flex items-center gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30"
                  }`}
                  aria-label={`Aller à la slide ${i + 1}`}
                />
              ))}
            </div>

            <Button
              onClick={next}
              size="lg"
              className="mt-8 h-14 rounded-full bg-primary px-10 text-base font-semibold text-primary-foreground shadow-[var(--shadow-elevated)] hover:bg-primary-glow"
            >
              {slide.cta}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}