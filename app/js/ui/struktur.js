"use strict";
/*
 * Reiter „1 · Struktur“: Anlagengliederung als Baum, rechts die Angaben
 * zum ausgewählten Element. Hier werden auch Merkmalwerte, Signale und
 * die Options-Bedingung eines Elements gepflegt.
 */
(function () {
  const { h, select, feld, textEingabe, wertEingabe, infoBox, badge, leererHinweis } = UI;
  const Model = () => SysM.Model;

  const TYP_KLASSE = {
    Anlage: "typ-anlage", Teilanlage: "typ-teilanlage", Station: "typ-station",
    Baugruppe: "typ-baugruppe", Komponente: "typ-komponente",
  };

  const KIND_TYP_VORSCHLAG = {
    Anlage: "Station", Teilanlage: "Station", Station: "Komponente",
    Baugruppe: "Komponente", Komponente: "Komponente",
  };

  function auswahl() {
    const projekt = App.projekt;
    let el = App.auswahl.elementId ? Model().findeElement(projekt, App.auswahl.elementId) : null;
    if (!el && projekt.elemente.length) {
      el = projekt.elemente.find((e) => !e.elternId) || projekt.elemente[0];
      App.auswahl.elementId = el.id;
    }
    return el;
  }

  function render(wurzel) {
    const projekt = App.projekt;
    const el = auswahl();
    const kennzeichen = SysM.Kennzeichnung.berechneKennzeichen(projekt);

    wurzel.append(infoBox(
      "Gliedern Sie die Anlage von grob nach fein – wie Sie sie auch einem Kollegen erklären würden. ",
      "Die Reihenfolge im Baum bestimmt die automatische Nummerierung der Kennzeichen. ",
      "Bausteine, die nicht jede Maschine bekommt, markieren Sie als „Option“."));

    const container = h("div", { class: "split" });
    container.append(renderBaum(projekt, el, kennzeichen));
    container.append(el ? renderDetail(projekt, el, kennzeichen) : h("div", { class: "panel" }, leererHinweis("Kein Element ausgewählt.")));
    wurzel.append(container);
  }

  // ---- Baum ----------------------------------------------------------------

  function renderBaum(projekt, ausgewaehlt, kennzeichen) {
    const liste = h("div", { class: "baum" });
    for (const { el, tiefe } of Model().elementeInBaumfolge(projekt)) {
      const kz = kennzeichen[el.id];
      liste.append(h("button", {
        class: "baum-zeile" + (ausgewaehlt && el.id === ausgewaehlt.id ? " ausgewaehlt" : ""),
        style: "padding-left:" + (10 + tiefe * 22) + "px",
        onclick: () => { App.auswahl.elementId = el.id; App.render(); },
      },
        h("span", { class: "baum-name" }, el.name),
        badge(el.typ, TYP_KLASSE[el.typ] || ""),
        el.verwendung === "option" ? badge("Option", "typ-option") : null,
        h("span", { class: "baum-bmk" }, kz ? kz.bmk : ""),
      ));
    }

    return h("div", { class: "panel" },
      h("div", { class: "panel-kopf" },
        h("h3", {}, "Anlagengliederung"),
        h("button", {
          class: "knopf",
          onclick: () => neuesElementAnlegen(projekt, ausgewaehlt),
        }, "+ Unterelement"),
      ),
      liste,
      h("p", { class: "klein" }, "Ein Element anklicken, um es rechts zu bearbeiten."),
    );
  }

  function neuesElementAnlegen(projekt, ausgewaehlt) {
    const eltern = ausgewaehlt && ausgewaehlt.typ !== "Komponente"
      ? ausgewaehlt
      : (ausgewaehlt ? Model().findeElement(projekt, ausgewaehlt.elternId) : null);
    const typ = eltern ? (KIND_TYP_VORSCHLAG[eltern.typ] || "Station") : "Anlage";
    const neu = Model().neuesElement({
      name: "Neues Element",
      typ,
      elternId: eltern ? eltern.id : null,
    });
    projekt.elemente.push(neu);
    App.auswahl.elementId = neu.id;
    App.speichern();
    App.render();
  }

  // ---- Detail ---------------------------------------------------------------

  function renderDetail(projekt, el, kennzeichen) {
    const kz = kennzeichen[el.id] || {};
    const istKomponente = el.typ === "Komponente";

    const detail = h("div", { class: "panel detail" });

    detail.append(h("div", { class: "panel-kopf" },
      h("h3", {}, el.name),
      h("div", { class: "knopf-reihe" },
        h("button", { class: "knopf leise", onclick: () => { Model().verschiebeElement(projekt, el.id, -1); App.speichern(); App.render(); } }, "↑"),
        h("button", { class: "knopf leise", onclick: () => { Model().verschiebeElement(projekt, el.id, +1); App.speichern(); App.render(); } }, "↓"),
        h("button", {
          class: "knopf gefahr",
          onclick: () => {
            const anzahl = 1 + Model().elementeInBaumfolge(projekt).filter(({ el: e }) => Model().istNachfahre(projekt, el.id, e.id)).length - 1;
            const frage = anzahl > 1
              ? `„${el.name}“ und ${anzahl - 1} untergeordnete Elemente löschen?`
              : `„${el.name}“ löschen?`;
            if (!confirm(frage)) return;
            Model().entferneElement(projekt, el.id);
            App.auswahl.elementId = el.elternId || null;
            App.speichern();
            App.render();
          },
        }, "Löschen"),
      ),
    ));

    detail.append(h("div", { class: "kennzeichen-anzeige" },
      "Kennzeichen: ", h("strong", {}, kz.bmk || "(noch unvollständig)"),
      h("span", { class: "feld-hinweis" }, " – wird automatisch aus der Struktur berechnet"),
    ));

    detail.append(feld("Name", textEingabe(el.name, (w) => { el.name = w || el.name; App.speichern(); App.render(); })));

    detail.append(feld("Ebene",
      select(Model().ELEMENT_TYPEN, el.typ, (w) => { el.typ = w; App.speichern(); App.render(); }),
      "Anlage → Teilanlage → Station → Baugruppe → Komponente. Komponenten sind die konkreten Betriebsmittel (Motor, Sensor, Ventil …)."));

    if (!istKomponente) {
      detail.append(feld("Funktionskürzel",
        textEingabe(el.kuerzel, (w) => { el.kuerzel = w.toUpperCase().trim(); App.speichern(); App.render(); }, { placeholder: "z. B. DOS" }),
        "Kurzzeichen für den Funktionsteil des Kennzeichens, z. B. DOS für Dosieren. Gleiche Kürzel auf einer Ebene werden automatisch nummeriert."));
    } else {
      const klassen = [{ wert: "", text: "– bitte wählen –" }]
        .concat(Model().PRODUKT_KLASSEN.map((k) => ({ wert: k.code, text: k.code + " – " + k.text })));
      if (el.produktKlasse && !Model().PRODUKT_KLASSEN.some((k) => k.code === el.produktKlasse)) {
        klassen.push({ wert: el.produktKlasse, text: el.produktKlasse + " – (eigene Klasse)" });
      }
      detail.append(feld("Produktklasse",
        select(klassen, el.produktKlasse, (w) => { el.produktKlasse = w; App.speichern(); App.render(); }),
        "Kennbuchstabe nach IEC 81346-2. Die laufende Nummer (M1, M2, …) vergibt das Werkzeug."));
    }

    detail.append(feld("Ortskennzeichen (+)",
      textEingabe(el.ort, (w) => { el.ort = w.trim(); App.speichern(); App.render(); }, { placeholder: "z. B. S1 oder F1" }),
      "Wo sitzt das? (Schaltschrank S1, Feld F1 …). Leer = vom übergeordneten Element geerbt" + (kz.ort ? ` – aktuell wirksam: ${kz.ort}` : "") + "."));

    detail.append(renderVerwendung(projekt, el));
    detail.append(renderMerkmalwerte(projekt, el));
    if (istKomponente) detail.append(renderSignale(projekt, el));

    detail.append(feld("Kommentar",
      h("textarea", { rows: 2, onchange: (e) => { el.kommentar = e.target.value; App.speichern(); } }, el.kommentar || ""),
      "Freitext, z. B. Herkunft oder Randbedingungen."));

    return detail;
  }

  // ---- Verwendung / Options-Bedingung ---------------------------------------

  function renderVerwendung(projekt, el) {
    const block = h("div", { class: "unterblock" }, h("h4", {}, "Verwendung"));

    const radioName = "verwendung-" + el.id;
    block.append(
      h("label", { class: "radio" },
        h("input", {
          type: "radio", name: radioName, checked: el.verwendung !== "option",
          onchange: () => { el.verwendung = "standard"; App.speichern(); App.render(); },
        }),
        " Standardumfang – ist in jeder Maschine enthalten"),
      h("label", { class: "radio" },
        h("input", {
          type: "radio", name: radioName, checked: el.verwendung === "option",
          onchange: () => { el.verwendung = "option"; App.speichern(); App.render(); },
        }),
        " Option – nur enthalten, wenn die Bedingung erfüllt ist"),
    );

    if (el.verwendung === "option") {
      if (!projekt.merkmale.length) {
        block.append(leererHinweis("Es gibt noch keine Merkmale. Legen Sie zuerst in Schritt 2 ein Merkmal an (z. B. „Etikettierung Ja/Nein“)."));
      } else {
        block.append(h("p", { class: "klein" }, "Enthalten, wenn alle folgenden Bedingungen erfüllt sind:"));
        block.append(renderBedingungsZeilen(projekt, el.bedingung, () => { App.speichern(); App.render(); }));
      }
    }
    return block;
  }

  /** Bedingungs-Editor (wird auch vom Regel-Reiter genutzt). */
  function renderBedingungsZeilen(projekt, bedingungen, onAenderung) {
    const behaelter = h("div", { class: "bedingungen" });
    bedingungen.forEach((bed, i) => {
      const mk = Model().findeMerkmal(projekt, bed.merkmalId);
      behaelter.append(h("div", { class: "bedingung-zeile" },
        select(projekt.merkmale.map((m) => ({ wert: m.id, text: m.name })), bed.merkmalId,
          (w) => { bed.merkmalId = w; bed.wert = ""; onAenderung(); }),
        select(SysM.Regeln.OPS.map((o) => ({ wert: o.code, text: o.text })), bed.op || "=",
          (w) => { bed.op = w; onAenderung(); }),
        wertEingabe(mk, bed.wert, (w) => { bed.wert = w; onAenderung(); }),
        h("button", { class: "knopf leise", title: "Bedingung entfernen", onclick: () => { bedingungen.splice(i, 1); onAenderung(); } }, "✕"),
      ));
    });
    behaelter.append(h("button", {
      class: "knopf leise",
      onclick: () => {
        if (!projekt.merkmale.length) return;
        bedingungen.push({ merkmalId: projekt.merkmale[0].id, op: "=", wert: "" });
        onAenderung();
      },
    }, "+ Bedingung"));
    return behaelter;
  }

  // ---- Merkmalwerte ----------------------------------------------------------

  function renderMerkmalwerte(projekt, el) {
    const block = h("div", { class: "unterblock" },
      h("h4", {}, "Merkmalwerte an diesem Element"),
      h("p", { class: "klein" }, "Feste Werte dieses Elements. Merkmale selbst werden in Schritt 2 definiert; Regeln können Werte je Variante überschreiben."));

    const eintraege = Object.entries(el.merkmalwerte || {});
    if (eintraege.length) {
      const tabelle = h("table", { class: "tabelle" },
        h("thead", {}, h("tr", {}, h("th", {}, "Merkmal"), h("th", {}, "Wert"), h("th", {}, "Einheit"), h("th", {}, ""))));
      const rumpf = h("tbody");
      for (const [mkId, wert] of eintraege) {
        const mk = Model().findeMerkmal(projekt, mkId);
        rumpf.append(h("tr", {},
          h("td", {}, mk ? mk.name : "(gelöschtes Merkmal)"),
          h("td", {}, wertEingabe(mk, wert, (w) => { el.merkmalwerte[mkId] = w; App.speichern(); App.render(); })),
          h("td", {}, mk ? mk.einheit : ""),
          h("td", {}, h("button", {
            class: "knopf leise", title: "Wert entfernen",
            onclick: () => { delete el.merkmalwerte[mkId]; App.speichern(); App.render(); },
          }, "✕")),
        ));
      }
      tabelle.append(rumpf);
      block.append(tabelle);
    }

    const frei = projekt.merkmale.filter((m) => !(m.id in (el.merkmalwerte || {})));
    if (frei.length) {
      block.append(h("div", { class: "knopf-reihe" },
        select([{ wert: "", text: "+ Merkmal zuweisen …" }].concat(frei.map((m) => ({ wert: m.id, text: m.name }))), "",
          (w) => {
            if (!w) return;
            el.merkmalwerte = el.merkmalwerte || {};
            el.merkmalwerte[w] = "";
            App.speichern();
            App.render();
          }),
      ));
    } else if (!projekt.merkmale.length) {
      block.append(leererHinweis("Noch keine Merkmale definiert (Schritt 2)."));
    }
    return block;
  }

  // ---- Signale ----------------------------------------------------------------

  function renderSignale(projekt, el) {
    const block = h("div", { class: "unterblock" },
      h("h4", {}, "Signale (für PLC-Tags)"),
      h("p", { class: "klein" }, "Welche Signale tauscht diese Komponente mit der Steuerung aus? Daraus entstehen in Schritt 5 die PLC-Tags."));

    el.signale = el.signale || [];
    if (el.signale.length) {
      const tabelle = h("table", { class: "tabelle" },
        h("thead", {}, h("tr", {}, h("th", {}, "Signalname"), h("th", {}, "Richtung"), h("th", {}, "Datentyp"), h("th", {}, ""))));
      const rumpf = h("tbody");
      el.signale.forEach((signal, i) => {
        rumpf.append(h("tr", {},
          h("td", {}, textEingabe(signal.name, (w) => { signal.name = w; App.speichern(); App.render(); })),
          h("td", {}, select(SysM.Model.SIGNAL_RICHTUNGEN.map((r) => ({ wert: r.code, text: r.text })), signal.richtung,
            (w) => { signal.richtung = w; App.speichern(); App.render(); })),
          h("td", {}, select(SysM.Model.SIGNAL_DATENTYPEN, signal.datentyp, (w) => { signal.datentyp = w; App.speichern(); App.render(); })),
          h("td", {}, h("button", {
            class: "knopf leise", title: "Signal entfernen",
            onclick: () => { el.signale.splice(i, 1); App.speichern(); App.render(); },
          }, "✕")),
        ));
      });
      tabelle.append(rumpf);
      block.append(tabelle);
    }

    block.append(h("button", {
      class: "knopf leise",
      onclick: () => { el.signale.push(Model().neuesSignal({ name: "Signal " + (el.signale.length + 1) })); App.speichern(); App.render(); },
    }, "+ Signal"));
    return block;
  }

  Tabs.struktur = { titel: "1 · Struktur", render, renderBedingungsZeilen };
})();
