import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LuUsers as Users, LuSearch as Search, LuUpload as Upload, LuFileSpreadsheet as FileSpreadsheet, LuCircleCheckBig as CheckCircle2, LuTriangleAlert as AlertTriangle, LuTrash2 as Trash2, LuPlus as Plus, LuX as X, LuUserRound as UserRound, LuLink as LinkIcon, LuMail as Mail, LuPhone as Phone } from "react-icons/lu";
import * as XLSX from "xlsx";
import { AdminShell } from "@/components/AdminShell";
import { AdminHero } from "@/components/AdminHero";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { CreateStudentDrawer } from "@/components/CreateStudentDrawer";
import { Pagination } from "@/components/Pagination";

interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
  post_name?: string | null;
  matricule: string | null;
  gender: string | null;
  birth_date?: string | null;
  birth_place?: string | null;
  physical_address?: string | null;
  photo_url?: string | null;
  enrollment_date?: string | null;
  school_id?: string | null;
  section_id?: string | null;
  option_id?: string | null;
  class_id?: string | null;
  class?: { id: string; name: string; level: string | null } | null;
}
interface StudentsResp {
  items: StudentRow[];
  totalItems: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ImportRow {
  first_name: string;
  last_name: string;
  post_name?: string;
  matricule?: string;
  gender?: string;
  birth_date?: string;
  birth_place?: string;
  physical_address?: string;
  photo_url?: string;
  enrollment_date?: string;
  class_name?: string;
  level?: string;
  academic_year?: string;
  section_name?: string;
  option_name?: string;
  __error?: string;
}

interface ImportResult {
  created_count: number;
  skipped_count: number;
  failed_count: number;
  skipped: { row: number; matricule?: string; reason: string }[];
  failed: { row: number; reason: string }[];
}

export const Route = createFileRoute("/_admin/admin/students")({
  head: () => ({ meta: [{ title: "Élèves — Administration" }] }),
  component: StudentsPage,
});

function StudentsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { user, profile, roles } = useAuth();
  const isSuper = roles.includes("super_admin");
  const isAdmin = roles.includes("admin");
  const adminSchoolQ = useQuery({
    queryKey: ["admin-school-of", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("admin_schools").select("school_id").eq("user_id", user!.id).maybeSingle();
      return data?.school_id ?? null;
    },
    enabled: !!user?.id && isAdmin && !profile?.primary_school_id,
  });
  const schoolId = profile?.primary_school_id ?? adminSchoolQ.data ?? null;
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [activeStudent, setActiveStudent] = useState<StudentRow | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-students", schoolId, search, page, pageSize],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (schoolId) qs.set("schoolId", schoolId);
      if (search) qs.set("search", search);
      qs.set("page", String(page));
      qs.set("limit", String(pageSize));
      return apiFetch<StudentsResp>(`/students?${qs.toString()}`);
    },
    enabled: !!schoolId || isSuper,
  });

  const items = data?.items ?? [];
  const totalItems = data?.totalItems ?? items.length;
  const totalPages = data?.totalPages ?? 1;

  return (
    <AdminShell>
      <AdminHero title="Élèves" subtitle="Gérez les élèves de votre école." backTo="/admin" className="rounded-b-[2rem]" />

      <section className="px-4 pt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center justify-center gap-2 rounded-3xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-card)] transition disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Plus className="h-4 w-4" /> Nouvel élève
        </button>
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className="flex items-center justify-center gap-2 rounded-3xl border border-primary bg-card py-3.5 text-sm font-extrabold text-primary shadow-[var(--shadow-card)]"
        >
          <Upload className="h-4 w-4" /> Import Excel
        </button>
      </section>

      <section className="px-4 pt-3">
        <div className="flex items-center gap-2 rounded-2xl bg-card px-4 py-3 shadow-[var(--shadow-card)]">
          <Search className="h-5 w-5 text-primary" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Rechercher par nom ou matricule…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{totalItems} élèves</p>
      </section>

      <section className="px-4 pt-2 pb-6 lg:hidden">
        {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Chargement…</p>}
        {!isLoading && items.length === 0 && (
          <div className="mt-4 rounded-3xl bg-card p-8 text-center shadow-[var(--shadow-card)]">
            <Users className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm font-bold">Aucun élève</p>
            <p className="mt-1 text-xs text-muted-foreground">Importez votre liste depuis un fichier Excel ou CSV.</p>
          </div>
        )}
        <div className="space-y-2">
          {items.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveStudent(s)}
              className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-[var(--shadow-card)] active:scale-[0.99] transition"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-tint-sky text-tint-sky-foreground font-bold">
                {s.photo_url
                  ? <img src={s.photo_url} alt="" className="h-full w-full object-cover" />
                  : (s.first_name?.[0] ?? "?").toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold">{s.last_name?.toUpperCase()} {s.first_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {s.matricule ? `Mat. ${s.matricule}` : "—"}
                  {s.class ? ` · ${s.class.name}` : ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Desktop table */}
      <section className="hidden lg:block px-6 pt-4 pb-8">
        <DataTable<StudentRow>
          loading={isLoading}
          rows={items}
          rowKey={(s) => s.id}
          onRowClick={(s) => setActiveStudent(s)}
          caption={<span>{items.length} élève{items.length > 1 ? "s" : ""}</span>}
          empty="Aucun élève. Importez votre liste depuis un fichier Excel."
          columns={[
            {
              key: "name",
              header: "Élève",
              cell: (s) => (
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-tint-sky text-tint-sky-foreground text-xs font-bold">
                    {s.photo_url
                      ? <img src={s.photo_url} alt="" className="h-full w-full object-cover" />
                      : (s.first_name?.[0] ?? "?").toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold">{s.last_name?.toUpperCase()} {s.first_name}</p>
                  </div>
                </div>
              ),
            },
            { key: "matricule", header: "Matricule", cell: (s) => <span className="font-mono text-xs">{s.matricule ?? "—"}</span> },
            { key: "gender", header: "Sexe", cell: (s) => s.gender === "M" ? "Masculin" : s.gender === "F" ? "Féminin" : "—" },
            { key: "class", header: "Classe", cell: (s) => s.class?.name ?? "—" },
            { key: "level", header: "Niveau", cell: (s) => s.class?.level ?? "—" },
            {
              key: "actions",
              header: "",
              headerClassName: "text-right",
              className: "text-right",
              cell: () => <span className="text-xs font-semibold text-primary">Voir la fiche →</span>,
            },
          ] as DataTableColumn<StudentRow>[]}
        />
      </section>

      <section className="px-4 lg:px-6 pb-8">
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </section>

      {createOpen && (
        <CreateStudentDrawer
          initialSchoolId={schoolId}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["admin-students"] });
            setCreateOpen(false);
          }}
        />
      )}

      {importOpen && (
        <ImportDrawer
          schoolId={schoolId}
          onClose={() => setImportOpen(false)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["admin-students"] });
            setImportOpen(false);
          }}
        />
      )}

      {activeStudent && (
        <StudentDrawer
          student={activeStudent}
          schoolId={schoolId}
          onClose={() => setActiveStudent(null)}
        />
      )}
    </AdminShell>
  );
}

