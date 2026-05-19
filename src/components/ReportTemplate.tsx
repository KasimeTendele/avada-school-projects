import type { ReactNode } from "react";
import { LuPrinter as Printer } from "react-icons/lu";
import avadaLogo from "@/assets/avada-logo.png";

export interface ReportInfo {
  /** Top right column under user info */
  classe?: string;
  section?: string;
  option?: string;
  devise?: string;
  /** Top left column */
  userId?: string;
  userName?: string;
  fonction?: string;
  matricule?: string;
}

export interface ReportSchool {
  name: string;
  sigle?: string | null;
  approval_number?: string | null;
  address?: string | null;
  city?: string | null;
  logo_url?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface ReportFooterAccount {
  account_name?: string;
  bank_name?: string;
  account_number?: string;
  currency?: string;
}

export interface ReportSignatory {
  name: string;
  title: string;
}

interface Props {
  school: ReportSchool;
  title: string;
  info: ReportInfo;
  children: ReactNode;
  totals?: { label: string; value: string }[];
  account?: ReportFooterAccount;
  signatory?: ReportSignatory;
  page?: { current: number; total: number };
}

/**
 * Template d'impression officiel "Avada School".
 * Tous les rapports (reçu de paiement, journal de caisse, etc.) doivent l'utiliser.
 */
export function ReportTemplate({
  school,
  title,
  info,
  children,
  totals,
  account,
  signatory,
  page = { current: 1, total: 1 },
}: Props) {
  return (
    <div className="report-doc mx-auto bg-white text-[#111] print:shadow-none">
      {/* Print toolbar (hidden on print) */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-end gap-2 border-b border-neutral-200 bg-white px-4 py-3">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-full bg-[#15c79b] px-5 py-2 text-sm font-semibold text-white shadow"
        >
          <Printer className="h-4 w-4" /> Imprimer / Enregistrer en PDF
        </button>
      </div>

      <div className="report-page">
        <p className="text-center text-[11px] text-neutral-500">
          Page {page.current} sur {page.total}
        </p>

        {/* Header */}
        <header className="mt-2 flex items-center justify-center gap-6">
          <img src={avadaLogo} alt="Avada School" className="h-20 w-auto shrink-0 object-contain" />
          <div className="text-center">
            <h1 className="text-[18px] font-extrabold tracking-wide text-neutral-900">
              REPUBLIQUE DEMOCRATIQUE DU CONGO
            </h1>
            <p className="text-[14px] font-bold uppercase text-neutral-800">{school.name}</p>
            {school.sigle && (
              <p className="text-[12px] font-semibold uppercase text-neutral-700">{school.sigle}</p>
            )}
            {school.approval_number && (
              <p className="mt-1 text-[12px] text-neutral-700">
                Numéro d&apos;agrément&nbsp;: {school.approval_number}
              </p>
            )}
            {(school.address || school.city) && (
              <p className="text-[12px] text-neutral-700">
                {[school.address, school.city].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
          {school.logo_url ? (
            <img src={school.logo_url} alt="Logo école" className="h-20 w-auto shrink-0 object-contain" />
          ) : (
            <div className="h-20 w-20 shrink-0" />
          )}
        </header>

        <h2 className="mt-6 text-center text-[18px] font-extrabold uppercase underline decoration-2 underline-offset-4">
          {title}
        </h2>

        {/* Info block */}
        <section className="mt-5 grid grid-cols-2 gap-x-8 border-b border-neutral-200 pb-5 text-[12px]">
          <dl className="space-y-1">
            <InfoRow label="Id. Utilisateur" value={info.userId} />
            <InfoRow label="Nom utilisateur" value={info.userName} />
            <InfoRow label="Fonction" value={info.fonction} />
            <InfoRow label="Matricule" value={info.matricule} />
          </dl>
          <dl className="space-y-1 border-l border-neutral-200 pl-8">
            <InfoRow label="Classe" value={info.classe} />
            <InfoRow label="Section" value={info.section} />
            <InfoRow label="Option" value={info.option} />
            <InfoRow label="Devise" value={info.devise} />
          </dl>
        </section>

        {/* Body */}
        <section className="mt-5">{children}</section>

        {/* Totals */}
        {totals && totals.length > 0 && (
          <section className="mt-3 flex justify-end">
            <div className="space-y-1 text-right text-[12px]">
              {totals.map((t) => (
                <div key={t.label} className="flex justify-end gap-3">
                  <span className="font-bold">{t.label}&nbsp;:</span>
                  <span className="min-w-[120px] text-left">{t.value}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Account info + signature */}
        <section className="mt-6 grid grid-cols-2 gap-8 text-[12px]">
          <div>
            {account && (
              <>
                <p className="font-extrabold uppercase">Informations de paiement</p>
                <dl className="mt-2 space-y-1">
                  <InfoRow label="Nom de compte" value={account.account_name} />
                  <InfoRow label="Nom de la banque" value={account.bank_name} />
                  <InfoRow label="Numéro Compte" value={account.account_number} />
                  <InfoRow label="Devise" value={account.currency} />
                </dl>
              </>
            )}
          </div>
          {signatory && (
            <div className="text-center">
              <p className="mt-8 font-bold">{signatory.name}</p>
              <p className="text-neutral-600">{signatory.title}</p>
            </div>
          )}
        </section>
      </div>

      {/* Footer band */}
      <footer className="report-footer mt-10 bg-[#15c79b] px-8 py-6 text-white">
        <div className="grid grid-cols-2 gap-6 text-[12px]">
          <div className="flex items-center gap-2 text-base font-extrabold">
            <img src={avadaLogo} alt="Avada School" className="h-10 w-auto object-contain bg-white/95 rounded-md p-1" />
          </div>
          <div className="space-y-1">
            <p>
              <span className="inline-block w-20">{school.name?.split(" ")[0] || "École"}</span>
              <span>: {[school.address, school.city].filter(Boolean).join(", ") || "—"}</span>
            </p>
            {school.phone && (
              <p>
                <span className="inline-block w-20">Téléphone</span>: {school.phone}
              </p>
            )}
            {school.email && (
              <p>
                <span className="inline-block w-20">Mail</span>: {school.email}
              </p>
            )}
          </div>
        </div>
      </footer>

      <style>{`
        .report-doc { width: 210mm; max-width: 100%; min-height: 297mm; }
        .report-page { padding: 24px 32px; }
        .report-footer { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print {
          .no-print { display: none !important; }
          @page { size: A4; margin: 0; }
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          body * { visibility: hidden; }
          .report-doc, .report-doc * { visibility: visible; }
          .report-doc {
            position: absolute; left: 0; top: 0;
            width: 210mm; max-width: 210mm; min-height: 297mm;
            margin: 0; box-shadow: none;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
          .report-footer { page-break-inside: avoid; break-inside: avoid; }
          tr, td, th { page-break-inside: avoid; break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <dt className="text-neutral-700">{label}</dt>
      <dd className="font-semibold">: {value || "—"}</dd>
    </div>
  );
}
