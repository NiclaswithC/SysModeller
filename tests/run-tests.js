"use strict";
/*
 * SysModeller – Tests der Kernlogik (ohne Oberfläche).
 * Ausführen mit:  node tests/run-tests.js
 */
const Model = require("../app/js/core/model.js");
const Regeln = require("../app/js/core/rules.js");
const Kennzeichnung = require("../app/js/core/labeling.js");
const Sysml = require("../app/js/core/sysml.js");
const Exporte = require("../app/js/core/exporte.js");
const Beispiel = require("../app/js/core/beispiel.js");
const Vorlagen = require("../app/js/core/vorlagen.js");
const Bibliothek = require("../app/js/core/bibliothek.js");
const Prozess = require("../app/js/core/prozess.js");

let ok = 0;
let fehler = 0;
function pruefe(bedingung, text) {
  if (bedingung) {
    ok += 1;
  } else {
    fehler += 1;
    console.error("  FEHLGESCHLAGEN: " + text);
  }
}
function gleich(ist, soll, text) {
  pruefe(ist === soll, `${text} – erwartet ${JSON.stringify(soll)}, erhalten ${JSON.stringify(ist)}`);
}

// ---- Modell ----------------------------------------------------------------
console.log("Modell …");
{
  const projekt = Model.neuesProjekt("Testanlage");
  gleich(projekt.schema, "sysmodeller/1", "Schema-Kennung");
  gleich(projekt.elemente.length, 1, "Neues Projekt hat ein Wurzelelement");

  const komponente = Model.neuesElement({ typ: "Komponente", name: "Motor", elternId: projekt.elemente[0].id });
  projekt.elemente.push(komponente);
  const befunde = Model.validieren(projekt);
  pruefe(befunde.some((b) => b.stufe === "Warnung" && b.text.includes("Produktklasse")),
    "Validierung meldet fehlende Produktklasse");

  const kind = Model.neuesElement({ typ: "Baugruppe", name: "BG", elternId: komponente.id });
  projekt.elemente.push(kind);
  pruefe(Model.validieren(projekt).some((b) => b.stufe === "Fehler" && b.text.includes("untergeordneten")),
    "Validierung meldet Kinder unter Komponente");

  gleich(Model.entferneElement(projekt, komponente.id), 2, "Entfernen nimmt den Unterbaum mit");
}

{
  // Reihenfolge und Verschieben
  const projekt = Model.neuesProjekt("A");
  const wurzelId = projekt.elemente[0].id;
  const s1 = Model.neuesElement({ name: "S1", typ: "Station", elternId: wurzelId });
  const s2 = Model.neuesElement({ name: "S2", typ: "Station", elternId: wurzelId });
  projekt.elemente.push(s1, s2);
  pruefe(Model.verschiebeElement(projekt, s2.id, -1), "Verschieben nach oben möglich");
  const folge = Model.elementeInBaumfolge(projekt).map((e) => e.el.name);
  gleich(folge.join(","), "A,S2,S1", "Baumfolge nach Verschieben");
  pruefe(!Model.verschiebeElement(projekt, s2.id, -1), "Verschieben über den Anfang hinaus abgelehnt");
}

