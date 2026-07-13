"use strict";
/*
 * Reiter „5 · Kennzeichnung“: zeigt die automatisch berechneten
 * Betriebsmittelkennzeichen (BMK) und PLC-Tags – wahlweise für die
 * Maximalstruktur oder eine konkrete Konfiguration.
 */
(function () {
  const { h, select, feld, textEingabe, infoBox, meldungBox, leererHinweis } = UI;
  const Model = () => SysM.Model;

  function bereichsWahl() {
    const projekt = App.projekt;
    const optionen = [{ wert: "", text: "Maximalstruktur (alle Optionen)" }]
      .concat(projekt.konfigurationen.map((k) => ({ wert: k.id, text: "Konfiguration: " + k.name })));
    return UI.feld("Anzeigen für",
      select(optionen, App.aktiveKonfigId || "", (w) => { App.aktiveKonfigId = w; App.speichern(); App.render(); }),
      "Die Nummerierung wird immer auf der Maximalstruktur berechnet – Kennzeichen bleiben in jeder Variante gleich.");
  }

  function aktuellesErgebnis() {
    const projekt = App.projekt;
    if (!App.aktiveKonfigId) return null;
    const konfig = Model().findeKonfiguration(projekt, App.aktiveKonfigId);
    if (!konfig) { App.aktiveKonfigId = ""; return null; }
    return SysM.Regeln.auswerten(projekt, konfig.antworten);
  }

  function render(wurzel) {
    const projekt = App.projekt;
    const ergebnis = aktuellesErgebnis();
    const kennzeichen = SysM.Kennzeichnung.berechneKennzeichen(projekt);
    const tags = SysM.Kennzeichnung.plcTags(projekt, kennzeichen, ergebnis ? ergebnis.elementStatus : null);
    const konflikte = SysM.Kennzeichnung.pruefeKonflikte(projekt, kennzeichen, tags);

    wurzel.append(infoBox(
      "Kennzeichen entstehen vollständig aus der Struktur – niemand vergibt sie von Hand, nichts wird doppelt oder vergessen. ",
      "Aufbau: Funktion (=, aus den Funktionskürzeln), Ort (+, vererbt) und Betriebsmittel (−, Produktklasse mit laufender Nummer). ",
      "PLC-Tags werden aus demselben Kennzeichen abgeleitet – Elektroplanung und Steuerungstechnik sprechen damit dieselbe Sprache."));

    const einstellungen = h("div", { class: "panel" },
      h("h3", {}, "Einstellungen"),
      h("div", { class: "einstellungs-reihe" },
        bereichsWahl(),
        feld("Trennzeichen im Funktionspfad",
          textEingabe(projekt.kennzeichnung.trennerFunktion, (w) => {
            projekt.kennzeichnung.trennerFunktion = w || ".";
            App.speichern();
            App.render();
          }, { maxlength: 3, class: "sehr-schmal" }),
          "Üblich: Punkt (=ABF.DOS)."),
        h("label", { class: "radio" },
          h("input", {
            type: "checkbox", checked: projekt.kennzeichnung.plcAdressenAutomatisch,
            onchange: (e) => { projekt.kennzeichnung.plcAdressenAutomatisch = e.target.checked; App.speichern(); App.render(); },
          }),
          " PLC-Adressen automatisch vergeben (%I/%Q, in Strukturreihenfolge)"),
      ),
    );
    wurzel.append(einstellungen);

    for (const k of konflikte) wurzel.append(meldungBox(k.stufe, k.text));

    // Maschinenbild mit eingeblendeten Kennzeichen
    const bildPanel = h("div", { class: "panel" }, h("h3", {}, "Kennzeichen am Maschinenbild"));
    bildPanel.append(Maschinenbild.render(projekt, {
      status: ergebnis ? ergebnis.elementStatus : null,
      kennzeichen,
      zeigeBmk: true,
      maxHoehe: 320,
      onKlick: (el) => {
        if (el) { App.auswahl.elementId = el.id; App.zeigeTab("struktur"); }
      },
    }));
    bildPanel.append(h("p", { class: "klein" }, "Jede Komponente trägt ihr Kennzeichen. Klick auf einen Block führt zu Schritt 1."));
    wurzel.append(bildPanel);

    // BMK-Tabelle
    const bmkPanel = h("div", { class: "panel" }, h("h3", {}, "Betriebsmittelkennzeichen (BMK)"));
    const bmkTabelle = h("table", { class: "tabelle" },
      h("thead", {}, h("tr", {},
        h("th", {}, "Kennzeichen"), h("th", {}, "Name"), h("th", {}, "Ebene"),
        h("th", {}, "Funktion (=)"), h("th", {}, "Ort (+)"), h("th", {}, "Betriebsmittel (−)"),
        ergebnis ? h("th", {}, "Enthalten") : null)));
    const bmkRumpf = h("tbody");
    for (const { el, tiefe } of Model().elementeInBaumfolge(projekt)) {
      const kz = kennzeichen[el.id] || {};
      const status = ergebnis ? ergebnis.elementStatus[el.id] : null;
      bmkRumpf.append(h("tr", { class: status && !status.effektivEnthalten ? "nicht-enthalten" : "" },
        h("td", {}, h("code", {}, kz.bmk || "")),
        h("td", { style: "padding-left:" + (10 + tiefe * 14) + "px" }, el.name),
        h("td", {}, el.typ),
        h("td", {}, kz.funktion || ""),
        h("td", {}, kz.ort || ""),
        h("td", {}, kz.produkt || ""),
        ergebnis ? h("td", {}, status && status.effektivEnthalten ? "ja" : "nein") : null,
      ));
    }
    bmkTabelle.append(bmkRumpf);
    bmkPanel.append(h("div", { class: "tabellen-rollen" }, bmkTabelle));
    wurzel.append(bmkPanel);

    // PLC-Tags
    const tagPanel = h("div", { class: "panel" },
      h("h3", {}, "PLC-Tags" + (ergebnis ? " (nur enthaltene Komponenten)" : " (Maximalstruktur)")));
    if (!tags.length) {
      tagPanel.append(leererHinweis("Keine Signale vorhanden. Signale werden in Schritt 1 an den Komponenten gepflegt."));
    } else {
      const tagTabelle = h("table", { class: "tabelle" },
        h("thead", {}, h("tr", {},
          h("th", {}, "Tag-Name"), h("th", {}, "Datentyp"), h("th", {}, "Richtung"),
          h("th", {}, "Adresse"), h("th", {}, "Kennzeichen"), h("th", {}, "Kommentar"))));
      const tagRumpf = h("tbody");
      for (const tag of tags) {
        tagRumpf.append(h("tr", {},
          h("td", {}, h("code", {}, tag.name)),
          h("td", {}, tag.datentyp),
          h("td", {}, tag.richtung === "A" ? "Ausgang" : "Eingang"),
          h("td", {}, h("code", {}, tag.adresse || "–")),
          h("td", {}, h("code", {}, tag.bmk)),
          h("td", {}, tag.kommentar),
        ));
      }
      tagTabelle.append(tagRumpf);
      tagPanel.append(h("div", { class: "tabellen-rollen" }, tagTabelle));
    }
    wurzel.append(tagPanel);
  }

  Tabs.kennzeichnung = { titel: "5 · Kennzeichnung", render };
})();
