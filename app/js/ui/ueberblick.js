"use strict";
/*
 * Reiter „Überblick“: erklärt das Werkzeug in einfachen Worten und zeigt
 * den Zustand des Projekts (Prüfbefunde).
 */
(function () {
  const { h, infoBox, meldungBox } = UI;

  const SCHRITTE = [
    { tab: "struktur", nr: 1, titel: "Struktur aufbauen", text: "Die Anlage in Stationen, Baugruppen und Komponenten gliedern – wie eine Stückliste, nur nach Funktion geordnet." },
    { tab: "merkmale", nr: 2, titel: "Merkmale festlegen", text: "Was ist an dieser Anlage einstellbar oder wissenswert? Taktleistung, Spannung, Ausstattung – jedes Merkmal wird einmal sauber definiert." },
    { tab: "regeln", nr: 3, titel: "Regeln aufschreiben", text: "Erfahrungswissen als WENN-DANN-Sätze: „WENN Taktleistung über 80 DANN Hochleistungspumpe.“ Das Werkzeug wendet sie automatisch an." },
    { tab: "varianten", nr: 4, titel: "Varianten ableiten", text: "Ein paar Fragen beantworten – die Regeln bestimmen daraus, welche Teile die Maschine bekommt. Mit Begründung für jede Entscheidung." },
    { tab: "kennzeichnung", nr: 5, titel: "Kennzeichen prüfen", text: "Betriebsmittelkennzeichen (BMK) und PLC-Tags entstehen automatisch aus der Struktur – immer gleich, immer widerspruchsfrei." },
    { tab: "uebergabe", nr: 6, titel: "Daten übergeben", text: "Strukturliste, BMK-Liste, PLC-Tags und das neutrale Datenmodell als Dateien für E-Planung, Steuerungstechnik und spätere Systeme." },
  ];

  function render(wurzel) {
    const projekt = App.projekt;

    wurzel.append(
      h("div", { class: "hero" },
        h("h2", {}, "Von der Maschinenstruktur zu den Übergabedaten – in sechs Schritten."),
        h("p", {},
          "SysModeller macht aus Projektwissen eine strukturierte, wiederverwendbare Maschinenbeschreibung: ",
          "Sie beschreiben Ihre Anlage ", h("strong", {}, "einmal"), " – mit allen Optionen. ",
          "Daraus entstehen Varianten, Kennzeichen und Übergabedaten ", h("strong", {}, "automatisch und nachvollziehbar"), "."),
      ),
    );

    // Die Maschine auf einen Blick – Klick führt in Schritt 1.
    if (projekt.elemente.length > 1) {
      const kennzeichen = SysM.Kennzeichnung.berechneKennzeichen(projekt);
      const vorschau = h("div", { class: "panel vorschau-panel" });
      vorschau.append(Maschinenbild.render(projekt, {
        kennzeichen,
        maxHoehe: 240,
        onKlick: (el) => {
          if (el) App.auswahl.elementId = el.id;
          App.zeigeTab("struktur");
        },
      }));
      vorschau.append(h("p", { class: "klein", style: "text-align:center" },
        "Ihre Maschine – dasselbe Bild begleitet Vertrieb (Variante zeigen), Engineering (Aufbau) und Service (Wiederfinden). Klick öffnet Schritt 1."));
      wurzel.append(vorschau);
    }

    wurzel.append(h("div", { class: "schritt-karten" },
      SCHRITTE.map((s) => h("button", { class: "schritt-karte", onclick: () => App.zeigeTab(s.tab) },
        h("span", { class: "schritt-nr" }, String(s.nr)),
        h("span", { class: "schritt-titel" }, s.titel),
        h("span", { class: "schritt-text" }, s.text),
      )),
    ));

    // Projekt & Prüfbefunde
    const befunde = SysM.Model.validieren(projekt);
    wurzel.append(h("div", { class: "panel" },
      h("h3", {}, "Aktuelles Projekt: " + projekt.projekt.name),
      UI.feld("Kurzbeschreibung",
        h("textarea", {
          rows: 2,
          onchange: (e) => { projekt.projekt.beschreibung = e.target.value; App.speichern(); },
        }, projekt.projekt.beschreibung || ""),
        "Worum geht es bei dieser Anlage? (optional)"),
      h("p", { class: "klein" },
        `${projekt.elemente.length} Strukturelemente · ${projekt.merkmale.length} Merkmale · ` +
        `${projekt.regeln.length} Regeln · ${projekt.konfigurationen.length} Konfigurationen`),
      befunde.length
        ? h("div", {},
            h("h4", {}, "Prüfbefunde"),
            befunde.map((b) => meldungBox(b.stufe, b.text)))
        : h("p", { class: "gut" }, "✓ Keine Prüfbefunde – das Modell ist in sich stimmig."),
    ));

    wurzel.append(infoBox(
      h("h3", {}, "Was steckt dahinter? (Sie müssen davon nichts wissen)"),
      h("p", {}, "Im Hintergrund arbeitet SysModeller mit bewährten Bezugsrahmen – ohne sie Ihnen aufzudrängen:"),
      h("ul", {},
        h("li", {}, h("strong", {}, "Anlagengliederung"), " nach dem Ebenenmodell der ISA-88 (Anlage → Teilanlage → Station → Baugruppe → Komponente)."),
        h("li", {}, h("strong", {}, "Kennzeichnung"), " nach den Aspekten der IEC 81346: Funktion (=), Ort (+), Betriebsmittel (−)."),
        h("li", {}, h("strong", {}, "Merkmale"), " getrennt von ihren Werten, mit optionalem stabilem Bezeichner (ECLASS/IRDI)."),
        h("li", {}, h("strong", {}, "Formales Systemmodell"), " (SysML): entsteht automatisch mit und kann jederzeit exportiert werden – Schritt 6."),
      ),
      h("p", {},
        "Die Struktur ist eine ", h("strong", {}, "Maximalstruktur"), ": sie enthält alle Optionen. ",
        "Eine Variante ist die Antwort auf wenige Fragen – alles Weitere leiten die Regeln ab. ",
        "Kennzeichen werden immer auf der Maximalstruktur nummeriert, damit ein Bauteil in jeder Variante dasselbe Kennzeichen behält."),
      h("p", {},
        "Alles wird automatisch im Browser gespeichert. Über „Projekt speichern“ erhalten Sie eine einzelne Datei, ",
        "die sich weitergeben, ablegen und wieder öffnen lässt."),
    ));
  }

  Tabs.ueberblick = { titel: "Überblick", render };
})();
