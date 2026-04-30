import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MovingFleet } from "@/components/MovingFleet";
import { useAuth } from "@/contexts/AuthContext";
import heroImg from "@/assets/hero-trucks.jpg";
import logo from "@/assets/logo.png";
import { Clock, ShieldCheck, FileText, Smartphone } from "lucide-react";

const Index = () => {
  const { user, role } = useAuth();
  const ctaTo = user ? (role === "admin" ? "/admin" : "/employee") : "/auth";
  const ctaLabel = user ? "Open Portal" : "Sign In to Portal";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="absolute top-0 inset-x-0 z-20">
        <div className="container flex items-center justify-between py-5">
          <Link to="/" className="flex items-center group">
            <img
              src={logo}
              alt="Dwayne Noe Construction"
              width={1024}
              height={1024}
              className="h-24 sm:h-28 w-auto drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] transition-transform group-hover:scale-105 [filter:brightness(0)_invert(1)]"
            />
          </Link>
          <Button asChild size="sm" className="bg-maple text-maple-foreground hover:bg-maple/90 font-display tracking-wider">
            <Link to={ctaTo}>{ctaLabel}</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-[80vh] flex items-center">
        <img
          src={heroImg}
          alt="Construction trucks and excavators at a job site at dusk"
          className="absolute inset-0 w-full h-full object-cover"
          width={1920}
          height={1080}
        />
        <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />

        <div className="container relative z-10 pt-28 pb-20">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-maple/40 bg-black/40 text-maple text-xs tracking-[0.2em] uppercase mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-maple animate-pulse" />
              Crew Time Portal
            </div>
            <h1 className="font-display text-5xl sm:text-6xl md:text-7xl uppercase leading-[0.95] mb-5">
              Built Hard.<br />
              <span className="text-maple">Tracked Easy.</span>
            </h1>
            <p className="text-lg text-foreground/80 max-w-xl mb-8">
              Daily timesheets in under 30 seconds. Friday tallies regular &
              overtime hours automatically and emails the report to the office.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90 font-display tracking-wider text-base">
                <Link to={ctaTo}>{ctaLabel}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-maple/50 text-maple hover:bg-maple/10 font-display tracking-wider">
                <a href="#how">How It Works</a>
              </Button>
            </div>
          </div>
        </div>

        {/* Animated fleet at the bottom of hero */}
        <div className="absolute inset-x-0 bottom-0">
          <MovingFleet />
        </div>
      </section>

      {/* Wood plank divider */}
      <div
        className="h-3 w-full"
        style={{
          backgroundImage:
            "linear-gradient(180deg, hsl(33 78% 56%), hsl(28 65% 38%))",
          boxShadow: "0 6px 20px -6px hsl(var(--maple) / 0.5)",
        }}
      />

      {/* Features */}
      <section id="how" className="container py-20">
        <h2 className="font-display text-3xl sm:text-4xl uppercase mb-12 text-center">
          Designed For The <span className="text-maple">Job Site</span>
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon: Smartphone, title: "Mobile First", body: "Works on any phone. Big buttons, fast entry, no fuss." },
            { icon: Clock, title: "30-Second Entry", body: "Pick a job, tap clock in / out, done. Hours auto-calculate." },
            { icon: FileText, title: "Auto Weekly Tally", body: "Friday at 6 PM, regular hours up to 40 plus overtime." },
            { icon: ShieldCheck, title: "Secure Access", body: "Each crew member only sees their own week. Admins see all." },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-card/60 backdrop-blur p-6 hover:border-maple/40 transition-colors shadow-deep"
            >
              <div className="h-11 w-11 rounded-lg bg-gradient-maple grid place-items-center mb-4 shadow-maple">
                <Icon className="h-5 w-5 text-maple-foreground" />
              </div>
              <h3 className="font-display text-lg uppercase tracking-wide mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-black/40">
        <div className="container py-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Dwayne Noe Construction · Crew Time Portal
        </div>
      </footer>
    </div>
  );
};

export default Index;
