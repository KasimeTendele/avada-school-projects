import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { LuLock as Lock, LuEye as Eye, LuEyeOff as EyeOff } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { MobileShell } from "@/components/MobileShell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe — Avada School" },
      { name: "description", content: "Définir un nouveau mot de passe pour votre compte Avada School." },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // supabase parses the recovery hash automatically on load
    const t = setTimeout(() => setReady(true), 300);
    return () => clearTimeout(t);
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Au moins 8 caractères.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Mot de passe mis à jour.");
      navigate({ to: "/login" });
    } catch (err) {
      toast.error((err as Error).message ?? "Échec de la mise à jour.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileShell>
      <div className="flex min-h-screen sm:min-h-[calc(100vh-3rem)] flex-col bg-background">
        <header className="bg-[image:var(--gradient-primary)] px-6 pb-10 pt-12 text-primary-foreground">
          <h1 className="text-3xl font-bold">Nouveau mot de passe</h1>
          <p className="mt-1 text-sm text-white/85">Choisissez un nouveau mot de passe sécurisé</p>
        </header>
        <form onSubmit={onSubmit} className="-mt-6 flex flex-1 flex-col gap-4 rounded-t-[2rem] bg-background px-6 pt-8 pb-8">
          <div className="flex h-14 items-center gap-3 rounded-2xl border border-input bg-card px-4">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <input required type={showPwd ? "text" : "password"} placeholder="Nouveau mot de passe" value={password}
              onChange={(e) => setPassword(e.target.value)} disabled={!ready}
              className="flex-1 bg-transparent text-base outline-none" />
            <button type="button" onClick={() => setShowPwd((v) => !v)}>
              {showPwd ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
            </button>
          </div>
          <Button type="submit" disabled={loading || !ready} size="lg"
            className="h-14 w-full rounded-full bg-primary text-base font-semibold text-primary-foreground hover:bg-primary-glow">
            {loading ? "Mise à jour…" : "Mettre à jour"}
          </Button>
        </form>
      </div>
    </MobileShell>
  );
}