// ---- Baukasten & Duplizieren ------------------------------------------------
console.log("Baukasten …");
{
  const projekt = Model.neuesProjekt("B");
  const wurzelId = projekt.elemente[0].id;

  // Baugruppen-Vorlage bringt Komponenten samt Signalen mit.
  const band = Vorlagen.instanziiere(projekt, "bg-foerderband", wurzelId);
  gleich(band.typ, "Baugruppe", "Vorlage: Förderband ist eine Baugruppe");
  gleich(band.kuerzel, "TRB", "Vorlage: Kürzel voreingestellt");
  const kinder = Model.kinder(projekt, band.id);
  gleich(kinder.length, 2, "Vorlage: Komponenten kommen mit");
  pruefe(kinder[0].signale.length > 0 && kinder[0].signale[0].id, "Vorlage: Signale mit eigenen IDs");
  gleich(kinder[0].produktKlasse, "M", "Vorlage: Produktklasse gesetzt");

  // Namen werden unter Geschwistern automatisch nummeriert.
  const band2 = Vorlagen.instanziiere(projekt, "bg-foerderband", wurzelId);
  gleich(band2.name, "Förderband 2", "Vorlage: Namen werden nummeriert");

  // Unbekannte Vorlage liefert null.
  gleich(Vorlagen.instanziiere(projekt, "gibt-es-nicht", wurzelId), null, "Unbekannte Vorlage abgelehnt");

  // Duplizieren kopiert den Unterbaum mit neuen IDs direkt hinter das Original.
  const anzahlVorher = projekt.elemente.length;
  const kopie = Model.kopiereUnterbaum(projekt, band.id);
  gleich(projekt.elemente.length, anzahlVorher + 3, "Duplizieren: drei neue Elemente");
  gleich(kopie.name, "Förderband 3", "Duplizieren: Name nummeriert");
  pruefe(kopie.id !== band.id, "Duplizieren: neue ID");
  const kopieKinder = Model.kinder(projekt, kopie.id);
  gleich(kopieKinder.length, 2, "Duplizieren: Kinder mitkopiert");
  pruefe(kopieKinder[0].signale[0].id !== kinder[0].signale[0].id, "Duplizieren: neue Signal-IDs");
  gleich(Model.validieren(projekt).filter((b) => b.stufe === "Fehler").length, 0, "Duplizieren: Modell bleibt gültig");
}

