"use strict";
/*
 * Reiter „Übergabedaten“: alle Exporte aus demselben neutralen Datenmodell.
 */
(function () {
  const { h, select, infoBox } = UI;
  const Model = () => SysM.Model;

  function render(wurzel) {
    const projekt = App.projekt;

    const konfig = App.aktiveKonfigId ? Model().findeKonfiguration(projekt, App.aktiveKonfigId) : null;
    const ergebnis = konfig ? SysM.Regeln.auswerten(projekt, konfig.antworten) : null;
    const kennzeichen = SysM.Kennzeichnung.berechneKennzeichen(projekt);
    const bereichText = konfig ? `Konfiguration „${konfig.name}“` : "Maximalstruktur (alle Optionen)";

    wurzel.append(infoBox(
      "Alle Dateien werden aus demselben Datenmodell berechnet und passen deshalb zusammen. ",
      "CSV-Dateien öffnen sich direkt in Excel; das neutrale JSON ist die vollständige Maschinenbeschreibung ",
      "für spätere Anbindungen (z. B. Teamcenter, EPLAN, TIA Portal)."));

    const optionen = [{ wert: "", text: "Maximalstruktur (alle Optionen)" }]
      .concat(projekt.konfigurationen.map((k) => ({ wert: k.id, text: "Konfiguration: " + k.name })));
    wurzel.append(h("div", { class: "panel" },
      UI.feld("Übergeben für",
        select(optionen, App.aktiveKonfigId || "", (w) => { App.aktiveKonfigId = w; App.speichern(); App.render(); }),
        "Aktuell: " + bereichText),
    ));

    const karten = h("div", { class: "export-karten" });

    function karte(titel, beschreibung, erzeugen) {
      let datei;
      try {
        datei = erzeugen();
      } catch (fehler) {
        return h("div", { class: "export-karte" },
          h("h4", {}, titel),
          h("p", { class: "klein" }, "Export derzeit nicht möglich: " + fehler.message));
      }
      return h("div", { class: "export-karte" },
        h("h4", {}, titel),
        h("p", {}, beschreibung),
        h("p", { class: "klein" }, "Datei: " + datei.dateiname),
        h("button", { class: "knopf", onclick: () => UI.download(datei.dateiname, datei.inhalt, datei.mime) }, "Herunterladen"),
      );
    }

    karten.append(
      karte("Strukturliste (CSV)",
        "Die komplette Anlagengliederung mit Kennzeichen und Enthaltensein – als Arbeits- und Prüfliste für alle Gewerke.",
        () => SysM.Exporte.strukturliste(projekt, kennzeichen, ergebnis)),
      karte("Merkmalliste (CSV)",
        "Alle Merkmale mit Wert, Einheit, Quelle (Antwort, Standard oder Regel) und IRDI – die Datenübergabe an Auslegung und Doku.",
        () => SysM.Exporte.merkmalliste(projekt, kennzeichen, ergebnis)),
      karte("BMK-Liste (CSV)",
        "Alle Betriebsmittel mit ihren Kennzeichen (=, +, −) – als Vorlage für die Elektrokonstruktion (z. B. EPLAN).",
        () => SysM.Exporte.bmkListe(projekt, kennzeichen, ergebnis)),
      karte("PLC-Tag-Tabelle (CSV)",
        "Alle Signale mit Tag-Namen, Datentyp und Adresse im Spaltenaufbau des TIA-Portal-Imports.",
        () => {
          const tags = SysM.Kennzeichnung.plcTags(projekt, kennzeichen, ergebnis ? ergebnis.elementStatus : null);
          return SysM.Exporte.plcTagTabelle(projekt, tags);
        }),
      karte("Neutrales Datenmodell (JSON)",
        "Die vollständige Maschinenbeschreibung – Struktur, Merkmale, Regeln, Konfigurationen. Dieselbe Datei, die auch „Projekt speichern“ erzeugt; Grundlage für jede spätere Systemanbindung.",
        () => SysM.Exporte.projektJson(projekt)),
      karte("Formales Systemmodell (SysML)",
        "Ihre Maschinenbeschreibung als formales Systemmodell in SysML-Textnotation – entsteht automatisch, ohne dass Sie dafür etwas tun müssen. Für Werkzeuge und Kollegen, die mit Systemmodellen arbeiten.",
        () => SysM.Exporte.sysmlModell(projekt)),
    );

    wurzel.append(karten);

    wurzel.append(infoBox(
      h("strong", {}, "Hinweis zur Weiterverwendung: "),
      "CSV-Dateien sind mit Semikolon getrennt (deutschsprachiges Excel), nur die PLC-Tag-Tabelle folgt dem ",
      "kommagetrennten TIA-Aufbau. Für eine direkte Systemanbindung (Teamcenter, EPLAN, TIA) ist das neutrale JSON ",
      "der vorgesehene Andockpunkt – siehe docs/datenmodell.md im Projektordner."));
  }

  Tabs.uebergabe = { titel: "Übergabedaten", render };
})();
