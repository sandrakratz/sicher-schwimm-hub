# Über uns: Textüberlauf in der Kachel „Schwimmausbildung"

## Problem

In der Kachel-Reihe „Was uns wichtig ist" ist das lange Wort „Schwimmausbildung" breiter als die Kachel und ragt bei schmaleren Spalten über den Rand hinaus.

## Lösung

In `src/routes/ueber-uns.tsx` beim Label der Kacheln Silbentrennung und Umbruch erlauben (`hyphens-auto`, `break-words`, `lang="de"`) und die Innenabstände etwas robuster machen, damit der Text sauber innerhalb der Kachel umbricht — Layout und Design bleiben sonst unverändert.

Anschließend Kontrolle der Darstellung in Desktop- und Mobilbreite.
