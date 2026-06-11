import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { LuMail as Mail, LuLock as Lock, LuEye as Eye, LuEyeOff as EyeOff } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { MobileShell } from "@/components/MobileShell";
import { useAuth } from "@/lib/auth-context";

import onb1 from "@/assets/onboarding-1.jpg";
import avadaLogo from "@/assets/avada-logo-white.png.asset.json";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  beforeLoad: ({ context }) => {
    if (context.auth?.isAuthenticated && !context.auth.loading && context.auth.roles.length > 0) {
      const r = context.auth.roles ?? [];
      const isCashierOnly = r.includes("cashier") && !r.some((x) => x === "admin" || x === "super_admin");
      const isStaff = r.some((x) => x === "super_admin" || x === "admin" || x === "cashier");
      throw redirect({ to: isCashierOnly ? "/cashier" : (isStaff ? "/admin" : "/home") });
    }
  },
  head: () => ({
    meta: [
      { title: "Connexion — Avada School" },
      { name: "description", content: "Accédez à votre espace Avada School : parents, caissiers et administrateurs." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const nextRoles = await signIn(email.trim(), password);
      toast.success("Bienvenue !");
      const isCashierOnly = nextRoles.includes("cashier") && !nextRoles.some((r) => r === "admin" || r === "super_admin");
      const isStaff = nextRoles.some((r) => r === "super_admin" || r === "admin" || r === "cashier");
      navigate({ to: isCashierOnly ? "/cashier" : (isStaff ? "/admin" : "/home") });
    } catch (err) {
      const msg = (err as Error).message ?? "Échec de connexion";
      toast.error(
        msg.toLowerCase().includes("invalid")
          ? "Email ou mot de passe incorrect."
          : msg,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileShell>
      <div className="flex min-h-screen sm:min-h-[calc(100vh-3rem)] flex-col bg-background">
        {/* Header image */}
        <div className="relative h-[28rem] overflow-hidden rounded-b-[2.5rem]">
          <img src={onb1} alt="" className="h-full w-full object-cover" loading="eager" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/30" />
          <div className="absolute inset-0 flex items-end justify-center pb-2">
            <img
              src={avadaLogo.url}
              alt="Avada School"
              className="h-[200px] w-auto px-5 py-3 drop-shadow-lg"
              style={{ filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.35))" }}
            />
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 px-6 pb-8 pt-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold">Connexion</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Accédez à votre espace Avada School
            </p>
          </div>

          <div className="flex h-14 items-center gap-3 rounded-2xl border border-input bg-card px-4">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex h-14 items-center gap-3 rounded-2xl border border-input bg-card px-4">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <input
              type={showPwd ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            <button type="button" onClick={() => setShowPwd((v) => !v)} aria-label="Afficher">
              {showPwd ? (
                <EyeOff className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Eye className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
          </div>

          <Link
            to="/forgot-password"
            className="self-end text-sm font-medium text-primary"
          >
            Mot de passe oublié ?
          </Link>

          <Button
            type="submit"
            disabled={loading}
            size="lg"
            className="h-14 w-full rounded-full bg-primary text-base font-semibold text-primary-foreground hover:bg-primary-glow"
          >
            {loading ? "Connexion…" : "Se connecter"}
          </Button>
        </form>
      </div>
    </MobileShell>
  );
}