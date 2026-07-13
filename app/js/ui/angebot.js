"use strict";
/*
 * Reiter „Angebot“ (Vertriebssicht): Der Vertrieb nimmt die Kundenanfrage
 * auf, beantwortet die Fragen – und bekommt sofort Machbarkeit, Maschinenbild
 * und Lieferumfang. Ein Klick erzeugt die Angebotsmappe als Datei:
 * die Übergabe an Kunde und Engineering, ohne Excel und E-Mail-Pingpong.
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
      "So läuft eine Anfrage: Kundenwünsche als Antworten erfassen – das Werkzeug prüft sofort die Machbarkeit ",
      "(die Regeln des Engineerings gelten auch hier), zeigt die Maschine und den Lieferumfang. ",
      "Die Angebotsmappe fasst alles in einer Datei zusammen; das Engineering arbeitet später mit genau denselben Daten weiter."));

    if (!fragen.length) {
      wurzel.append(leererHinweis(
        "Es gibt noch keine Fragen an den Kunden: Das Engineering markiert dafür unter „Merkmale“ mindestens ein Merkmal als Frage."));
      return;
    }

    const liste = h("div", { class: "baum" });
    for (const k of projekt.konfigurationen) {
      liste.append(h("button", {
        class: "baum-zeile" + (konfig && k.id === konfig.id ? " ausgewaehlt" : ""),
        onclick: () => { App.auswahl.konfigId = k.id; App.render(); },
      },
        h("span", { class: "baum-name" }, k.name),
        k.kunde ? h("span", { class: "baum-bmk" }, k.kunde) : null,
        App.aktiveKonfigId === k.id ? badge("in Übergabe aktiv", "typ-option") : null,
      ));
    }
    if (!projekt.konfigurationen.length) liste.append(leererHinweis("Noch keine Anfrage – legen Sie die erste an."));

    const linkerTeil = h("div", { class: "panel schmal" },
      h("div", { class: "panel-kopf" },
        h("h3", {}, "Anfragen"),
        h("button", {
          class: "knopf",
          onclick: () => {
            const neu = Model().neueKonfiguration({ name: "Anfrage " + (projekt.konfigurationen.length + 1) });
            projekt.konfigurationen.push(neu);
            App.auswahl.konfigId = neu.id;
            App.speichern();
            App.render();
          },
        }, "+ Neue Anfrage"),
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
      container.append(h("div", { class: "panel" }, leererHinweis("Keine Anfrage ausgewählt.")));
    }
    wurzel.append(container);
  }

  function renderFragen(projekt, konfig, fragen) {
    const panel = h("div", { class: "panel schmal" });
    panel.append(h("div", { class: "panel-kopf" },
      h("h3", {}, "Kundenanfrage"),
      h("div", { class: "knopf-reihe" },
        h("button", {
          class: "knopf leise",
          onclick: () => {
            const kopie = Model().neueKonfiguration({
              name: konfig.name + " (Kopie)",
              kunde: konfig.kunde,
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
            if (!confirm(`Anfrage „${konfig.name}“ löschen?`)) return;
            projekt.konfigurationen = projekt.konfigurationen.filter((k) => k.id !== konfig.id);
            if (App.aktiveKonfigId === konfig.id) App.aktiveKonfigId = "";
            App.auswahl.konfigId = null;
            App.speichern();
            App.render();
          },
        }, "Löschen"),
      ),
    ));

    panel.append(feld("Bezeichnung",
      textEingabe(konfig.name, (w) => { konfig.name = w || konfig.name; App.speichern(); App.render(); })));
    panel.append(feld("Kunde / Projekt",
      textEingabe(konfig.kunde, (w) => { konfig.kunde = w; App.speichern(); App.render(); }, { placeholder: "z. B. Muster GmbH, Linie 3" })));

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
    }, App.aktiveKonfigId === konfig.id ? "✓ Gilt für Kennzeichnung & Übergabe" : "Für Kennzeichnung & Übergabe verwenden"));

    return panel;
  }

  function renderErgebnis(projekt, konfig, ergebnis) {
    const panel = h("div", { class: "panel detail" });
    panel.append(h("div", { class: "panel-kopf" },
      h("h3", {}, "Angebot: " + konfig.name + (konfig.kunde ? " – " + konfig.kunde : "")),
      h("button", {
        class: "knopf",
        onclick: () => {
          const datei = erzeugeAngebotsmappe(projekt, konfig, ergebnis);
          UI.download(datei.dateiname, datei.inhalt, "text/html");
        },
      }, "Angebotsmappe erzeugen"),
    ));

    // Machbarkeit zuerst – das ist die Frage des Vertriebs.
    const fehlerAnzahl = ergebnis.meldungen.filter((m) => m.stufe === "Fehler").length;
    const warnungAnzahl = ergebnis.meldungen.filter((m) => m.stufe === "Warnung").length;
    if (fehlerAnzahl) {
      panel.append(h("div", { class: "meldung meldung-fehler" }, h("strong", {}, "Nicht machbar wie angefragt. "), "Details unten – vor dem Angebot mit dem Engineering klären."));
    } else if (warnungAnzahl) {
      panel.append(h("div", { class: "meldung meldung-warnung" }, h("strong", {}, "Machbar mit Einschränkungen. "), "Bitte Hinweise unten beachten."));
    } else {
      panel.append(h("p", { class: "gut" }, "✓ Machbar – keine Einwände aus den hinterlegten Engineering-Regeln."));
    }
    for (const m of ergebnis.meldungen) panel.append(meldungBox(m.stufe, m.text));

    // Sonderlösungen (ETO) im Umfang sichtbar machen – hier entsteht Aufwand.
    const etoImUmfang = SysM.Prozess.etoElemente(projekt, ergebnis.elementStatus);
    if (etoImUmfang.length) {
      panel.append(h("div", { class: "meldung meldung-warnung" },
        h("strong", {}, `${etoImUmfang.length} Sonderlösung(en) (ETO) im Lieferumfang: `),
        etoImUmfang.map((e) => `„${e.name}“`).join(", "),
        " – noch kein Firmenstandard, Engineering-Aufwand und Termin einplanen."));
    }

    // Maschinenbild
    const kennzeichen = SysM.Kennzeichnung.berechneKennzeichen(projekt);
    panel.append(Maschinenbild.render(projekt, {
      status: ergebnis.elementStatus,
      kennzeichen,
      maxHoehe: 300,
      onKlick: (el) => {
        if (el) { App.auswahl.elementId = el.id; App.zeigeTab("struktur"); }
      },
    }));

    // Lieferumfang: die Stationen/Baugruppen dieser Maschine
    const umfangBlock = h("div", { class: "unterblock" }, h("h4", {}, "Lieferumfang"));
    const chips = h("div", { class: "umfang-chips" });
    for (const { el, tiefe } of Model().elementeInBaumfolge(projekt)) {
      if (tiefe !== 1) continue;
      const status = ergebnis.elementStatus[el.id];
      const hatEto = el.eto || projekt.elemente.some((k) => k.eto && Model().istNachfahre(projekt, el.id, k.id));
      chips.append(h("span", {
        class: "umfang-chip" + (status.effektivEnthalten ? "" : " entfaellt") + (hatEto && status.effektivEnthalten ? " eto" : ""),
        title: status.grund + (hatEto ? " – enthält Sonderlösung (ETO)" : ""),
      }, (status.effektivEnthalten ? "✓ " : "✕ ") + el.name + (hatEto ? " (ETO)" : "")));
    }
    umfangBlock.append(chips);
    panel.append(umfangBlock);

    // Umfang als Liste (eingeklappt)
    const umfang = h("details", { class: "unterblock-details" },
      h("summary", {}, "Kompletter Maschinenumfang als Liste"));
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
    const werteBlock = h("div", { class: "unterblock" }, h("h4", {}, "Technische Daten dieser Maschine"));
    const tabelle = h("table", { class: "tabelle" },
      h("thead", {}, h("tr", {}, h("th", {}, "Merkmal"), h("th", {}, "Wert"), h("th", {}, "Woher?"))));
    const rumpf = h("tbody");
    for (const mk of projekt.merkmale) {
      const eintrag = ergebnis.werte[mk.id];
      if (!eintrag) continue;
      const quelle = eintrag.quelle.art === "Regel" ? `Regel „${eintrag.quelle.regelName}“` :
        eintrag.quelle.art === "Antwort" ? "Kundenanfrage" : "Standardwert";
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

    panel.append(feld("Interner Kommentar",
      h("textarea", { rows: 2, onchange: (e) => { konfig.kommentar = e.target.value; App.speichern(); } }, konfig.kommentar || "")));

    return panel;
  }

  // ---- Angebotsmappe ------------------------------------------------------------

  function htmlSicher(text) {
    return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /**
   * Erzeugt die Angebotsmappe als eigenständige HTML-Datei: Maschinenbild,
   * Anfrage, Lieferumfang, technische Daten und Hinweise – druck- und
   * mailfähig, für Kunde und Engineering dieselbe Quelle.
   */
  function erzeugeAngebotsmappe(projekt, konfig, ergebnis) {
    const kennzeichen = SysM.Kennzeichnung.berechneKennzeichen(projekt);
    const bild = Maschinenbild.render(projekt, { status: ergebnis.elementStatus, kennzeichen, maxHoehe: 420 });
    const svgEl = bild.querySelector("svg");
    svgEl.removeAttribute("style");
    const svg = new XMLSerializer().serializeToString(svgEl);
    const stand = new Date().toLocaleDateString("de-DE");
    const fragen = projekt.merkmale.filter((m) => m.istKonfiguration);

    const antwortenZeilen = fragen.map((mk) => {
      const eintrag = ergebnis.werte[mk.id];
      const wert = eintrag ? SysM.Model.merkmalWertAlsText(mk, eintrag.wert) : "–";
      const quelle = eintrag && eintrag.quelle.art === "Antwort" ? "" : " (Standard)";
      return `<tr><td>${htmlSicher(mk.name)}</td><td><strong>${htmlSicher(wert)}</strong>${quelle}</td></tr>`;
    }).join("");

    const umfangZeilen = SysM.Model.elementeInBaumfolge(projekt)
      .filter(({ tiefe }) => tiefe === 1 || tiefe === 2)
      .map(({ el, tiefe }) => {
        const status = ergebnis.elementStatus[el.id];
        const einzug = tiefe === 2 ? "&nbsp;&nbsp;&nbsp;&nbsp;" : "";
        const stil = status.effektivEnthalten ? "" : ' style="color:#999"';
        const vermerk = status.effektivEnthalten
          ? (el.verwendung === "option" ? " (gewählte Option)" : "") + (el.eto ? " <strong>(Sonderlösung ETO)</strong>" : "")
          : " – nicht im Lieferumfang";
        const herkunft = el.herkunftFunktion && el.herkunftFunktion.art === "funktion"
          ? `erfüllt „${htmlSicher(el.herkunftFunktion.funktionName)}“ (${htmlSicher(el.herkunftFunktion.loesungName)})`
          : htmlSicher(el.kommentar || "");
        return `<tr${stil}><td>${einzug}${status.effektivEnthalten ? "✓" : "✕"} ${htmlSicher(el.name)}${vermerk}</td><td>${herkunft}</td></tr>`;
      }).join("");

    const etoImUmfang = SysM.Prozess.etoElemente(projekt, ergebnis.elementStatus);
    const etoAbschnitt = etoImUmfang.length
      ? `<h2>Sonderlösungen (kundenspezifische Entwicklung)</h2>
         <p>Für die folgenden Umfänge gibt es noch keinen Firmenstandard – sie werden projektspezifisch
         konstruiert (Aufwand und Termin gesondert kalkulieren):</p>
         <ul>${etoImUmfang.map((e) => {
           const hf = e.herkunftFunktion;
           return `<li><strong>${htmlSicher(e.name)}</strong>${hf && hf.funktionName ? ` – für die Funktion „${htmlSicher(hf.funktionName)}“ im Prozessschritt „${htmlSicher(hf.schrittName)}“` : ""}</li>`;
         }).join("")}</ul>`
      : "";

    const prozessZeilen = (projekt.prozess || []).map((schritt, i) => {
      const loesungen = (schritt.funktionen || [])
        .filter((f) => f.loesungId)
        .map((f) => {
          const loesung = SysM.Bibliothek.findeLoesung(App.bibliothek, f.loesungId);
          const funktion = SysM.Bibliothek.findeFunktion(App.bibliothek, f.funktionId);
          return `${htmlSicher(funktion ? funktion.name : "?")}: ${htmlSicher(loesung ? loesung.name : "?")}`;
        }).join("<br>");
      return `<tr><td><strong>${i + 1}. ${htmlSicher(schritt.name)}</strong></td><td>${loesungen || "–"}</td></tr>`;
    }).join("");
    const prozessAbschnitt = prozessZeilen
      ? `<h2>Ihr Prozess – unsere Lösung</h2><table>${prozessZeilen}</table>`
      : "";

    const datenZeilen = projekt.merkmale
      .filter((mk) => !mk.istKonfiguration && ergebnis.werte[mk.id])
      .map((mk) => `<tr><td>${htmlSicher(mk.name)}</td><td><strong>${htmlSicher(SysM.Model.merkmalWertAlsText(mk, ergebnis.werte[mk.id].wert))}</strong></td></tr>`)
      .join("");

    const meldungen = ergebnis.meldungen.length
      ? "<ul>" + ergebnis.meldungen.map((m) => `<li><strong>${htmlSicher(m.stufe)}:</strong> ${htmlSicher(m.text)}</li>`).join("") + "</ul>"
      : "<p>Keine – die Anfrage ist ohne Einschränkungen machbar.</p>";

    const inhalt = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Angebotsmappe – ${htmlSicher(projekt.projekt.name)} – ${htmlSicher(konfig.name)}</title>
<style>
  body { font-family: "Segoe UI", system-ui, Arial, sans-serif; color: #1d2530; max-width: 900px; margin: 30px auto; padding: 0 20px; line-height: 1.5; }
  h1 { font-size: 24px; margin-bottom: 2px; }
  h2 { font-size: 17px; margin-top: 28px; border-bottom: 2px solid #1f5fa8; padding-bottom: 4px; }
  .meta { color: #5a6675; font-size: 14px; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; margin-top: 8px; }
  td { border: 1px solid #d7dde5; padding: 6px 10px; vertical-align: top; }
  .bild { text-align: center; margin: 16px 0; }
  .bild svg { max-width: 100%; height: auto; }
  .mb-box polygon { stroke: rgba(30,40,55,0.25); stroke-width: 0.8; stroke-linejoin: round; }
  .mb-box.mb-entfaellt { opacity: 0.22; }
  .mb-box.mb-option .mb-deckel { stroke: #b8860b; stroke-dasharray: 5 4; }
  .mb-deckel { fill: none; stroke: transparent; }
  .mb-name-sockel, .mb-name-frei { font-size: 12.5px; font-weight: 600; fill: #22303f; text-anchor: middle; paint-order: stroke; stroke: rgba(255,255,255,0.75); stroke-width: 3px; }
  .mb-bmk { font-family: Consolas, monospace; font-size: 10.5px; fill: #1f4d80; text-anchor: middle; paint-order: stroke; stroke: rgba(255,255,255,0.85); stroke-width: 3px; }
  .fuss { margin-top: 34px; font-size: 12px; color: #5a6675; border-top: 1px solid #d7dde5; padding-top: 8px; }
  @media print { body { margin: 10mm; } }
</style>
</head>
<body>
  <h1>Angebotsmappe: ${htmlSicher(projekt.projekt.name)}</h1>
  <p class="meta">${htmlSicher(konfig.name)}${konfig.kunde ? " · Kunde: " + htmlSicher(konfig.kunde) : ""} · Stand: ${stand}</p>
  ${projekt.projekt.beschreibung ? `<p>${htmlSicher(projekt.projekt.beschreibung)}</p>` : ""}

  <h2>Ihre Maschine</h2>
  <div class="bild">${svg}</div>

  ${prozessAbschnitt}

  <h2>Ihre Anforderungen</h2>
  <table>${antwortenZeilen}</table>

  <h2>Lieferumfang</h2>
  <table>${umfangZeilen}</table>

  ${etoAbschnitt}

  <h2>Technische Auslegung</h2>
  ${datenZeilen ? `<table>${datenZeilen}</table>` : "<p>Keine abgeleiteten Werte.</p>"}

  <h2>Hinweise aus der technischen Prüfung</h2>
  ${meldungen}

  <p class="fuss">Automatisch erzeugt mit SysModeller aus dem Projektmodell „${htmlSicher(projekt.projekt.name)}“.
  Angebot und Engineering arbeiten mit derselben Datenbasis – Änderungen an der Anfrage werden neu berechnet, nicht abgeschrieben.</p>
</body>
</html>`;

    const name = SysM.Sysml.bezeichner(projekt.projekt.name) + "_Angebotsmappe_" + SysM.Sysml.bezeichner(konfig.name) + ".html";
    return { dateiname: name, inhalt };
  }

  Tabs.angebot = { titel: "Angebot", render };
})();
