"use strict";
/*
 * Reiter „Struktur“ (Engineering): Die Maschine wird aus dem Baukasten zusammengesetzt –
 * per Klick oder indem man Bausteine direkt auf das Maschinenbild zieht.
 * Das Bild ist die Hauptansicht; eine Listenansicht steht daneben bereit.
 */
(function () {
  const { h, select, feld, textEingabe, wertEingabe, infoBox, badge, leererHinweis, segmente } = UI;
  const Model = () => SysM.Model;

  const TYP_KLASSE = {
    Anlage: "typ-anlage", Teilanlage: "typ-teilanlage", Station: "typ-station",
    Baugruppe: "typ-baugruppe", Komponente: "typ-komponente",
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

  /** Passendes Elternteil für einen neuen Baustein bestimmen. */
  function zielEltern(projekt, vorlage, wunschEl) {
    const wurzel = projekt.elemente.find((e) => !e.elternId) || null;
    if (vorlage.typ === "Station" || vorlage.typ === "Teilanlage") {
      // Stationen kommen auf die Linie, außer man legt sie gezielt auf eine Teilanlage.
      if (wunschEl && (wunschEl.typ === "Anlage" || wunschEl.typ === "Teilanlage")) return wunschEl;
      return wurzel;
    }
    let el = wunschEl || auswahl();
    while (el && el.typ === "Komponente") el = Model().findeElement(projekt, el.elternId);
    return el || wurzel;
  }

  function bausteinEinfuegen(kennung, wunschEl) {
    const projekt = App.projekt;
    let neu = null;
    if (kennung.startsWith("modul:")) {
      const modul = SysM.Bibliothek.findeModul(App.bibliothek.module, kennung.slice(6));
      if (!modul) return;
      const eltern = zielEltern(projekt, modul.wurzel, wunschEl);
      neu = SysM.Bibliothek.einfuegen(projekt, modul, eltern ? eltern.id : null);
    } else {
      const vorlage = SysM.Vorlagen.finde(kennung);
      if (!vorlage) return;
      const eltern = zielEltern(projekt, vorlage, wunschEl);
      neu = SysM.Vorlagen.instanziiere(projekt, kennung, eltern ? eltern.id : null);
    }
    if (neu) {
      App.auswahl.elementId = neu.id;
      App.speichern();
      App.render();
    }
  }

  function render(wurzel) {
    const projekt = App.projekt;
    const el = auswahl();
    const kennzeichen = SysM.Kennzeichnung.berechneKennzeichen(projekt);

    wurzel.append(infoBox(
      "Setzen Sie die Maschine aus dem Baukasten zusammen: Baustein anklicken oder direkt auf das Bild ziehen. ",
      "Kürzel, Produktklassen und typische Signale sind schon voreingestellt – Kennzeichen entstehen automatisch."));

    wurzel.append(renderMaschinenPanel(projekt, el, kennzeichen));

    const container = h("div", { class: "split" });
    container.append(renderBaukasten(projekt));
    container.append(el ? renderDetail(projekt, el, kennzeichen) : h("div", { class: "panel detail" }, leererHinweis("Klicken Sie im Bild auf einen Block, um ihn zu bearbeiten.")));
    wurzel.append(container);
  }

  // ---- Maschinenbild / Liste -------------------------------------------------

  function renderMaschinenPanel(projekt, el, kennzeichen) {
    const ansicht = App.ansicht;
    const panel = h("div", { class: "panel maschinen-panel" });

    panel.append(h("div", { class: "panel-kopf" },
      h("h3", {}, "Ihre Maschine"),
      h("div", { class: "knopf-reihe" },
        segmente([{ wert: "bild", text: "Maschinenbild" }, { wert: "liste", text: "Liste" }], ansicht.modus,
          (w) => { ansicht.modus = w; App.speichern(); App.render(); }),
        ansicht.modus === "bild" ? h("label", { class: "radio kompakt" },
          h("input", {
            type: "checkbox", checked: ansicht.bmk,
            onchange: (e) => { ansicht.bmk = e.target.checked; App.speichern(); App.render(); },
          }), " Kennzeichen einblenden") : null,
        ansicht.modus === "bild" ? h("div", { class: "knopf-reihe" },
          h("button", { class: "knopf leise", title: "Kleiner", onclick: () => { ansicht.zoom = Math.max(0.6, Math.round((ansicht.zoom - 0.2) * 10) / 10); App.speichern(); App.render(); } }, "−"),
          h("button", { class: "knopf leise", title: "Größer", onclick: () => { ansicht.zoom = Math.min(2.4, Math.round((ansicht.zoom + 0.2) * 10) / 10); App.speichern(); App.render(); } }, "+"),
        ) : null,
      ),
    ));

    if (ansicht.modus === "bild") {
      panel.append(Maschinenbild.render(projekt, {
        auswahlId: el ? el.id : null,
        kennzeichen,
        zeigeBmk: ansicht.bmk,
        zoom: ansicht.zoom,
        onKlick: (geklickt) => {
          if (geklickt) { App.auswahl.elementId = geklickt.id; App.render(); }
        },
        onDrop: (vorlageId, zielEl) => bausteinEinfuegen(vorlageId, zielEl),
      }));
      panel.append(h("div", { class: "mb-fusszeile" },
        Maschinenbild.legende(),
        h("span", { class: "klein" }, "Block anklicken = auswählen · Baustein aus dem Baukasten auf einen Block ziehen = dort einfügen"),
      ));
    } else {
      panel.append(renderListe(projekt, el, kennzeichen));
    }
    return panel;
  }

  function renderListe(projekt, ausgewaehlt, kennzeichen) {
    const liste = h("div", { class: "baum baum-breit" });
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
    return liste;
  }

  // ---- Baukasten ---------------------------------------------------------------

  function renderBaukasten(projekt) {
    const panel = h("div", { class: "panel baukasten" },
      h("h3", {}, "Baukasten"),
      h("p", { class: "klein" }, "Anklicken fügt den Baustein bei der Auswahl ein – oder auf das Bild ziehen."));

    // Zuerst die eigenen Firmenstandards – Wiederverwendung vor Neubau.
    const standards = SysM.Bibliothek.neuesteVersionen(App.bibliothek.module);
    const standardBlock = h("details", { class: "baukasten-gruppe", open: "" },
      h("summary", {}, "Firmenstandard"),
      h("p", { class: "klein" }, "Ihre freigegebenen Module – überall derselbe Schnitt (siehe Bibliothek)."));
    const standardRaster = h("div", { class: "baukasten-raster" });
    for (const modul of standards) {
      const farbe = Maschinenbild.FARBEN[modul.wurzel.typ] || Maschinenbild.FARBEN.Komponente;
      const knopf = h("button", {
        class: "vorlage-knopf standard",
        draggable: "true",
        title: modul.beschreibung || modul.name,
        onclick: () => bausteinEinfuegen("modul:" + modul.id, null),
      },
        h("span", {
          class: "vorlage-wuerfel",
          style: `background:${farbe[0]};border-color:${farbe[2]};box-shadow:2px 2px 0 ${farbe[1]};`,
        }),
        h("span", { class: "vorlage-name" }, modul.name, h("span", { class: "vorlage-version" }, " v" + modul.version)),
      );
      knopf.addEventListener("dragstart", (ereignis) => {
        ereignis.dataTransfer.setData("text/vorlage", "modul:" + modul.id);
        ereignis.dataTransfer.effectAllowed = "copy";
      });
      standardRaster.append(knopf);
    }
    if (!standards.length) standardRaster.append(h("p", { class: "klein" }, "Noch keine – bewährte Bausteine unten im Detail veröffentlichen."));
    standardBlock.append(standardRaster);
    panel.append(standardBlock);

    for (const gruppe of SysM.Vorlagen.GRUPPEN) {
      const aufklappen = gruppe.titel !== "Grundbausteine";
      const block = h("details", { class: "baukasten-gruppe", ...(aufklappen ? { open: "" } : {}) },
        h("summary", {}, gruppe.titel));
      block.append(h("p", { class: "klein" }, gruppe.hinweis));
      const raster = h("div", { class: "baukasten-raster" });
      for (const vorlage of gruppe.eintraege) {
        const farbe = Maschinenbild.FARBEN[vorlage.typ] || Maschinenbild.FARBEN.Komponente;
        const knopf = h("button", {
          class: "vorlage-knopf",
          draggable: "true",
          title: vorlage.kinder ? "Bringt mit: " + vorlage.kinder.map((k) => k.name).join(", ") : vorlage.name,
          onclick: () => bausteinEinfuegen(vorlage.id, null),
        },
          h("span", {
            class: "vorlage-wuerfel",
            style: `background:${farbe[0]};border-color:${farbe[2]};box-shadow:2px 2px 0 ${farbe[1]};`,
          }),
          h("span", { class: "vorlage-name" }, vorlage.name),
        );
        knopf.addEventListener("dragstart", (ereignis) => {
          ereignis.dataTransfer.setData("text/vorlage", vorlage.id);
          ereignis.dataTransfer.effectAllowed = "copy";
        });
        raster.append(knopf);
      }
      block.append(raster);
      panel.append(block);
    }
    return panel;
  }

  // ---- Detail ---------------------------------------------------------------

  function renderDetail(projekt, el, kennzeichen) {
    const kz = kennzeichen[el.id] || {};
    const istKomponente = el.typ === "Komponente";

    const detail = h("div", { class: "panel detail" });

    detail.append(h("div", { class: "panel-kopf" },
      h("h3", {}, el.name),
      h("div", { class: "knopf-reihe" },
        h("button", { class: "knopf leise", title: "In der Reihenfolge nach vorn", onclick: () => { Model().verschiebeElement(projekt, el.id, -1); App.speichern(); App.render(); } }, "↑"),
        h("button", { class: "knopf leise", title: "In der Reihenfolge nach hinten", onclick: () => { Model().verschiebeElement(projekt, el.id, +1); App.speichern(); App.render(); } }, "↓"),
        el.elternId ? h("button", {
          class: "knopf leise", title: "Element samt Inhalt kopieren",
          onclick: () => {
            const kopie = Model().kopiereUnterbaum(projekt, el.id);
            if (kopie) { App.auswahl.elementId = kopie.id; App.speichern(); App.render(); }
          },
        }, "Duplizieren") : null,
        h("button", {
          class: "knopf gefahr",
          onclick: () => {
            const nachfahren = projekt.elemente.filter((e) => Model().istNachfahre(projekt, el.id, e.id)).length;
            const frage = nachfahren
              ? `„${el.name}“ und ${nachfahren} enthaltene Elemente löschen?`
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
      h("span", { class: "feld-hinweis" }, " – entsteht automatisch aus Aufbau und Reihenfolge"),
    ));

    detail.append(feld("Name", textEingabe(el.name, (w) => { el.name = w || el.name; App.speichern(); App.render(); })));

    detail.append(feld("Ebene",
      segmente(Model().ELEMENT_TYPEN, el.typ, (w) => { el.typ = w; App.speichern(); App.render(); }),
      istKomponente
        ? "Komponenten sind die konkreten Betriebsmittel (Motor, Sensor, Ventil …)."
        : "Von grob (Anlage) nach fein (Komponente)."));

    if (!istKomponente) {
      detail.append(feld("Funktionskürzel",
        textEingabe(el.kuerzel, (w) => { el.kuerzel = w.toUpperCase().trim(); App.speichern(); App.render(); },
          { placeholder: "automatisch: " + SysM.Kennzeichnung.autoKuerzel(el.name) }),
        "Kurzzeichen im Kennzeichen (z. B. DOS für Dosieren). Leer lassen = wird aus dem Namen abgeleitet."));
    } else {
      const klassen = [{ wert: "", text: "– bitte wählen –" }]
        .concat(Model().PRODUKT_KLASSEN.map((k) => ({ wert: k.code, text: k.code + " – " + k.text })));
      if (el.produktKlasse && !Model().PRODUKT_KLASSEN.some((k) => k.code === el.produktKlasse)) {
        klassen.push({ wert: el.produktKlasse, text: el.produktKlasse + " – (eigene Klasse)" });
      }
      detail.append(feld("Produktklasse",
        select(klassen, el.produktKlasse, (w) => { el.produktKlasse = w; App.speichern(); App.render(); }),
        "Kennbuchstabe nach IEC 81346-2 – die laufende Nummer (M1, M2 …) vergibt das Werkzeug."));
    }

    detail.append(renderVerwendung(projekt, el));
    if (istKomponente) detail.append(renderSignale(projekt, el));
    detail.append(renderMerkmalwerte(projekt, el));
    detail.append(renderStandardBlock(projekt, el));

    // Selten Gebrauchtes eingeklappt
    const weitere = h("details", { class: "unterblock-details" },
      h("summary", {}, "Weitere Angaben (Ort, Kommentar)"));
    weitere.append(feld("Ortskennzeichen (+)",
      textEingabe(el.ort, (w) => { el.ort = w.trim(); App.speichern(); App.render(); }, { placeholder: "z. B. S1 oder F1" }),
      "Wo sitzt das? (Schaltschrank S1, Feld F1 …). Leer = vom übergeordneten Element geerbt" + (kz.ort ? ` – aktuell wirksam: ${kz.ort}` : "") + "."));
    weitere.append(feld("Kommentar",
      h("textarea", { rows: 2, onchange: (e) => { el.kommentar = e.target.value; App.speichern(); } }, el.kommentar || ""),
      "Freitext, z. B. Herkunft oder Randbedingungen."));
    detail.append(weitere);

    return detail;
  }

  // ---- Firmenstandard: Herkunft, Abweichung, Veröffentlichen ------------------

  function renderStandardBlock(projekt, el) {
    const block = h("div", { class: "unterblock" }, h("h4", {}, "Firmenstandard"));

    if (el.herkunft) {
      const modul = SysM.Bibliothek.findeModul(App.bibliothek.module, el.herkunft.modulId);
      if (!modul) {
        block.append(h("p", { class: "klein" },
          `Stammt aus „${el.herkunft.name}“ v${el.herkunft.version} – dieser Standard ist in der Bibliothek nicht mehr vorhanden.`));
      } else {
        const pruefung = SysM.Bibliothek.vergleiche(projekt, el.id, modul);
        if (pruefung.gleich) {
          block.append(h("p", {},
            h("span", { class: "abweichung ok" }, "✓ entspricht dem Standard "),
            `„${modul.name}“ v${el.herkunft.version}.`));
        } else {
          block.append(h("p", {},
            h("span", { class: "abweichung warn" }, "⚠ weicht vom Standard ab "),
            `(„${modul.name}“ v${el.herkunft.version}, ${pruefung.unterschiede.length} Unterschiede):`));
          const listeEl = h("ul", { class: "abweichungs-liste" });
          for (const u of pruefung.unterschiede.slice(0, 8)) listeEl.append(h("li", {}, u));
          if (pruefung.unterschiede.length > 8) listeEl.append(h("li", {}, "…"));
          block.append(listeEl);
          block.append(h("p", { class: "klein" },
            "Gewollt? Dann als neue Version veröffentlichen – sonst zurückbauen. So bleibt „Standard“ wirklich Standard."));
        }
      }
    } else {
      block.append(h("p", { class: "klein" },
        "Dieser Baustein ist projektspezifisch. Bewährt er sich, veröffentlichen Sie ihn – dann steht er allen Projekten im Baukasten zur Verfügung."));
    }

    if (el.elternId) {
      block.append(h("button", {
        class: "knopf leise",
        onclick: () => {
          const basisName = el.herkunft ? el.herkunft.name : el.name;
          const name = prompt("Name des Standards:", basisName);
          if (!name) return;
          const vorhanden = App.bibliothek.module.filter((m) => m.name === name);
          const version = vorhanden.length ? Math.max(...vorhanden.map((m) => m.version || 1)) + 1 : 1;
          const modul = SysM.Bibliothek.schnappschuss(projekt, el.id, {
            name, version,
            stand: new Date().toLocaleDateString("de-DE"),
            beschreibung: el.kommentar || "",
          });
          App.bibliothek.module.push(modul);
          el.herkunft = { modulId: modul.id, name: modul.name, version: modul.version };
          App.speichern();
          App.render();
        },
      }, el.herkunft ? "Als neue Version veröffentlichen" : "Als Firmenstandard veröffentlichen"));
    }
    return block;
  }

  // ---- Verwendung / Options-Bedingung ---------------------------------------

  function renderVerwendung(projekt, el) {
    const block = h("div", { class: "unterblock" }, h("h4", {}, "Immer dabei oder Option?"));

    block.append(segmente(
      [{ wert: "standard", text: "✓ Immer dabei" }, { wert: "option", text: "Option" }],
      el.verwendung === "option" ? "option" : "standard",
      (w) => { el.verwendung = w; App.speichern(); App.render(); }));

    if (el.verwendung === "option") {
      if (!projekt.merkmale.length) {
        block.append(leererHinweis("Es gibt noch keine Merkmale. Legen Sie zuerst unter „Merkmale“ eines an (z. B. „Etikettierung Ja/Nein“)."));
      } else {
        block.append(h("p", { class: "klein" }, "Dieser Baustein ist enthalten, wenn gilt:"));
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
    const eintraege = Object.entries(el.merkmalwerte || {});
    const frei = projekt.merkmale.filter((m) => !(m.id in (el.merkmalwerte || {})));

    const block = h("div", { class: "unterblock" }, h("h4", {}, "Technische Daten (Merkmalwerte)"));

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
    } else {
      block.append(h("p", { class: "klein" }, "Noch keine Werte an diesem Baustein. Regeln können Werte je Variante setzen."));
    }

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
    }
    return block;
  }

  // ---- Signale ----------------------------------------------------------------

  function renderSignale(projekt, el) {
    const block = h("div", { class: "unterblock" },
      h("h4", {}, "Signale (werden zu PLC-Tags)"));

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
    } else {
      block.append(h("p", { class: "klein" }, "Welche Signale tauscht diese Komponente mit der Steuerung aus? Aus jedem Signal entsteht unter „Kennzeichnung“ ein PLC-Tag."));
    }

    block.append(h("button", {
      class: "knopf leise",
      onclick: () => { el.signale.push(Model().neuesSignal({ name: "Signal " + (el.signale.length + 1) })); App.speichern(); App.render(); },
    }, "+ Signal"));
    return block;
  }

  Tabs.struktur = { titel: "Struktur", render, renderBedingungsZeilen };
})();
