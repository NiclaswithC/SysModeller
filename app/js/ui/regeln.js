"use strict";
/*
 * Reiter „3 · Regeln“: Erfahrungswissen als WENN-DANN-Sätze, zusammengeklickt
 * statt programmiert. Die Vorschau zeigt jede Regel als lesbaren Satz.
 */
(function () {
  const { h, select, feld, textEingabe, wertEingabe, infoBox, badge, leererHinweis } = UI;
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

  function render(wurzel) {
    const projekt = App.projekt;
    const regel = auswahl();

    wurzel.append(infoBox(
      "Eine Regel ist ein Satz: „WENN Taktleistung größer 80 DANN setze Pumpentyp = Hochleistung.“ ",
      "Regeln können Werte setzen, Optionen aufnehmen oder ausschließen und Meldungen ausgeben. ",
      "Sie werden bei jeder Variante automatisch angewendet – in der Reihenfolge dieser Liste, die spätere Regel gewinnt."));

    if (!projekt.merkmale.length) {
      wurzel.append(leererHinweis("Regeln prüfen Merkmale – legen Sie zuerst in Schritt 2 Merkmale an."));
      return;
    }

    const liste = h("div", { class: "baum" });
    for (const r of projekt.regeln) {
      liste.append(h("button", {
        class: "baum-zeile" + (regel && r.id === regel.id ? " ausgewaehlt" : ""),
        onclick: () => { App.auswahl.regelId = r.id; App.render(); },
      },
        h("span", { class: "baum-name" }, r.name),
        r.aktiv === false ? badge("inaktiv", "typ-inaktiv") : null,
      ));
    }
    if (!projekt.regeln.length) liste.append(leererHinweis("Noch keine Regeln."));

    const linkerTeil = h("div", { class: "panel" },
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
      h("p", { class: "klein" }, "Reihenfolge ändern: Regel auswählen und im Detail ↑ / ↓ verwenden."),
    );

    const container = h("div", { class: "split" });
    container.append(linkerTeil);
    container.append(regel ? renderDetail(projekt, regel) : h("div", { class: "panel" }, leererHinweis("Keine Regel ausgewählt.")));
    wurzel.append(container);
  }

  function verschiebeRegel(projekt, regel, richtung) {
    const i = projekt.regeln.indexOf(regel);
    const j = i + richtung;
    if (j < 0 || j >= projekt.regeln.length) return;
    projekt.regeln[i] = projekt.regeln[j];
    projekt.regeln[j] = regel;
    App.speichern();
    App.render();
  }

  function renderDetail(projekt, regel) {
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

    detail.append(h("div", { class: "kennzeichen-anzeige" },
      h("strong", {}, Regeln().beschreibeRegel(regel, projekt))));

    detail.append(feld("Name", textEingabe(regel.name, (w) => { regel.name = w || regel.name; App.speichern(); App.render(); })));

    detail.append(h("label", { class: "radio" },
      h("input", {
        type: "checkbox", checked: regel.aktiv !== false,
        onchange: (e) => { regel.aktiv = e.target.checked; App.speichern(); App.render(); },
      }),
      " Regel ist aktiv"));

    // WENN
    const wennBlock = h("div", { class: "unterblock" },
      h("h4", {}, "WENN"),
      h("p", { class: "klein" }, "Alle Bedingungen müssen erfüllt sein (UND). Ohne Bedingung gilt die Regel immer."));
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
      text: " ".repeat(tiefe * 3) + el.name + (el.verwendung === "option" ? " (Option)" : ""),
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

  Tabs.regeln = { titel: "3 · Regeln", render };
})();
