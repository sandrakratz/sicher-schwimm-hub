import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { Bell, BellOff, Share, SquarePlus, Smartphone } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getPushInfo, subscribePush, unsubscribePush } from "@/lib/push.functions";

export const Route = createFileRoute("/mitteilungen")({
  validateSearch: (s) => z.object({ token: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Mitteilungen aktivieren – Sicher Schwimmen e.V." },
      {
        name: "description",
        content:
          "Eilnachrichten zu Ihrem Schwimmkurs kostenlos als Mitteilung aufs Handy erhalten.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

type Info = Awaited<ReturnType<typeof getPushInfo>>;
type Device = "android" | "iphone" | "pc";

function urlBase64ToBytes(str: string) {
  const s = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function detectDevice(): Device {
  const ua = navigator.userAgent;
  const isIpad = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || isIpad) return "iphone";
  if (/Android/.test(ua)) return "android";
  return "pc";
}

function isHomeScreenApp() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

function canPush() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function Page() {
  const { token } = Route.useSearch();
  const load = useServerFn(getPushInfo);
  const subscribe = useServerFn(subscribePush);
  const unsubscribe = useServerFn(unsubscribePush);
  const [info, setInfo] = useState<Info | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [homeScreen, setHomeScreen] = useState(false);
  const [active, setActive] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !/^[a-f0-9]{20,80}$/.test(token)) {
      setInfo({ found: false, publicKey: "" });
      return;
    }
    load({ data: { token } })
      .then(setInfo)
      .catch(() => setInfo({ found: false, publicKey: "" }));
  }, [token]);

  useEffect(() => {
    const d = detectDevice();
    setDevice(d);
    setHomeScreen(isHomeScreenApp());
    if (d === "pc") {
      import("qrcode")
        .then((Q) => Q.toDataURL(window.location.href, { width: 320, margin: 1 }))
        .then(setQr)
        .catch(() => setQr(null));
      return;
    }
    if (canPush()) {
      if (Notification.permission === "denied") setBlocked(true);
      navigator.serviceWorker
        .getRegistration("/")
        .then(async (reg) => {
          const sub = await reg?.pushManager.getSubscription();
          setActive(!!sub);
        })
        .catch(() => {});
    }
  }, []);

  async function activate() {
    if (!token || !info?.found) return;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setBlocked(perm === "denied");
        toast.error("Ohne Ihre Erlaubnis können wir keine Mitteilungen senden.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToBytes(info.publicKey) as BufferSource,
        });
      }
      const json = sub.toJSON();
      const r = await subscribe({
        data: {
          token,
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh || "",
          auth: json.keys?.auth || "",
          userAgent: navigator.userAgent.slice(0, 400),
        },
      });
      if (!r.ok) throw new Error("Link ungültig");
      setActive(true);
      toast.success("Mitteilungen aktiviert – Sie erhalten gleich eine Testmitteilung.");
    } catch {
      toast.error("Die Aktivierung hat leider nicht geklappt. Bitte versuchen Sie es erneut.");
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    if (!token) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await unsubscribe({ data: { token, endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setActive(false);
      toast.success("Mitteilungen wurden abgestellt. Sie erhalten weiterhin E-Mails.");
    } catch {
      toast.error("Abmelden hat leider nicht geklappt.");
    } finally {
      setBusy(false);
    }
  }

  const iphoneNeedsInstall = device === "iphone" && !homeScreen;
  const unsupported = device !== null && device !== "pc" && !iphoneNeedsInstall && !canPush();

  return (
    <PublicLayout>
      <div className="container mx-auto max-w-xl px-4 py-10">
        <h1 className="text-3xl font-bold text-primary-deep mb-2">Mitteilungen aktivieren</h1>
        <p className="text-muted-foreground mb-6">
          Fällt ein Kurstermin kurzfristig aus, erfahren Sie es sofort auf Ihrem Handy – kostenlos,
          ohne Konto und ohne dass jemand Ihre Handynummer sieht.
        </p>

        {!info && <p className="text-muted-foreground">Wird geladen …</p>}

        {info && !info.found && (
          <Card>
            <CardContent className="p-6">
              Dieser Link ist ungültig. Bitte melden Sie sich unter info@sicher-schwimmen.com.
            </CardContent>
          </Card>
        )}

        {info?.found && device === "pc" && (
          <Card>
            <CardContent className="p-6 space-y-4 text-center">
              <Smartphone className="mx-auto h-8 w-8 text-primary" />
              <p className="font-semibold">Bitte mit dem Handy scannen</p>
              <p className="text-sm text-muted-foreground">
                Mitteilungen werden auf dem Handy eingerichtet. Richten Sie die Kamera Ihres Handys
                auf diesen Code und öffnen Sie den Link.
              </p>
              {qr && (
                <img
                  src={qr}
                  alt="QR-Code zum Öffnen dieser Seite auf dem Handy"
                  className="mx-auto h-64 w-64"
                />
              )}
            </CardContent>
          </Card>
        )}

        {info?.found && iphoneNeedsInstall && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <p className="font-semibold">Auf dem iPhone sind zuerst drei kleine Schritte nötig</p>
              <p className="text-sm text-muted-foreground">
                Apple erlaubt Mitteilungen nur für Seiten, die auf dem Home-Bildschirm liegen (ab
                iOS 16.4).
              </p>
              <ol className="space-y-4 text-sm">
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                    1
                  </span>
                  <span>
                    Öffnen Sie diesen Link in <strong>Safari</strong> (dem blauen Kompass-Symbol).
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                    2
                  </span>
                  <span>
                    Tippen Sie unten auf das <strong>Teilen-Symbol</strong>{" "}
                    <Share className="inline h-4 w-4 align-text-bottom" /> und wählen Sie{" "}
                    <strong>„Zum Home-Bildschirm“</strong>{" "}
                    <SquarePlus className="inline h-4 w-4 align-text-bottom" />. Bestätigen Sie mit
                    „Hinzufügen“.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                    3
                  </span>
                  <span>
                    Öffnen Sie die Seite über das{" "}
                    <strong>neue Symbol auf Ihrem Home-Bildschirm</strong> und tippen Sie dort auf
                    „Mitteilungen aktivieren“.
                  </span>
                </li>
              </ol>
              <p className="text-xs text-muted-foreground">
                Wichtig: Führen Sie Schritt 2 auf genau dieser Seite durch (mit dem Link aus Ihrer
                E-Mail), damit das Symbol Ihren persönlichen Link mitnimmt.
              </p>
              <p className="text-xs text-muted-foreground">
                Ohne diese Schritte erhalten Sie Eilnachrichten nur per E-Mail.
              </p>
            </CardContent>
          </Card>
        )}

        {info?.found && unsupported && (
          <Card>
            <CardContent className="p-6">
              Dieses Gerät oder dieser Browser unterstützt leider keine Mitteilungen. Sie erhalten
              Eilnachrichten weiterhin per E-Mail.
            </CardContent>
          </Card>
        )}

        {info?.found && device && device !== "pc" && !iphoneNeedsInstall && !unsupported && (
          <Card>
            <CardContent className="p-6 space-y-4">
              {info.childName && (
                <p className="text-sm text-muted-foreground">
                  Für: <strong className="text-foreground">{info.childName}</strong>
                  {info.courseName ? ` · ${info.courseName}` : ""}
                </p>
              )}
              {active ? (
                <>
                  <p className="font-semibold flex items-center gap-2">
                    <Bell className="h-5 w-5 text-primary" /> Mitteilungen sind auf diesem Handy
                    aktiv.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Sie erhalten Eilnachrichten zusätzlich zur E-Mail. Das gilt für alle Kurse, die
                    Sie mit dieser E-Mail-Adresse gebucht haben.
                  </p>
                  <Button variant="outline" onClick={deactivate} disabled={busy}>
                    <BellOff className="h-4 w-4" /> Mitteilungen abstellen
                  </Button>
                </>
              ) : (
                <>
                  {blocked && (
                    <p className="text-sm rounded-md border border-destructive/40 bg-destructive/5 p-3">
                      Mitteilungen sind in Ihren Handy-Einstellungen für diese Seite blockiert.
                      Bitte erlauben Sie sie dort und laden Sie die Seite neu.
                    </p>
                  )}
                  <Button size="lg" className="w-full" onClick={activate} disabled={busy}>
                    <Bell className="h-5 w-5" />{" "}
                    {busy ? "Einen Moment …" : "Mitteilungen aktivieren"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Ihr Handy fragt Sie anschließend um Erlaubnis. Danach senden wir eine kurze
                    Testmitteilung.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PublicLayout>
  );
}
