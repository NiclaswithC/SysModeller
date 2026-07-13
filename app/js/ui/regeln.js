"use strict";
/*
 * Reiter „Regeln“ (Engineering): Erfahrungswissen als WENN-DANN-Sätze, zusammengeklickt
 * statt programmiert. Der Simulator daneben zeigt live, welche Regel bei
 * welchen Antworten greift – Wirkung sofort sichtbar.
 */
(function () {
  const { h, select, feld, textEingabe, wertEingabe, infoBox, badge, leererHinweis, grossWertEingabe } = UI;
  const Model = () => SysM.Model;
  const Regeln = () => SysM.Regeln;

  function auswahl() {
    const projekt = App.projekt;
    let regel = App.auswahl.regelId ? Model().findeRegel(projekt, App.auswahl.regelId) : null;
    if (!regel && projekt.regeln.length) {
      regel = projekt.regeln[0];
      App.auswahl.regelId = regel.id;
    }
    return regel;
  }

  function testAntworten() {
    if (!App.regelTest) App.regelTest = { antworten: {} };
    return App.regelTest.antworten;
  }

  function render(wurzel) {
    const projekt = App.projekt;
    const regel = auswahl();

    wurzel.append(infoBox(
      "Eine Regel ist ein Satz: „WENN Taktleistung größer 80 DANN setze Pumpentyp = Hochleistung.“ ",
      "Stellen Sie im Simulator Beispielantworten ein – der grüne Punkt zeigt sofort, welche Regeln dann greifen. ",
      "Regeln gelten in der Reihenfolge dieser Liste, die spätere gewinnt."));

    if (!projekt.merkmale.length) {
      wurzel.append(leererHinweis("Regeln prüfen Merkmale – legen Sie zuerst unter „Merkmale“ welche an."));
      return;
    }

    // Live-Auswertung mit den Probier-Antworten
    const ergebnis = Regeln().auswerten(projekt, testAntworten());

    const liste = h("div", { class: "baum" });
    for (const r of projekt.regeln) {
      const feuert = r.aktiv !== false && Regeln().pruefeBedingungen(r.wenn, ergebnis.werte);
      liste.append(h("button", {
        class: "baum-zeile" + (regel && r.id === regel.id ? " ausgewaehlt" : ""),
        onclick: () => { App.auswahl.regelId = r.id; App.render(); },
      },
        h("span", {
          class: "punkt " + (r.aktiv === false ? "punkt-grau" : feuert ? "punkt-gruen" : "punkt-leer"),
          title: r.aktiv === false ? "inaktiv" : feuert ? "greift bei den Probier-Antworten" : "greift gerade nicht",
        }),
        h("span", { class: "baum-name" }, r.name),
        r.aktiv === false ? badge("inaktiv", "typ-inaktiv") : null,
      ));
    }
    if (!projekt.regeln.length) liste.append(leererHinweis("Noch keine Regeln."));

    const linkerTeil = h("div", { class: "panel schmal" },
      h("div", { class: "panel-kopf" },
        h("h3", {}, "Regeln"),
        h("button", {
          class: "knopf",
          onclick: () => {
            const neu = Model().neueRegel({ name: "Regel " + (projekt.regeln.length + 1) });
            projekt.regeln.push(neu);
            App.auswahl.regelId = neu.id;
            App.speichern();
            App.render();
          },
        }, "+ Regel"),
      ),
      liste,
      h("p", { class: "klein" }, "● = greift bei den aktuellen Probier-Antworten."),
      renderSimulator(projekt, ergebnis),
    );

    const container = h("div", { class: "split" });
    container.append(linkerTeil);
    container.append(regel
      ? renderDetail(projekt, regel, ergebnis)
      : h("div", { class: "panel detail" }, leererHinweis("Keine Regel ausgewählt.")));
    wurzel.append(container);
  }

  // ---- Simulator -------------------------------------------------------------

  function renderSimulator(projekt, ergebnis) {
    const fragen = projekt.merkmale.filter((m) => m.istKonfiguration);
    const block = h("div", { class: "unterblock simulator" },
      h("h4", {}, "Ausprobieren"),
      h("p", { class: "klein" }, "Beispielantworten einstellen – Liste und Häkchen reagieren sofort. Ändert nichts am Projekt."));

    if (!fragen.length) {
      block.append(h("p", { class: "klein" }, "Noch keine Fragen definiert (unter „Merkmale“ markieren)."));
      return block;
    }

    for (const mk of fragen) {
      const antworten = testAntworten();
      const wirksam = antworten[mk.id] !== undefined && antworten[mk.id] !== ""
        ? antworten[mk.id] : mk.standardwert;
      block.append(h("div", { class: "frage-block kompakt" },
        h("span", { class: "frage-titel" }, mk.name + (mk.einheit ? ` (${mk.einheit})` : "")),
        grossWertEingabe(mk, wirksam, (w) => { antworten[mk.id] = w; App.render(); }),
      ));
    }

    // Abgeleitete Werte kurz zeigen
    const abgeleitet = projekt.merkmale
      .filter((m) => !m.istKonfiguration && ergebnis.werte[m.id])
      .map((m) => `${m.name} = ${Model().merkmalWertAlsText(m, ergebnis.werte[m.id].wert)}`);
    if (abgeleitet.length) {
      block.append(h("p", { class: "klein" }, h("strong", {}, "Ergibt: "), abgeleitet.join(" · ")));
    }
    if (ergebnis.meldungen.length) {
      block.append(h("p", { class: "klein" },
        h("strong", {}, "Meldungen: "),
        ergebnis.meldungen.map((m) => m.stufe + ": " + m.text).join(" · ")));
    }
    return block;
  }

  // ---- Detail ------------------------------------------------------------------

  function verschiebeRegel(projekt, regel, richtung) {
    const i = projekt.regeln.indexOf(regel);
    const j = i + richtung;
    if (j < 0 || j >= projekt.regeln.length) return;
    projekt.regeln[i] = projekt.regeln[j];
    projekt.regeln[j] = regel;
    App.speichern();
    App.render();
  }

  function renderDetail(projekt, regel, ergebnis) {
    const detail = h("div", { class: "panel detail" });

    detail.append(h("div", { class: "panel-kopf" },
      h("h3", {}, regel.name),
      h("div", { class: "knopf-reihe" },
        h("button", { class: "knopf leise", onclick: () => verschiebeRegel(projekt, regel, -1) }, "↑"),
        h("button", { class: "knopf leise", onclick: () => verschiebeRegel(projekt, regel, +1) }, "↓"),
        h("button", {
          class: "knopf gefahr",
          onclick: () => {
            if (!confirm(`Regel „${regel.name}“ löschen?`)) return;
            projekt.regeln = projekt.regeln.filter((r) => r.id !== regel.id);
            App.auswahl.regelId = null;
            App.speichern();
            App.render();
          },
        }, "Löschen"),
      ),
    ));

    const feuert = regel.aktiv !== false && Regeln().pruefeBedingungen(regel.wenn, ergebnis.werte);
    detail.append(h("div", { class: "kennzeichen-anzeige" },
      h("strong", {}, Regeln().beschreibeRegel(regel, projekt)),
      h("div", { class: "klein", style: "margin-top:4px" },
        regel.aktiv === false
          ? "Diese Regel ist inaktiv."
          : feuert
            ? "✔ Greift bei den aktuellen Probier-Antworten."
            : "Greift bei den aktuellen Probier-Antworten nicht.")));

    detail.append(feld("Name", textEingabe(regel.name, (w) => { regel.name = w || regel.name; App.speichern(); App.render(); })));

    detail.append(h("label", { class: "radio" },
      h("input", {
        type: "checkbox", checked: regel.aktiv !== false,
        onchange: (e) => { regel.aktiv = e.target.checked; App.speichern(); App.render(); },
      }),
      " Regel ist aktiv"));

    // WENN – mit Live-Häkchen je Bedingung
    const wennBlock = h("div", { class: "unterblock" },
      h("h4", {}, "WENN"),
      h("p", { class: "klein" }, "Alle Bedingungen müssen erfüllt sein (UND). Ohne Bedingung gilt die Regel immer. ✓/✕ zeigt den Stand mit den Probier-Antworten."));
    regel.wenn.forEach((bed) => {
      const erfuellt = Regeln().pruefeBedingung(bed, ergebnis.werte);
      const eintrag = ergebnis.werte[bed.merkmalId];
      const mk = Model().findeMerkmal(projekt, bed.merkmalId);
      wennBlock.append(h("div", { class: "bedingung-status " + (erfuellt ? "erfuellt" : "nicht-erfuellt") },
        (erfuellt ? "✓ " : "✕ ") + Regeln().beschreibeBedingung(bed, projekt) +
        (eintrag && mk ? ` (aktuell: ${Model().merkmalWertAlsText(mk, eintrag.wert)})` : " (aktuell: kein Wert)")));
    });
    wennBlock.append(Tabs.struktur.renderBedingungsZeilen(projekt, regel.wenn, () => { App.speichern(); App.render(); }));
    detail.append(wennBlock);

    // DANN
    const dannBlock = h("div", { class: "unterblock" }, h("h4", {}, "DANN"));
    regel.dann.forEach((aktion, i) => {
      dannBlock.append(renderAktion(projekt, regel, aktion, i));
    });
    dannBlock.append(h("button", {
      class: "knopf leise",
      onclick: () => {
        regel.dann.push({ art: "wertSetzen", merkmalId: projekt.merkmale[0] ? projekt.merkmale[0].id : "", wert: "" });
        App.speichern();
        App.render();
      },
    }, "+ Aktion"));
    detail.append(dannBlock);

    detail.append(feld("Warum gibt es diese Regel?",
      h("textarea", { rows: 2, onchange: (e) => { regel.kommentar = e.target.value; App.speichern(); } }, regel.kommentar || ""),
      "Kurze Begründung – damit die Regel auch in fünf Jahren noch nachvollziehbar ist."));

    return detail;
  }

  function elementOptionen(projekt) {
    return Model().elementeInBaumfolge(projekt).map(({ el, tiefe }) => ({
      wert: el.id,
      text: " ".repeat(tiefe * 3) + el.name + (el.verwendung === "option" ? " (Option)" : ""),
    }));
  }

  function renderAktion(projekt, regel, aktion, index) {
    const zeile = h("div", { class: "aktion-zeile" });

    zeile.append(select(Regeln().AKTIONS_ARTEN.map((a) => ({ wert: a.code, text: a.text })), aktion.art,
      (w) => {
        regel.dann[index] = { art: w };
        if (w === "wertSetzen") regel.dann[index] = { art: w, merkmalId: projekt.merkmale[0] ? projekt.merkmale[0].id : "", wert: "" };
        if (w === "meldung") regel.dann[index] = { art: w, stufe: "Hinweis", text: "" };
        if (w === "elementAufnehmen" || w === "elementAusschliessen") {
          const erste = projekt.elemente.find((e) => e.verwendung === "option") || projekt.elemente[0];
          regel.dann[index] = { art: w, elementId: erste ? erste.id : "" };
        }
        App.speichern();
        App.render();
      }));

    if (aktion.art === "elementAufnehmen" || aktion.art === "elementAusschliessen") {
      zeile.append(select(elementOptionen(projekt), aktion.elementId,
        (w) => { aktion.elementId = w; App.speichern(); App.render(); }));
    }

    if (aktion.art === "wertSetzen") {
      const mk = Model().findeMerkmal(projekt, aktion.merkmalId);
      zeile.append(
        select(projekt.merkmale.map((m) => ({ wert: m.id, text: m.name })), aktion.merkmalId,
          (w) => { aktion.merkmalId = w; aktion.wert = ""; App.speichern(); App.render(); }),
        h("span", { class: "klein" }, "="),
        wertEingabe(mk, aktion.wert, (w) => { aktion.wert = w; App.speichern(); App.render(); }),
        h("span", { class: "klein" }, "an"),
        select([{ wert: "", text: "Anlage gesamt" }].concat(elementOptionen(projekt)), aktion.elementId || "",
          (w) => { aktion.elementId = w || undefined; App.speichern(); App.render(); }),
      );
    }

    if (aktion.art === "meldung") {
      zeile.append(
        select(Regeln().MELDUNG_STUFEN, aktion.stufe || "Hinweis", (w) => { aktion.stufe = w; App.speichern(); App.render(); }),
        textEingabe(aktion.text, (w) => { aktion.text = w; App.speichern(); App.render(); }, { placeholder: "Text der Meldung", class: "breit" }),
      );
    }

    zeile.append(h("button", {
      class: "knopf leise", title: "Aktion entfernen",
      onclick: () => { regel.dann.splice(index, 1); App.speichern(); App.render(); },
    }, "✕"));

    return zeile;
  }

  Tabs.regeln = { titel: "Regeln", render };
})();
