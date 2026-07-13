"use strict";
/*
 * Reiter „4 · Varianten“: Fragen mit Schaltern und Reglern beantworten –
 * das Maschinenbild zeigt sofort, welche Maschine daraus wird.
 */
(function () {
  const { h, feld, textEingabe, infoBox, badge, meldungBox, leererHinweis, grossWertEingabe } = UI;
  const Model = () => SysM.Model;
  const Regeln = () => SysM.Regeln;

  function auswahl() {
    const projekt = App.projekt;
    let konfig = App.auswahl.konfigId ? Model().findeKonfiguration(projekt, App.auswahl.konfigId) : null;
    if (!konfig && projekt.konfigurationen.length) {
      konfig = projekt.konfigurationen[0];
      App.auswahl.konfigId = konfig.id;
    }
    return konfig;
  }

  function render(wurzel) {
    const projekt = App.projekt;
    const konfig = auswahl();
    const fragen = projekt.merkmale.filter((m) => m.istKonfiguration);

    wurzel.append(infoBox(
      "Eine Konfiguration ist eine konkrete Maschine: Fragen beantworten, fertig. ",
      "Das Bild rechts zeigt sofort, welche Bausteine die Maschine bekommt – ausgegraut, was entfällt. ",
      "Jede Entscheidung ist im Protokoll begründet."));

    if (!fragen.length) {
      wurzel.append(leererHinweis(
        "Es gibt noch keine Fragen: Markieren Sie in Schritt 2 mindestens ein Merkmal als „Frage an den Vertrieb/Kunden“."));
      return;
    }

    const liste = h("div", { class: "baum" });
    for (const k of projekt.konfigurationen) {
      liste.append(h("button", {
        class: "baum-zeile" + (konfig && k.id === konfig.id ? " ausgewaehlt" : ""),
        onclick: () => { App.auswahl.konfigId = k.id; App.render(); },
      },
        h("span", { class: "baum-name" }, k.name),
        App.aktiveKonfigId === k.id ? badge("aktiv für Schritt 5/6", "typ-option") : null,
      ));
    }
    if (!projekt.konfigurationen.length) liste.append(leererHinweis("Noch keine Konfiguration – legen Sie die erste an."));

    const linkerTeil = h("div", { class: "panel schmal" },
      h("div", { class: "panel-kopf" },
        h("h3", {}, "Konfigurationen"),
        h("button", {
          class: "knopf",
          onclick: () => {
            const neu = Model().neueKonfiguration({ name: "Konfiguration " + (projekt.konfigurationen.length + 1) });
            projekt.konfigurationen.push(neu);
            App.auswahl.konfigId = neu.id;
            App.speichern();
            App.render();
          },
        }, "+ Neu"),
      ),
      liste,
    );

    const container = h("div", { class: "split" });
    container.append(linkerTeil);
    if (konfig) {
      const ergebnis = Regeln().auswerten(projekt, konfig.antworten);
      container.append(renderFragen(projekt, konfig, fragen));
      container.append(renderErgebnis(projekt, konfig, ergebnis));
    } else {
      container.append(h("div", { class: "panel" }, leererHinweis("Keine Konfiguration ausgewählt.")));
    }
    wurzel.append(container);
  }

  function renderFragen(projekt, konfig, fragen) {
    const panel = h("div", { class: "panel schmal" });
    panel.append(h("div", { class: "panel-kopf" },
      h("h3", {}, "Fragen"),
      h("div", { class: "knopf-reihe" },
        h("button", {
          class: "knopf leise",
          onclick: () => {
            const kopie = Model().neueKonfiguration({
              name: konfig.name + " (Kopie)",
              antworten: Object.assign({}, konfig.antworten),
              kommentar: konfig.kommentar,
            });
            projekt.konfigurationen.push(kopie);
            App.auswahl.konfigId = kopie.id;
            App.speichern();
            App.render();
          },
        }, "Duplizieren"),
        h("button", {
          class: "knopf gefahr",
          onclick: () => {
            if (!confirm(`Konfiguration „${konfig.name}“ löschen?`)) return;
            projekt.konfigurationen = projekt.konfigurationen.filter((k) => k.id !== konfig.id);
            if (App.aktiveKonfigId === konfig.id) App.aktiveKonfigId = "";
            App.auswahl.konfigId = null;
            App.speichern();
            App.render();
          },
        }, "Löschen"),
      ),
    ));

    panel.append(feld("Name der Konfiguration",
      textEingabe(konfig.name, (w) => { konfig.name = w || konfig.name; App.speichern(); App.render(); })));

    for (const mk of fragen) {
      const antwort = konfig.antworten[mk.id];
      const beantwortet = antwort !== undefined && antwort !== "";
      const wirksam = beantwortet ? antwort : mk.standardwert;

      const frage = h("div", { class: "frage-block" });
      frage.append(h("div", { class: "frage-kopf" },
        h("span", { class: "frage-titel" }, mk.name + (mk.einheit ? ` (${mk.einheit})` : "")),
        beantwortet
          ? h("button", {
              class: "frage-zuruecksetzen", title: "Antwort löschen, Standardwert verwenden",
              onclick: () => { delete konfig.antworten[mk.id]; App.speichern(); App.render(); },
            }, "auf Standard zurück")
          : h("span", { class: "frage-standard" }, "Standard"),
      ));
      frage.append(grossWertEingabe(mk, wirksam, (w) => {
        konfig.antworten[mk.id] = w;
        App.speichern();
        App.render();
      }));
      if (mk.kommentar) frage.append(h("p", { class: "klein" }, mk.kommentar));
      panel.append(frage);
    }

    panel.append(h("button", {
      class: "knopf" + (App.aktiveKonfigId === konfig.id ? " leise" : ""),
      onclick: () => { App.aktiveKonfigId = konfig.id; App.speichern(); App.render(); },
    }, App.aktiveKonfigId === konfig.id ? "✓ Wird in Schritt 5/6 verwendet" : "In Schritt 5/6 verwenden"));

    return panel;
  }

  function renderErgebnis(projekt, konfig, ergebnis) {
    const panel = h("div", { class: "panel detail" });
    panel.append(h("h3", {}, "So sieht „" + konfig.name + "“ aus"));

    for (const m of ergebnis.meldungen) panel.append(meldungBox(m.stufe, m.text));
    if (!ergebnis.meldungen.length) panel.append(h("p", { class: "gut" }, "✓ Keine Meldungen – die Konfiguration ist zulässig."));

    // Maschinenbild mit ausgegrauten Optionen
    const kennzeichen = SysM.Kennzeichnung.berechneKennzeichen(projekt);
    panel.append(Maschinenbild.render(projekt, {
      status: ergebnis.elementStatus,
      kennzeichen,
      maxHoehe: 300,
      onKlick: (el) => {
        if (el) { App.auswahl.elementId = el.id; App.zeigeTab("struktur"); }
      },
    }));
    const entfallen = projekt.elemente.filter((e) => ergebnis.elementStatus[e.id] && !ergebnis.elementStatus[e.id].effektivEnthalten);
    panel.append(h("p", { class: "klein" }, entfallen.length
      ? "Ausgegraut (nicht in dieser Variante): " + entfallen.filter((e) => {
          const eltern = Model().findeElement(projekt, e.elternId);
          return !eltern || (ergebnis.elementStatus[eltern.id] && ergebnis.elementStatus[eltern.id].effektivEnthalten);
        }).map((e) => `„${e.name}“`).join(", ") + ". Klick auf einen Block führt zu Schritt 1."
      : "Alle Bausteine der Maximalstruktur sind enthalten."));

    // Umfang als Liste (eingeklappt)
    const umfang = h("details", { class: "unterblock-details" },
      h("summary", {}, "Maschinenumfang als Liste"));
    for (const { el, tiefe } of Model().elementeInBaumfolge(projekt)) {
      const status = ergebnis.elementStatus[el.id];
      const zeile = h("div", {
        class: "ergebnis-zeile" + (status.effektivEnthalten ? "" : " nicht-enthalten"),
        style: "padding-left:" + (tiefe * 22) + "px",
      },
        h("span", { class: "ergebnis-symbol" }, status.effektivEnthalten ? "✓" : "✕"),
        h("span", {}, el.name),
      );
      if (el.verwendung === "option" || !status.effektivEnthalten) {
        zeile.append(h("span", { class: "ergebnis-grund" }, " – " + status.grund));
      }
      umfang.append(zeile);
    }
    panel.append(umfang);

    // Ermittelte Werte
    const werteBlock = h("div", { class: "unterblock" }, h("h4", {}, "Ermittelte Werte"));
    const tabelle = h("table", { class: "tabelle" },
      h("thead", {}, h("tr", {}, h("th", {}, "Merkmal"), h("th", {}, "Wert"), h("th", {}, "Woher?"))));
    const rumpf = h("tbody");
    for (const mk of projekt.merkmale) {
      const eintrag = ergebnis.werte[mk.id];
      if (!eintrag) continue;
      const quelle = eintrag.quelle.art === "Regel" ? `Regel „${eintrag.quelle.regelName}“` :
        eintrag.quelle.art === "Antwort" ? "Ihre Antwort" : "Standardwert";
      rumpf.append(h("tr", {},
        h("td", {}, mk.name),
        h("td", {}, Model().merkmalWertAlsText(mk, eintrag.wert)),
        h("td", {}, quelle)));
    }
    for (const [elId, werte] of Object.entries(ergebnis.elementWerte)) {
      const el = Model().findeElement(projekt, elId);
      for (const [mkId, eintrag] of Object.entries(werte)) {
        const mk = Model().findeMerkmal(projekt, mkId);
        const regel = Model().findeRegel(projekt, eintrag.regelId);
        rumpf.append(h("tr", {},
          h("td", {}, (mk ? mk.name : "?") + " an „" + (el ? el.name : "?") + "“"),
          h("td", {}, mk ? Model().merkmalWertAlsText(mk, eintrag.wert) : String(eintrag.wert)),
          h("td", {}, regel ? `Regel „${regel.name}“` : "Regel")));
      }
    }
    tabelle.append(rumpf);
    werteBlock.append(tabelle);
    panel.append(werteBlock);

    // Protokoll
    const protokoll = h("details", { class: "protokoll" },
      h("summary", {}, `Warum ist das Ergebnis so? Protokoll ansehen (${ergebnis.trace.length} Schritte)`));
    const protokollListe = h("ol", {});
    for (const schritt of ergebnis.trace) {
      protokollListe.append(h("li", {}, schritt.text));
    }
    protokoll.append(protokollListe);
    panel.append(protokoll);

    panel.append(feld("Kommentar zur Konfiguration",
      h("textarea", { rows: 2, onchange: (e) => { konfig.kommentar = e.target.value; App.speichern(); } }, konfig.kommentar || "")));

    return panel;
  }

  Tabs.varianten = { titel: "4 · Varianten", render };
})();
