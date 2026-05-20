import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LuUserRound as UserRound, LuSearch as Search, LuPlus as Plus, LuMail as Mail, LuPhone as Phone,
  LuLock as Lock, LuHash as Hash, LuX as X, LuEye as Eye, LuEyeOff as EyeOff,
  LuImage as ImageIcon, LuLoader as Loader, LuChevronDown, LuChevronUp,
  LuFileSpreadsheet as FileSpreadsheet, LuUpload as Upload, LuCircleCheck as CheckCircle2,
  LuTriangleAlert as AlertTriangle, LuTrash2 as Trash2,
} from "react-icons/lu";
import * as XLSX from "xlsx";
import { AdminShell } from "@/components/AdminShell";
import { AdminHero } from "@/components/AdminHero";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { Pagination } from "@/components/Pagination";
import { apiFetch } from "@/lib/api";
import { uploadPublicFile } from "@/lib/upload";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ParentRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  status: string;
  children: { id: string; first_name: string; last_name: string; matricule: string | null; relationship: string | null }[];
}
interface ParentsResp { items: ParentRow[] }

export const Route = createFileRoute("/_admin/admin/parents")({
  head: () => ({ meta: [{ title: "Parents — Administration" }] }),
  component: ParentsPage,
});

function ParentsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["admin-parents", search],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (search) qs.set("search", search);
      return apiFetch<ParentsResp>(`/admin-parents?${qs.toString()}`);
    },
  });
  const items = data?.items ?? [];
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize],
  );

  const allOnPageSelected = pageItems.length > 0 && pageItems.every((p) => selected.has(p.id));
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageItems.forEach((p) => next.delete(p.id));
      else pageItems.forEach((p) => next.add(p.id));
      return next;
    });
  }

  const bulkDeleteMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map((id) => apiFetch(`/admin-parents/${id}`, { method: "DELETE" })),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      return { total: ids.length, failed };
    },
    onSuccess: ({ total, failed }) => {
      qc.invalidateQueries({ queryKey: ["admin-parents"] });
      setSelected(new Set());
      if (failed === 0) toast.success(`${total} parent(s) supprimé(s)`);
      else toast.warning(`${total - failed}/${total} supprimé(s), ${failed} échec(s)`);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <AdminShell>
      <AdminHero title="Parents" subtitle="Comptes parents (tuteurs) liés aux élèves." backTo="/admin" className="rounded-b-[2rem]" />

      <section className="px-4 pt-4 space-y-2">
        <button
          onClick={() => setCreateOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-3xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-card)]"
        >
          <Plus className="h-4 w-4" /> Créer un compte parent
        </button>
        <button
          onClick={() => setImportOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-3xl border border-border bg-card py-3 text-sm font-bold shadow-[var(--shadow-card)]"
        >
          <FileSpreadsheet className="h-4 w-4 text-primary" /> Importer parents (Excel)
        </button>
      </section>

      <section className="px-4 pt-3">
        <div className="flex items-center gap-2 rounded-2xl bg-card px-4 py-3 shadow-[var(--shadow-card)]">
          <Search className="h-5 w-5 text-primary" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Rechercher (nom, email, matricule…)"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{totalItems} parents</p>
      </section>

      {selected.size > 0 && (
        <section className="px-4 pt-3">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 shadow-[var(--shadow-card)]">
            <p className="text-sm font-bold text-destructive">{selected.size} parent(s) sélectionné(s)</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="rounded-2xl border border-border bg-card px-3 py-2 text-xs font-bold"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={bulkDeleteMut.isPending}
                onClick={() => {
                  if (!confirm(`Supprimer définitivement ${selected.size} parent(s) ? Cette action est irréversible.`)) return;
                  bulkDeleteMut.mutate(Array.from(selected));
                }}
                className="flex items-center gap-2 rounded-2xl bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {bulkDeleteMut.isPending ? "Suppression…" : "Supprimer la sélection"}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="px-4 pt-2 pb-6 lg:hidden">
        {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Chargement…</p>}
        {!isLoading && items.length === 0 && (
          <div className="mt-4 rounded-3xl bg-card p-8 text-center shadow-[var(--shadow-card)]">
            <UserRound className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm font-bold">Aucun parent enregistré</p>
            <p className="mt-1 text-xs text-muted-foreground">Créez un compte parent et liez-le à un élève via son matricule.</p>
          </div>
        )}
        <div className="space-y-3">
          {pageItems.map((p) => (
            <div
              key={p.id}
              className="w-full rounded-3xl bg-card p-4 text-left shadow-[var(--shadow-card)] transition hover:bg-secondary/40"
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 accent-destructive"
                  checked={selected.has(p.id)}
                  onChange={() => toggleOne(p.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Sélectionner"
                />
                <button
                  type="button"
                  onClick={() => setDetailId(p.id)}
                  className="flex flex-1 items-start gap-3 text-left active:scale-[0.99]"
                >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-tint-peach text-tint-peach-foreground">
                  {p.avatar_url
                    ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                    : <UserRound className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-extrabold">{p.full_name ?? "—"}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.email ?? "—"}{p.phone ? ` · ${p.phone}` : ""}</p>
                  {p.children.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.children.map((c) => (
                        <span key={c.id} className="rounded-full bg-tint-sky px-2.5 py-0.5 text-[11px] font-semibold text-tint-sky-foreground">
                          {c.last_name} {c.first_name}{c.matricule ? ` · ${c.matricule}` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Desktop table */}
      <section className="hidden lg:block px-6 pt-4 pb-8">
        <DataTable<ParentRow>
          loading={isLoading}
          rows={pageItems}
          rowKey={(p) => p.id}
          onRowClick={(p) => setDetailId(p.id)}
          caption={<span>{totalItems} parent{totalItems > 1 ? "s" : ""}</span>}
          empty="Aucun parent. Créez un compte ou importez depuis Excel."
          columns={[
            {
              key: "select",
              header: (
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-destructive"
                  checked={allOnPageSelected}
                  onChange={toggleAllOnPage}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Tout sélectionner"
                />
              ),
              cell: (p) => (
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-destructive"
                  checked={selected.has(p.id)}
                  onChange={() => toggleOne(p.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Sélectionner"
                />
              ),
            },
            {
              key: "name",
              header: "Parent",
              cell: (p) => (
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-tint-peach text-tint-peach-foreground">
                    {p.avatar_url
                      ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                      : <UserRound className="h-4 w-4" />}
                  </span>
                  <span className="font-bold">{p.full_name ?? "—"}</span>
                </div>
              ),
            },
            { key: "email", header: "Email", cell: (p) => <span className="text-xs">{p.email ?? "—"}</span> },
            { key: "phone", header: "Téléphone", cell: (p) => <span className="font-mono text-xs">{p.phone ?? "—"}</span> },
            {
              key: "status",
              header: "Statut",
              cell: (p) => (
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  p.status === "active" ? "bg-tint-mint text-tint-mint-foreground" : "bg-muted text-muted-foreground",
                )}>
                  {p.status}
                </span>
              ),
            },
            {
              key: "children",
              header: "Enfants",
              cell: (p) => p.children.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : (
                <div className="flex flex-wrap gap-1">
                  {p.children.slice(0, 3).map((c) => (
                    <span key={c.id} className="rounded-full bg-tint-sky px-2 py-0.5 text-[10px] font-semibold text-tint-sky-foreground">
                      {c.last_name} {c.first_name}
                    </span>
                  ))}
                  {p.children.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">+{p.children.length - 3}</span>
                  )}
                </div>
              ),
            },
            {
              key: "actions",
              header: "",
              headerClassName: "text-right",
              className: "text-right",
              cell: () => <span className="text-xs font-semibold text-primary">Voir la fiche →</span>,
            },
          ] as DataTableColumn<ParentRow>[]}
        />
      </section>

      <section className="px-4 lg:px-6 pb-8">
        <Pagination
          page={safePage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </section>

      {createOpen && (
        <CreateParentDrawer
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["admin-parents"] });
            setCreateOpen(false);
          }}
        />
      )}
      {importOpen && (
        <ImportParentsDrawer
          onClose={() => setImportOpen(false)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["admin-parents"] });
            setImportOpen(false);
          }}
        />
      )}
      {detailId && (
        <ParentDetailDrawer parentId={detailId} onClose={() => setDetailId(null)} />
      )}
    </AdminShell>
  );
}

interface ParentDetail {
  profile: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
    first_name: string | null;
    last_name: string | null;
    post_name: string | null;
    gender: string | null;
    profession: string | null;
    relationship: string | null;
    physical_address: string | null;
    professional_address: string | null;
    status: string;
    created_at: string;
    substitute: Record<string, string> | null;
  };
  roles: string[];
  account: {
    email: string | null;
    email_confirmed_at: string | null;
    phone: string | null;
    last_sign_in_at: string | null;
    created_at: string | null;
    provider: string | null;
  } | null;
  children: {
    link_id: string;
    relationship: string | null;
    id: string;
    first_name: string;
    last_name: string;
    post_name: string | null;
    matricule: string | null;
    gender: string | null;
    birth_date: string | null;
    photo_url: string | null;
    school: { id: string; name: string } | null;
    class: { id: string; name: string; level: string | null; academic_year: string | null } | null;
  }[];
}

function ParentDetailDrawer({ parentId, onClose }: { parentId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-parent", parentId],
    queryFn: () => apiFetch<ParentDetail>(`/admin-parents/${parentId}`),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiFetch(`/admin-parents/${parentId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Parent supprimé");
      qc.invalidateQueries({ queryKey: ["admin-parents"] });
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  function fmtDate(s: string | null | undefined) {
    if (!s) return "—";
    try { return new Date(s).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }); } catch { return s; }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-[480px] rounded-t-[2rem] bg-background p-5 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-border" />
        <div className="mt-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-extrabold">
            <UserRound className="h-5 w-5 text-primary" /> Fiche parent
          </h3>
          <button type="button" onClick={onClose} aria-label="Fermer">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {isLoading && <p className="py-10 text-center text-sm text-muted-foreground">Chargement…</p>}
        {error && <p className="py-10 text-center text-sm text-destructive">{(error as Error).message}</p>}

        {data && (
          <div className="mt-4 space-y-4">
            {/* Header avec photo */}
            <div className="flex items-center gap-3 rounded-3xl bg-card p-4 shadow-[var(--shadow-card)]">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-tint-peach text-tint-peach-foreground">
                {data.profile.avatar_url
                  ? <img src={data.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                  : <UserRound className="h-7 w-7" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-extrabold">{data.profile.full_name ?? "—"}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {data.roles.map((r) => (
                    <span key={r} className="rounded-full bg-tint-lavender px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-tint-lavender-foreground">{r}</span>
                  ))}
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    data.profile.status === "active" ? "bg-tint-mint text-tint-mint-foreground" : "bg-muted text-muted-foreground",
                  )}>{data.profile.status}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setEditOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-primary bg-card py-2.5 text-xs font-extrabold text-primary shadow-[var(--shadow-card)]"
            >
              ✏️ Modifier les informations
            </button>

            <button
              type="button"
              disabled={deleteMut.isPending}
              onClick={() => {
                const name = data.profile.full_name ?? "ce parent";
                if (confirm(`Supprimer définitivement ${name} ?\n\nCela retire son compte de connexion, ses liens avec les élèves et toutes ses notifications.`)) {
                  deleteMut.mutate();
                }
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive bg-card py-2.5 text-xs font-extrabold text-destructive shadow-[var(--shadow-card)] disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" /> {deleteMut.isPending ? "Suppression…" : "Supprimer le parent"}
            </button>

            {/* Identité */}
            <DetailSection title="Identité">
              <DetailRow label="Prénom" value={data.profile.first_name} />
              <DetailRow label="Postnom" value={data.profile.post_name} />
              <DetailRow label="Nom" value={data.profile.last_name} />
              <DetailRow label="Sexe" value={data.profile.gender === "M" ? "Masculin" : data.profile.gender === "F" ? "Féminin" : null} />
              <DetailRow label="Lien de parenté" value={data.profile.relationship} />
              <DetailRow label="Profession" value={data.profile.profession} />
            </DetailSection>

            {/* Compte de connexion */}
            <DetailSection title="Compte de connexion">
              <DetailRow label="Email" value={data.account?.email ?? data.profile.email} icon={<Mail className="h-3.5 w-3.5" />} />
              <DetailRow label="Téléphone" value={data.profile.phone ?? data.account?.phone} icon={<Phone className="h-3.5 w-3.5" />} />
              <DetailRow
                label="Email vérifié"
                value={data.account?.email_confirmed_at ? `Oui · ${fmtDate(data.account.email_confirmed_at)}` : "Non"}
              />
              <DetailRow label="Fournisseur" value={data.account?.provider ?? "email"} />
              <DetailRow label="Dernière connexion" value={data.account?.last_sign_in_at ? fmtDate(data.account.last_sign_in_at) : "Jamais connecté"} />
              <DetailRow label="Compte créé le" value={fmtDate(data.account?.created_at ?? data.profile.created_at)} />
            </DetailSection>

            {/* Adresses */}
            <DetailSection title="Adresses">
              <DetailRow label="Adresse physique" value={data.profile.physical_address} multiline />
              <DetailRow label="Adresse professionnelle" value={data.profile.professional_address} multiline />
            </DetailSection>

            {/* Enfants liés */}
            <DetailSection title={`Enfants liés (${data.children.length})`}>
              {data.children.length === 0 && (
                <p className="text-xs text-muted-foreground">Aucun enfant lié.</p>
              )}
              <div className="space-y-2">
                {data.children.map((c) => (
                  <div key={c.link_id} className="rounded-2xl bg-secondary/50 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-card">
                        {c.photo_url
                          ? <img src={c.photo_url} alt="" className="h-full w-full object-cover" />
                          : <UserRound className="h-5 w-5 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold">{c.last_name} {c.post_name ?? ""} {c.first_name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {c.matricule ? `Mat. ${c.matricule}` : "—"}
                          {c.class ? ` · ${c.class.name}` : ""}
                          {c.school ? ` · ${c.school.name}` : ""}
                        </p>
                        {c.relationship && (
                          <span className="mt-1 inline-block rounded-full bg-tint-sky px-2 py-0.5 text-[10px] font-semibold text-tint-sky-foreground">
                            {c.relationship}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </DetailSection>

            {/* Remplaçant */}
            {data.profile.substitute && Object.keys(data.profile.substitute).length > 0 && (
              <DetailSection title="Remplaçant">
                <DetailRow label="Prénom" value={data.profile.substitute.first_name} />
                <DetailRow label="Nom" value={data.profile.substitute.last_name} />
                <DetailRow label="Lien" value={data.profile.substitute.relationship} />
                <DetailRow label="Téléphone" value={data.profile.substitute.phone} />
                <DetailRow label="Email" value={data.profile.substitute.email} />
              </DetailSection>
            )}
          </div>
        )}
      </div>

      {editOpen && data && (
        <EditParentDrawer
          parentId={parentId}
          initial={data.profile}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["admin-parent", parentId] });
            qc.invalidateQueries({ queryKey: ["admin-parents"] });
            setEditOpen(false);
          }}
        />
      )}
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-card p-4 shadow-[var(--shadow-card)]">
      <h4 className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function DetailRow({ label, value, icon, multiline }: { label: string; value: string | null | undefined; icon?: React.ReactNode; multiline?: boolean }) {
  return (
    <div className={cn("flex gap-3 border-b border-border/60 py-1.5 last:border-0", multiline ? "flex-col" : "items-start justify-between")}>
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}{label}
      </span>
      <span className={cn("text-sm font-medium", multiline ? "" : "text-right")}>{value || "—"}</span>
    </div>
  );
}

interface Substitute {
  first_name?: string;
  last_name?: string;
  relationship?: string;
  phone?: string;
  email?: string;
  avatar_url?: string;
}

function CreateParentDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [avatarUrl, setAvatarUrl] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [postName, setPostName] = useState("");
  const [gender, setGender] = useState<"M" | "F" | "">("");
  const [profession, setProfession] = useState("");
  const [relationship, setRelationship] = useState("parent");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [physicalAddress, setPhysicalAddress] = useState("");
  const [professionalAddress, setProfessionalAddress] = useState("");
  const [matricule, setMatricule] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const [showSub, setShowSub] = useState(false);
  const [sub, setSub] = useState<Substitute>({});

  const fullName = [firstName.trim(), postName.trim(), lastName.trim()].filter(Boolean).join(" ");

  const mut = useMutation({
    mutationFn: () => {
      const substitute = showSub && (sub.first_name || sub.last_name || sub.phone || sub.email)
        ? sub
        : null;
      return apiFetch("/admin-parents", {
        method: "POST",
        body: JSON.stringify({
          full_name: fullName,
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          post_name: postName.trim() || null,
          gender: gender || null,
          profession: profession.trim() || null,
          relationship,
          email: email.trim(),
          phone: phone.trim() || null,
          password,
          avatar_url: avatarUrl || null,
          physical_address: physicalAddress.trim() || null,
          professional_address: professionalAddress.trim() || null,
          matricule: matricule.trim(),
          substitute,
        }),
      });
    },
    onSuccess: () => { toast.success("Compte parent créé et lié à l'élève"); onCreated(); },
    onError: (e) => toast.error((e as Error).message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return toast.error("Prénom et nom requis");
    if (!email.trim()) return toast.error("Email requis");
    if (password.length < 8) return toast.error("Mot de passe : 8 caractères minimum");
    if (!matricule.trim()) return toast.error("Matricule de l'élève requis");
    mut.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[480px] rounded-t-[2rem] bg-background p-5 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-border" />
        <div className="mt-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-extrabold">
            <UserRound className="h-5 w-5 text-primary" /> Nouveau compte parent
          </h3>
          <button type="button" onClick={onClose} aria-label="Fermer">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          Le compte sera lié à un élève de votre école via son matricule.
        </p>

        <SectionTitle>Photo</SectionTitle>
        <PhotoUpload value={avatarUrl} onChange={setAvatarUrl} prefix="parent" />

        <SectionTitle>Identité</SectionTitle>
        <div className="space-y-2.5">
          <Field label="Prénom *">
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className={inputCls} />
          </Field>
          <Field label="Nom *">
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} required className={inputCls} />
          </Field>
          <Field label="Postnom">
            <input value={postName} onChange={(e) => setPostName(e.target.value)} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Sexe">
              <select value={gender} onChange={(e) => setGender(e.target.value as "M" | "F" | "")} className={inputCls}>
                <option value="">—</option>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            </Field>
            <Field label="Lien de parenté">
              <select value={relationship} onChange={(e) => setRelationship(e.target.value)} className={inputCls}>
                <option value="parent">Parent</option>
                <option value="pere">Père</option>
                <option value="mere">Mère</option>
                <option value="tuteur">Tuteur</option>
                <option value="oncle">Oncle</option>
                <option value="tante">Tante</option>
              </select>
            </Field>
          </div>
          <Field label="Profession">
            <input value={profession} onChange={(e) => setProfession(e.target.value)} className={inputCls} />
          </Field>
        </div>

        <SectionTitle>Contact & compte</SectionTitle>
        <div className="space-y-2.5">
          <FieldIcon icon={<Mail className="h-4 w-4 text-muted-foreground" />}>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email *"
              className="flex-1 bg-transparent text-sm outline-none" required />
          </FieldIcon>
          <FieldIcon icon={<Phone className="h-4 w-4 text-muted-foreground" />}>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="Téléphone"
              className="flex-1 bg-transparent text-sm outline-none" />
          </FieldIcon>
          <FieldIcon icon={<Lock className="h-4 w-4 text-muted-foreground" />}>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPwd ? "text" : "password"}
              placeholder="Mot de passe (8+ caractères) *" className="flex-1 bg-transparent text-sm outline-none" required />
            <button type="button" onClick={() => setShowPwd((v) => !v)}>
              {showPwd ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
            </button>
          </FieldIcon>
        </div>

        <SectionTitle>Adresses</SectionTitle>
        <div className="space-y-2.5">
          <Field label="Adresse physique">
            <textarea value={physicalAddress} onChange={(e) => setPhysicalAddress(e.target.value)} rows={2} className={inputCls} />
          </Field>
          <Field label="Adresse professionnelle">
            <textarea value={professionalAddress} onChange={(e) => setProfessionalAddress(e.target.value)} rows={2} className={inputCls} />
          </Field>
        </div>

        <SectionTitle>Élève à lier</SectionTitle>
        <FieldIcon icon={<Hash className="h-4 w-4 text-muted-foreground" />}>
          <input value={matricule} onChange={(e) => setMatricule(e.target.value)} placeholder="Matricule de l'élève *"
            className="flex-1 bg-transparent text-sm outline-none" required />
        </FieldIcon>

        <button
          type="button"
          onClick={() => setShowSub((v) => !v)}
          className="mt-5 flex w-full items-center justify-between rounded-2xl border border-dashed border-border bg-card px-4 py-3 text-sm font-bold"
        >
          <span>Remplaçant (optionnel)</span>
          {showSub ? <LuChevronUp className="h-4 w-4" /> : <LuChevronDown className="h-4 w-4" />}
        </button>

        {showSub && (
          <div className="mt-2.5 space-y-2.5 rounded-2xl border border-border bg-secondary/40 p-3">
            <PhotoUpload value={sub.avatar_url ?? ""} onChange={(u) => setSub((s) => ({ ...s, avatar_url: u }))} prefix="sub" />
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Prénom">
                <input value={sub.first_name ?? ""} onChange={(e) => setSub((s) => ({ ...s, first_name: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="Nom">
                <input value={sub.last_name ?? ""} onChange={(e) => setSub((s) => ({ ...s, last_name: e.target.value }))} className={inputCls} />
              </Field>
            </div>
            <Field label="Lien de parenté">
              <input value={sub.relationship ?? ""} onChange={(e) => setSub((s) => ({ ...s, relationship: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Téléphone">
              <input value={sub.phone ?? ""} type="tel" onChange={(e) => setSub((s) => ({ ...s, phone: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Email">
              <input value={sub.email ?? ""} type="email" onChange={(e) => setSub((s) => ({ ...s, email: e.target.value }))} className={inputCls} />
            </Field>
          </div>
        )}

        <button type="submit" disabled={mut.isPending}
          className="mt-5 w-full rounded-3xl bg-primary py-4 text-sm font-extrabold text-primary-foreground disabled:opacity-60">
          {mut.isPending ? "Création…" : "Créer et lier"}
        </button>
      </form>
    </div>
  );
}

const inputCls = "w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm font-medium outline-none focus:border-primary";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="mt-5 mb-2 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">{children}</h4>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function FieldIcon({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex h-12 items-center gap-3 rounded-2xl border border-input bg-card px-4 shadow-[var(--shadow-card)]">
      {icon}
      {children}
    </div>
  );
}

function PhotoUpload({ value, onChange, prefix }: { value: string; onChange: (url: string) => void; prefix: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const onPick = async (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Fichier trop volumineux (max 5 Mo)"); return; }
    setBusy(true);
    try {
      const url = await uploadPublicFile("avatars", file, prefix);
      onChange(url);
      toast.success("Photo téléversée");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 p-3">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-card">
        {value ? <img src={value} alt="Photo" className="h-full w-full object-cover" /> : <UserRound className="h-6 w-6 text-muted-foreground" />}
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">
          {busy ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
          {busy ? "Téléversement…" : value ? "Remplacer" : "Ajouter une photo"}
        </button>
        {value && <button type="button" onClick={() => onChange("")} className="text-xs font-semibold text-destructive">Retirer</button>}
      </div>
    </div>
  );
}

// ===================== Import parents (Excel) =====================

interface ImportParentRow {
  first_name: string;
  last_name: string;
  post_name?: string;
  email: string;
  password?: string;
  phone?: string;
  gender?: string;
  profession?: string;
  relationship?: string;
  physical_address?: string;
  professional_address?: string;
  matricule?: string;
  __error?: string;
}

interface ImportParentsResult {
  created_count: number;
  skipped_count: number;
  failed_count: number;
  created: { email: string; full_name: string | null; generated_password?: string; student?: { matricule?: string } | null }[];
  skipped: { row: number; email?: string; reason: string }[];
  failed: { row: number; reason: string }[];
}

function ImportParentsDrawer({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportParentRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportParentsResult | null>(null);
  const validRows = useMemo(() => rows.filter((r) => !r.__error), [rows]);

  const importMut = useMutation({
    mutationFn: () =>
      apiFetch<ImportParentsResult>("/admin-parents/import", {
        method: "POST",
        body: JSON.stringify({ parents: validRows }),
      }),
    onSuccess: (r) => {
      setResult(r);
      toast.success(`${r.created_count} parents créés`);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  function downloadTemplate() {
    const headers = [
      "first_name", "last_name", "post_name", "email", "password",
      "phone", "gender", "profession", "relationship",
      "physical_address", "professional_address", "matricule",
    ];
    const sample1 = [
      "Joseph", "KABILA", "MULAMBA", "joseph.kabila@example.cd", "",
      "+243810000001", "M", "Ingénieur", "père",
      "12 av. Lumumba, Kinshasa", "Sonatrach, Gombe", "MAT-001",
    ];
    const sample2 = [
      "Marie", "MUKENDI", "TSHIBANGU", "marie.mukendi@example.cd", "MotDePasse2024!",
      "+243820000002", "F", "Comptable", "mère",
      "45 av. Mobutu, Lubumbashi", "Banque Centrale", "MAT-002",
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, sample1, sample2]);
    (ws as any)["!cols"] = headers.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Parents");
    XLSX.writeFile(wb, "modele-import-parents.xlsx");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (json.length > 3000) {
        toast.error(`Fichier trop volumineux : ${json.length} lignes (max 3000)`);
        return;
      }
      const parsed: ImportParentRow[] = json.map((r) => {
        const norm = (k: string) =>
          String(
            (r as any)[k] ??
              (r as any)[k.toUpperCase()] ??
              (r as any)[k.replace(/_/g, " ")] ??
              "",
          ).trim();
        const row: ImportParentRow = {
          first_name: norm("first_name") || norm("prenom") || norm("prénom"),
          last_name: norm("last_name") || norm("nom"),
          post_name: norm("post_name") || norm("postnom") || undefined,
          email: (norm("email") || norm("mail")).toLowerCase(),
          password: norm("password") || norm("mot_de_passe") || undefined,
          phone: norm("phone") || norm("telephone") || norm("téléphone") || undefined,
          gender: norm("gender") || norm("sexe") || undefined,
          profession: norm("profession") || norm("metier") || norm("métier") || undefined,
          relationship: norm("relationship") || norm("lien") || norm("relation") || undefined,
          physical_address: norm("physical_address") || norm("adresse") || norm("adresse_physique") || undefined,
          professional_address: norm("professional_address") || norm("adresse_pro") || norm("adresse_professionnelle") || undefined,
          matricule: norm("matricule") || norm("matricule_eleve") || undefined,
        };
        if (!row.email || !row.email.includes("@")) row.__error = "Email invalide";
        else if (!row.first_name || !row.last_name) row.__error = "Prénom et nom requis";
        return row;
      });
      setRows(parsed);
    } catch (err) {
      toast.error("Fichier illisible");
      console.error(err);
    } finally {
      e.target.value = "";
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-[480px] rounded-t-[2rem] bg-background p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-border" />
        <h3 className="mt-3 flex items-center gap-2 text-base font-extrabold">
          <FileSpreadsheet className="h-5 w-5 text-primary" /> Import parents
        </h3>

        {!result && (
          <>
            <p className="mt-2 text-xs text-muted-foreground">
              Colonnes : <strong>first_name, last_name, post_name, email, password, phone, gender, profession, relationship, physical_address, professional_address, matricule</strong>.
              Obligatoires : <strong>first_name, last_name, email</strong>. Le mot de passe est généré automatiquement si vide. Le matricule (optionnel) lie le parent à un élève existant. Capacité : <strong>3000 lignes max</strong>.
            </p>

            <div className="mt-3 flex gap-2">
              <button onClick={downloadTemplate} className="flex-1 rounded-2xl border border-border bg-card py-3 text-xs font-bold">
                📥 Modèle xlsx
              </button>
              <button onClick={() => fileRef.current?.click()} className="flex-1 rounded-2xl bg-primary py-3 text-xs font-bold text-primary-foreground">
                📂 Choisir fichier
              </button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="hidden" />
            </div>

            {fileName && (
              <p className="mt-3 text-xs text-muted-foreground">
                Fichier : <strong>{fileName}</strong> · {rows.length} ligne(s) ·{" "}
                <span className="text-success">{validRows.length} valides</span>
                {rows.length - validRows.length > 0 && (
                  <span className="text-warning"> · {rows.length - validRows.length} en erreur</span>
                )}
              </p>
            )}

            {rows.length > 0 && (
              <div className="mt-3 max-h-72 overflow-auto rounded-2xl border border-border">
                <table className="min-w-max text-[11px]">
                  <thead className="sticky top-0 bg-secondary text-left">
                    <tr>
                      <th className="p-2">#</th>
                      <th className="p-2">Nom</th>
                      <th className="p-2">Prénom</th>
                      <th className="p-2">Postnom</th>
                      <th className="p-2">Email</th>
                      <th className="p-2">Mot de passe</th>
                      <th className="p-2">Téléphone</th>
                      <th className="p-2">Sexe</th>
                      <th className="p-2">Profession</th>
                      <th className="p-2">Lien</th>
                      <th className="p-2">Adresse</th>
                      <th className="p-2">Adresse pro</th>
                      <th className="p-2">Matricule élève</th>
                      <th className="p-2">Erreur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((r, i) => (
                      <tr key={i} className={cn("border-t border-border", r.__error && "bg-destructive/10")}>
                        <td className="p-2 text-muted-foreground">{i + 1}</td>
                        <td className="p-2 font-bold whitespace-nowrap">{r.last_name || "—"}</td>
                        <td className="p-2 whitespace-nowrap">{r.first_name || "—"}</td>
                        <td className="p-2 whitespace-nowrap">{r.post_name || "—"}</td>
                        <td className="p-2 whitespace-nowrap">{r.email || "—"}</td>
                        <td className="p-2 whitespace-nowrap text-muted-foreground">{r.password ? "•••••" : "auto"}</td>
                        <td className="p-2 whitespace-nowrap">{r.phone || "—"}</td>
                        <td className="p-2">{r.gender || "—"}</td>
                        <td className="p-2 whitespace-nowrap">{r.profession || "—"}</td>
                        <td className="p-2 whitespace-nowrap">{r.relationship || "—"}</td>
                        <td className="p-2 max-w-[180px] truncate" title={r.physical_address}>{r.physical_address || "—"}</td>
                        <td className="p-2 max-w-[180px] truncate" title={r.professional_address}>{r.professional_address || "—"}</td>
                        <td className="p-2 whitespace-nowrap">{r.matricule || "—"}</td>
                        <td className="p-2 whitespace-nowrap text-destructive">{r.__error || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 50 && (
                  <p className="border-t border-border p-2 text-center text-[11px] text-muted-foreground">
                    … et {rows.length - 50} ligne(s) supplémentaires
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button onClick={onClose} className="flex items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm font-bold">
                Annuler
              </button>
              <button
                disabled={validRows.length === 0 || importMut.isPending}
                onClick={() => importMut.mutate()}
                className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {importMut.isPending ? <Loader className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Importer {validRows.length}
              </button>
            </div>
          </>
        )}

        {result && (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-tint-mint/40 p-4">
              <p className="flex items-center gap-2 text-sm font-extrabold">
                <CheckCircle2 className="h-4 w-4 text-success" /> {result.created_count} parent(s) créé(s)
              </p>
              {result.created.some((c) => c.generated_password) && (
                <div className="mt-2 max-h-40 overflow-y-auto rounded-xl bg-background/80 p-2 text-[11px]">
                  <p className="font-bold mb-1">Mots de passe générés (à transmettre) :</p>
                  <ul className="space-y-0.5">
                    {result.created.filter((c) => c.generated_password).slice(0, 50).map((c, i) => (
                      <li key={i} className="font-mono"><strong>{c.email}</strong> → {c.generated_password}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {result.skipped_count > 0 && (
              <div className="rounded-2xl bg-tint-peach/40 p-4">
                <p className="flex items-center gap-2 text-sm font-extrabold">
                  <Trash2 className="h-4 w-4" /> {result.skipped_count} ignoré(s)
                </p>
                <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                  {result.skipped.slice(0, 10).map((s, i) => (
                    <li key={i}>Ligne {s.row} — {s.email} — {s.reason}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.failed_count > 0 && (
              <div className="rounded-2xl bg-destructive/10 p-4">
                <p className="flex items-center gap-2 text-sm font-extrabold text-destructive">
                  <AlertTriangle className="h-4 w-4" /> {result.failed_count} échec(s)
                </p>
                <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                  {result.failed.slice(0, 10).map((f, i) => (
                    <li key={i}>Ligne {f.row} — {f.reason}</li>
                  ))}
                </ul>
              </div>
            )}
            <button onClick={onDone} className="w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground">
              Terminer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ===================== Édition profil parent =====================

interface EditParentInitial {
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  post_name: string | null;
  gender: string | null;
  profession: string | null;
  relationship: string | null;
  phone: string | null;
  physical_address: string | null;
  professional_address: string | null;
  avatar_url: string | null;
}

function EditParentDrawer({
  parentId,
  initial,
  onClose,
  onSaved,
}: {
  parentId: string;
  initial: EditParentInitial;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState(initial.full_name ?? "");
  const [firstName, setFirstName] = useState(initial.first_name ?? "");
  const [lastName, setLastName] = useState(initial.last_name ?? "");
  const [postName, setPostName] = useState(initial.post_name ?? "");
  const [gender, setGender] = useState<string>(initial.gender ?? "");
  const [profession, setProfession] = useState(initial.profession ?? "");
  const [relationship, setRelationship] = useState(initial.relationship ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [physicalAddress, setPhysicalAddress] = useState(initial.physical_address ?? "");
  const [professionalAddress, setProfessionalAddress] = useState(initial.professional_address ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initial.avatar_url ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const saveMut = useMutation({
    mutationFn: () =>
      apiFetch(`/admin-parents/${parentId}`, {
        method: "PATCH",
        body: JSON.stringify({
          full_name: fullName.trim() || null,
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          post_name: postName.trim() || null,
          gender: gender || null,
          profession: profession.trim() || null,
          relationship: relationship.trim() || null,
          phone: phone.trim() || null,
          physical_address: physicalAddress.trim() || null,
          professional_address: professionalAddress.trim() || null,
          avatar_url: avatarUrl || null,
        }),
      }),
    onSuccess: () => {
      toast.success("Parent mis à jour");
      onSaved();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  async function onPickPhoto(file: File | null) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Fichier trop volumineux (max 5 Mo)"); return; }
    setBusy(true);
    try {
      const url = await uploadPublicFile("avatars", file, "parent");
      setAvatarUrl(url);
      toast.success("Photo téléversée");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  const inputCls = "w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm font-medium outline-none focus:border-primary";

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50" onClick={onClose}>
      <form
        onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }}
        className="max-h-[92vh] w-full max-w-[480px] overflow-y-auto rounded-t-[2rem] bg-background p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-border" />
        <div className="mt-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-extrabold">
            <UserRound className="h-5 w-5 text-primary" /> Modifier le parent
          </h3>
          <button type="button" onClick={onClose} aria-label="Fermer">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <h4 className="mt-5 mb-2 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">Photo</h4>
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 p-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-card">
            {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-6 w-6 text-muted-foreground" />}
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">
              {busy ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
              {busy ? "Téléversement…" : avatarUrl ? "Remplacer" : "Ajouter une photo"}
            </button>
            {avatarUrl && <button type="button" onClick={() => setAvatarUrl("")} className="text-xs font-semibold text-destructive">Retirer</button>}
          </div>
        </div>

        <h4 className="mt-5 mb-2 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">Identité</h4>
        <div className="space-y-2.5">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Nom complet</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Prénom</span>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Nom</span>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Postnom</span>
              <input value={postName} onChange={(e) => setPostName(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Sexe</span>
              <select value={gender} onChange={(e) => setGender(e.target.value)} className={inputCls}>
                <option value="">—</option>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Lien de parenté</span>
              <select value={relationship} onChange={(e) => setRelationship(e.target.value)} className={inputCls}>
                <option value="">—</option>
                <option value="parent">Parent</option>
                <option value="pere">Père</option>
                <option value="mere">Mère</option>
                <option value="tuteur">Tuteur</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Profession</span>
              <input value={profession} onChange={(e) => setProfession(e.target.value)} className={inputCls} />
            </label>
          </div>
        </div>

        <h4 className="mt-5 mb-2 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">Coordonnées</h4>
        <div className="space-y-2.5">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Téléphone</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Adresse physique</span>
            <textarea value={physicalAddress} onChange={(e) => setPhysicalAddress(e.target.value)} rows={2} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Adresse professionnelle</span>
            <textarea value={professionalAddress} onChange={(e) => setProfessionalAddress(e.target.value)} rows={2} className={inputCls} />
          </label>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="rounded-3xl border border-border bg-card py-3.5 text-sm font-bold">
            Annuler
          </button>
          <button
            type="submit"
            disabled={saveMut.isPending}
            className="rounded-3xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground disabled:opacity-50"
          >
            {saveMut.isPending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}
