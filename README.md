# SysModeller

**Vom Angebot bis zum Service: eine Maschine, ein Modell – standalone, PLM-frei, nachvollziehbar.**

SysModeller ist ein Proof of Concept für Advanced Machine Engineering (AME) und beantwortet
vier Kernprobleme des Maschinenbaus:

1. **Steigende Komplexität** → wird geteilt: Die Maschine besteht aus Modulen, eine konkrete
   Maschine entsteht über wenige Fragen; Regeln fügen zusammen und prüfen.
2. **Ineffiziente Kommunikation (Excel + E-Mail)** → ein Projektmodell als einzige Quelle:
   Angebotsmappe, Strukturliste, BMK-Liste und PLC-Tags werden daraus *erzeugt*, nicht abgeschrieben.
3. **Scheinbare Wiederverwendung** („Conveyor Typ A“ ist in jeder Disziplin anders geschnitten) →
   die **Bibliothek**: ein Modul wird einmal definiert – Mechanik-Aufbau, Elektrik-Komponenten,
   Software-Signale, Merkmale – und überall in genau diesem Schnitt verwendet. Instanzen kennen
   ihre Herkunft; **Abweichungen vom Standard werden erkannt und angezeigt**.
4. **Wissensverlust beim Weggang erfahrener Kollegen** → Erfahrungswissen steht als WENN-DANN-Regeln
   mit Begründung im Modell und wirkt bei jedem Angebot automatisch.

## Schnellstart

Es gibt nichts zu installieren:

1. `app/index.html` im Browser öffnen (Doppelklick genügt).
2. Beim ersten Start ist das Beispielprojekt **Abfüllanlage** geladen, inklusive zweier
   Firmenstandards in der Bibliothek.
3. Eigenes Projekt: Kopfzeile → „Neues Projekt“. Gespeichert wird automatisch im Browser;
   „Projekt speichern“ erzeugt eine einzelne JSON-Datei zum Ablegen und Weitergeben.

Die Kernlogik ist ohne Browser testbar:

```
node tests/run-tests.js
```

## Aufbau entlang des realen Prozesses

| Rolle | Reiter | Inhalt |
|---|---|---|
| **Vertrieb** | Prozess | Den Prozess des Kunden als Schritte modellieren; je Schritt **Funktion** („Spannen“) und **Lösungsprinzip** („pneumatisch / hydraulisch / elektrisch“) wählen – dahinter stehen die Firmenstandards (CTO) oder **ETO-Hüllen**; „Maschine aufbauen“ erzeugt die Struktur in Prozessreihenfolge, mit Rückverfolgbarkeit bis zur Kundenanforderung |
| **Vertrieb** | Angebot | Kundenanfrage mit Schaltern/Reglern erfassen → sofort Machbarkeit (geprüft gegen die Engineering-Regeln), Maschinenbild, Lieferumfang inkl. ETO-Ausweis – und per Klick die **Angebotsmappe** als eigenständige HTML-Datei |
| **Engineering** | Struktur | Maschine aus dem **Baukasten** zusammensetzen (Firmenstandards + vorkonfigurierte Bausteine, per Klick oder Drag & Drop) – das interaktive **Maschinenbild** (isometrische 3D-Blockansicht) ist die Hauptansicht |
| **Engineering** | Merkmale | Merkmal-Katalog: Definition getrennt vom Wert, optional mit stabilem Bezeichner (IRDI) |
| **Engineering** | Regeln | Erfahrungswissen als WENN-DANN-Sätze mit Begründung – mit **Live-Simulator** (welche Regel greift wann?) |
| **Standards** | Bibliothek | Firmenstandards: einmal definiert, überall derselbe Schnitt; versioniert, als Datei teilbar, mit **Abweichungs-Prüfung** je Instanz |
| **Übergabe** | Kennzeichnung, Übergabedaten | BMK (=, +, −) und PLC-Tags deterministisch aus der Struktur; Strukturliste, Merkmalliste, BMK-Liste, PLC-Tag-Tabelle (TIA-Aufbau), neutrales JSON, SysML |

