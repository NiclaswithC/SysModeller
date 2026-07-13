# Das neutrale Datenmodell

Eine Projektdatei ist ein einzelnes JSON-Dokument (`schema: "sysmodeller/1"`).
Alles, was das Werkzeug anzeigt oder exportiert, wird aus diesen Daten berechnet –
Kennzeichen, Variantenumfänge und Exporte werden **nicht gespeichert** und können
daher nicht veralten.

```json
{
  "schema": "sysmodeller/1",
  "projekt": { "name": "…", "beschreibung": "…" },
  "elemente": [ … ],
  "merkmale": [ … ],
  "regeln": [ … ],
  "konfigurationen": [ … ],
  "kennzeichnung": { "trennerFunktion": ".", "plcAdressenAutomatisch": true }
}
```

## elemente[] – die Anlagengliederung

```json
{
  "id": "el-dos",
  "name": "Dosierstation",
  "typ": "Station",                  // Anlage | Teilanlage | Station | Baugruppe | Komponente
  "elternId": "el-abf",              // null = Wurzel; Reihenfolge im Array = Geschwisterfolge
  "kuerzel": "DOS",                  // Funktionskürzel für den =-Aspekt (nicht bei Komponente)
  "produktKlasse": "M",              // nur Komponente: Kennbuchstabe nach IEC 81346-2
  "ort": "F1",                       // Ortskennzeichen (+), leer = vom Elternteil geerbt
  "verwendung": "standard",          // "standard" | "option"
  "bedingung": [                     // nur bei Option: UND-verknüpfte Vergleiche
    { "merkmalId": "mk-etikett", "op": "=", "wert": "ja" }
  ],
  "merkmalwerte": { "mk-nennweite": "DN15" },   // feste Werte dieses Elements
  "signale": [                       // nur Komponente: Grundlage der PLC-Tags
    { "id": "sg-1", "name": "Freigabe", "richtung": "A", "datentyp": "Bool" }
  ],
  "kommentar": ""
}
```

Die fünf Ebenen entsprechen dem physischen Modell der **ISA-88**:

| SysModeller | ISA-88 |
|---|---|
| Anlage | Prozesszelle / Process Cell |
| Teilanlage | Teilanlage / Unit |
| Station, Baugruppe | Technische Einrichtung / Equipment Module |
| Komponente | Einzelsteuereinheit / Control Module |

Die Hierarchie ist nicht erzwungen (eine Station direkt unter der Anlage ist
zulässig); nur Komponenten sind als Blätter festgelegt.

## merkmale[] – Definition getrennt vom Wert (ECLASS-Prinzip)

```json
{
  "id": "mk-takt",
  "name": "Taktleistung",
  "typ": "zahl",                     // zahl | text | jaNein | auswahl
  "einheit": "1/min",
  "werte": [],                       // nur bei auswahl: erlaubte Werte
  "istKonfiguration": true,          // true = „Frage“ im Konfigurationsbogen (Schritt 4)
  "standardwert": "60",
  "irdi": "0173-1#02-AAE916#005",    // optional: stabiler Bezeichner, z. B. ECLASS-IRDI
  "kommentar": "…"
}
```

Das Merkmal (die Definition) existiert genau einmal; Werte stehen an Elementen
(`merkmalwerte`), in Konfigurationen (`antworten`) oder entstehen zur Laufzeit durch
Regeln. Das optionale IRDI-Feld gibt jedem Merkmal einen systemübergreifend stabilen
Bezeichner – die Voraussetzung, um Merkmale später verlustfrei nach ECLASS,
Teamcenter oder in Verwaltungsschalen-Welten (AAS) abzubilden.

## regeln[] – Varianten- und Konsistenzlogik

