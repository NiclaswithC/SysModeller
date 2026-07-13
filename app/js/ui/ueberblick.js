"use strict";
/*
 * Reiter „Überblick“: erklärt das Werkzeug entlang des realen
 * Maschinenbau-Prozesses und der Probleme, die es beantwortet.
 */
(function () {
  const { h, infoBox, meldungBox } = UI;

  const PROBLEME = [
    {
      titel: "Komplexität teilen",
      text: "Die Maschine wird in Module zerlegt, die je Anfrage über wenige Fragen zusammengesetzt werden. Niemand muss das Ganze im Kopf haben – jeder pflegt seinen Baustein, das Werkzeug fügt zusammen und prüft.",
      tab: "struktur", aktion: "→ Struktur & Baukasten",
    },
    {
      titel: "Schluss mit Excel + E-Mail",
      text: "Ein Projektmodell statt zwanzig Listen: Vertrieb, Mechanik, Elektrik und Software arbeiten auf derselben Quelle. Angebotsmappe, BMK-Liste und PLC-Tags werden daraus erzeugt – nicht abgeschrieben.",
      tab: "angebot", aktion: "→ Angebot & Übergabedaten",
    },
    {
      titel: "Standard bleibt Standard",
      text: "„Förderband Typ A“ ist in der Bibliothek einmal definiert – ein Schnitt für alle Disziplinen. Instanzen kennen ihre Herkunft; weicht eine ab, zeigt das Werkzeug es an, statt dass es jeder anders macht.",
      tab: "bibliothek", aktion: "→ Bibliothek",
    },
    {
      titel: "Wissen bleibt im Haus",
      text: "Erfahrungswissen steht als WENN-DANN-Regeln mit Begründung im Modell („Über 80 Takte reicht die Standardpumpe nicht“). Es wirkt bei jedem Angebot automatisch – auch wenn der Kollege, der es wusste, nicht mehr da ist.",
      tab: "regeln", aktion: "→ Regeln",
    },
  ];

  const PROZESS = [
    { schritt: "Anfrage", wer: "Vertrieb", was: "Den Prozess des Kunden als Schritte aufnehmen; je Schritt Funktion und Lösungsprinzip wählen (z. B. „Spannen: pneumatisch“) – dahinter stehen die Firmenstandards, Lücken werden als Sonderlösung (ETO) sichtbar." },
    { schritt: "Angebot", wer: "Vertrieb", was: "Angebotsmappe per Klick: Maschinenbild, Lieferumfang, technische Daten, Hinweise – eine Datei für den Kunden." },
    { schritt: "Auftrag → Engineering", wer: "Mechanik / Elektrik / Software", was: "Dieselbe Konfiguration liefert jedem Gewerk seine Sicht: Strukturliste, BMK-Liste, PLC-Tags – ohne Neuerfassung." },
    { schritt: "Standardpflege", wer: "Engineering", was: "Bewährte Bausteine in die Bibliothek veröffentlichen; Erfahrungen als Regeln festhalten – das nächste Angebot kann sie schon." },
    { schritt: "Service", wer: "Service", was: "Maschinenbild und Kennzeichen je ausgelieferter Konfiguration: Wo sitzt −M2 und was ist verbaut? Steht im Modell." },
  ];

  function render(wurzel) {
    const projekt = App.projekt;

    wurzel.append(
      h("div", { class: "hero" },
        h("h2", {}, "Vom Angebot bis zum Service: eine Maschine, ein Modell."),
        h("p", {},
          "SysModeller begleitet den echten Ablauf im Maschinenbau: Der Vertrieb erfasst die Anfrage und erhält sofort ",
          "Machbarkeit, Maschinenbild und Angebotsmappe. Das Engineering arbeitet mit ", h("strong", {}, "denselben Daten"),
          " weiter – und alles, was sich bewährt, wandert als Standard in die Bibliothek und als Regel ins Modell."),
      ),
    );

    // Die vier Probleme, die das Werkzeug beantwortet
    wurzel.append(h("div", { class: "schritt-karten" },
      PROBLEME.map((p) => h("button", { class: "schritt-karte", onclick: () => App.zeigeTab(p.tab) },
        h("span", { class: "schritt-titel" }, p.titel),
        h("span", { class: "schritt-text" }, p.text),
        h("span", { class: "schritt-verweis" }, p.aktion),
      )),
    ));

    // Die Maschine auf einen Blick – Klick führt zur Struktur.
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
        "Ihre Maschine – dasselbe Bild begleitet Vertrieb (Variante zeigen), Engineering (Aufbau) und Service (Wiederfinden). Klick öffnet die Struktur."));
      wurzel.append(vorschau);
    }

    // Der Prozess von links nach rechts
    const prozessPanel = h("div", { class: "panel" }, h("h3", {}, "So läuft ein Auftrag durch das Werkzeug"));
    const tabelle = h("table", { class: "tabelle" },
      h("thead", {}, h("tr", {}, h("th", {}, "Prozessschritt"), h("th", {}, "Wer"), h("th", {}, "Was passiert hier"))));
    const rumpf = h("tbody");
    for (const p of PROZESS) {
      rumpf.append(h("tr", {},
        h("td", {}, h("strong", {}, p.schritt)),
        h("td", {}, p.wer),
        h("td", {}, p.was)));
    }
    tabelle.append(rumpf);
    prozessPanel.append(h("div", { class: "tabellen-rollen" }, tabelle));
    wurzel.append(prozessPanel);

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
        `${projekt.regeln.length} Regeln · ${projekt.konfigurationen.length} Anfragen · ` +
        `${SysM.Bibliothek.neuesteVersionen(App.bibliothek.module).length} Firmenstandards in der Bibliothek`),
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
        h("li", {}, h("strong", {}, "Formales Systemmodell"), " (SysML): entsteht automatisch mit und kann jederzeit exportiert werden (Übergabedaten)."),
      ),
      h("p", {},
        "Die Struktur ist eine ", h("strong", {}, "Maximalstruktur"), ": sie enthält alle Optionen. ",
        "Eine Anfrage ist die Antwort auf wenige Fragen – alles Weitere leiten die Regeln ab. ",
        "Kennzeichen werden immer auf der Maximalstruktur nummeriert, damit ein Bauteil in jeder Variante dasselbe Kennzeichen behält."),
      h("p", {},
        "Alles wird automatisch im Browser gespeichert. Über „Projekt speichern“ erhalten Sie eine einzelne Datei, ",
        "die sich weitergeben, ablegen und wieder öffnen lässt – die Bibliothek der Firmenstandards hat ihre eigene Datei."),
    ));
  }

  Tabs.ueberblick = { titel: "Überblick", render };
})();
