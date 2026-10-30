import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getTrainerPushKey,
  subscribeTrainerPush,
  unsubscribeTrainerPush,
} from "@/lib/trainer-push.functions";

function urlBase64ToBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const canPush = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

/** Push-Mitteilungen auf diesem Gerät: Ersatz gesucht, Dienstplan geändert, Erinnerungen. */
export function TrainerPushToggle() {
  const keyFn = useServerFn(getTrainerPushKey);
  const subFn = useServerFn(subscribeTrainerPush);
  const unsubFn = useServerFn(unsubscribeTrainerPush);
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const iosBrowser =
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod/.test(navigator.userAgent) &&
    !window.matchMedia("(display-mode: standalone)").matches;

  useEffect(() => {
    if (!canPush()) return;
    setSupported(true);
    setBlocked(Notification.permission === "denied");
    navigator.serviceWorker
      .getRegistration("/")
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setActive(!!sub))
      .catch(() => {});
  }, []);

  async function activate() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setBlocked(perm === "denied");
        toast.error("Ohne Erlaubnis können wir keine Mitteilungen senden.");
        return;
      }
      const { publicKey } = await keyFn();
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToBytes(publicKey) as BufferSource,
        }));
      const json = sub.toJSON();
      await subFn({
        data: {
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh || "",
          auth: json.keys?.auth || "",
          userAgent: navigator.userAgent.slice(0, 400),
        },
      });
      setActive(true);
      toast.success("Mitteilungen aktiviert – du bekommst gleich eine Testmitteilung.");
    } catch {
      toast.error("Die Aktivierung hat nicht geklappt. Bitte versuche es erneut.");
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await unsubFn({ data: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setActive(false);
      toast.success("Mitteilungen auf diesem Gerät abgestellt.");
    } catch {
      toast.error("Abstellen hat nicht geklappt.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return (
      <p className="text-sm text-muted-foreground">
        {iosBrowser
          ? "Mitteilungen gibt es auf dem iPhone erst, wenn der Trainerbereich als App auf dem Home-Bildschirm liegt (Teilen → „Zum Home-Bildschirm“)."
          : "Dieses Gerät unterstützt keine Mitteilungen."}
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 text-sm">
          <span className="font-medium">Mitteilungen auf diesem Gerät</span>
          <div className="text-xs text-muted-foreground">
            Ersatz gesucht, Dienstplan geändert, Erinnerung vor dem Einsatz.
          </div>
        </div>
        {active ? (
          <Button
            size="sm"
            variant="outline"
            className="min-h-10"
            disabled={busy}
            onClick={deactivate}
          >
            <BellOff className="h-4 w-4" /> Abstellen
          </Button>
        ) : (
          <Button size="sm" className="min-h-10" disabled={busy || blocked} onClick={activate}>
            <Bell className="h-4 w-4" /> Aktivieren
          </Button>
        )}
      </div>
      {blocked && (
        <p className="text-xs text-destructive">
          Mitteilungen sind im Browser blockiert. Bitte in den Website-Einstellungen erlauben.
        </p>
      )}
    </div>
  );
}