```json
{
  "id": "rg-pumpe",
  "name": "Hochleistungspumpe ab 80 Takten",
  "aktiv": true,
  "wenn": [ { "merkmalId": "mk-takt", "op": ">", "wert": "80" } ],
  "dann": [
    { "art": "wertSetzen", "merkmalId": "mk-pumpentyp", "wert": "Hochleistung" },
    { "art": "wertSetzen", "elementId": "el-dos-p", "merkmalId": "mk-pumpentyp", "wert": "Hochleistung" }
  ],
  "kommentar": "Über 80 Flaschen/min reicht die Standardpumpe nicht."
}
```

Vergleichsoperatoren: `=`, `!=`, `<`, `<=`, `>`, `>=` (Zahlen mit deutschem Komma
werden erkannt; vollständig numerische Angaben werden numerisch verglichen).
Aktionsarten:

| art | Wirkung |
|---|---|
| `wertSetzen` | setzt einen Merkmalwert – anlagenweit (ohne `elementId`) oder an einem Element |
| `elementAufnehmen` / `elementAusschliessen` | übersteuert das Enthaltensein eines Elements |
| `meldung` | gibt Hinweis/Warnung/Fehler aus (Konsistenzprüfung) |

### Auswertungssemantik (Schritt 4)

1. **Startwerte:** Antworten der Konfiguration, sonst Standardwerte der Merkmale.
2. **Fixpunkt:** Aktive Regeln werden in Listenreihenfolge angewendet und die Liste
   so lange wiederholt, bis sich nichts mehr ändert (max. 20 Durchläufe). Setzen
   mehrere Regeln denselben Wert, gewinnt die spätere; ändert sich das Ergebnis
   dauerhaft hin und her, wird **Nichtkonvergenz als Fehler gemeldet** statt still
   entschieden.
3. **Enthaltensein je Element**, mit Vorrang:
   Regel-Eingriff > eigene Options-Bedingung > Verwendung (Standard = enthalten,
   Option ohne Bedingung = nicht enthalten).
4. **Wirksames Enthaltensein:** Ohne den übergeordneten Zweig kein Element –
   entfällt eine Station, entfallen ihre Komponenten mit Begründung.
5. **Protokoll:** Jeder Schritt (Antwort, Regelanwendung, Optionsentscheidung)
   wird als lesbarer Satz aufgezeichnet.

## konfigurationen[] – Varianten als Antwortsätze

```json
{ "id": "kf-premium", "name": "Premium 90", "antworten": { "mk-takt": "90", "mk-etikett": "ja" }, "kommentar": "" }
```

Eine Konfiguration speichert **nur die Antworten**. Umfang, Werte und Meldungen
werden bei jeder Anzeige neu berechnet – ändert sich eine Regel, sind alle
Konfigurationen automatisch auf dem neuen Stand (und Abweichungen sofort sichtbar).

## Kennzeichnung (Schritt 5) – Berechnungsregeln

Aufbau nach den Aspekten der **IEC 81346**: `=Funktion +Ort -Betriebsmittel`,
z. B. `=ABF.DOS+F1-M1`.

- **Funktion (=):** Pfad der Funktionskürzel aller Nicht-Komponenten von der Wurzel
  abwärts, verbunden mit dem Trennzeichen (Vorgabe `.`). Fehlt ein Kürzel, wird eines
  aus dem Namen abgeleitet (erste drei Buchstaben, Warnung in der Validierung).
  Gleiche Kürzel unter demselben Elternteil werden in Geschwisterfolge nummeriert
  (`DOS1`, `DOS2`).
- **Ort (+):** das nächste gesetzte Ortskennzeichen am Element selbst oder einem
  Vorfahren (Vererbung nach unten).
- **Betriebsmittel (−):** nur Komponenten; Kennbuchstabe der Produktklasse
  (IEC 81346-2: B Sensor, M Antrieb, Q Schalten, K Signalverarbeitung, …) plus
  laufende Nummer je Klasse **innerhalb der umgebenden Funktionsgruppe**, in
  Baumreihenfolge.
- **Stabilität:** Alle Zähler laufen über die **Maximalstruktur**. Eine Variante
  blendet Elemente nur aus – es wird nie umnummeriert, Kennzeichen sind über alle
  Varianten identisch.
