import { SOCIAL } from "@/lib/billing-config";
import { Facebook, Instagram } from "lucide-react";

/** Icon-Links zu den offiziellen Social-Media-Kanälen. */
export function SocialLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {SOCIAL.map((s) => {
        const Icon = s.key === "facebook" ? Facebook : Instagram;
        return (
          <a
            key={s.key}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Sicher Schwimmen e.V. auf ${s.label}`}
            title={s.label}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-current/20 bg-current/5 transition hover:text-accent"
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </a>
        );
      })}
    </div>
  );
}
