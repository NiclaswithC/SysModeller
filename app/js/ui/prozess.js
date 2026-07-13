"use strict";
/*
 * Reiter „Prozess“ (Vertriebssicht, erster Schritt): Der Kunde gibt seinen
 * Prozess vor. Je Prozessschritt werden Funktionen gewählt („Spannen“),
 * je Funktion das Lösungsprinzip („Pneumatisch spannen“) – dahinter stehen
 * die Firmenstandards mit Vorzugskomponenten und Parametern, oder eine
 * ETO-Hülle, wo es noch keinen Standard gibt. Ein Klick baut daraus die
 * Maschine – mit Rückverfolgbarkeit bis zur Kundenanforderung.
 */
(function () {
  const { h, select, feld, textEingabe, infoBox, badge, leererHinweis } = UI;
  const Model = () => SysM.Model;
  const Bibliothek = () => SysM.Bibliothek;
  const Prozess = () => SysM.Prozess;

  function auswahlSchritt() {
    const projekt = App.projekt;
    projekt.prozess = projekt.prozess || [];
    let schritt = App.auswahl.schrittId ? projekt.prozess.find((s) => s.id === App.auswahl.schrittId) : null;
    if (!schritt && projekt.prozess.length) {
      schritt = projekt.prozess[0];
      App.auswahl.schrittId = schritt.id;
    }
    return schritt;
  }

  function render(wurzel) {
    const projekt = App.projekt;
    const schritt = auswahlSchritt();

    wurzel.append(infoBox(
      "Hier beginnt die Anfrage: Welche Schritte hat der Prozess des Kunden? Je Schritt wählen Sie die benötigte ",
      h("strong", {}, "Funktion"), " (z. B. „Spannen“) und dann das ", h("strong", {}, "Lösungsprinzip"),
      " (pneumatisch, hydraulisch, elektrisch …). Hinter jeder Lösung steht Ihr Standardmodul mit Vorzugskomponenten – ",
      "oder eine ", h("strong", {}, "Sonderlösung (ETO)"), ", die das Engineering ausarbeitet. ",
      "„Maschine aufbauen“ erzeugt daraus die Struktur in Prozessreihenfolge."));

    const container = h("div", { class: "split" });
    container.append(renderSchritte(projekt, schritt));
    container.append(schritt
      ? renderSchrittDetail(projekt, schritt)
      : h("div", { class: "panel detail" }, leererHinweis("Legen Sie den ersten Prozessschritt an – z. B. „Zuführen“ oder „Fügen“.")));
    container.append(renderErgebnis(projekt));
    wurzel.append(container);
  }

  // ---- Schrittliste -----------------------------------------------------------

  function renderSchritte(projekt, ausgewaehlt) {
    const liste = h("div", { class: "baum" });
    projekt.prozess.forEach((s, i) => {
      const gewaehlt = (s.funktionen || []).filter((f) => f.loesungId).length;
      liste.append(h("button", {
        class: "baum-zeile" + (ausgewaehlt && s.id === ausgewaehlt.id ? " ausgewaehlt" : ""),
        onclick: () => { App.auswahl.schrittId = s.id; App.render(); },
      },
        h("span", { class: "schritt-nummer" }, String(i + 1)),
        h("span", { class: "baum-name" }, s.name),
        h("span", { class: "baum-bmk" }, gewaehlt ? gewaehlt + " Lösung(en)" : ""),
      ));
    });
    if (!projekt.prozess.length) {
      liste.append(leererHinweis("Noch keine Prozessschritte."));
    }

    return h("div", { class: "panel schmal" },
      h("div", { class: "panel-kopf" },
        h("h3", {}, "Prozess des Kunden"),
        h("button", {
          class: "knopf",
          onclick: () => {
            const neu = Prozess().neuerSchritt({ name: "Schritt " + (projekt.prozess.length + 1) });
            projekt.prozess.push(neu);
            App.auswahl.schrittId = neu.id;
            App.speichern();
            App.render();
          },
        }, "+ Schritt"),
      ),
      liste,
      h("p", { class: "klein" }, "Die Reihenfolge der Schritte wird zur Reihenfolge der Stationen (die Linie)."),
    );
  }

  // ---- Schritt-Detail: Funktionen und Lösungsprinzipien -------------------------

  function renderSchrittDetail(projekt, schritt) {
    const bibliothek = App.bibliothek;
    const panel = h("div", { class: "panel schmal" });

    panel.append(h("div", { class: "panel-kopf" },
      h("h3", {}, "Schritt: " + schritt.name),
      h("div", { class: "knopf-reihe" },
        h("button", { class: "knopf leise", title: "Nach vorn", onclick: () => verschiebeSchritt(projekt, schritt, -1) }, "↑"),
        h("button", { class: "knopf leise", title: "Nach hinten", onclick: () => verschiebeSchritt(projekt, schritt, +1) }, "↓"),
        h("button", {
          class: "knopf gefahr",
          onclick: () => {
            if (!confirm(`Prozessschritt „${schritt.name}“ entfernen? Die zugehörige Station wird beim nächsten „Maschine aufbauen“ entfernt.`)) return;
            projekt.prozess = projekt.prozess.filter((s) => s.id !== schritt.id);
            App.auswahl.schrittId = null;
            App.speichern();
            App.render();
          },
        }, "Löschen"),
      ),
    ));

    panel.append(feld("Name des Schritts",
      textEingabe(schritt.name, (w) => { schritt.name = w || schritt.name; App.speichern(); App.render(); },
        { placeholder: "z. B. Zuführen, Fügen, Prüfen" })));

    panel.append(h("h4", {}, "Benötigte Funktionen"));
    schritt.funktionen = schritt.funktionen || [];

    for (const eintrag of schritt.funktionen) {
      panel.append(renderFunktionsEintrag(projekt, schritt, eintrag, bibliothek));
    }

    const freieFunktionen = bibliothek.funktionen;
    panel.append(h("div", { class: "knopf-reihe" },
      select([{ wert: "", text: "+ Funktion wählen …" }]
        .concat(freieFunktionen.map((f) => ({ wert: f.id, text: f.name }))), "",
        (w) => {
          if (!w) return;
          schritt.funktionen.push(Prozess().neuerFunktionsEintrag({ funktionId: w }));
          App.speichern();
          App.render();
        }),
      h("button", {
        class: "knopf leise",
        onclick: () => {
          const name = prompt("Name der neuen Funktion (z. B. „Prüfen“):");
          if (!name) return;
          const funktion = Bibliothek().neueFunktion({ name });
          bibliothek.funktionen.push(funktion);
          bibliothek.loesungen.push(Bibliothek().neueLoesung({
            funktionId: funktion.id, name: "Sonderlösung", modulName: "",
            beschreibung: "Automatisch angelegt – Lösungsprinzipien in der Bibliothek pflegen.",
          }));
          schritt.funktionen.push(Prozess().neuerFunktionsEintrag({ funktionId: funktion.id }));
          App.speichern();
          App.render();
        },
      }, "Neue Funktion…"),
    ));

    return panel;
  }

  function renderFunktionsEintrag(projekt, schritt, eintrag, bibliothek) {
    const funktion = Bibliothek().findeFunktion(bibliothek, eintrag.funktionId);
    const loesungen = Bibliothek().loesungenZuFunktion(bibliothek, eintrag.funktionId);

    const block = h("div", { class: "funktion-block" });
    block.append(h("div", { class: "frage-kopf" },
      h("span", { class: "frage-titel" }, funktion ? funktion.name : "(gelöschte Funktion)"),
      h("button", {
        class: "knopf leise", title: "Funktion aus diesem Schritt entfernen",
        onclick: () => {
          schritt.funktionen = schritt.funktionen.filter((f) => f.id !== eintrag.id);
          App.speichern();
          App.render();
        },
      }, "✕"),
    ));
    if (funktion && funktion.beschreibung) block.append(h("p", { class: "klein" }, funktion.beschreibung));

    if (!loesungen.length) {
      block.append(leererHinweis("Für diese Funktion sind noch keine Lösungsprinzipien hinterlegt (Bibliothek)."));
      return block;
    }

    block.append(h("p", { class: "klein" }, "Wie soll das gelöst werden?"));
    const chips = h("div", { class: "loesung-chips" });
    for (const loesung of loesungen) {
      const modul = Bibliothek().modulZuLoesung(bibliothek, loesung);
      chips.append(h("button", {
        class: "loesung-chip" + (eintrag.loesungId === loesung.id ? " aktiv" : "") + (modul ? "" : " eto"),
        title: modul
          ? `Standard „${modul.name}“ v${modul.version} mit Vorzugskomponenten` + (modul.beschreibung ? " – " + modul.beschreibung : "")
          : "Noch kein Standard – es entsteht eine Hülle für das Engineering (ETO).",
        onclick: () => {
          eintrag.loesungId = eintrag.loesungId === loesung.id ? "" : loesung.id;
          App.speichern();
          App.render();
        },
      },
        loesung.name,
        modul ? badge("Standard v" + modul.version, "typ-merkmal") : badge("ETO", "typ-eto"),
      ));
    }
    block.append(chips);
    return block;
  }

  function verschiebeSchritt(projekt, schritt, richtung) {
    const i = projekt.prozess.indexOf(schritt);
    const j = i + richtung;
    if (j < 0 || j >= projekt.prozess.length) return;
    projekt.prozess[i] = projekt.prozess[j];
    projekt.prozess[j] = schritt;
    App.speichern();
    App.render();
  }

  // ---- Ergebnis: Maschine aufbauen ------------------------------------------------

  function renderErgebnis(projekt) {
    const panel = h("div", { class: "panel detail" });
    const generierteVorhanden = projekt.elemente.some((e) => e.generiert);
    panel.append(h("div", { class: "panel-kopf" },
      h("h3", {}, "Daraus wird die Maschine"),
      h("button", {
        class: "knopf",
        disabled: !projekt.prozess.length && !generierteVorhanden,
        onclick: () => {
          const bericht = SysM.Prozess.erzeugeStruktur(projekt, App.bibliothek);
          App.speichern();
          App.letzterProzessBericht = bericht;
          App.render();
        },
      }, "Maschine aufbauen / aktualisieren"),
    ));

    if (!projekt.prozess.length) {
      panel.append(leererHinweis(
        "Sobald Prozessschritte und Lösungen gewählt sind, entsteht hier die Maschine – je Schritt eine Station, " +
        "darin die Standardmodule (mit Vorzugskomponenten, Signalen und Parametern) bzw. ETO-Hüllen."));
      return panel;
    }

    // Maschinenbild (aktueller Strukturstand)
    const kennzeichen = SysM.Kennzeichnung.berechneKennzeichen(projekt);
    panel.append(Maschinenbild.render(projekt, {
      kennzeichen,
      maxHoehe: 280,
      onKlick: (el) => {
        if (el) { App.auswahl.elementId = el.id; App.zeigeTab("struktur"); }
      },
    }));

    const etoListe = SysM.Prozess.etoElemente(projekt, null);
    panel.append(h("p", { class: "klein" },
      etoListe.length
        ? `⚠ ${etoListe.length} Sonderlösung(en) (ETO): ${etoListe.map((e) => `„${e.name}“`).join(", ")} – hier entsteht Engineering-Aufwand.`
        : "Alle gewählten Lösungen sind Firmenstandards – die Maschine ist durchgängig konfigurierbar (CTO)."));

    if (App.letzterProzessBericht && App.letzterProzessBericht.length) {
      const bericht = h("details", { class: "unterblock-details", open: "" },
        h("summary", {}, "Was wurde geändert?"));
      const listeEl = h("ul", { class: "abweichungs-liste" });
      for (const zeile of App.letzterProzessBericht) listeEl.append(h("li", {}, zeile));
      bericht.append(listeEl);
      panel.append(bericht);
    }

    panel.append(h("p", { class: "klein" },
      "Weiter geht es im Reiter „Angebot“: Dort werden die Parameter der gewählten Module abgefragt (Ausprägung), ",
      "die Regeln prüfen die Machbarkeit, und die Angebotsmappe fasst alles zusammen. ",
      "Von Hand ergänzte Elemente (z. B. aus der Struktur-Sicht) bleiben beim Aktualisieren erhalten."));

    return panel;
  }

  Tabs.prozess = { titel: "Prozess", render };
})();
