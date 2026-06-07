import { useEffect, useState } from "react";
import { LuSmartphone, LuDownload } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const APK_URL = "https://ixtnwgkxrlukgnmdophx.supabase.co/storage/v1/object/public/app-downloads/Avadaschool.apk";
const STORAGE_KEY = "avada.mobile-app-prompt.dismissed";

function isAndroidPhone(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Android/i.test(ua);
}

function isMobilePhone(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPod|Mobile/i.test(ua);
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

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setOpen(false);
  };

  const onDownload = () => {
    // Trigger APK download
    const a = document.createElement("a");
    a.href = APK_URL;
    a.download = "Avadaschool.apk";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
  };

  const android = isAndroidPhone();

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : dismiss())}>
      <DialogContent className="max-w-[92vw] sm:max-w-md rounded-2xl">
        <DialogHeader className="items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <LuSmartphone className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-xl">Bonjour cher parent</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Veuillez télécharger la version mobile pour une meilleure expérience sur votre téléphone.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex flex-col gap-2">
          <Button
            onClick={onDownload}
            size="lg"
            className="h-12 w-full rounded-full bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <LuDownload className="mr-2 h-5 w-5" />
            Télécharger
          </Button>
          <Button
            onClick={dismiss}
            variant="ghost"
            size="lg"
            className="h-12 w-full rounded-full text-base font-medium"
          >
            Continuer avec la version web
          </Button>
          {!android && (
            <p className="mt-1 text-center text-[11px] text-muted-foreground">
              L'application mobile est disponible pour Android.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
