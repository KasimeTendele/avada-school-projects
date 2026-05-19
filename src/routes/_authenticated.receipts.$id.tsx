import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ReportTemplate } from "@/components/ReportTemplate";
import { formatNumber } from "@/lib/format";
import { prettyMethod } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/receipts/$id")({
  head: () => ({ meta: [{ title: "Reçu de paiement — Avada School" }] }),
  component: ReceiptPage,
});

function ReceiptPage() {
  const { id } = Route.useParams();

  const q = useQuery({
    queryKey: ["receipt", id],
    queryFn: async () => {
      const { data: receipt, error } = await supabase
        .from("receipts")
        .select("id, receipt_number, created_at, payment_id")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!receipt) throw new Error("Reçu introuvable");

      const { data: payment } = await supabase
        .from("payments")
        .select("id, amount, currency, method, reference, paid_at, status, fee_id, student_id, school_id")
        .eq("id", receipt.payment_id)
        .maybeSingle();

      const [{ data: fee }, { data: student }, { data: school }] = await Promise.all([
        payment ? supabase.from("fees").select("label, fee_type").eq("id", payment.fee_id).maybeSingle() : Promise.resolve({ data: null }),
        payment ? supabase.from("students").select("first_name, last_name, matricule, class_id").eq("id", payment.student_id).maybeSingle() : Promise.resolve({ data: null }),
        payment ? supabase.from("schools").select("name, sigle, approval_number, address, city, logo_url, email, phone").eq("id", payment.school_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);

      const { data: cls } = student?.class_id
        ? await supabase.from("classes").select("name, level").eq("id", student.class_id).maybeSingle()
        : { data: null } as { data: null };

      return { receipt, payment, fee, student, school, cls };
    },
  });

  if (q.isLoading) return <div className="p-10 text-center text-sm text-muted-foreground">Chargement…</div>;
  if (q.error || !q.data?.payment) return <div className="p-10 text-center text-sm text-destructive">Reçu introuvable.</div>;

  const { receipt, payment, fee, student, school, cls } = q.data;
  const date = new Date(payment.paid_at ?? receipt.created_at);

  return (
    <div className="min-h-screen bg-neutral-100 py-6 print:bg-white print:py-0">
      <ReportTemplate
        school={{
          name: school?.name ?? "École",
          sigle: school?.sigle, approval_number: school?.approval_number,
          address: school?.address, city: school?.city, logo_url: school?.logo_url,
          email: school?.email, phone: school?.phone,
        }}
        title="Reçu de paiement"
        info={{
          userId: receipt.receipt_number,
          userName: student ? `${student.first_name} ${student.last_name}`.toUpperCase() : "—",
          fonction: "ÉLÈVE",
          matricule: student?.matricule ?? "—",
          classe: cls?.name ?? "—",
          section: cls?.level ?? "—",
          option: fee?.fee_type ?? "—",
          devise: payment.currency,
        }}
        totals={[
          { label: `Total Montant (${payment.currency})`, value: `${formatNumber(Number(payment.amount))},00` },
        ]}
        signatory={{ name: school?.name ?? "Caisse", title: "Caissière" }}
      >
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-neutral-100">
              <th className="border border-neutral-300 px-2 py-2 text-left">No</th>
              <th className="border border-neutral-300 px-2 py-2 text-left">ÉLÈVE</th>
              <th className="border border-neutral-300 px-2 py-2 text-left">REÇU</th>
              <th className="border border-neutral-300 px-2 py-2 text-left">DATE</th>
              <th className="border border-neutral-300 px-2 py-2 text-left">MONTANT</th>
              <th className="border border-neutral-300 px-2 py-2 text-left">RÉFÉRENCE</th>
              <th className="border border-neutral-300 px-2 py-2 text-left">MODE DE PAIEMENT</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-neutral-300 px-2 py-2">01</td>
              <td className="border border-neutral-300 px-2 py-2">{student ? `${student.first_name} ${student.last_name}`.toUpperCase() : "—"}</td>
              <td className="border border-neutral-300 px-2 py-2">{receipt.receipt_number}</td>
              <td className="border border-neutral-300 px-2 py-2">{date.toLocaleDateString("fr-FR")}</td>
              <td className="border border-neutral-300 px-2 py-2">{formatNumber(Number(payment.amount))},00</td>
              <td className="border border-neutral-300 px-2 py-2">{payment.reference ?? "—"}</td>
              <td className="border border-neutral-300 px-2 py-2 uppercase">{prettyMethod(payment.method)}</td>
            </tr>
          </tbody>
        </table>
      </ReportTemplate>
    </div>
  );
}
