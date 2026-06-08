import { useEffect, useState } from "react";
import { LuSmartphone, LuDownload, LuApple, LuCircleCheck } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const APK_URL = "https://median.co/share/dyaozpz#apk";
const STORAGE_KEY = "avada.mobile-app-prompt.installed";

function isAndroidPhone(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent || "");
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}

function isMobilePhone(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPod|iPad|Mobile/i.test(navigator.userAgent || "");
}

export function MobileAppPrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isMobilePhone()) return;
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {}
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, []);

  // Close without remembering — dialog will reappear on next visit
  const closeOnly = () => setOpen(false);

  // Remember permanently — won't show again
  const rememberAndClose = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setOpen(false);
  };

  const onDownload = () => {
    window.open(APK_URL, "_blank", "noopener,noreferrer");
  };

  const android = isAndroidPhone();
  const ios = isIOS();

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeOnly())}>
      <DialogContent className="max-w-[92vw] sm:max-w-md rounded-2xl">
        <DialogHeader className="items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            {ios ? (
              <LuApple className="h-7 w-7 text-primary" />
            ) : (
              <LuSmartphone className="h-7 w-7 text-primary" />
            )}
          </div>
          <DialogTitle className="text-xl">Bonjour cher parent</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {ios
              ? "L'application mobile AvadaSchool pour iPhone / iPad n'est pas encore disponible. Restez connecté, elle arrive bientôt !"
              : "Veuillez télécharger la version mobile pour une meilleure expérience sur votre téléphone."}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex flex-col gap-2">
          {android && (
            <>
              <Button
                onClick={onDownload}
                size="lg"
                className="h-12 w-full rounded-full bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <LuDownload className="mr-2 h-5 w-5" />
                Télécharger
              </Button>
              <Button
                onClick={rememberAndClose}
                variant="outline"
                size="lg"
                className="h-12 w-full rounded-full text-base font-medium"
              >
                <LuCircleCheck className="mr-2 h-5 w-5" />
                J'ai déjà installé
              </Button>
            </>
          )}
          <Button
            onClick={closeOnly}
            variant={android ? "ghost" : "default"}
            size="lg"
            className="h-12 w-full rounded-full text-base font-medium"
          >
            {ios ? "Continuer avec le site web" : "Continuer avec la version web"}
          </Button>
          {!android && !ios && (
            <p className="mt-1 text-center text-[11px] text-muted-foreground">
              L'application mobile est disponible pour Android.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
