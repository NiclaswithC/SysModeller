"use strict";
/*
 * Reiter „Layout“ (Vertriebssicht, zweiter Schritt): das 2D-Hallenlayout.
 * Die Module aus dem Prozess werden in der Draufsicht angeordnet – anfassen
 * und verschieben, wie man eine Anlage in der Halle plant. Darunter läuft
 * dasselbe Modell live als 3D-Bild mit: Layout, 3D-Darstellung, Struktur
 * und Parameter sind eine einzige Datenbasis.
 */
(function () {
  const { h, infoBox, leererHinweis } = UI;
  const Model = () => SysM.Model;

  const S2 = 34;        // Pixel je Rastereinheit in der Draufsicht
  const RASTER = 0.5;   // Einrasten beim Verschieben

  function wurzelElement(projekt) {
    return projekt.elemente.find((e) => !e.elternId) || null;
  }

  function module(projekt) {
    const wurzel = wurzelElement(projekt);
    return wurzel ? Model().kinder(projekt, wurzel.id) : [];
  }

  function render(wurzel) {
    const projekt = App.projekt;

    wurzel.append(infoBox(
      "Ordnen Sie die Module an wie in der Halle: anfassen und verschieben, Raster ", String(RASTER),
      " m. Das ist keine Zeichnung, sondern dasselbe Modell wie überall – ",
      "das 3D-Bild darunter, die Parameter und später die Kennzeichen hängen direkt daran. ",
      "Neue Module kommen aus dem Prozess (Reiter davor) oder aus dem Baukasten in der Struktur."));

    const alle = module(projekt);
    if (!alle.length) {
      wurzel.append(leererHinweis(
        "Noch keine Module. Starten Sie im Reiter „Prozess“ (Prozessschritte → Funktionen → Lösungen → „Maschine aufbauen“)."));
      return;
    }

    const platziert = alle.filter((e) => Maschinenbild.hatLayout(e));
    const unplatziert = alle.filter((e) => !Maschinenbild.hatLayout(e));

    // Kopfzeile mit Werkzeugen
    const panel = h("div", { class: "panel" });
    panel.append(h("div", { class: "panel-kopf" },
      h("h3", {}, "Hallenlayout (Draufsicht)"),
      h("div", { class: "knopf-reihe" },
        h("button", {
          class: "knopf leise",
          title: "Alle Module in einer Reihe anordnen (aktuelle Reihenfolge)",
          onclick: () => {
            let x = 0;
            for (const el of alle) {
              const fp = Maschinenbild.fussabdruck(projekt, el);
              el.layout = { x, y: 0 };
              x += fp.w + 1;
            }
            App.speichern();
            App.render();
          },
        }, "In Reihe anordnen"),
        h("button", {
          class: "knopf leise",
          title: "Strukturreihenfolge (und damit die Kennzeichen-Nummerierung) dem Layout angleichen: links nach rechts",
          onclick: () => {
            SysM.Prozess.reihenfolgeAusLayout(projekt);
            App.speichern();
            App.render();
          },
        }, "Nummerierung ans Layout anpassen"),
      ),
    ));

    if (unplatziert.length) {
      const ablage = h("div", { class: "ly-ablage" },
        h("span", { class: "klein" }, "Noch zu platzieren: "));
      for (const el of unplatziert) {
        ablage.append(h("button", {
          class: "knopf leise",
          onclick: () => {
            const belegteX = platziert.map((p) => {
              const fp = Maschinenbild.fussabdruck(projekt, p);
              return p.layout.x + fp.w;
            });
            el.layout = { x: belegteX.length ? Math.ceil(Math.max(...belegteX)) + 1 : 0, y: 0 };
            App.speichern();
            App.render();
          },
        }, "+ " + el.name));
      }
      panel.append(ablage);
    }

    panel.append(renderZeichnung(projekt, platziert));
    panel.append(h("p", { class: "klein" },
      "Modul anklicken = auswählen und rechts Einzelheiten sehen · ziehen = verschieben. ",
      "Die Kennzeichen-Nummerierung folgt der Strukturreihenfolge – „Nummerierung ans Layout anpassen“ gleicht sie an."));

    const zeile = h("div", { class: "split" });

    // 3D-Ansicht: dasselbe Modell, live
    const dreiD = h("div", { class: "panel detail" },
      h("h3", {}, "Dasselbe Modell in 3D"));
    const kennzeichen = SysM.Kennzeichnung.berechneKennzeichen(projekt);
    dreiD.append(Maschinenbild.render(projekt, {
      auswahlId: App.auswahl.elementId,
      kennzeichen,
      maxHoehe: 300,
      onKlick: (el) => { if (el) { App.auswahl.elementId = el.id; App.render(); } },
    }));
    dreiD.append(h("p", { class: "klein" },
      "Keine zweite Datenpflege: Das 3D-Bild entsteht aus Layout + Struktur. ",
      "Später kann hier je Modul ein echtes CAD-Hüllmodell (JT/STEP) hinterlegt werden, ohne dass sich am Datenmodell etwas ändert."));

    zeile.append(dreiD);
    zeile.append(renderModulInfo(projekt));

    wurzel.append(panel, zeile);
  }

  // ---- Draufsicht (SVG) --------------------------------------------------------

  function renderZeichnung(projekt, platziert) {
    const SVGNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("class", "ly-svg");

    // Bildausschnitt
    let maxX = 20;
    let maxY = 10;
    const eintraege = platziert.map((el) => {
      const fp = Maschinenbild.fussabdruck(projekt, el);
      maxX = Math.max(maxX, el.layout.x + fp.w + 2);
      maxY = Math.max(maxY, el.layout.y + fp.d + 2);
      return { el, fp };
    });
    svg.setAttribute("viewBox", `${-S2} ${-S2} ${(maxX + 1) * S2 + S2} ${(maxY + 1) * S2 + S2}`);

    // Raster
    const defs = document.createElementNS(SVGNS, "defs");
    defs.innerHTML =
      `<pattern id="ly-raster" width="${S2}" height="${S2}" patternUnits="userSpaceOnUse">` +
      `<path d="M ${S2} 0 L 0 0 0 ${S2}" fill="none" stroke="#dde3ea" stroke-width="1"/></pattern>`;
    svg.append(defs);
    const boden = document.createElementNS(SVGNS, "rect");
    boden.setAttribute("x", -S2); boden.setAttribute("y", -S2);
    boden.setAttribute("width", (maxX + 2) * S2); boden.setAttribute("height", (maxY + 2) * S2);
    boden.setAttribute("fill", "url(#ly-raster)");
    svg.append(boden);

    for (const { el, fp } of eintraege) {
      svg.append(zeichneModul(projekt, svg, el, fp));
    }
    return svg;
  }

  function zeichneModul(projekt, svg, el, fp) {
    const SVGNS = "http://www.w3.org/2000/svg";
    const farben = Maschinenbild.FARBEN[el.typ] || Maschinenbild.FARBEN.Station;
    const gruppe = document.createElementNS(SVGNS, "g");
    gruppe.setAttribute("class", "ly-station"
      + (App.auswahl.elementId === el.id ? " ausgewaehlt" : "")
      + (el.eto ? " eto" : "")
      + (el.verwendung === "option" ? " option" : ""));
    gruppe.setAttribute("transform", `translate(${el.layout.x * S2}, ${el.layout.y * S2})`);
    gruppe.setAttribute("data-element-id", el.id);

    const rect = document.createElementNS(SVGNS, "rect");
    rect.setAttribute("width", fp.w * S2);
    rect.setAttribute("height", fp.d * S2);
    rect.setAttribute("rx", 6);
    rect.setAttribute("fill", farben[0]);
    gruppe.append(rect);

    // Kinder angedeutet (kleine Kästchen wie im 3D-Bild)
    for (const kind of fp.kinder || []) {
      const kk = document.createElementNS(SVGNS, "rect");
      kk.setAttribute("x", kind.x * S2);
      kk.setAttribute("y", kind.y * S2);
      kk.setAttribute("width", kind.fp.w * S2);
      kk.setAttribute("height", kind.fp.d * S2);
      kk.setAttribute("rx", 3);
      kk.setAttribute("class", "ly-kind");
      const titel = document.createElementNS(SVGNS, "title");
      titel.textContent = kind.el.name;
      kk.append(titel);
      gruppe.append(kk);
    }

    const text = document.createElementNS(SVGNS, "text");
    text.setAttribute("x", (fp.w * S2) / 2);
    text.setAttribute("y", fp.d * S2 - 8);
    text.setAttribute("class", "ly-name");
    text.textContent = el.name + (el.eto ? " (ETO)" : "");
    gruppe.append(text);

    verdrahteZiehen(projekt, svg, gruppe, el);
    return gruppe;
  }

  /** Ziehen mit Einrasten; kurzer Klick wählt nur aus. */
  function verdrahteZiehen(projekt, svg, gruppe, el) {
    let start = null;

    function svgPunkt(ereignis) {
      const punkt = new DOMPoint(ereignis.clientX, ereignis.clientY);
      return punkt.matrixTransform(svg.getScreenCTM().inverse());
    }

    gruppe.addEventListener("pointerdown", (ereignis) => {
      ereignis.preventDefault();
      const p = svgPunkt(ereignis);
      start = { px: p.x, py: p.y, x: el.layout.x, y: el.layout.y, bewegt: false };
      try { gruppe.setPointerCapture(ereignis.pointerId); } catch (fehler) { /* z. B. synthetische Events */ }
      gruppe.classList.add("zieht");
    });
    gruppe.addEventListener("pointermove", (ereignis) => {
      if (!start) return;
      const p = svgPunkt(ereignis);
      const dx = (p.x - start.px) / S2;
      const dy = (p.y - start.py) / S2;
      if (Math.abs(dx) + Math.abs(dy) > 0.1) start.bewegt = true;
      const nx = Math.max(0, Math.round((start.x + dx) / RASTER) * RASTER);
      const ny = Math.max(0, Math.round((start.y + dy) / RASTER) * RASTER);
      el.layout = { x: nx, y: ny };
      gruppe.setAttribute("transform", `translate(${nx * S2}, ${ny * S2})`);
    });
    gruppe.addEventListener("pointerup", () => {
      if (!start) return;
      const bewegt = start.bewegt;
      start = null;
      gruppe.classList.remove("zieht");
      App.auswahl.elementId = el.id;
      if (bewegt) App.speichern();
      App.render();
    });
  }

  // ---- Modul-Info (das, was „dranhängt“) ----------------------------------------

  function renderModulInfo(projekt) {
    const panel = h("div", { class: "panel schmal" });
    const el = App.auswahl.elementId ? Model().findeElement(projekt, App.auswahl.elementId) : null;
    if (!el) {
      panel.append(h("h3", {}, "Modul-Info"),
        leererHinweis("Ein Modul im Layout anklicken – hier stehen dann Herkunft, Inhalt und Parameter."));
      return panel;
    }

    const kennzeichen = SysM.Kennzeichnung.berechneKennzeichen(projekt);
    const kz = kennzeichen[el.id] || {};
    panel.append(h("h3", {}, el.name));
    panel.append(h("p", { class: "klein" }, "Kennzeichen: ", h("code", {}, kz.bmk || "–")));

    if (el.herkunftFunktion && el.herkunftFunktion.art === "funktion") {
      panel.append(h("p", { class: "klein" },
        `Erfüllt „${el.herkunftFunktion.funktionName}“ (${el.herkunftFunktion.loesungName}) im Schritt „${el.herkunftFunktion.schrittName}“.`));
    }
    if (el.herkunft) {
      panel.append(h("p", { class: "klein" }, `Firmenstandard „${el.herkunft.name}“ v${el.herkunft.version}.`));
    }
    if (el.eto) {
      panel.append(h("div", { class: "meldung meldung-warnung" },
        h("strong", {}, "Sonderlösung (ETO)"), " – wird vom Engineering ausgearbeitet."));
    }

    // Inhalt (die Komponenten, die schon „dranhängen“)
    const inhalt = projekt.elemente.filter((e) => Model().istNachfahre(projekt, el.id, e.id) && e.typ === "Komponente");
    if (inhalt.length) {
      panel.append(h("p", { class: "klein" }, h("strong", {}, "Enthaltene Komponenten: "),
        inhalt.map((k) => k.name).join(", ")));
    }

    // Parameter (Merkmalwerte im Unterbaum)
    const werte = [];
    for (const e of [el].concat(projekt.elemente.filter((x) => Model().istNachfahre(projekt, el.id, x.id)))) {
      for (const [mkId, wert] of Object.entries(e.merkmalwerte || {})) {
        const mk = Model().findeMerkmal(projekt, mkId);
        if (mk && wert !== "") werte.push(`${mk.name} = ${Model().merkmalWertAlsText(mk, wert)}`);
      }
    }
    if (werte.length) {
      panel.append(h("p", { class: "klein" }, h("strong", {}, "Parameter: "), werte.join(" · ")));
    }

    panel.append(h("div", { class: "knopf-reihe" },
      h("button", { class: "knopf leise", onclick: () => App.zeigeTab("struktur") }, "Im Engineering öffnen"),
      h("button", { class: "knopf leise", onclick: () => App.zeigeTab("angebot") }, "Zum Angebot"),
    ));
    return panel;
  }

  Tabs.layout = { titel: "Layout", render };
})();
