# Veröffentlichung der Sperrliste reparieren

## Ziel
Die bereits vorhandene Admin-Seite „Sperrliste“ soll zuverlässig auf `sicher-schwimmen.com` erreichbar und im Admin-Menü sichtbar sein.

## Bestätigter Ist-Zustand
- Die Sperrlisten-Route und der Menüeintrag sind im gespeicherten Projektcode vorhanden.
- Die eigene Domain ist aktiv verbunden und die Veröffentlichung ist öffentlich.
- Das aktuell ausgelieferte Deployment ist veraltet: `/admin/sperrliste` liefert dort einen 404 und die ausgelieferten Programmdateien enthalten keinen Sperrlisten-Eintrag.
- Cookie-Löschung kann das nicht beheben, da der Server selbst die alte Version ausliefert.

## Vorgehen
1. Den aktuellen gespeicherten Projektstand erneut veröffentlichen.
2. Den Abschluss der Veröffentlichung abwarten und anschließend sowohl die Lovable-Domain als auch `sicher-schwimmen.com/admin/sperrliste` direkt prüfen.
3. Kontrollieren, dass das Admin-Menü für Rollen `admin` und `board` den Punkt „Sperrliste“ enthält und die Seite ohne 404 lädt.
4. Falls weiterhin die alte Version ausgeliefert wird, den Veröffentlichungsstatus als Plattform-/Deploymentproblem dokumentieren und mit den überprüften Fakten eskalieren, statt weitere wirkungslose Code- oder Cookie-Änderungen vorzunehmen.

## Technische Hinweise
Es sind derzeit keine Änderungen an Navigation, Route, Rollenfreigabe oder Domain-Konfiguration erforderlich. Der Fehler liegt zwischen gespeichertem Projektstand und ausgelieferter Produktionsversion.