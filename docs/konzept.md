# Konzept: SysModeller als AME-Proof-of-Concept

## Einordnung

Advanced Machine Engineering (AME) beschreibt den Übergang von personengebundenem
Projektwissen zu einer strukturierten, wiederverwendbaren und regelbasierten
Maschinenbeschreibung – üblicherweise mit Teamcenter als Strukturkern. Dieser PoC
zeigt dieselbe Kette **standalone und PLM-frei**:

```
Maschinenstruktur → Merkmale → Regeln/Varianten → Kennzeichnung → Übergabedaten
```

Zielgruppe ist der konservativ denkende Maschinenbauer: Das Werkzeug spricht seine
Sprache (Station, Baugruppe, BMK, Option), verlangt keine Methodenschulung und
erklärt jeden Schritt in einem Satz. Priorität hat Nachvollziehbarkeit und
Konsistenz, nicht Funktionsumfang.

## Antworten auf die Leitfragen

### 1. Wie kapselt man formale Systemmodellierung für Nicht-Methodiker?

Durch **Übersetzung statt Vereinfachung**: Das Datenmodell *ist* ein Systemmodell
(Strukturelemente ↔ Parts, Merkmale ↔ Attribute, Optionen ↔ Variationen, Regeln ↔
Constraints), aber die Oberfläche verwendet ausschließlich Maschinenbau-Vokabular:

| Oberfläche sagt | Formal dahinter (SysML) |
|---|---|
| „Anlagengliederung“, „Station“, „Komponente“ | `part` / `part def` (Verschachtelung) |
| „Merkmal“ / „Wert am Element“ | `attribute def` / `attribute` (Usage mit Wert) |
| „Option mit Bedingung“ | `variation` / Variantenpunkt |
| „Regel (WENN … DANN …)“ | `constraint def` |
| „Signal“ | `port` |

Drei Konsequenzen dieser Kapselung:

- **Kein Freitext-Formalismus:** Bedingungen und Regeln werden aus Auswahllisten
  zusammengeklickt (Merkmal · Vergleich · Wert). Es gibt keine Syntax, die man
  falsch schreiben könnte.
- **Jede Formalität zahlt sofort ein:** Wer ein Funktionskürzel pflegt, bekommt
  Kennzeichen; wer eine Bedingung setzt, bekommt Varianten. Es gibt keine
  Modellierungsarbeit, deren Nutzen erst „später“ käme.
- **Das formale Modell ist Abfallprodukt, nicht Voraussetzung:** Der SysML-Export
  (Schritt 6) entsteht automatisch. Wer ihn nie anfasst, verliert nichts.

### 2. Wie bleibt ein Modell über mehrere Reifegrade tragfähig?

Die sechs Schritte sind zugleich Ausbaustufen – jede Stufe ist für sich nützlich,
und keine spätere Stufe erfordert einen Umbau der früheren:

| Reifegrad (Evolutionsmodell) | Nutzung in SysModeller |
|---|---|
| Freigegebene Modul-Hüllen | Nur Schritt 1: Struktur als geordnete Modulliste, Kennzeichen inklusive (Schritt 5 funktioniert bereits) |
| Mechatronische Struktur (Funktion/Komponente/Ort/Parameter/Artefakt) | Schritte 1–2: Funktionskürzel, Ortskennzeichen, Produktklassen, Merkmale mit IRDI |
| Regelbasierte Varianten | Schritte 3–4: Optionen, Regeln, Konfigurationen mit Protokoll |
| Durchgängige Konfiguration Vertrieb → Service | Schritte 4–6: Konfigurationsfragen („Vertriebssicht“), Übergabedaten je Variante, neutrales JSON als Andockpunkt |

Technisch abgesichert ist das durch zwei Entscheidungen: Alle Felder jenseits von
Name/Typ/Eltern sind **optional** (ein Element ohne Merkmale, Bedingungen und Signale
ist vollständig gültig), und alle abgeleiteten Informationen (Kennzeichen, Varianten,
Exporte) werden **berechnet statt gespeichert** – es kann also kein Reifegrad-Artefakt
veralten oder inkonsistent werden.

### 3. Wie entsteht Kennzeichnung deterministisch und disziplinübergreifend?

Kennzeichen werden **nie von Hand vergeben**, sondern vollständig aus der Struktur
berechnet (Details in [datenmodell.md](datenmodell.md)):

- Funktion `=` aus dem Pfad der Funktionskürzel (`=ABF.DOS`),
- Ort `+` aus dem vererbten Ortskennzeichen (`+F1`),
- Betriebsmittel `−` aus Produktklasse + laufender Nummer (`-M1`).

Dieselbe Quelle speist alle Disziplinen: Die BMK-Liste (E-Planung), die PLC-Tags
(Steuerungstechnik, `ABF_DOS_M1_Freigabe`) und die Strukturliste (Mechanik/Doku)
sind Projektionen desselben Baums – Konsistenz ist damit keine Disziplin der
Beteiligten, sondern eine Eigenschaft des Systems.

