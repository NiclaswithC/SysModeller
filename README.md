# SysModeller

**Von der Maschinenstruktur zu den Übergabedaten – standalone, PLM-frei, nachvollziehbar.**

SysModeller ist ein Proof of Concept für Advanced Machine Engineering (AME): der Übergang von
personengebundenem Projektwissen (Erfahrung + Copy-Paste) zu einer strukturierten, wiederverwendbaren
und regelbasierten Maschinenbeschreibung. Das Werkzeug bildet die Kette

> **Maschinenstruktur → Merkmale → Regeln/Varianten → Kennzeichnung → Übergabedaten**

in einem einzigen, bewusst einfachen Werkzeug ab – bedienbar ohne Methodenschulung,
mit einem formalen Systemmodell (SysML) im Hintergrund.

## Schnellstart

Es gibt nichts zu installieren:

1. `app/index.html` im Browser öffnen (Doppelklick genügt).
2. Beim ersten Start ist das Beispielprojekt **Abfüllanlage** geladen – einfach die sechs Reiter
   von links nach rechts durchgehen.
3. Eigenes Projekt: Kopfzeile → „Neues Projekt“. Gespeichert wird automatisch im Browser;
   „Projekt speichern“ erzeugt eine einzelne JSON-Datei zum Ablegen und Weitergeben.

Die Kernlogik ist ohne Browser testbar:

```
node tests/run-tests.js
```

## Die sechs Schritte

| Schritt | Reiter | Inhalt |
|---|---|---|
| 1 | **Struktur** | Anlagengliederung als Baum (Anlage → Teilanlage → Station → Baugruppe → Komponente), Optionen mit Bedingung, Signale an Komponenten |
| 2 | **Merkmale** | Merkmal-Katalog: Definition getrennt vom Wert, optional mit stabilem Bezeichner (IRDI) |
| 3 | **Regeln** | Erfahrungswissen als WENN-DANN-Sätze, zusammengeklickt statt programmiert |
| 4 | **Varianten** | Fragen beantworten → Regeln bestimmen Umfang und Werte, mit Begründungsprotokoll |
| 5 | **Kennzeichnung** | BMK (=, +, −) und PLC-Tags mit Adressen – deterministisch aus der Struktur berechnet |
| 6 | **Übergabe** | Strukturliste, Merkmalliste, BMK-Liste, PLC-Tag-Tabelle (TIA-Aufbau), neutrales JSON, SysML |

Jeder Schritt ist für sich nutzbar – wer nur Struktur und Kennzeichnung braucht, hört nach
Schritt 1 und 5 auf; Merkmale, Regeln und Varianten kommen dazu, wenn die Organisation so weit ist.
So bleibt ein einziges Modell über mehrere Reifegrade tragfähig.

## Leitideen

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