function ImportDrawer({
  schoolId,
  onClose,
  onDone,
}: {
  schoolId: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const validRows = useMemo(() => rows.filter((r) => !r.__error), [rows]);

  const importMut = useMutation({
    mutationFn: () => {
      if (!schoolId) throw new Error("Aucune école associée à votre compte. Contactez le super admin.");
      return apiFetch<ImportResult>("/students/import", {
        method: "POST",
        body: JSON.stringify({ school_id: schoolId, students: validRows }),
      });
    },
    onSuccess: (r) => {
      setResult(r);
      toast.success(`${r.created_count} élèves créés`);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  function pickFile() {
    fileRef.current?.click();
  }

  function downloadTemplate() {
    const headers = [
      "first_name", "last_name", "post_name", "matricule", "gender",
      "birth_date", "birth_place", "physical_address", "photo_url",
      "enrollment_date", "section_name", "option_name",
      "class_name", "level", "academic_year",
    ];
    const sample1 = [
      "Jean", "KABILA", "MULAMBA", "MAT-001", "M",
      "2012-05-12", "Kinshasa", "12 av. Lumumba, Kinshasa", "",
      "2024-09-05", "Scientifique", "Math-Physique",
      "5e A", "Secondaire", "2024-2025",
    ];
    const sample2 = [
      "Marie", "MUKENDI", "TSHIBANGU", "MAT-002", "F",
      "2013-08-03", "Lubumbashi", "45 av. Mobutu, Lubumbashi", "",
      "2024-09-05", "Littéraire", "Latin-Philo",
      "4e B", "Secondaire", "2024-2025",
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, sample1, sample2]);
    // Largeur des colonnes
    (ws as any)["!cols"] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Élèves");
    XLSX.writeFile(wb, "modele-import-eleves.xlsx");
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
      const parsed: ImportRow[] = json.map((r) => {
        const norm = (k: string) =>
          String(
            (r as any)[k] ??
              (r as any)[k.toUpperCase()] ??
              (r as any)[k.replace(/_/g, " ")] ??
              "",
          ).trim();
        const row: ImportRow = {
          first_name: norm("first_name") || norm("prenom") || norm("prénom"),
          last_name: norm("last_name") || norm("nom"),
          post_name: norm("post_name") || norm("postnom") || undefined,
          matricule: norm("matricule") || undefined,
          gender: norm("gender") || norm("sexe") || undefined,
          birth_date: normalizeDate(norm("birth_date") || norm("date_naissance") || norm("date naissance")),
          birth_place: norm("birth_place") || norm("lieu_naissance") || norm("lieu naissance") || undefined,
          physical_address: norm("physical_address") || norm("adresse") || norm("adresse_physique") || undefined,
          photo_url: norm("photo_url") || norm("photo") || undefined,
          enrollment_date: normalizeDate(norm("enrollment_date") || norm("date_inscription") || norm("inscription")),
          section_name: norm("section_name") || norm("section") || undefined,
          option_name: norm("option_name") || norm("option") || undefined,
          class_name: norm("class_name") || norm("classe") || undefined,
          level: norm("level") || norm("niveau") || undefined,
          academic_year: norm("academic_year") || norm("annee_scolaire") || norm("année scolaire") || undefined,
        };
        if (!row.first_name || !row.last_name) row.__error = "Prénom et nom requis";
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
          <FileSpreadsheet className="h-5 w-5 text-primary" /> Import élèves
        </h3>

        {!result && (
          <>
            <p className="mt-2 text-xs text-muted-foreground">
              Colonnes : <strong>first_name, last_name, post_name, matricule, gender, birth_date, birth_place, physical_address, photo_url, enrollment_date, section_name, option_name, class_name, level, academic_year</strong>.
              Seuls <strong>first_name</strong> et <strong>last_name</strong> sont obligatoires. Les classes inconnues sont créées automatiquement ; les sections et options doivent exister au préalable. Capacité : <strong>3000 lignes max</strong>.
            </p>

            <div className="mt-3 flex gap-2">
              <button onClick={downloadTemplate} className="flex-1 rounded-2xl border border-border bg-card py-3 text-xs font-bold">
                📥 Modèle xlsx
              </button>
              <button onClick={pickFile} className="flex-1 rounded-2xl bg-primary py-3 text-xs font-bold text-primary-foreground">
                📂 Choisir fichier
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={onFile}
                className="hidden"
              />
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
                      <th className="p-2">Matricule</th>
                      <th className="p-2">Sexe</th>
                      <th className="p-2">Naissance</th>
                      <th className="p-2">Lieu</th>
                      <th className="p-2">Adresse</th>
                      <th className="p-2">Photo</th>
                      <th className="p-2">Inscription</th>
                      <th className="p-2">Section</th>
                      <th className="p-2">Option</th>
                      <th className="p-2">Classe</th>
                      <th className="p-2">Niveau</th>
                      <th className="p-2">Année</th>
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
                        <td className="p-2 whitespace-nowrap">{r.matricule || "—"}</td>
                        <td className="p-2">{r.gender || "—"}</td>
                        <td className="p-2 whitespace-nowrap">{r.birth_date || "—"}</td>
                        <td className="p-2 whitespace-nowrap">{r.birth_place || "—"}</td>
                        <td className="p-2 max-w-[180px] truncate" title={r.physical_address}>{r.physical_address || "—"}</td>
                        <td className="p-2 max-w-[120px] truncate" title={r.photo_url}>{r.photo_url || "—"}</td>
                        <td className="p-2 whitespace-nowrap">{r.enrollment_date || "—"}</td>
                        <td className="p-2 whitespace-nowrap">{r.section_name || "—"}</td>
                        <td className="p-2 whitespace-nowrap">{r.option_name || "—"}</td>
                        <td className="p-2 whitespace-nowrap">{r.class_name || "—"}</td>
                        <td className="p-2 whitespace-nowrap">{r.level || "—"}</td>
                        <td className="p-2 whitespace-nowrap">{r.academic_year || "—"}</td>
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
                <Upload className="h-4 w-4" /> Importer {validRows.length}
              </button>
            </div>
          </>
        )}

        {result && (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-tint-mint/40 p-4">
              <p className="flex items-center gap-2 text-sm font-extrabold">
                <CheckCircle2 className="h-4 w-4 text-success" /> {result.created_count} élève(s) créé(s)
              </p>
            </div>
            {result.skipped_count > 0 && (
              <div className="rounded-2xl bg-tint-peach/40 p-4">
                <p className="flex items-center gap-2 text-sm font-extrabold">
                  <Trash2 className="h-4 w-4" /> {result.skipped_count} ignoré(s) (matricule déjà existant)
                </p>
                <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                  {result.skipped.slice(0, 10).map((s, i) => (
                    <li key={i}>Ligne {s.row} — {s.matricule}</li>
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

function normalizeDate(v: string): string | undefined {
  if (!v) return undefined;
  // Excel renvoie parfois un nombre (date série). Si c'est déjà une chaîne ISO, on retourne tel quel.
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  // dd/mm/yyyy
  const m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return undefined;
}

// ===================== Fiche élève (drawer) =====================

interface ParentSummary {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
}
interface ParentLink {
  link_id: string;
  relationship: string | null;
  parent: ParentSummary | null;
}

function StudentDrawer({
  student,
  schoolId,
  onClose,
}: {
  student: StudentRow;
  schoolId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [linkOpen, setLinkOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["student-parents", student.id],
    queryFn: () => apiFetch<{ items: ParentLink[] }>(`/admin-parents/students/${student.id}/parents`),
  });
  const parents = data?.items ?? [];

  const unlinkMut = useMutation({
    mutationFn: (linkId: string) => apiFetch(`/admin-parents/link/${linkId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Lien supprimé");
      qc.invalidateQueries({ queryKey: ["student-parents", student.id] });
      qc.invalidateQueries({ queryKey: ["admin-parents"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-[480px] rounded-t-[2rem] bg-background p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-border" />
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-tint-sky text-tint-sky-foreground font-extrabold">
              {student.photo_url
                ? <img src={student.photo_url} alt="" className="h-full w-full object-cover" />
                : (student.first_name?.[0] ?? "?").toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-lg font-extrabold">
                {student.last_name?.toUpperCase()} {student.first_name}
              </h3>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {student.matricule ? `Mat. ${student.matricule}` : "—"}
                {student.class ? ` · ${student.class.name}` : ""}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <button
          onClick={() => setEditOpen(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-primary bg-card py-2.5 text-xs font-extrabold text-primary shadow-[var(--shadow-card)]"
        >
          ✏️ Modifier les informations
        </button>

        <div className="mt-5 flex items-center justify-between">
          <h4 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
            Parents / Tuteurs
          </h4>
          <span className="text-xs text-muted-foreground">{parents.length} lié(s)</span>
        </div>

        <div className="mt-2 space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
          {!isLoading && parents.length === 0 && (
            <div className="rounded-2xl bg-card p-4 text-center shadow-[var(--shadow-card)]">
              <UserRound className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-bold">Aucun parent lié</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Liez un parent existant ou créez-le depuis l'écran "Parents".
              </p>
            </div>
          )}
          {parents.map((p) => (
            <div key={p.link_id} className="flex items-start gap-3 rounded-2xl bg-card p-3 shadow-[var(--shadow-card)]">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-tint-peach text-tint-peach-foreground">
                <UserRound className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold">{p.parent?.full_name ?? "—"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {p.parent?.email ?? "—"}{p.parent?.phone ? ` · ${p.parent.phone}` : ""}
                </p>
                {p.relationship && (
                  <span className="mt-1 inline-block rounded-full bg-tint-sky px-2 py-0.5 text-[10px] font-bold uppercase text-tint-sky-foreground">
                    {p.relationship}
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  if (confirm("Supprimer ce lien parent–élève ?")) unlinkMut.mutate(p.link_id);
                }}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Délier"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => setLinkOpen(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-3xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-card)]"
        >
          <LinkIcon className="h-4 w-4" /> Lier un parent existant
        </button>
      </div>

      {linkOpen && (
        <LinkParentDrawer
          studentId={student.id}
          studentName={`${student.last_name ?? ""} ${student.first_name ?? ""}`.trim()}
          schoolId={schoolId}
          alreadyLinkedIds={new Set(parents.map((p) => p.parent?.id).filter(Boolean) as string[])}
          onClose={() => setLinkOpen(false)}
          onLinked={() => {
            qc.invalidateQueries({ queryKey: ["student-parents", student.id] });
            qc.invalidateQueries({ queryKey: ["admin-parents"] });
            setLinkOpen(false);
          }}
        />
      )}

      {editOpen && (
        <CreateStudentDrawer
          initialSchoolId={schoolId}
          student={student}
          onClose={() => setEditOpen(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["admin-students"] });
            setEditOpen(false);
            onClose();
          }}
        />
      )}
    </div>
  );
}

// ===================== Lier parent existant =====================

function LinkParentDrawer({
  studentId,
  studentName,
  schoolId,
  alreadyLinkedIds,
  onClose,
  onLinked,
}: {
  studentId: string;
  studentName: string;
  schoolId: string | null;
  alreadyLinkedIds: Set<string>;
  onClose: () => void;
  onLinked: () => void;
}) {
  const [tab, setTab] = useState<"school" | "exact">("school");
  const [search, setSearch] = useState("");
  const [exactEmail, setExactEmail] = useState("");
  const [exactPhone, setExactPhone] = useState("");
  const [exactResult, setExactResult] = useState<ParentSummary | null | undefined>(undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [relationship, setRelationship] = useState("parent");

  const { data: list, isLoading } = useQuery({
    queryKey: ["link-parents-by-school", schoolId, search],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (schoolId) qs.set("schoolId", schoolId);
      if (search) qs.set("search", search);
      qs.set("limit", "50");
      return apiFetch<{ items: ParentSummary[]; total: number }>(`/admin-parents/by-school?${qs.toString()}`);
    },
    enabled: tab === "school",
  });

  const searchExactMut = useMutation({
    mutationFn: () => {
      const qs = new URLSearchParams();
      if (exactEmail.trim()) qs.set("email", exactEmail.trim());
      if (exactPhone.trim()) qs.set("phone", exactPhone.trim());
      return apiFetch<{ parent: ParentSummary | null }>(`/admin-parents/search-exact?${qs.toString()}`);
    },
    onSuccess: (r) => {
      setExactResult(r.parent);
      if (!r.parent) toast.info("Aucun parent trouvé avec ces coordonnées exactes");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const linkMut = useMutation({
    mutationFn: async (parentIds: string[]) => {
      const results = await Promise.allSettled(
        parentIds.map((pid) =>
          apiFetch(`/admin-parents/link`, {
            method: "POST",
            body: JSON.stringify({ student_id: studentId, parent_user_id: pid, relationship }),
          }),
        ),
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const ko = results.length - ok;
      return { ok, ko };
    },
    onSuccess: ({ ok, ko }) => {
      if (ok > 0) toast.success(`${ok} parent(s) lié(s)`);
      if (ko > 0) toast.error(`${ko} échec(s)`);
      onLinked();
    },
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-[480px] rounded-t-[2rem] bg-background p-5 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-border" />
        <div className="mt-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-extrabold">
            <LinkIcon className="h-5 w-5 text-primary" /> Lier un parent
          </h3>
          <button onClick={onClose} aria-label="Fermer">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">Élève : {studentName}</p>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-secondary p-1">
          <button
            onClick={() => setTab("school")}
            className={cn("rounded-xl py-2 text-xs font-bold", tab === "school" ? "bg-card shadow-[var(--shadow-card)]" : "text-muted-foreground")}
          >
            Mon école
          </button>
          <button
            onClick={() => setTab("exact")}
            className={cn("rounded-xl py-2 text-xs font-bold", tab === "exact" ? "bg-card shadow-[var(--shadow-card)]" : "text-muted-foreground")}
          >
            Recherche exacte
          </button>
        </div>

        <div className="mt-3 rounded-2xl border border-input bg-card px-3 py-2 shadow-[var(--shadow-card)]">
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Lien de parenté</label>
          <select
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            className="mt-0.5 w-full bg-transparent text-sm font-bold outline-none"
          >
            <option value="parent">Parent</option>
            <option value="pere">Père</option>
            <option value="mere">Mère</option>
            <option value="tuteur">Tuteur</option>
          </select>
        </div>

        {tab === "school" && (
          <>
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-card px-4 py-3 shadow-[var(--shadow-card)]">
              <Search className="h-5 w-5 text-primary" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher (nom, email, téléphone)…"
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <div className="mt-3 space-y-2">
              {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
              {!isLoading && (list?.items ?? []).length === 0 && (
                <p className="rounded-2xl bg-card p-4 text-center text-xs text-muted-foreground shadow-[var(--shadow-card)]">
                  Aucun parent dans votre école. Utilisez "Recherche exacte" pour un parent d'une autre école.
                </p>
              )}
              {(list?.items ?? []).map((p) => {
                const linked = alreadyLinkedIds.has(p.id);
                const checked = selected.has(p.id);
                return (
                  <label
                    key={p.id}
                    className={cn(
                      "flex items-start gap-3 rounded-2xl bg-card p-3 shadow-[var(--shadow-card)]",
                      linked && "opacity-60",
                    )}
                  >
                    <input
                      type="checkbox"
                      disabled={linked}
                      checked={checked}
                      onChange={() => toggle(p.id)}
                      className="mt-1 h-4 w-4 accent-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold">{p.full_name ?? "—"}</p>
                      <p className="flex items-center gap-2 truncate text-xs text-muted-foreground">
                        {p.email && (<><Mail className="h-3 w-3 shrink-0" />{p.email}</>)}
                      </p>
                      {p.phone && (
                        <p className="flex items-center gap-2 truncate text-xs text-muted-foreground">
                          <Phone className="h-3 w-3 shrink-0" />{p.phone}
                        </p>
                      )}
                      {linked && <span className="mt-1 inline-block text-[10px] font-bold uppercase text-success">Déjà lié</span>}
                    </div>
                  </label>
                );
              })}
            </div>
            <button
              disabled={selected.size === 0 || linkMut.isPending}
              onClick={() => linkMut.mutate(Array.from(selected))}
              className="mt-4 w-full rounded-3xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground disabled:opacity-50"
            >
              {linkMut.isPending ? "Liaison…" : `Lier ${selected.size} parent(s)`}
            </button>
          </>
        )}

        {tab === "exact" && (
          <>
            <p className="mt-3 text-xs text-muted-foreground">
              Pour un parent inscrit dans une autre école, saisissez son <strong>email exact</strong> ou son <strong>téléphone exact</strong>.
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex h-12 items-center gap-3 rounded-2xl border border-input bg-card px-4 shadow-[var(--shadow-card)]">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <input
                  value={exactEmail}
                  onChange={(e) => setExactEmail(e.target.value)}
                  type="email"
                  placeholder="email@exemple.com"
                  className="flex-1 bg-transparent text-sm outline-none"
                />
              </div>
              <div className="flex h-12 items-center gap-3 rounded-2xl border border-input bg-card px-4 shadow-[var(--shadow-card)]">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <input
                  value={exactPhone}
                  onChange={(e) => setExactPhone(e.target.value)}
                  type="tel"
                  placeholder="+243 ..."
                  className="flex-1 bg-transparent text-sm outline-none"
                />
              </div>
              <button
                disabled={(!exactEmail.trim() && !exactPhone.trim()) || searchExactMut.isPending}
                onClick={() => { setExactResult(undefined); searchExactMut.mutate(); }}
                className="w-full rounded-2xl border border-primary bg-card py-3 text-sm font-bold text-primary disabled:opacity-50"
              >
                {searchExactMut.isPending ? "Recherche…" : "Rechercher"}
              </button>
            </div>

            {exactResult === null && (
              <p className="mt-3 rounded-2xl bg-card p-4 text-center text-xs text-muted-foreground shadow-[var(--shadow-card)]">
                Aucun parent trouvé. Vérifiez l'email ou le téléphone.
              </p>
            )}
            {exactResult && (
              <div className="mt-3 rounded-2xl bg-card p-3 shadow-[var(--shadow-card)]">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-tint-peach text-tint-peach-foreground">
                    <UserRound className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold">{exactResult.full_name ?? "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">{exactResult.email ?? "—"}</p>
                    {exactResult.phone && <p className="truncate text-xs text-muted-foreground">{exactResult.phone}</p>}
                    {alreadyLinkedIds.has(exactResult.id) && (
                      <span className="mt-1 inline-block text-[10px] font-bold uppercase text-success">Déjà lié</span>
                    )}
                  </div>
                </div>
                <button
                  disabled={alreadyLinkedIds.has(exactResult.id) || linkMut.isPending}
                  onClick={() => linkMut.mutate([exactResult.id])}
                  className="mt-3 w-full rounded-2xl bg-primary py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-50"
                >
                  {linkMut.isPending ? "Liaison…" : "Lier ce parent"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}