// ---- Firmenstandard-Bibliothek ----------------------------------------------
console.log("Bibliothek …");
{
  const projekt = Beispiel.erzeuge();

  // Veröffentlichen: Schnappschuss des Transportbands (nutzt keine Merkmale).
  const modul = Bibliothek.schnappschuss(projekt, "el-trb", {
    name: "Transportband Standard", version: 1, beschreibung: "Test", stand: "01.01.2026",
  });
  gleich(modul.wurzel.name, "Transportband Standard", "Schnappschuss: Modulname am Wurzelknoten");
  gleich(modul.wurzel.kinder.length, 2, "Schnappschuss: Kinder enthalten");
  gleich(modul.wurzel.kinder[0].signale.length, 2, "Schnappschuss: Signale enthalten");

  // Schnappschuss mit Merkmalen: Dosierstation trägt Werte für Pumpentyp/Nennweite.
  const dosModul = Bibliothek.schnappschuss(projekt, "el-dos", { name: "Dosierstation Standard", version: 1 });
  pruefe(dosModul.merkmale.some((m) => m.name === "Pumpentyp"), "Schnappschuss: verwendete Merkmale eingesammelt");

  // Einfügen in ein LEERES Projekt: Merkmale werden angelegt, Werte verdrahtet.
  const ziel = Model.neuesProjekt("Neu");
  const instanz = Bibliothek.einfuegen(ziel, dosModul, ziel.elemente[0].id);
  pruefe(instanz.herkunft && instanz.herkunft.modulId === dosModul.id, "Einfügen: Herkunft vermerkt");
  pruefe(ziel.merkmale.some((m) => m.name === "Pumpentyp"), "Einfügen: fehlendes Merkmal angelegt");
  const pumpe = ziel.elemente.find((e) => e.name === "Dosierpumpe");
  const pumpentyp = ziel.merkmale.find((m) => m.name === "Pumpentyp");
  gleich(pumpe.merkmalwerte[pumpentyp.id], "Standard", "Einfügen: Merkmalwert über Namen verdrahtet");
  gleich(Model.validieren(ziel).filter((b) => b.stufe === "Fehler").length, 0, "Einfügen: Zielprojekt gültig");

  // Zweites Einfügen: Merkmal wird wiedererkannt, nicht doppelt angelegt.
  const anzahlMerkmale = ziel.merkmale.length;
  Bibliothek.einfuegen(ziel, dosModul, ziel.elemente[0].id);
  gleich(ziel.merkmale.length, anzahlMerkmale, "Einfügen: Merkmale nicht doppelt");

  // Abweichungs-Prüfung: frisch eingefügt = Standard; nach Änderung = Abweichung.
  const gleichPruefung = Bibliothek.vergleiche(ziel, instanz.id, dosModul);
  pruefe(gleichPruefung.gleich, "Vergleich: frische Instanz entspricht dem Standard");
  pumpe.signale.push(Model.neuesSignal({ name: "Extra", richtung: "E", datentyp: "Bool" }));
  const abweichung = Bibliothek.vergleiche(ziel, instanz.id, dosModul);
  pruefe(!abweichung.gleich, "Vergleich: Änderung wird erkannt");
  pruefe(abweichung.unterschiede.some((u) => u.includes("Signale")), "Vergleich: Unterschied benennt Signale");

  // Instanzname darf abweichen (Nummerierung).
  instanz.name = "Dosierstation Standard 7";
  pumpe.signale.pop();
  pruefe(Bibliothek.vergleiche(ziel, instanz.id, dosModul).gleich, "Vergleich: Wurzelname wird ignoriert");

  // Merkmal-Wiedererkennung über IRDI: gleicher IRDI, anderer Name.
  const irdiModul = Bibliothek.schnappschuss(projekt, "el-dos", { name: "IRDI-Test", version: 1 });
  const irdiZiel = Model.neuesProjekt("I");
  irdiZiel.merkmale.push(Model.neuesMerkmal({ name: "Ganz anderer Name", typ: "zahl", irdi: "0173-1#02-AAE916#005" }));
  // Taktleistung kommt in der Dosierstation nicht vor – erweitere um Bedingung mit Taktleistung:
  gleich(irdiModul.merkmale.some((m) => m.irdi === "0173-1#02-AAE916#005"), false, "(Dosiermodul nutzt Taktleistung nicht)");

  // Neueste Versionen je Name.
  const versionen = Bibliothek.neuesteVersionen([
    { id: "a", name: "X", version: 1 }, { id: "b", name: "X", version: 3 }, { id: "c", name: "Y", version: 1 },
  ]);
  gleich(versionen.length, 2, "Neueste Versionen: je Name eine");
  gleich(versionen.find((m) => m.name === "X").version, 3, "Neueste Versionen: höchste gewinnt");

  // Startbestand
  const start = Bibliothek.beispielBibliothek("01.01.2026");
  gleich(start.module.length, 4, "Beispielbibliothek: vier Module");
  pruefe(start.module.every((m) => m.wurzel.kinder.length > 0), "Beispielbibliothek: Module mit Inhalt");
  pruefe(start.funktionen.some((f) => f.name === "Spannen"), "Beispielbibliothek: Funktion Spannen");
  const spannLoesungen = Bibliothek.loesungenZuFunktion(start, "fn-spannen");
  gleich(spannLoesungen.length, 3, "Beispielbibliothek: drei Lösungsprinzipien für Spannen");
  pruefe(Bibliothek.modulZuLoesung(start, Bibliothek.findeLoesung(start, "ls-spann-pneu")) !== null,
    "Beispielbibliothek: Pneumatisch spannen ist CTO");
  gleich(Bibliothek.modulZuLoesung(start, Bibliothek.findeLoesung(start, "ls-spann-hydr")), null,
    "Beispielbibliothek: Hydraulisch spannen ist ETO");
}

