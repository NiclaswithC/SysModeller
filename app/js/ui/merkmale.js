"use strict";
/*
 * Reiter „2 · Merkmale“: der Merkmal-Katalog. Hier wird definiert, WAS es
 * gibt (Name, Typ, Einheit, erlaubte Werte) – die WERTE stehen an den
 * Elementen (Schritt 1) bzw. entstehen je Variante (Schritt 4).
 */
(function () {
  const { h, select, feld, textEingabe, wertEingabe, infoBox, badge, leererHinweis } = UI;
  const Model = () => SysM.Model;

  function auswahl() {
    const projekt = App.projekt;
    let mk = App.auswahl.merkmalId ? Model().findeMerkmal(projekt, App.auswahl.merkmalId) : null;
    if (!mk && projekt.merkmale.length) {
      mk = projekt.merkmale[0];
      App.auswahl.merkmalId = mk.id;
    }
    return mk;
  }

  function verwendungen(projekt, mkId) {
    let anElementen = 0;
    let inBedingungen = 0;
    for (const el of projekt.elemente) {
      if (el.merkmalwerte && mkId in el.merkmalwerte) anElementen += 1;
      if ((el.bedingung || []).some((b) => b.merkmalId === mkId)) inBedingungen += 1;
    }
    let inRegeln = 0;
    for (const r of projekt.regeln) {
      const benutzt = (r.wenn || []).some((b) => b.merkmalId === mkId) ||
        (r.dann || []).some((a) => a.merkmalId === mkId);
      if (benutzt) inRegeln += 1;
    }
    return { anElementen, inBedingungen, inRegeln };
  }

  function render(wurzel) {
    const projekt = App.projekt;
    const mk = auswahl();

    wurzel.append(infoBox(
      "Ein Merkmal wird hier einmal sauber definiert und überall wiederverwendet – ",
      "das Merkmal (z. B. „Taktleistung“) bleibt dabei getrennt von seinem Wert (z. B. „90 1/min“). ",
      "Merkmale, die als „Frage an den Vertrieb“ markiert sind, bilden später den Konfigurationsbogen in Schritt 4."));

    const liste = h("div", { class: "baum" });
    for (const m of projekt.merkmale) {
      liste.append(h("button", {
        class: "baum-zeile" + (mk && m.id === mk.id ? " ausgewaehlt" : ""),
        onclick: () => { App.auswahl.merkmalId = m.id; App.render(); },
      },
        h("span", { class: "baum-name" }, m.name),
        badge(typText(m.typ), "typ-merkmal"),
        m.istKonfiguration ? badge("Frage", "typ-option") : null,
        h("span", { class: "baum-bmk" }, m.einheit || ""),
      ));
    }
    if (!projekt.merkmale.length) liste.append(leererHinweis("Noch keine Merkmale. Legen Sie das erste an – z. B. „Taktleistung“."));

    const linkerTeil = h("div", { class: "panel" },
      h("div", { class: "panel-kopf" },
        h("h3", {}, "Merkmal-Katalog"),
        h("button", {
          class: "knopf",
          onclick: () => {
            const neu = Model().neuesMerkmal({ name: "Neues Merkmal" });
            projekt.merkmale.push(neu);
            App.auswahl.merkmalId = neu.id;
            App.speichern();
            App.render();
          },
        }, "+ Merkmal"),
      ),
      liste,
    );

    const container = h("div", { class: "split" });
    container.append(linkerTeil);
    container.append(mk ? renderDetail(projekt, mk) : h("div", { class: "panel" }, leererHinweis("Kein Merkmal ausgewählt.")));
    wurzel.append(container);
  }

  function typText(code) {
    const eintrag = Model().MERKMAL_TYPEN.find((t) => t.code === code);
    return eintrag ? eintrag.text : code;
  }

  function renderDetail(projekt, mk) {
    const nutzung = verwendungen(projekt, mk.id);
    const detail = h("div", { class: "panel detail" });

    detail.append(h("div", { class: "panel-kopf" },
      h("h3", {}, mk.name),
      h("button", {
        class: "knopf gefahr",
        onclick: () => {
          const summe = nutzung.anElementen + nutzung.inBedingungen + nutzung.inRegeln;
          const frage = summe
            ? `„${mk.name}“ wird noch verwendet (${nutzung.anElementen} Elementwerte, ${nutzung.inBedingungen} Bedingungen, ${nutzung.inRegeln} Regeln). Trotzdem löschen?`
            : `„${mk.name}“ löschen?`;
          if (!confirm(frage)) return;
          projekt.merkmale = projekt.merkmale.filter((m) => m.id !== mk.id);
          App.auswahl.merkmalId = null;
          App.speichern();
          App.render();
        },
      }, "Löschen"),
    ));

    detail.append(feld("Name", textEingabe(mk.name, (w) => { mk.name = w || mk.name; App.speichern(); App.render(); })));

    detail.append(feld("Art des Merkmals",
      select(Model().MERKMAL_TYPEN.map((t) => ({ wert: t.code, text: t.text })), mk.typ,
        (w) => { mk.typ = w; App.speichern(); App.render(); }),
      "Zahl (z. B. Taktleistung), Text, Ja/Nein (z. B. Etikettierung) oder feste Auswahlliste (z. B. Spannungen)."));

    if (mk.typ === "auswahl") {
      detail.append(feld("Erlaubte Werte",
        h("textarea", {
          rows: 4,
          onchange: (e) => {
            mk.werte = e.target.value.split("\n").map((z) => z.trim()).filter(Boolean);
            App.speichern();
            App.render();
          },
        }, (mk.werte || []).join("\n")),
        "Ein Wert je Zeile."));
    }

    if (mk.typ === "zahl" || mk.typ === "text") {
      detail.append(feld("Einheit",
        textEingabe(mk.einheit, (w) => { mk.einheit = w.trim(); App.speichern(); App.render(); }, { placeholder: "z. B. 1/min, kW, mm" }),
        "Nur zur Anzeige – der Wert selbst bleibt eine reine Zahl."));
    }

    if (mk.typ === "zahl") {
      detail.append(feld("Sinnvoller Bereich (von / bis)",
        h("div", { class: "knopf-reihe" },
          textEingabe(mk.min, (w) => { mk.min = w.trim(); App.speichern(); App.render(); }, { placeholder: "von", class: "sehr-schmal" }),
          h("span", { class: "klein" }, "bis"),
          textEingabe(mk.max, (w) => { mk.max = w.trim(); App.speichern(); App.render(); }, { placeholder: "bis", class: "sehr-schmal" })),
        "Optional. Wenn gesetzt, wird die Frage in Schritt 4 als Schieberegler angezeigt."));
    }

    detail.append(h("div", { class: "unterblock" },
      h("label", { class: "radio" },
        h("input", {
          type: "checkbox", checked: mk.istKonfiguration,
          onchange: (e) => { mk.istKonfiguration = e.target.checked; App.speichern(); App.render(); },
        }),
        " Frage an den Vertrieb/Kunden – wird beim Zusammenstellen einer Variante abgefragt (Schritt 4)."),
    ));

    detail.append(feld("Standardwert",
      wertEingabe(mk, mk.standardwert, (w) => { mk.standardwert = w; App.speichern(); App.render(); }),
      "Gilt, solange nichts anderes beantwortet oder per Regel gesetzt wird."));

    detail.append(feld("Stabiler Bezeichner (IRDI, optional)",
      textEingabe(mk.irdi, (w) => { mk.irdi = w.trim(); App.speichern(); }, { placeholder: "z. B. 0173-1#02-AAE916#005" }),
      "Verweis auf ein Normmerkmal (z. B. ECLASS). Sorgt dafür, dass andere Systeme dieses Merkmal eindeutig wiedererkennen."));

    detail.append(feld("Kommentar",
      h("textarea", { rows: 2, onchange: (e) => { mk.kommentar = e.target.value; App.speichern(); } }, mk.kommentar || ""),
      "Was bedeutet das Merkmal, wer legt den Wert fest?"));

    detail.append(h("p", { class: "klein" },
      `Verwendung: ${nutzung.anElementen}× als Wert an Elementen, ${nutzung.inBedingungen}× in Options-Bedingungen, ${nutzung.inRegeln}× in Regeln.`));

    return detail;
  }

  Tabs.merkmale = { titel: "2 · Merkmale", render };
})();
