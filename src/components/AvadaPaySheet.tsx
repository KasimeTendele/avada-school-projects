import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import avadaLogo from "@/assets/avadapay-logo.png";
import mobileMoneyLogos from "@/assets/mobile-money.png";
import { LuCreditCard as CardIcon } from "react-icons/lu";

export interface AvadaPayContext {
  feeId: string;
  studentId: string;
  studentName: string;
  amount: number;
  currency: string;
  label: string;
}

type ProviderName = "AIRTEL" | "VODACOM" | "ORANGE" | "AFRICELL";

const PROVIDER_PREFIXES: Record<ProviderName, string[]> = {
  AIRTEL: ["97", "98", "99"],
  VODACOM: ["81", "82", "83", "86"],
  ORANGE: ["84", "85", "89"],
  AFRICELL: ["90", "91"],
};

const PROVIDER_LABEL: Record<ProviderName, string> = {
  AIRTEL: "Airtel Money",
  VODACOM: "M-Pesa (Vodacom)",
  ORANGE: "Orange Money",
  AFRICELL: "Africell Money",
};

function normalizePhone(raw: string): string {
  let p = (raw ?? "").replace(/\D/g, "");
  if (p.startsWith("243")) p = p.slice(3);
  if (p.startsWith("0")) p = p.slice(1);
  return p;
}

function detectProvider(phone: string): ProviderName | null {
  const p = normalizePhone(phone).slice(0, 2);
  for (const [name, prefixes] of Object.entries(PROVIDER_PREFIXES)) {
    if (prefixes.includes(p)) return name as ProviderName;
  }
  return null;
}