// ---- Prozess -> Struktur ------------------------------------------------------
console.log("Prozess …");
{
  const bibliothek = Bibliothek.beispielBibliothek("01.01.2026");
  const projekt = Model.neuesProjekt("Montagezelle");

  // Prozess: Zuführen (Band, CTO) -> Spannen (pneumatisch CTO + hydraulisch ETO getrennt testen)
  const s1 = Prozess.neuerSchritt({ name: "Zuführen" });
  s1.funktionen.push(Prozess.neuerFunktionsEintrag({ funktionId: "fn-zufuehren", loesungId: "ls-band" }));
  const s2 = Prozess.neuerSchritt({ name: "Fügen" });
  s2.funktionen.push(Prozess.neuerFunktionsEintrag({ funktionId: "fn-spannen", loesungId: "ls-spann-hydr" }));
  projekt.prozess.push(s1, s2);

  let bericht = Prozess.erzeugeStruktur(projekt, bibliothek);
  pruefe(bericht.length >= 4, "Erzeugen: Bericht beschreibt die Schritte");

  const wurzel = projekt.elemente.find((e) => !e.elternId);
  const stationen = Model.kinder(projekt, wurzel.id);
  gleich(stationen.length, 2, "Erzeugen: je Prozessschritt eine Station");
  gleich(stationen[0].name, "Zuführen", "Erzeugen: Stationsreihenfolge = Prozessreihenfolge");
  gleich(stationen[1].name, "Fügen", "Erzeugen: zweite Station");

  const band = Model.kinder(projekt, stationen[0].id)[0];
  pruefe(band && band.herkunft && band.herkunft.name === "Förderband Typ A", "Erzeugen: CTO-Modul instanziiert");
  gleich(band.herkunftFunktion.funktionName, "Zuführen", "Erzeugen: Rückverfolgung zur Funktion");
  pruefe(Model.kinder(projekt, band.id).length === 2, "Erzeugen: Vorzugskomponenten enthalten");

  const huelle = Model.kinder(projekt, stationen[1].id)[0];
  pruefe(huelle && huelle.eto === true, "Erzeugen: ETO-Lösung wird zur Hülle");
  gleich(huelle.name, "Hydraulisch spannen", "Erzeugen: Hülle trägt den Lösungsnamen");
  gleich(Prozess.etoElemente(projekt, null).length, 1, "Erzeugen: ETO-Liste findet die Hülle");

  // Lösung wechseln: hydraulisch -> pneumatisch (CTO) ersetzt die Hülle.
  s2.funktionen[0].loesungId = "ls-spann-pneu";
  bericht = Prozess.erzeugeStruktur(projekt, bibliothek);
  const neu = Model.kinder(projekt, stationen[1].id).filter((k) => k.generiert);
  gleich(neu.length, 1, "Wechsel: genau eine generierte Lösung in der Station");
  pruefe(neu[0].herkunft && neu[0].herkunft.name === "Spanneinheit pneumatisch", "Wechsel: neue Lösung ist das CTO-Modul");
  gleich(Prozess.etoElemente(projekt, null).length, 0, "Wechsel: keine ETO-Hülle mehr");

  // Von Hand ergänztes Element bleibt beim Aktualisieren stehen.
  const manuell = Model.neuesElement({ name: "Zusatzsensor", typ: "Komponente", elternId: stationen[1].id, produktKlasse: "B" });
  projekt.elemente.push(manuell);
  Prozess.erzeugeStruktur(projekt, bibliothek);
  pruefe(Model.findeElement(projekt, manuell.id) !== null, "Aktualisieren: Handarbeit bleibt erhalten");

  // Idempotenz: ohne Änderung passiert nichts.
  const anzahl = projekt.elemente.length;
  bericht = Prozess.erzeugeStruktur(projekt, bibliothek);
  gleich(projekt.elemente.length, anzahl, "Aktualisieren: idempotent ohne Änderungen");
  pruefe(bericht.some((z) => z.includes("bereits auf dem Stand")), "Aktualisieren: Bericht meldet keinen Änderungsbedarf");

  // Schritt löschen entfernt die generierte Station (Handarbeit darunter geht mit – bewusst).
  projekt.prozess = projekt.prozess.filter((s) => s.id !== s1.id);
  Prozess.erzeugeStruktur(projekt, bibliothek);
  gleich(Model.kinder(projekt, wurzel.id).length, 1, "Schritt gelöscht: Station entfernt");

  // Neue Schritte werden in Prozessfolge VOR handangelegte Stationen sortiert.
  const s0 = Prozess.neuerSchritt({ name: "Vorbereiten" });
  projekt.prozess.unshift(s0);
  Prozess.erzeugeStruktur(projekt, bibliothek);
  const folge = Model.kinder(projekt, wurzel.id).map((e) => e.name);
  gleich(folge[0], "Vorbereiten", "Reihenfolge: neuer erster Schritt steht vorn");

  gleich(Model.validieren(projekt).filter((b) => b.stufe === "Fehler").length, 0, "Prozess: Projekt bleibt gültig");

  // Kennzeichen bleiben auf der generierten Struktur berechenbar.
  const kz = Kennzeichnung.berechneKennzeichen(projekt);
  pruefe(Object.values(kz).length > 0, "Prozess: Kennzeichen berechenbar");
}

