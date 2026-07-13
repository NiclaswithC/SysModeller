"use strict";
/*
 * Reiter „Bibliothek“: die Firmenstandards. Ein Modul wird einmal definiert
 * und überall gleich verwendet – Mechanik, Elektrik und Software sehen
 * denselben Schnitt. Die Bibliothek gilt projektübergreifend und lässt sich
 * als Datei weitergeben (z. B. an Kollegen oder andere Standorte).
 */
(function () {
  const { h, select, feld, infoBox, badge, leererHinweis } = UI;
  const Model = () => SysM.Model;
  const Bibliothek = () => SysM.Bibliothek;

  function auswahl() {
    const module = App.bibliothek.module;
    let modul = App.auswahl.modulId ? Bibliothek().findeModul(module, App.auswahl.modulId) : null;
    if (!modul && module.length) {
      modul = module[0];
      App.auswahl.modulId = modul.id;
    }
    return modul;
  }

  function verwendungenImProjekt(modul) {
    return App.projekt.elemente.filter((e) => e.herkunft &&
      (e.herkunft.modulId === modul.id || e.herkunft.name === modul.name));
  }

  function render(wurzel) {
    const modul = auswahl();

    wurzel.append(infoBox(
      "Hier steht, was „Standard“ bei Ihnen wirklich heißt: Jedes Modul ist einmal sauber definiert – ",
      "mit Aufbau, Komponenten, Signalen und Merkmalen – und wird überall in genau diesem Schnitt verwendet. ",
      "Veröffentlichen Sie bewährte Bausteine aus der Struktur („Als Firmenstandard veröffentlichen“); ",
      "eingefügte Instanzen kennen ihre Herkunft, Abweichungen werden erkannt."));

    const liste = h("div", { class: "baum" });
    for (const m of Bibliothek().neuesteVersionen(App.bibliothek.module)) {
      const anzahl = verwendungenImProjekt(m).length;
      liste.append(h("button", {
        class: "baum-zeile" + (modul && m.id === modul.id ? " ausgewaehlt" : ""),
        onclick: () => { App.auswahl.modulId = m.id; App.render(); },
      },
        h("span", { class: "baum-name" }, m.name),
        badge("v" + m.version, "typ-merkmal"),
        h("span", { class: "baum-bmk" }, anzahl ? anzahl + "× im Projekt" : ""),
      ));
    }
    if (!App.bibliothek.module.length) {
      liste.append(leererHinweis("Noch keine Standards. Veröffentlichen Sie einen Baustein aus der Struktur."));
    }

    const linkerTeil = h("div", { class: "panel schmal" },
      h("div", { class: "panel-kopf" },
        h("h3", {}, "Firmenstandards"),
        h("div", { class: "knopf-reihe" },
          h("button", { class: "knopf leise", onclick: bibliothekImportieren }, "Importieren"),
          h("button", {
            class: "knopf leise",
            onclick: () => {
              const inhalt = JSON.stringify({
                schema: "sysmodeller-bibliothek/1",
                module: App.bibliothek.module,
                funktionen: App.bibliothek.funktionen,
                loesungen: App.bibliothek.loesungen,
              }, null, 2);
              UI.download("SysModeller_Bibliothek.json", inhalt, "application/json");
            },
          }, "Exportieren"),
        ),
      ),
      liste,
      h("p", { class: "klein" }, "Die Bibliothek gilt für alle Projekte auf diesem Rechner. Export/Import verteilt sie im Team."),
    );

    const container = h("div", { class: "split" });
    container.append(linkerTeil);
    container.append(modul ? renderDetail(modul) : h("div", { class: "panel detail" }, leererHinweis("Kein Standard ausgewählt.")));
    wurzel.append(container);

    wurzel.append(renderFunktionskatalog());
  }

  // ---- Funktionskatalog: Funktionen und Lösungsprinzipien ----------------------

  function renderFunktionskatalog() {
    const bibliothek = App.bibliothek;
    const panel = h("div", { class: "panel" });
    panel.append(h("div", { class: "panel-kopf" },
      h("h3", {}, "Funktionen & Lösungsprinzipien"),
      h("button", {
        class: "knopf",
        onclick: () => {
          const name = prompt("Name der neuen Funktion (z. B. „Spannen“):");
          if (!name) return;
          bibliothek.funktionen.push(Bibliothek().neueFunktion({ name }));
          App.speichern();
          App.render();
        },
      }, "+ Funktion"),
    ));
    panel.append(h("p", { class: "klein" },
      "Die Sprache des Vertriebs: Eine Funktion (WAS: „Spannen“) hat mehrere Lösungsprinzipien " +
      "(WIE: pneumatisch, hydraulisch, elektrisch). Jedes Prinzip verweist auf einen Firmenstandard – " +
      "oder ist als ETO markiert, solange es keinen gibt."));

    if (!bibliothek.funktionen.length) {
      panel.append(UI.leererHinweis("Noch keine Funktionen im Katalog."));
      return panel;
    }

    const modulNamen = Bibliothek().neuesteVersionen(bibliothek.module).map((m) => m.name);
    for (const funktion of bibliothek.funktionen) {
      const block = h("div", { class: "unterblock" });
      block.append(h("div", { class: "panel-kopf" },
        h("h4", {}, UI.textEingabe(funktion.name, (w) => { funktion.name = w || funktion.name; App.speichern(); App.render(); })),
        h("div", { class: "knopf-reihe" },
          h("button", {
            class: "knopf leise",
            onclick: () => {
              bibliothek.loesungen.push(Bibliothek().neueLoesung({ funktionId: funktion.id, name: "Neue Lösung" }));
              App.speichern();
              App.render();
            },
          }, "+ Lösung"),
          h("button", {
            class: "knopf gefahr",
            onclick: () => {
              if (!confirm(`Funktion „${funktion.name}“ samt Lösungsprinzipien aus dem Katalog löschen?`)) return;
              bibliothek.funktionen = bibliothek.funktionen.filter((f) => f.id !== funktion.id);
              bibliothek.loesungen = bibliothek.loesungen.filter((l) => l.funktionId !== funktion.id);
              App.speichern();
              App.render();
            },
          }, "Löschen"),
        ),
      ));

      const loesungen = Bibliothek().loesungenZuFunktion(bibliothek, funktion.id);
      if (!loesungen.length) {
        block.append(h("p", { class: "klein" }, "Noch keine Lösungsprinzipien."));
      }
      for (const loesung of loesungen) {
        const optionen = [{ wert: "", text: "ETO – noch kein Standard" }]
          .concat(modulNamen.map((n) => ({ wert: n, text: "Standard: " + n })));
        block.append(h("div", { class: "aktion-zeile" },
          UI.textEingabe(loesung.name, (w) => { loesung.name = w || loesung.name; App.speichern(); App.render(); },
            { placeholder: "z. B. Pneumatisch spannen" }),
          select(optionen, loesung.modulName || "", (w) => { loesung.modulName = w; App.speichern(); App.render(); }),
          loesung.modulName ? badge("CTO", "typ-merkmal") : badge("ETO", "typ-eto"),
          h("button", {
            class: "knopf leise", title: "Lösung entfernen",
            onclick: () => {
              bibliothek.loesungen = bibliothek.loesungen.filter((l) => l.id !== loesung.id);
              App.speichern();
              App.render();
            },
          }, "✕"),
        ));
      }
      panel.append(block);
    }
    return panel;
  }

  function bibliothekImportieren() {
    const eingabe = document.createElement("input");
    eingabe.type = "file";
    eingabe.accept = ".json,application/json";
    eingabe.addEventListener("change", () => {
      const datei = eingabe.files && eingabe.files[0];
      if (!datei) return;
      const leser = new FileReader();
      leser.onload = () => {
        try {
          const daten = JSON.parse(String(leser.result));
          if (daten.schema !== "sysmodeller-bibliothek/1" || !Array.isArray(daten.module)) {
            throw new Error("Das ist keine SysModeller-Bibliotheksdatei.");
          }
          let neu = 0;
          for (const m of daten.module) {
            const vorhanden = App.bibliothek.module.some((x) => x.name === m.name && x.version === m.version);
            if (!vorhanden) { App.bibliothek.module.push(m); neu += 1; }
          }
          for (const f of daten.funktionen || []) {
            if (!App.bibliothek.funktionen.some((x) => x.name === f.name)) {
              App.bibliothek.funktionen.push(f);
              for (const l of (daten.loesungen || []).filter((l) => l.funktionId === f.id)) {
                App.bibliothek.loesungen.push(l);
              }
              neu += 1;
            }
          }
          App.speichern();
          App.render();
          alert(neu + " Standard(s)/Funktion(en) übernommen.");
        } catch (fehler) {
          alert("Import fehlgeschlagen: " + fehler.message);
        }
      };
      leser.readAsText(datei);
    });
    eingabe.click();
  }

  function renderDetail(modul) {
    const detail = h("div", { class: "panel detail" });

    detail.append(h("div", { class: "panel-kopf" },
      h("h3", {}, modul.name + " (Version " + modul.version + ")"),
      h("div", { class: "knopf-reihe" },
        h("button", {
          class: "knopf",
          onclick: () => {
            const projekt = App.projekt;
            const wurzel = projekt.elemente.find((e) => !e.elternId);
            let eltern = wurzel;
            if (modul.wurzel.typ === "Baugruppe" || modul.wurzel.typ === "Komponente") {
              const ausgewaehlt = App.auswahl.elementId ? Model().findeElement(projekt, App.auswahl.elementId) : null;
              let ziel = ausgewaehlt;
              while (ziel && ziel.typ === "Komponente") ziel = Model().findeElement(projekt, ziel.elternId);
              eltern = ziel || wurzel;
            }
            const neu = Bibliothek().einfuegen(projekt, modul, eltern ? eltern.id : null);
            App.auswahl.elementId = neu.id;
            App.speichern();
            App.zeigeTab("struktur");
          },
        }, "In das Projekt einfügen"),
        h("button", {
          class: "knopf gefahr",
          onclick: () => {
            if (!confirm(`Standard „${modul.name}“ (alle Versionen) aus der Bibliothek löschen? Bereits eingefügte Instanzen bleiben im Projekt.`)) return;
            App.bibliothek.module = App.bibliothek.module.filter((m) => m.name !== modul.name);
            App.auswahl.modulId = null;
            App.speichern();
            App.render();
          },
        }, "Löschen"),
      ),
    ));

    if (modul.beschreibung) detail.append(h("p", {}, modul.beschreibung));
    detail.append(h("p", { class: "klein" }, "Stand: " + (modul.stand || "–") +
      " · Enthaltene Merkmale: " + ((modul.merkmale || []).map((m) => m.name).join(", ") || "keine")));

    // Vorschau über ein Wegwerf-Projekt
    const vorschauProjekt = Model().neuesProjekt(modul.name);
    vorschauProjekt.elemente = [];
    Bibliothek().einfuegen(vorschauProjekt, modul, null);
    detail.append(Maschinenbild.render(vorschauProjekt, { maxHoehe: 230 }));

    // Inhalt als Liste (alle Disziplinen auf einen Blick)
    const inhalt = h("div", { class: "unterblock" }, h("h4", {}, "Ein Schnitt für alle Disziplinen"));
    const tabelle = h("table", { class: "tabelle" },
      h("thead", {}, h("tr", {},
        h("th", {}, "Baustein (Mechanik)"), h("th", {}, "Produktklasse (Elektrik)"), h("th", {}, "Signale (Software)"))));
    const rumpf = h("tbody");
    (function zeilen(knoten, tiefe) {
      rumpf.append(h("tr", {},
        h("td", { style: "padding-left:" + (10 + tiefe * 16) + "px" }, knoten.name + " (" + knoten.typ + ")"),
        h("td", {}, knoten.produktKlasse || ""),
        h("td", {}, (knoten.signale || []).map((s) => s.name + " (" + s.richtung + ", " + s.datentyp + ")").join(", ")),
      ));
      for (const kind of knoten.kinder || []) zeilen(kind, tiefe + 1);
    })(modul.wurzel, 0);
    tabelle.append(rumpf);
    inhalt.append(tabelle);
    detail.append(inhalt);

    // Instanzen im aktuellen Projekt inkl. Abweichungs-Prüfung
    const instanzen = verwendungenImProjekt(modul);
    const pruefBlock = h("div", { class: "unterblock" }, h("h4", {}, "Verwendung im aktuellen Projekt"));
    if (!instanzen.length) {
      pruefBlock.append(h("p", { class: "klein" }, "Noch nicht in diesem Projekt verwendet."));
    } else {
      for (const el of instanzen) {
        const version = Bibliothek().findeModul(App.bibliothek.module, el.herkunft.modulId) || modul;
        const pruefung = Bibliothek().vergleiche(App.projekt, el.id, version);
        pruefBlock.append(h("div", { class: "instanz-zeile" },
          h("button", {
            class: "verweis",
            onclick: () => { App.auswahl.elementId = el.id; App.zeigeTab("struktur"); },
          }, el.name),
          pruefung.gleich
            ? h("span", { class: "abweichung ok" }, "✓ entspricht dem Standard (v" + el.herkunft.version + ")")
            : h("span", { class: "abweichung warn", title: pruefung.unterschiede.join("\n") },
                "⚠ weicht ab (" + pruefung.unterschiede.length + " Unterschiede)"),
        ));
      }
    }
    detail.append(pruefBlock);

    return detail;
  }

  Tabs.bibliothek = { titel: "Bibliothek", render };
})();