Zwei Regeln sichern die Stabilität über Varianten hinweg:

1. **Nummeriert wird immer auf der Maximalstruktur.** Entfällt eine Option, wird
   nicht umnummeriert – ein Bauteil trägt in jeder Variante dasselbe Kennzeichen.
2. **Kollisionen werden gemeldet, nicht „repariert“.** Doppelte BMK oder Tag-Namen
   erscheinen als Warnung; die Behebung (z. B. Produktklasse ergänzen) bleibt eine
   sichtbare, nachvollziehbare Entscheidung des Anwenders.

### 4. Was ist das minimale neutrale Datenmodell?

Fünf Sammlungen genügen (vollständige Beschreibung in [datenmodell.md](datenmodell.md)):

```
elemente[]         Baum mit Typ, Funktionskürzel, Ort, Produktklasse,
                   Verwendung (Standard/Option + Bedingung), Merkmalwerten, Signalen
merkmale[]         Definitionen: Typ, Einheit, Werteliste, Standardwert, IRDI,
                   istKonfiguration (= „Frage“)
regeln[]           WENN (Bedingungsliste) / DANN (Aktionsliste)
konfigurationen[]  benannte Antwortsätze
kennzeichnung{}    wenige Einstellungen (Trenner, Adressvergabe)
```

Alles Weitere ist ableitbar. Die Zuordnung zu Teamcenter (Item/BOM/Variant Rule),
EPLAN (Funktionale Zuordnung/BMK) und TIA (Tag-Tabelle) ist in
[datenmodell.md](datenmodell.md) tabelliert – der Anschluss wäre je System ein
Ex-/Importer gegen dieses JSON, ohne Änderung am Modell selbst.

## Bewusste Entscheidungen im offenen Lösungsraum

| Offener Punkt | Entscheidung | Begründung |
|---|---|---|
| Technologie-Stack | Reines HTML/CSS/JS, keine Abhängigkeiten, kein Server | „Datei öffnen, läuft“ – niedrigste denkbare Hürde; IT-Freigabe unkritisch; Kernlogik trotzdem separat testbar |
| UI-Paradigma | Sechs nummerierte Reiter = Arbeitsfolge; interaktives Maschinenbild als Hauptansicht; Baukasten statt leerer Formulare; Schalter/Regler statt Textfeldern | Der Werkzeugzweck ist an der Navigation ablesbar; Maschinenbauer denken räumlich – die Maschine wird zusammengesetzt, nicht eingetragen |
| Maschinenbild | Isometrische Blockansicht, rein aus der Struktur berechnet (kein CAD) | Räumliche Wiedererkennung für Vertrieb/Engineering/Service ohne Geometriedaten; später können CAD-Hüllen (JT/STEP) je Element angehängt werden, ohne das Modell zu ändern |
| Datenhaltung | Browser-Speicher + eine JSON-Datei pro Projekt | Datei-Metapher, die jeder kennt (ablegen, mailen, versionieren) |
| Umfang der Regelsprache | Nur UND-verknüpfte Vergleiche und vier Aktionsarten | Klein genug, um jede Regel als deutschen Satz anzuzeigen; deckt Wertableitung, Optionswahl und Prüfung ab |
| Grad der Automatisierung | Berechnen ja, stillschweigend entscheiden nein | Kennzeichen/Adressen/Varianten werden automatisch erzeugt, aber Konflikte und Widersprüche immer gemeldet |
| Konfliktverhalten der Regeln | Listenreihenfolge, letzte Regel gewinnt; Nichtkonvergenz = Fehler | Einfachste erklärbare Semantik; das Protokoll zeigt jeden Überschreibvorgang |

## Grenzen und nächste Schritte

Bewusst nicht im PoC: Mehrbenutzerbetrieb und Rechte, Versions-/Freigabestände,
ODER-Bedingungen und Formeln in Regeln, direkte Systemschnittstellen, vollständige
IEC-81346-Mehrfachaspekte je Element (ein Element trägt hier genau einen
Funktionspfad). Sinnvolle Ausbaurichtungen, jeweils ohne Modellbruch:

1. **Bibliotheken:** wiederverwendbare Modul-Vorlagen (freigegebene Hüllen) mit
   eigener Versionierung – Stufe 1 des Evolutionsmodells als Katalog.
2. **Regelsprache maßvoll erweitern:** ODER-Gruppen, einfache Formeln
   (`Leistung = Takt × Faktor`), weiterhin als Satz anzeigbar.
3. **Schnittstellen:** Teamcenter-/EPLAN-/TIA-Adapter gegen das neutrale JSON;
   SysML-Export in Richtung standardkonformer Werkzeuge härten.
4. **Service-Sicht:** Kennzeichen + Merkmale als As-Built-Auszug je ausgelieferter
   Konfiguration.