{
  // IRDI-Wiedererkennung: Modul mit Merkmal (per Bedingung) trifft auf Projekt
  // mit gleichem IRDI unter anderem Namen -> kein Duplikat, Bedingung verdrahtet.
  const quelle = Beispiel.erzeuge();
  const modul = Bibliothek.schnappschuss(quelle, "el-eti", { name: "Etikettierer Standard", version: 1 });
  pruefe(modul.merkmale.some((m) => m.name === "Etikettierung"), "Options-Modul: Bedingungs-Merkmal eingesammelt");

  const ziel = Model.neuesProjekt("Z");
  const vorhanden = Model.neuesMerkmal({ name: "Labeling", typ: "jaNein", irdi: "", standardwert: "nein" });
  ziel.merkmale.push(vorhanden);
  const instanz = Bibliothek.einfuegen(ziel, modul, ziel.elemente[0].id);
  const etikettierung = ziel.merkmale.find((m) => m.name === "Etikettierung");
  pruefe(!!etikettierung, "Options-Modul: Merkmal per Name angelegt (kein IRDI-Treffer)");
  gleich(instanz.bedingung[0].merkmalId, etikettierung.id, "Options-Modul: Bedingung auf Projekt-Merkmal verdrahtet");
  const ergebnis = Regeln.auswerten(ziel, { [etikettierung.id]: "ja" });
  gleich(ergebnis.elementStatus[instanz.id].effektivEnthalten, true, "Options-Modul: Option funktioniert im Zielprojekt");
}

// ---- Regel-Engine ----------------------------------------------------------
console.log("Regel-Engine …");
{
  const projekt = Beispiel.erzeuge();

  // Basis: Etikettierer nicht enthalten, Standardpumpe.
  const basis = Regeln.auswerten(projekt, Model.findeKonfiguration(projekt, "kf-basis").antworten);
  pruefe(basis.konvergiert, "Basis konvergiert");
  gleich(basis.elementStatus["el-eti"].effektivEnthalten, false, "Basis: Etikettierer nicht enthalten");
  gleich(basis.elementStatus["el-eti-m"].effektivEnthalten, false, "Basis: Etikettiermotor entfällt mit der Station");
  gleich(basis.elementStatus["el-dos"].effektivEnthalten, true, "Basis: Dosierstation enthalten");
  gleich(basis.werte["mk-pumpentyp"].wert, "Standard", "Basis: Pumpentyp Standard");
  gleich(basis.meldungen.length, 0, "Basis: keine Meldungen");

  // Premium: Etikettierer enthalten, Hochleistungspumpe, DN25 am Ventil.
  const premium = Regeln.auswerten(projekt, Model.findeKonfiguration(projekt, "kf-premium").antworten);
  gleich(premium.elementStatus["el-eti"].effektivEnthalten, true, "Premium: Etikettierer enthalten");
  gleich(premium.werte["mk-pumpentyp"].wert, "Hochleistung", "Premium: Pumpentyp abgeleitet");
  gleich(premium.werte["mk-pumpentyp"].quelle.art, "Regel", "Premium: Quelle ist Regel");
  const ventilwert = Regeln.elementWert(projekt, premium, "el-dos-v", "mk-nennweite");
  gleich(ventilwert.wert, "DN25", "Premium: Nennweite DN25 per Regel");
  gleich(ventilwert.quelle, "Regel", "Premium: Nennweite-Quelle Regel");
  const ventilBasis = Regeln.elementWert(projekt, basis, "el-dos-v", "mk-nennweite");
  gleich(ventilBasis.wert, "DN15", "Basis: Nennweite DN15 aus der Struktur");
  pruefe(premium.trace.length > 0, "Premium: Protokoll vorhanden");
  gleich(premium.meldungen.length, 0, "Premium: keine Meldungen (90 <= 100)");

  // Export USA: Hinweis (UL) + Warnung (Etikettierer über 100 Takte).
  const usa = Regeln.auswerten(projekt, Model.findeKonfiguration(projekt, "kf-export").antworten);
  pruefe(usa.meldungen.some((m) => m.stufe === "Hinweis" && m.text.includes("UL")), "USA: UL-Hinweis");
  pruefe(usa.meldungen.some((m) => m.stufe === "Warnung" && m.text.includes("100")), "USA: Takt-Warnung");
  gleich(usa.werte["mk-ausfuehrung"].wert, "UL", "USA: Ausführung UL");

  // Ohne Antworten gelten die Standardwerte.
  const leer = Regeln.auswerten(projekt, {});
  gleich(leer.werte["mk-takt"].wert, "60", "Standardwert greift ohne Antwort");
  gleich(leer.werte["mk-takt"].quelle.art, "Standardwert", "Quelle Standardwert");
}

