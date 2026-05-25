import { useEffect, useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function ForcePasswordChangeDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.user_metadata?.must_change_password === true) setOpen(true);
    else setOpen(false);
  }, [user]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) return toast.error("Mot de passe : 8 caractères minimum.");
    if (pwd !== confirm) return toast.error("Les mots de passe ne correspondent pas.");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: pwd,
        data: { must_change_password: false },
      });
      if (error) throw error;
      toast.success("Mot de passe mis à jour.");
      setOpen(false);
      setPwd("");
      setConfirm("");
    } catch (err) {
      toast.error((err as Error).message ?? "Échec de la mise à jour");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* forced */ }}>
      <DialogContent
        className="max-w-md [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Changer votre mot de passe</DialogTitle>
          <DialogDescription>
            Pour votre sécurité, veuillez définir un nouveau mot de passe personnel avant de continuer.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-pwd">Nouveau mot de passe</Label>
            <Input id="new-pwd" type="password" autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} required minLength={8} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-pwd">Confirmer le mot de passe</Label>
            <Input id="confirm-pwd" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Mise à jour…" : "Mettre à jour"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}