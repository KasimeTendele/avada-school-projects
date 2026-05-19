import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { LuArrowLeft as ArrowLeft, LuMail as Mail } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { MobileShell } from "@/components/MobileShell";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Mot de passe oublié — Avada School" },
      { name: "description", content: "Réinitialisez votre mot de passe Avada School." },
    ],
  }),
  component: ForgotPage,
});

function ForgotPage() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await resetPassword(email.trim());
      toast.success("Email envoyé. Vérifiez votre boîte de réception.");
      navigate({ to: "/login" });
    } catch (err) {
      toast.error((err as Error).message ?? "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileShell>
      <div className="flex min-h-screen sm:min-h-[calc(100vh-3rem)] flex-col bg-background">
        <header className="bg-[image:var(--gradient-primary)] px-5 pb-10 pt-8 text-primary-foreground">
          <Link to="/login" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm" aria-label="Retour">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="mt-4 text-3xl font-bold">Mot de passe oublié</h1>
          <p className="mt-1 text-sm text-white/85">
            Saisissez votre email pour recevoir un lien de réinitialisation
          </p>
        </header>

        <form onSubmit={onSubmit} className="-mt-6 flex flex-1 flex-col gap-4 rounded-t-[2rem] bg-background px-6 pt-8 pb-8">
          <div className="flex h-14 items-center gap-3 rounded-2xl border border-input bg-card px-4">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <input required type="email" placeholder="Email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 bg-transparent text-base outline-none" />
          </div>
          <Button type="submit" disabled={loading} size="lg"
            className="h-14 w-full rounded-full bg-primary text-base font-semibold text-primary-foreground hover:bg-primary-glow">
            {loading ? "Envoi…" : "Envoyer le lien"}
          </Button>
        </form>
      </div>
    </MobileShell>
  );
}