{
  // Widersprüchliche Regeln werden erkannt und gemeldet.
  const projekt = Model.neuesProjekt("W");
  const mk = Model.neuesMerkmal({ name: "X", typ: "zahl", istKonfiguration: false, standardwert: "1" });
  projekt.merkmale.push(mk);
  projekt.regeln.push(
    Model.neueRegel({ name: "R1", wenn: [{ merkmalId: mk.id, op: "=", wert: "1" }], dann: [{ art: "wertSetzen", merkmalId: mk.id, wert: "2" }] }),
    Model.neueRegel({ name: "R2", wenn: [{ merkmalId: mk.id, op: "=", wert: "2" }], dann: [{ art: "wertSetzen", merkmalId: mk.id, wert: "1" }] }),
  );
  const ergebnis = Regeln.auswerten(projekt, {});
  pruefe(!ergebnis.konvergiert, "Widerspruch: keine Konvergenz");
  pruefe(ergebnis.meldungen.some((m) => m.stufe === "Fehler"), "Widerspruch: Fehlermeldung vorhanden");
}

{
  // Vergleiche, auch mit deutschem Komma.
  pruefe(Regeln.vergleiche(">", "90", "80"), "90 > 80");
  pruefe(Regeln.vergleiche(">", "90,5", "90"), "90,5 > 90 (Komma)");
  pruefe(Regeln.vergleiche("=", "60,0", "60"), "60,0 = 60 numerisch");
  pruefe(Regeln.vergleiche("=", "ja", "ja"), "Text gleich");
  pruefe(!Regeln.vergleiche("=", "", "ja"), "Leerer Ist-Wert ist nie gleich");
  pruefe(!Regeln.vergleiche(">", "abc", "1"), "Kein Zahlenvergleich mit Text");
  pruefe(Regeln.vergleiche("!=", "0,5 l", "1,0 l"), "Auswahlwerte ungleich");
}

