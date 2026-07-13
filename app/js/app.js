"use strict";
/*
 * SysModeller – Anwendungsrahmen: Kopfzeile, Reiter-Navigation, Speichern.
 */
(function () {
  const { h } = UI;
  const SPEICHER_SCHLUESSEL = "sysmodeller.projekt";
  const ZUSTAND_SCHLUESSEL = "sysmodeller.zustand";

  const REITER_FOLGE = ["ueberblick", "struktur", "merkmale", "regeln", "varianten", "kennzeichnung", "uebergabe"];

  window.App = {
    projekt: null,
    tab: "ueberblick",
    aktiveKonfigId: "",
    auswahl: { elementId: null, merkmalId: null, regelId: null, konfigId: null },

    speichern() {
      try {
        localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify(this.projekt));
        localStorage.setItem(ZUSTAND_SCHLUESSEL, JSON.stringify({ tab: this.tab, aktiveKonfigId: this.aktiveKonfigId }));
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
      this.auswahl = { elementId: null, merkmalId: null, regelId: null, konfigId: null };
      this.aktiveKonfigId = "";
      this.speichern();
      this.render();
    },

    render() {
      const wurzel = document.getElementById("app");
      wurzel.replaceChildren();
      wurzel.append(renderKopf());
      wurzel.append(renderNavigation());
      const inhalt = h("main", { class: "inhalt" });
      const reiter = Tabs[this.tab] || Tabs.ueberblick;
      reiter.render(inhalt);
      wurzel.append(inhalt);
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
    for (const name of REITER_FOLGE) {
      nav.append(h("button", {
        class: "reiter-knopf" + (App.tab === name ? " aktiv" : ""),
        onclick: () => App.zeigeTab(name),
      }, Tabs[name].titel));
    }
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
      const gespeichert = localStorage.getItem(SPEICHER_SCHLUESSEL);
      if (gespeichert) {
        App.projekt = SysM.Model.pruefeProjekt(JSON.parse(gespeichert));
        const zustand = JSON.parse(localStorage.getItem(ZUSTAND_SCHLUESSEL) || "{}");
        if (REITER_FOLGE.includes(zustand.tab)) App.tab = zustand.tab;
        if (zustand.aktiveKonfigId) App.aktiveKonfigId = zustand.aktiveKonfigId;
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
