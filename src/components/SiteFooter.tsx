import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/sw-logo.png.asset.json";
const logo = logoAsset.url;
import { Mail, Phone, MapPin } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="bg-primary-deep text-sidebar-foreground mt-20">
      <div className="container mx-auto px-4 py-14 grid gap-10 md:grid-cols-4">
        <div>
          <div className="mb-4 inline-block bg-white rounded-2xl p-3">
            <img src={logo} alt="Sicher Schwimmen e.V." className="h-20 w-auto object-contain" height={80} loading="lazy" />
          </div>
          <p className="text-sm opacity-80 leading-relaxed">
            Schwimmkurse, Wassergewöhnung und vereinsleben für Familien im
            Rhein-Sieg-Kreis.
          </p>
        </div>

        <div>
          <h4 className="font-display font-bold mb-3 text-base">Verein</h4>
          <ul className="space-y-2 text-sm opacity-90">
            <li><Link to="/ueber-uns" className="hover:text-accent">Über uns</Link></li>
            <li><Link to="/sicherheit" className="hover:text-accent">Kinderschutz</Link></li>
            <li><Link to="/mitgliedschaft" className="hover:text-accent">Mitgliedschaft</Link></li>
            <li><Link to="/kurse" className="hover:text-accent">Kurse</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-display font-bold mb-3 text-base">Service</h4>
          <ul className="space-y-2 text-sm opacity-90">
            <li><Link to="/kurs-anfragen" className="hover:text-accent">Warteliste</Link></li>
            <li><Link to="/kontakt" className="hover:text-accent">Kontakt</Link></li>
            <li><Link to="/faq" className="hover:text-accent">FAQ</Link></li>
            <li><Link to="/portal" className="hover:text-accent">Mitgliederportal</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-display font-bold mb-3 text-base">Kontakt</h4>
          <ul className="space-y-3 text-sm opacity-90">
            <li className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 shrink-0 text-accent" />Hennef, Rhein-Sieg-Kreis</li>
            <li className="flex items-start gap-2"><Mail className="h-4 w-4 mt-0.5 shrink-0 text-accent" />info@sicher-schwimmen.de</li>
            <li className="flex items-start gap-2"><Phone className="h-4 w-4 mt-0.5 shrink-0 text-accent" />Telefon folgt</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container mx-auto px-4 py-5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs opacity-80">
          <div>© {new Date().getFullYear()} Sicher Schwimmen e.V.</div>
          <div className="flex flex-wrap gap-4">
            <Link to="/impressum" className="hover:text-accent">Impressum</Link>
            <Link to="/datenschutz" className="hover:text-accent">Datenschutz</Link>
            <Link to="/satzung" className="hover:text-accent">Satzung</Link>
            <Link to="/mitgliedsordnung" className="hover:text-accent">Mitgliedsordnung</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