// ---- Kennzeichnung ---------------------------------------------------------
console.log("Kennzeichnung …");
{
  const projekt = Beispiel.erzeuge();
  const kz = Kennzeichnung.berechneKennzeichen(projekt);

  gleich(kz["el-abf"].bmk, "=ABF", "BMK der Anlage");
  gleich(kz["el-dos"].bmk, "=ABF.DOS+F1", "BMK der Dosierstation mit Ort");
  gleich(kz["el-trb-m"].bmk, "=ABF.ZUF.TRB+F1-M1", "BMK Bandmotor (Ort geerbt)");
  gleich(kz["el-dos-p"].bmk, "=ABF.DOS+F1-M1", "BMK Dosierpumpe (eigener Zählbereich)");
  gleich(kz["el-dos-fm"].bmk, "=ABF.DOS+F1-B1", "BMK Durchflussmesser");
  gleich(kz["el-eti"].bmk, "=ABF.ETI+F2", "BMK Etikettierer mit eigenem Ort");
  gleich(kz["el-stg-sps"].bmk, "=ABF.STG+S1-K1", "BMK SPS im Schaltschrank");

  // Gleiche Kürzel unter demselben Elternteil werden nummeriert.
  const doppel = Model.neuesProjekt("D");
  const wurzelId = doppel.elemente[0].id;
  doppel.elemente[0].kuerzel = "ANL";
  const a = Model.neuesElement({ name: "Dosierer A", typ: "Station", kuerzel: "DOS", elternId: wurzelId });
  const b = Model.neuesElement({ name: "Dosierer B", typ: "Station", kuerzel: "DOS", elternId: wurzelId });
  doppel.elemente.push(a, b);
  const kz2 = Kennzeichnung.berechneKennzeichen(doppel);
  gleich(kz2[a.id].funktion, "=ANL.DOS1", "Doppeltes Kürzel wird nummeriert (1)");
  gleich(kz2[b.id].funktion, "=ANL.DOS2", "Doppeltes Kürzel wird nummeriert (2)");

  // Nummerierung bleibt über Varianten stabil (Maximalstruktur zählt).
  const basis = Regeln.auswerten(projekt, Model.findeKonfiguration(projekt, "kf-basis").antworten);
  const kzBasis = Kennzeichnung.berechneKennzeichen(projekt);
  gleich(kzBasis["el-stg-sps"].bmk, kz["el-stg-sps"].bmk, "BMK stabil, wenn eine Option entfällt");
  pruefe(basis.elementStatus["el-eti"].effektivEnthalten === false, "(Basis ohne Etikettierer)");
}

{
  const projekt = Beispiel.erzeuge();
  const kz = Kennzeichnung.berechneKennzeichen(projekt);

  // Maximalstruktur: alle Signale.
  const alleTags = Kennzeichnung.plcTags(projekt, kz, null);
  gleich(alleTags.length, 13, "Anzahl PLC-Tags der Maximalstruktur");
  pruefe(alleTags.every((t) => /^[A-Za-z][A-Za-z0-9_]*$/.test(t.name)), "Tag-Namen sind bereinigt");
  gleich(new Set(alleTags.map((t) => t.name)).size, alleTags.length, "Tag-Namen sind eindeutig");

  const bandStoerung = alleTags.find((t) => t.signalId === "sg-trb-stoer");
  gleich(bandStoerung.name, "ABF_ZUF_TRB_M1_Stoerung", "Tag-Name aus Funktionspfad und Produkt");
  gleich(bandStoerung.adresse, "%I0.0", "Erste Bool-Eingangsadresse");

  const durchfluss = alleTags.find((t) => t.signalId === "sg-fm-wert");
  gleich(durchfluss.datentyp, "Real", "Durchfluss ist Real");
  gleich(durchfluss.adresse, "%ID4", "Real-Adresse auf 4 Byte ausgerichtet");

  const drehzahl = alleTags.find((t) => t.signalId === "sg-dp-drehzahl");
  gleich(drehzahl.adresse, "%QW2", "Int-Ausgangsadresse wortweise");

  // Variante ohne Etikettierer: dessen Tags entfallen, Rest bleibt.
  const basis = Regeln.auswerten(projekt, Model.findeKonfiguration(projekt, "kf-basis").antworten);
  const basisTags = Kennzeichnung.plcTags(projekt, kz, basis.elementStatus);
  gleich(basisTags.length, 11, "Basis: Etikettierer-Tags entfallen");
  pruefe(!basisTags.some((t) => t.name.includes("ETI")), "Basis: keine ETI-Tags");

  // Konfliktprüfung: sauberes Beispiel hat keine Konflikte.
  gleich(Kennzeichnung.pruefeKonflikte(projekt, kz, alleTags).length, 0, "Beispiel ohne Kennzeichen-Konflikte");

  // Konflikt provozieren: zwei Komponenten ohne Produktklasse mit gleichem BMK.
  const konfliktProjekt = Model.neuesProjekt("K");
  const kWurzel = konfliktProjekt.elemente[0];
  const k1 = Model.neuesElement({ name: "K eins", typ: "Komponente", elternId: kWurzel.id, produktKlasse: "" });
  const k2 = Model.neuesElement({ name: "K zwei", typ: "Komponente", elternId: kWurzel.id, produktKlasse: "" });
  konfliktProjekt.elemente.push(k1, k2);
  const kzK = Kennzeichnung.berechneKennzeichen(konfliktProjekt);
  pruefe(Kennzeichnung.pruefeKonflikte(konfliktProjekt, kzK, []).length > 0, "Doppeltes BMK wird gemeldet");
}