- **Konflikte** (doppelte BMK, doppelte Tag-Namen) werden als Warnung gemeldet und
  absichtlich nicht automatisch „repariert“.

**PLC-Tags:** je Signal einer enthaltenen Komponente
`Funktionspfad_Produktkennzeichen_Signalname`, bereinigt (Umlaute → ae/oe/ue,
Sonderzeichen → `_`), z. B. `ABF_DOS_M1_Freigabe`. Optionale automatische
Adressvergabe in Baumreihenfolge, getrennt nach Eingängen (`%I`) und Ausgängen
(`%Q`): Bool bitweise gepackt, Int/Word wortausgerichtet (`%IW/%QW`), Real
doppelwortausgerichtet (`%ID/%QD`).

## Übergabedaten (Schritt 6)

| Export | Format | Gedachter Abnehmer |
|---|---|---|
| Strukturliste | CSV (Semikolon, UTF-8-BOM) | alle Gewerke, Prüfliste |
| Merkmalliste | CSV | Auslegung, Dokumentation (inkl. Quelle je Wert und IRDI) |
| BMK-Liste | CSV | Elektrokonstruktion (EPLAN-Artikel-/Betriebsmittelsicht) |
| PLC-Tag-Tabelle | CSV (Komma, TIA-Spaltenaufbau `Name,Path,Data Type,Logical Address,Comment,…`) | TIA Portal / Steuerungstechnik |
| Neutrales Datenmodell | JSON (identisch mit „Projekt speichern“) | jede spätere Systemanbindung |
| Formales Systemmodell | vereinfachte SysML-v2-Textnotation | MBSE-Werkzeuge, Architekten |

## Zuordnung zu Zielsystemen (Andockpfade)

Der Anschluss an ein Zielsystem ist jeweils ein Ex-/Importer gegen das neutrale
JSON – das Modell selbst muss dafür nicht geändert werden.

| SysModeller | Teamcenter | EPLAN | TIA Portal |
|---|---|---|---|
| Element (Baum) | Item + BOM-Zeile (150 %-Struktur) | Funktionale Zuordnung / Struktursegment | – |
| Funktionskürzel-Pfad `=` | Funktionale Sicht | Anlagenkennzeichen `=` | Ordnerstruktur/Gruppen |
| Ort `+` | – (Attribut) | Ortskennzeichen `+` | – |
| Produktklasse + Nummer `−` | – (Attribut) | BMK `-` | Tag-Präfix |
| Merkmal (+ IRDI) | Merkmal/Classification (z. B. ECLASS) | Artikel-/Funktionsdaten | – |
| Option + Bedingung | Variant Condition | – (vorkonfigurierte Makros) | – |
| Regel | Variant Rule / Checker | – | – |
| Konfiguration | Variant Rule (gespeicherte Konfiguration) | Projektauswahl | – |
| Signal | – | SPS-Kasten/Anschluss | PLC-Tag (Tabellenimport) |
| SysML-Export | – (Austausch Richtung MBSE-Werkzeuge) | – | – |

## Formales Modell (SysML) – Zuordnung

| Modellinhalt | SysML-Textnotation |
|---|---|
| Projekt | `package` |
| Elementtyp (Ebene) | `part def` |
| Element | verschachtelte `part`-Usage (Kennzeichen als Kommentar) |
| Merkmal | `attribute def` (Einheit/Werteliste/IRDI als Dokumentation) |
| Merkmalwert am Element | `attribute … = wert` |
| Signal | `port` (Richtung/Datentyp als Kommentar) |
| Option + Bedingung | `variation`-Vermerk am Part |
| Regel | `constraint def` mit dokumentierter WENN/DANN-Logik |
| Konfiguration | Kommentarblock (Antwortsatz) |

Die Notation ist bewusst **vereinfacht** (Lesbarkeit vor Werkzeug-Konformität);
für den Austausch mit strikten SysML-v2-Werkzeugen wäre der Export zu härten.
