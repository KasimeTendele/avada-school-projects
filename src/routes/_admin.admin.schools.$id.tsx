import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { LuArrowLeft as ArrowLeft, LuImage as ImageIcon, LuLoader as Loader, LuCheck as Check, LuTrash2 as Trash2 } from "react-icons/lu";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/api";
import { uploadPublicFile } from "@/lib/upload";
import { useAuth } from "@/lib/auth-context";

interface School {
  id: string;
  name: string;
  sigle?: string | null;
  city?: string | null;
  address?: string | null;
  logo_url?: string | null;
  approval_number?: string | null;
}

export const Route = createFileRoute("/_admin/admin/schools/$id")({
  head: () => ({ meta: [{ title: "École — Édition" }] }),
  component: SchoolEditPage,
});

function SchoolEditPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { roles } = useAuth();
  const isSuper = roles.includes("super_admin");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-school", id],
    queryFn: () => apiFetch<School>(`/admin-schools/${id}`),
  });

  const [logoUrl, setLogoUrl] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data?.logo_url !== undefined) setLogoUrl(data.logo_url ?? "");
  }, [data?.logo_url]);

  const onPick = async (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Fichier trop volumineux (max 5 Mo)");
    setBusy(true);
    try {
      const url = await uploadPublicFile("school-assets", file, `logo-${id}`);
      setLogoUrl(url);
      toast.success("Logo téléversé");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await apiFetch(`/admin-schools/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ logo_url: logoUrl || null }),
      });
      toast.success("École mise à jour");
      qc.invalidateQueries({ queryKey: ["admin-school", id] });
      qc.invalidateQueries({ queryKey: ["admin-schools"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AdminShell>
        <div className="p-10 text-center text-sm text-muted-foreground">Chargement…</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <header className="rounded-b-[2rem] bg-primary px-5 pt-8 pb-5 text-primary-foreground">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate({ to: "/admin/schools" })} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold">{data?.name}</h1>
            {data?.city && <p className="text-xs opacity-80">{data.city}</p>}
          </div>
        </div>
      </header>

      <section className="px-4 pt-5 pb-24 max-w-2xl mx-auto w-full">
        <div className="rounded-3xl bg-card p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-base font-extrabold">Logo de l'école</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Ce logo apparaîtra sur tous les rapports et reçus officiels de l'école.
          </p>

          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-border bg-secondary/40">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo école" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => onPick(e.target.files?.[0] ?? null)}
              />
              <button
                disabled={!isSuper || busy}
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {busy ? <Loader className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                {logoUrl ? "Changer le logo" : "Téléverser un logo"}
              </button>
              {logoUrl && isSuper && (
                <button
                  onClick={() => setLogoUrl("")}
                  className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2 text-xs font-semibold text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Retirer
                </button>
              )}
            </div>
          </div>

          {!isSuper && (
            <p className="mt-3 text-xs text-muted-foreground">
              Seul le super administrateur peut modifier le logo de l'école.
            </p>
          )}

          <div className="mt-6 flex justify-end">
            <button
              disabled={!isSuper || saving || logoUrl === (data?.logo_url ?? "")}
              onClick={onSave}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
