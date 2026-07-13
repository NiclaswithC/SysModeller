"use strict";
/*
 * SysModeller – Anwendungsrahmen: Kopfzeile, Reiter-Navigation, Speichern.
 */
(function () {
  const { h } = UI;
  const SPEICHER_SCHLUESSEL = "sysmodeller.projekt";
  const ZUSTAND_SCHLUESSEL = "sysmodeller.zustand";
  const BIBLIOTHEK_SCHLUESSEL = "sysmodeller.bibliothek";

  // Navigation entlang des Maschinenbau-Prozesses, nicht entlang des Werkzeugs.
  const REITER_GRUPPEN = [
    { titel: "", tabs: ["ueberblick"] },
    { titel: "Vertrieb", tabs: ["prozess", "angebot"] },
    { titel: "Engineering", tabs: ["struktur", "merkmale", "regeln"] },
    { titel: "Standards", tabs: ["bibliothek"] },
    { titel: "Übergabe", tabs: ["kennzeichnung", "uebergabe"] },
  ];
  const REITER_FOLGE = REITER_GRUPPEN.flatMap((g) => g.tabs);
  const ALTE_TAB_NAMEN = { varianten: "angebot" };

  window.App = {
    projekt: null,
    tab: "ueberblick",
    aktiveKonfigId: "",
    auswahl: { elementId: null, merkmalId: null, regelId: null, konfigId: null, modulId: null, schrittId: null },
    ansicht: { modus: "bild", bmk: false, zoom: 1 },   // Darstellung des Maschinenbilds
    regelTest: { antworten: {} },                       // Probier-Antworten des Regel-Simulators
    bibliothek: { module: [] },                         // Firmenstandards (projektübergreifend)

    speichern() {
      try {
        localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify(this.projekt));
        localStorage.setItem(BIBLIOTHEK_SCHLUESSEL, JSON.stringify(this.bibliothek));
        localStorage.setItem(ZUSTAND_SCHLUESSEL, JSON.stringify({
          tab: this.tab,
          aktiveKonfigId: this.aktiveKonfigId,
          ansicht: this.ansicht,
        }));
      } catch (fehler) {
        console.warn("Speichern im Browser nicht möglich:", fehler);
      }
    },

    zeigeTab(name) {
      this.tab = name;
      this.speichern();
      this.render();
    },

    projektErsetzen(projekt) {
      this.projekt = projekt;
      this.auswahl = { elementId: null, merkmalId: null, regelId: null, konfigId: null, modulId: null, schrittId: null };
      this.aktiveKonfigId = "";
      this.speichern();
      this.render();
    },

    render() {
      // Reentranz-Schutz: Entfernt replaceChildren ein fokussiertes Eingabefeld,
      // feuert dessen change/blur mitten im Aufräumen und würde sonst ein
      // verschachteltes Neuzeichnen auslösen.
      if (this._zeichnet) {
        this._nochmalZeichnen = true;
        return;
      }
      this._zeichnet = true;
      try {
        do {
          this._nochmalZeichnen = false;
          const wurzel = document.getElementById("app");
          wurzel.replaceChildren();
          wurzel.append(renderKopf());
          wurzel.append(renderNavigation());
          const inhalt = h("main", { class: "inhalt" });
          const reiter = Tabs[this.tab] || Tabs.ueberblick;
          reiter.render(inhalt);
          wurzel.append(inhalt);
        } while (this._nochmalZeichnen);
      } finally {
        this._zeichnet = false;
      }
    },
  };

  function renderKopf() {
    return h("header", { class: "kopf" },
      h("div", { class: "marke" },
        h("span", { class: "logo" }, "⚙"),
        h("div", {},
          h("h1", {}, "SysModeller"),
          h("p", { class: "untertitel" }, "Von der Maschinenstruktur zu den Übergabedaten"))),
      h("div", { class: "kopf-mitte" },
        UI.textEingabe(App.projekt.projekt.name, (w) => {
          App.projekt.projekt.name = w || App.projekt.projekt.name;
          App.speichern();
          App.render();
        }, { class: "projekt-name", title: "Projektname" })),
      h("div", { class: "kopf-knoepfe" },
        h("button", { class: "knopf leise", onclick: neuesProjekt }, "Neues Projekt"),
        h("button", { class: "knopf leise", onclick: beispielLaden }, "Beispiel laden"),
        h("button", { class: "knopf leise", onclick: projektOeffnen }, "Projekt öffnen"),
        h("button", { class: "knopf", onclick: projektSpeichern }, "Projekt speichern"),
      ));
  }

  function renderNavigation() {
    const nav = h("nav", { class: "reiter" });
    REITER_GRUPPEN.forEach((gruppe, index) => {
      const block = h("div", { class: "reiter-gruppe" });
      if (gruppe.titel) block.append(h("span", { class: "reiter-gruppe-titel" }, gruppe.titel));
      const knoepfe = h("div", { class: "reiter-gruppe-knoepfe" });
      for (const name of gruppe.tabs) {
        knoepfe.append(h("button", {
          class: "reiter-knopf" + (App.tab === name ? " aktiv" : ""),
          onclick: () => App.zeigeTab(name),
        }, Tabs[name].titel));
      }
      block.append(knoepfe);
      nav.append(block);
      if (index < REITER_GRUPPEN.length - 1) nav.append(h("span", { class: "reiter-trenner" }));
    });
    return nav;
  }

  function neuesProjekt() {
    if (!confirm("Neues, leeres Projekt beginnen? Das aktuelle Projekt wird im Browser überschrieben – bei Bedarf vorher „Projekt speichern“.")) return;
    App.projektErsetzen(SysM.Model.neuesProjekt("Neue Anlage"));
    App.zeigeTab("struktur");
  }

  function beispielLaden() {
    if (!confirm("Beispielprojekt „Abfüllanlage“ laden? Das aktuelle Projekt wird im Browser überschrieben – bei Bedarf vorher „Projekt speichern“.")) return;
    App.projektErsetzen(SysM.Beispiel.erzeuge());
    App.zeigeTab("ueberblick");
  }

  function projektSpeichern() {
    const datei = SysM.Exporte.projektJson(App.projekt);
    UI.download(datei.dateiname, datei.inhalt, datei.mime);
  }

  function projektOeffnen() {
    const eingabe = document.createElement("input");
    eingabe.type = "file";
    eingabe.accept = ".json,application/json";
    eingabe.addEventListener("change", () => {
      const datei = eingabe.files && eingabe.files[0];
      if (!datei) return;
      const leser = new FileReader();
      leser.onload = () => {
        try {
          const projekt = SysM.Model.pruefeProjekt(JSON.parse(String(leser.result)));
          App.projektErsetzen(projekt);
        } catch (fehler) {
          alert("Die Datei konnte nicht geladen werden: " + fehler.message);
        }
      };
      leser.readAsText(datei);
    });
    eingabe.click();
  }

  // ---- Start ---------------------------------------------------------------

  function laden() {
    try {
      const bibliothek = localStorage.getItem(BIBLIOTHEK_SCHLUESSEL);
      if (bibliothek) App.bibliothek = JSON.parse(bibliothek);
    } catch (fehler) {
      console.warn("Bibliothek konnte nicht geladen werden:", fehler);
    }
    if (!App.bibliothek || !Array.isArray(App.bibliothek.module) || !App.bibliothek.module.length) {
      // Startbestand, damit Bibliothek und Funktionskatalog greifbar sind.
      App.bibliothek = SysM.Bibliothek.beispielBibliothek(new Date().toLocaleDateString("de-DE"));
    } else if (!Array.isArray(App.bibliothek.funktionen) || !App.bibliothek.funktionen.length) {
      // Ältere Bibliothek ohne Funktionskatalog: Katalog nachrüsten,
      // fehlende Beispielmodule (auf die er verweist) mitbringen.
      const beispiel = SysM.Bibliothek.beispielBibliothek(new Date().toLocaleDateString("de-DE"));
      for (const modul of beispiel.module) {
        if (!App.bibliothek.module.some((m) => m.name === modul.name)) App.bibliothek.module.push(modul);
      }
      App.bibliothek.funktionen = beispiel.funktionen;
      App.bibliothek.loesungen = beispiel.loesungen;
    }
    App.bibliothek.funktionen = App.bibliothek.funktionen || [];
    App.bibliothek.loesungen = App.bibliothek.loesungen || [];
    try {
      const gespeichert = localStorage.getItem(SPEICHER_SCHLUESSEL);
      if (gespeichert) {
        App.projekt = SysM.Model.pruefeProjekt(JSON.parse(gespeichert));
        const zustand = JSON.parse(localStorage.getItem(ZUSTAND_SCHLUESSEL) || "{}");
        const tab = ALTE_TAB_NAMEN[zustand.tab] || zustand.tab;
        if (REITER_FOLGE.includes(tab)) App.tab = tab;
        if (zustand.aktiveKonfigId) App.aktiveKonfigId = zustand.aktiveKonfigId;
        if (zustand.ansicht) App.ansicht = Object.assign(App.ansicht, zustand.ansicht);
        return;
      }
    } catch (fehler) {
      console.warn("Gespeichertes Projekt konnte nicht geladen werden:", fehler);
    }
    // Erster Start: mit dem Beispiel beginnen, damit sofort etwas zu sehen ist.
    App.projekt = SysM.Beispiel.erzeuge();
  }

  laden();
  App.render();
})();