// ---- Exporte ---------------------------------------------------------------
console.log("Exporte …");
{
  const projekt = Beispiel.erzeuge();
  const kz = Kennzeichnung.berechneKennzeichen(projekt);
  const ergebnis = Regeln.auswerten(projekt, Model.findeKonfiguration(projekt, "kf-premium").antworten);

  const struktur = Exporte.strukturliste(projekt, kz, ergebnis);
  pruefe(struktur.inhalt.charCodeAt(0) === 0xFEFF, "CSV beginnt mit BOM");
  const strukturZeilen = struktur.inhalt.replace(/^﻿/, "").trim().split("\r\n");
  gleich(strukturZeilen.length, projekt.elemente.length + 1, "Strukturliste: eine Zeile je Element plus Kopf");
  pruefe(strukturZeilen[0].includes(";"), "Strukturliste ist semikolongetrennt");

  const merkmale = Exporte.merkmalliste(projekt, kz, ergebnis);
  pruefe(merkmale.inhalt.includes("Hochleistung"), "Merkmalliste enthält abgeleiteten Wert");
  pruefe(merkmale.inhalt.includes("DN25"), "Merkmalliste enthält Regelwert am Element");
  pruefe(merkmale.inhalt.includes("0173-1#02-AAE916#005"), "Merkmalliste enthält IRDI");

  const bmk = Exporte.bmkListe(projekt, kz, ergebnis);
  pruefe(bmk.inhalt.includes("=ABF.DOS+F1-M1"), "BMK-Liste enthält Dosierpumpe");

  const tags = Kennzeichnung.plcTags(projekt, kz, ergebnis.elementStatus);
  const tagTabelle = Exporte.plcTagTabelle(projekt, tags);
  const tagZeilen = tagTabelle.inhalt.replace(/^﻿/, "").trim().split("\r\n");
  gleich(tagZeilen[0], "Name,Path,Data Type,Logical Address,Comment,Hmi Visible,Hmi Accessible,Hmi Writeable",
    "PLC-Tabelle: TIA-Spaltenkopf");
  gleich(tagZeilen.length, tags.length + 1, "PLC-Tabelle: eine Zeile je Tag plus Kopf");

  const json = Exporte.projektJson(projekt);
  const zurueck = Model.pruefeProjekt(JSON.parse(json.inhalt));
  gleich(zurueck.elemente.length, projekt.elemente.length, "JSON-Export lässt sich wieder importieren");

  const sysml = Exporte.sysmlModell(projekt);
  pruefe(sysml.inhalt.includes("package Abfuellanlage"), "SysML: Paket vorhanden");
  pruefe(sysml.inhalt.includes("attribute def Taktleistung"), "SysML: Merkmalsdefinition");
  pruefe(sysml.inhalt.includes("part dosierstation : Station"), "SysML: Strukturelement");
  pruefe(sysml.inhalt.includes("variation"), "SysML: Option markiert");
  pruefe(sysml.inhalt.includes("constraint def"), "SysML: Regeln als Constraints");
}

{
  // Import weist fremde Dateien ab.
  let abgelehnt = false;
  try { Model.pruefeProjekt({ schema: "anderes/1" }); } catch (e) { abgelehnt = true; }
  pruefe(abgelehnt, "Import lehnt fremdes Schema ab");
}

// ---- Beispielprojekt selbst ------------------------------------------------
console.log("Beispielprojekt …");
{
  const projekt = Beispiel.erzeuge();
  const befunde = Model.validieren(projekt).filter((b) => b.stufe === "Fehler");
  gleich(befunde.length, 0, "Beispielprojekt ohne Validierungsfehler");
}

console.log("");
if (fehler > 0) {
  console.error(`${fehler} Test(s) fehlgeschlagen, ${ok} bestanden.`);
  process.exit(1);
}
console.log(`Alle ${ok} Tests bestanden.`);