Jede Sicht ist für sich nutzbar – wer nur Struktur und Kennzeichnung braucht, nutzt nur diese;
Merkmale, Regeln und Angebote kommen dazu, wenn die Organisation so weit ist.
So bleibt ein einziges Modell über mehrere Reifegrade tragfähig.

## Leitideen

- **Räumlich denken:** Das interaktive Maschinenbild (isometrische Blockansicht, ohne CAD-Daten
  berechnet) begleitet alle Schritte – Vertrieb zeigt Varianten daran, Engineering baut daran,
  Service findet Komponenten samt Kennzeichen darin wieder.
- **Bausteine statt Formulare:** Der Baukasten liefert vorkonfigurierte Stationen, Baugruppen und
  Komponenten mit Kürzel, Produktklasse und typischen Signalen – einfügen per Klick oder Drag & Drop.
- **Maximalstruktur (150 %-Modell):** Die Anlage wird einmal mit allen Optionen beschrieben.
  Eine Variante ist nur die Antwort auf wenige Fragen – alles Weitere leiten Regeln ab.
- **Deterministische Kennzeichnung:** BMK und PLC-Tags werden vollständig aus der Struktur
  berechnet und immer auf der Maximalstruktur nummeriert – ein Bauteil behält in jeder
  Variante dasselbe Kennzeichen.
- **Nachvollziehbarkeit vor Funktionsumfang:** Jede Entscheidung der Regel-Engine steht mit
  Begründung im Protokoll; Widersprüche werden gemeldet statt still entschieden.
- **Neutrales Datenmodell:** Eine kleine JSON-Struktur (Struktur, Merkmale, Regeln,
  Konfigurationen, Kennzeichnung) als Andockpunkt für Teamcenter, EPLAN, TIA & Co. –
  siehe [docs/datenmodell.md](docs/datenmodell.md).
- **SysML im Hintergrund:** Die Oberfläche kennt keinen SysML-Jargon; das formale Modell
  entsteht automatisch mit und ist als Textnotation exportierbar (Schritt 6).

## Fachliche Bezugsrahmen

Als Vokabular verwendet (nicht als vorgeschriebene Umsetzung):

- **ISA-88** – Ebenen der Anlagengliederung
- **IEC 81346** – dreiaspektige Kennzeichnung: Funktion `=`, Ort `+`, Betriebsmittel `−`
- **ECLASS/IRDI** – stabile Trennung von Merkmal und Merkmalwert
- **SysML** – formales Systemmodell im Hintergrund

Details und Zuordnungstabellen: [docs/datenmodell.md](docs/datenmodell.md) ·
Einordnung, Reifegrade und Antworten auf die Leitfragen: [docs/konzept.md](docs/konzept.md)

## Projektaufbau

```
app/
  index.html          Anwendung – im Browser öffnen, fertig
  css/app.css
  js/core/            Kernlogik ohne Oberfläche (auch unter Node lauffähig)
    model.js          neutrales Datenmodell, Validierung, Import/Export
    rules.js          Regel- und Konfigurations-Engine mit Protokoll
    labeling.js       BMK- und PLC-Tag-Erzeugung
    sysml.js          Export des formalen Modells (SysML-Textnotation)
    exporte.js        Übergabedaten (CSV/JSON)
    beispiel.js       Beispielprojekt „Abfüllanlage“
  js/ui/              Oberfläche (je Reiter eine Datei, ohne Framework)
beispiel/             Beispielprojekt als neutrale JSON-Datei
docs/                 Konzept und Datenmodell
tests/run-tests.js    Tests der Kernlogik (node tests/run-tests.js)
```

## Grenzen des PoC

Bewusst weggelassen: Mehrbenutzerbetrieb, Rechte, Versionsstände, direkte Systemschnittstellen,
komplexe Regelausdrücke (ODER-Verknüpfung, Formeln). Das neutrale Datenmodell ist so geschnitten,
dass diese Erweiterungen ohne Bruch möglich sind – siehe [docs/konzept.md](docs/konzept.md).