export function AvadaPaySheet({
  open,
  onOpenChange,
  context,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  context: AvadaPayContext | null;
}) {
  const navigate = useNavigate();
  const [method, setMethod] = useState<"MOBILE_MONEY" | "CARD">("MOBILE_MONEY");
  const [phone, setPhone] = useState("");
  const [card, setCard] = useState({ number: "", expiry: "", cvc: "" });
  const [loading, setLoading] = useState(false);
  const [waiting, setWaiting] = useState<{ paymentId: string } | null>(null);
  const [providerOverride, setProviderOverride] = useState<ProviderName | null>(null);

  const detectedProvider = useMemo(() => detectProvider(phone), [phone]);
  const provider = providerOverride ?? detectedProvider;

  if (!context) return null;

  // Poll payment status until COMPLETED / FAILED
  useEffect(() => {
    if (!waiting) return;
    let cancelled = false;
    const start = Date.now();
    const tick = async () => {
      if (cancelled) return;
      try {
        const p = await apiFetch<{ id: string; status: string; receipts?: { id: string }[] }>(
          `/payments/${waiting.paymentId}`,
        );
        if (p.status === "COMPLETED") {
          toast.success("Paiement confirmé !");
          setWaiting(null);
          setLoading(false);
          onOpenChange(false);
          const rid = p.receipts?.[0]?.id;
          if (rid) navigate({ to: "/receipts/$id", params: { id: rid } });
          return;
        }
        if (p.status === "FAILED") {
          toast.error("Paiement échoué. Réessayez.");
          setWaiting(null);
          setLoading(false);
          return;
        }
      } catch {
        /* ignore transient errors */
      }
      if (Date.now() - start > 5 * 60 * 1000) {
        toast.error("Temps écoulé. Vérifiez votre paiement plus tard.");
        setWaiting(null);
        setLoading(false);
        return;
      }
      setTimeout(tick, 3000);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [waiting, navigate, onOpenChange]);

  const handlePay = async () => {
    if (method === "MOBILE_MONEY") {
      const normalized = normalizePhone(phone);
      if (normalized.length < 9) {
        toast.error("Numéro invalide (9 chiffres requis, sans 0).");
        return;
      }
      if (!provider) {
        toast.error("Opérateur introuvable pour ce numéro.");
        return;
      }
      if (context.currency !== "CDF") {
        toast.error("Mobile Money disponible uniquement en CDF.");
        return;
      }
    }
    if (method === "CARD" && card.number.replace(/\s/g, "").length < 12) {
      toast.error("Numéro de carte invalide.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{ payment: { id: string }; receipt: { id: string } | null }>(
        "/payments/initiate",
        {
          method: "POST",
          body: JSON.stringify({
            fee_id: context.feeId,
            student_id: context.studentId,
            amount: context.amount,
            method: method === "MOBILE_MONEY" ? "MOBILE_MONEY" : "CARD",
            reference: method === "MOBILE_MONEY" ? normalizePhone(phone) : `CARD-${card.number.slice(-4)}`,
            phone: method === "MOBILE_MONEY" ? normalizePhone(phone) : undefined,
            provider: method === "MOBILE_MONEY" ? provider : undefined,
          }),
        },
      );
      if (method === "MOBILE_MONEY") {
        toast.success("Demande envoyée. Confirmez le paiement sur votre téléphone.");
        setWaiting({ paymentId: res.payment.id });
        // Keep sheet open with waiting state; loading stays true until polling resolves
        return;
      }
      toast.success("Paiement enregistré. Reçu disponible.");
      onOpenChange(false);
      if (res?.receipt?.id) {
        navigate({ to: "/receipts/$id", params: { id: res.receipt.id } });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur lors du paiement.";
      toast.error(msg);
      setLoading(false);
      return;
    }
    setLoading(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92vh] overflow-y-auto rounded-t-[2rem] p-0"
      >
        <div className="px-5 pt-3 pb-8">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />

          {/* AvadaPay logo card */}
          <div className="rounded-2xl border border-border bg-card px-4 py-5 shadow-[var(--shadow-card)]">
            <img src={avadaLogo} alt="AvadaPay" className="mx-auto h-7 object-contain" />
          </div>

          {/* Method picker */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMethod("MOBILE_MONEY")}
              className={cn(
                "flex flex-col items-center gap-2 rounded-2xl border-2 bg-card px-3 py-4 transition-colors",
                method === "MOBILE_MONEY" ? "border-primary" : "border-border",
              )}
            >
              <img src={mobileMoneyLogos} alt="Mobile Money" className="h-8 object-contain" />
              <span className="text-sm font-bold">Mobile Money</span>
            </button>
            <button
              type="button"
              onClick={() => setMethod("CARD")}
              className={cn(
                "flex flex-col items-center gap-2 rounded-2xl border-2 bg-card px-3 py-4 transition-colors",
                method === "CARD" ? "border-primary" : "border-border",
              )}
            >
              <CardIcon className="h-8 w-8 text-primary" />
              <span className="text-sm font-bold">Carte bancaire</span>
            </button>
          </div>

          {/* Amount (locked) */}
          <div className="mt-5">
            <Label className="text-sm font-semibold">Montant ({context.currency})</Label>
            <Input
              readOnly
              value={context.amount}
              className="mt-1 h-11 rounded-xl border-border bg-muted text-base font-bold"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Montant fixé par l'école pour {context.studentName}.
            </p>
          </div>

          {/* Method fields */}
          {method === "MOBILE_MONEY" ? (
            <div className="mt-4">
              <Label htmlFor="ap-phone" className="text-sm font-semibold">
                Numéro de téléphone
              </Label>
              <Input
                id="ap-phone"
                type="tel"
                placeholder="85XXXXXXX, 89XXXXXXX, 97XXXXXXX…"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setProviderOverride(null);
                }}
                className="mt-1 h-11 rounded-xl border-border"
              />
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Orange : 80, 84, 85, 89 · Airtel : 97, 98, 99 · Vodacom : 81, 82, 83, 86 · Africell : 90, 91 (sans 0 devant)
              </p>
              {phone && (
                <div className="mt-3">
                  <Label className="text-sm font-semibold">Opérateur</Label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {(Object.keys(PROVIDER_PREFIXES) as ProviderName[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setProviderOverride(p)}
                        className={cn(
                          "rounded-xl border-2 px-3 py-2 text-xs font-bold transition-colors",
                          provider === p ? "border-primary bg-primary/5" : "border-border",
                        )}
                      >
                        {PROVIDER_LABEL[p]}
                      </button>
                    ))}
                  </div>
                  {!provider && (
                    <p className="mt-1 text-[11px] text-destructive">
                      Préfixe non reconnu — sélectionnez l'opérateur manuellement.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div>
                <Label className="text-sm font-semibold">Numéro de carte</Label>
                <Input
                  placeholder="4242 4242 4242 4242"
                  value={card.number}
                  onChange={(e) => setCard({ ...card, number: e.target.value })}
                  className="mt-1 h-11 rounded-xl border-border"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-semibold">Expiration</Label>
                  <Input
                    placeholder="MM/AA"
                    value={card.expiry}
                    onChange={(e) => setCard({ ...card, expiry: e.target.value })}
                    className="mt-1 h-11 rounded-xl border-border"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold">CVC</Label>
                  <Input
                    placeholder="123"
                    value={card.cvc}
                    onChange={(e) => setCard({ ...card, cvc: e.target.value })}
                    className="mt-1 h-11 rounded-xl border-border"
                  />
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={handlePay}
            disabled={loading || !!waiting}
            className="mt-6 h-12 w-full rounded-xl bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90"
          >
            {waiting
              ? "En attente de confirmation…"
              : loading
                ? "Traitement…"
                : `Payer ${formatNumber(context.amount)} ${context.currency}`}
          </Button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            {waiting
              ? "Validez la transaction sur votre téléphone (code PIN Mobile Money)."
              : "Paiement sécurisé via AvadaPay."}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}