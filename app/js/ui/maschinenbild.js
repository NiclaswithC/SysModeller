"use strict";
/*
 * SysModeller – Maschinenbild: interaktive, isometrische Blockansicht.
 *
 * Die Struktur wird als 3D-Blockbild gezeichnet: die Anlage als Grundplatte,
 * Stationen als Sockel nebeneinander (die Linie), Baugruppen und Komponenten
 * als Blöcke darauf. Alles ist rein aus der Struktur berechnet – kein CAD,
 * aber dieselbe räumliche Denkweise: anklicken, ablegen, wiedererkennen.
 *
 * Optionen (alle optional):
 *   auswahlId     – hervorgehobenes Element
 *   onKlick(el)   – Klick auf einen Block
 *   onDrop(vorlageId, zielEl) – Baukasten-Baustein auf einen Block gezogen
 *   status        – elementStatus einer Auswertung: nicht Enthaltenes wird blass
 *   kennzeichen   – Ergebnis von berechneKennzeichen (für BMK-Beschriftung)
 *   zeigeBmk      – BMK über den Komponenten anzeigen
 *   maxHoehe      – CSS-Maximalhöhe in px (Vorgabe 420)
 */
(function () {
  const SVGNS = "http://www.w3.org/2000/svg";

  const HOEHEN = { Anlage: 0.32, Teilanlage: 0.55, Station: 0.85, Baugruppe: 0.5, Komponente: 0.9 };
  const ABSTAND = 0.5;   // Lücke zwischen Geschwistern
  const RAND = 0.55;     // Innenrand eines Sockels
  const S = 46;          // Weltmaßstab in px
  const C30 = Math.cos(Math.PI / 6);

  // Farbtripel je Ebene: [Deckfläche, rechte Fläche, linke Fläche]
  const FARBEN = {
    Anlage: ["#dde5ee", "#c3cfdd", "#aebccd"],
    Teilanlage: ["#cfe3df", "#b2cfc9", "#9bbfb8"],
    Station: ["#d9d4ee", "#bfb7e0", "#a99fd2"],
    Baugruppe: ["#ecdfc2", "#dcc99d", "#c9b283"],
    Komponente: ["#c6d3e4", "#a9bcd6", "#93a9c7"],
  };

  function proj(x, y, z) {
    return { x: (x - y) * C30 * S, y: (x + y) * 0.5 * S - z * S };
  }

  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    return el;
  }

  function hatLayout(el) {
    return el.layout && typeof el.layout.x === "number" && typeof el.layout.y === "number";
  }

  /**
   * Grundfläche (Breite/Tiefe) eines Elements samt Kind-Positionen.
   * Auf der obersten Ebene gelten die 2D-Layout-Positionen der Module
   * (Reiter „Layout“); Module ohne Position reihen sich dahinter auf.
   */
  function fussabdruck(projekt, el) {
    const Model = SysM.Model;
    const kinder = Model.kinder(projekt, el.id);
    if (!kinder.length) {
      if (el.typ === "Komponente") return { w: 1.15, d: 1.15, kinder: [] };
      return { w: 2.4, d: 1.7, kinder: [] };
    }
    const teile = kinder.map((k) => ({ el: k, fp: fussabdruck(projekt, k) }));

    if (!el.elternId) {
      const positionen = [];
      let maxX = 0;
      let maxY = 0;
      for (const t of teile.filter((t) => hatLayout(t.el))) {
        positionen.push({ el: t.el, fp: t.fp, x: RAND + t.el.layout.x, y: RAND + t.el.layout.y });
        maxX = Math.max(maxX, t.el.layout.x + t.fp.w);
        maxY = Math.max(maxY, t.el.layout.y + t.fp.d);
      }
      let x = positionen.length ? maxX + ABSTAND : 0;
      for (const t of teile.filter((t) => !hatLayout(t.el))) {
        positionen.push({ el: t.el, fp: t.fp, x: RAND + x, y: RAND });
        x += t.fp.w + ABSTAND;
        maxX = Math.max(maxX, x - ABSTAND);
        maxY = Math.max(maxY, t.fp.d);
      }
      return { w: maxX + 2 * RAND, d: maxY + 2 * RAND, kinder: positionen };
    }

    const flaeche = teile.reduce((summe, t) => summe + (t.fp.w + ABSTAND) * (t.fp.d + ABSTAND), 0);
    const maxBreite = Math.max(Math.sqrt(flaeche) * 1.5, ...teile.map((t) => t.fp.w));
    let x = 0;
    let y = 0;
    let zeilenTiefe = 0;
    let breite = 0;
    const positionen = [];
    for (const t of teile) {
      if (x > 0 && x + t.fp.w > maxBreite + 0.01) {
        x = 0;
        y += zeilenTiefe + ABSTAND;
        zeilenTiefe = 0;
      }
      positionen.push({ el: t.el, fp: t.fp, x: x + RAND, y: y + RAND });
      x += t.fp.w + ABSTAND;
      zeilenTiefe = Math.max(zeilenTiefe, t.fp.d);
      breite = Math.max(breite, x - ABSTAND);
    }
    return { w: breite + 2 * RAND, d: y + zeilenTiefe + 2 * RAND, kinder: positionen };
  }

  function zeichneBox(gruppe, x, y, z, w, d, h, farben, klasse) {
    const zh = z + h;
    const p = (px, py, pz) => {
      const q = proj(px, py, pz);
      return q.x.toFixed(1) + "," + q.y.toFixed(1);
    };
    const flaechen = [
      { punkte: [p(x + w, y, zh), p(x + w, y + d, zh), p(x + w, y + d, z), p(x + w, y, z)], farbe: farben[1] },
      { punkte: [p(x, y + d, zh), p(x + w, y + d, zh), p(x + w, y + d, z), p(x, y + d, z)], farbe: farben[2] },
      { punkte: [p(x, y, zh), p(x + w, y, zh), p(x + w, y + d, zh), p(x, y + d, zh)], farbe: farben[0] },
    ];
    for (const f of flaechen) {
      gruppe.append(svgEl("polygon", { points: f.punkte.join(" "), fill: f.farbe, class: klasse || "" }));
    }
  }

  /**
   * Zeichnet das Maschinenbild und liefert ein fertiges DOM-Element.
   */
  function render(projekt, opts) {
    opts = opts || {};
    const Model = SysM.Model;
    const svg = svgEl("svg", { class: "mb-svg" });
    const inhalt = svgEl("g", {});
    svg.append(inhalt);

    const wurzeln = projekt.elemente.filter((e) => !e.elternId);
    let cursorX = 0;
    const boxen = [];

    function platziere(el, fp, x, y, z) {
      const status = opts.status ? opts.status[el.id] : null;
      const enthalten = status ? status.effektivEnthalten : true;
      const h = HOEHEN[el.typ] !== undefined ? HOEHEN[el.typ] : 0.6;
      boxen.push({ el, x, y, z, w: fp.w, d: fp.d, h, enthalten, fp });
      const sortiert = fp.kinder.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y));
      for (const kind of sortiert) {
        platziere(kind.el, kind.fp, x + kind.x, y + kind.y, z + h);
      }
    }

    for (const wurzel of wurzeln) {
      const fp = fussabdruck(projekt, wurzel);
      platziere(wurzel, fp, cursorX, 0, 0);
      cursorX += fp.w + 1.2;
    }

    // Zeichnen in Ablagereihenfolge (Eltern vor Kindern, Geschwister sortiert)
    for (const box of boxen) {
      const gruppe = svgEl("g", {
        class: "mb-box"
          + (opts.auswahlId === box.el.id ? " mb-ausgewaehlt" : "")
          + (!box.enthalten ? " mb-entfaellt" : "")
          + (box.el.verwendung === "option" ? " mb-option" : "")
          + (box.el.eto ? " mb-eto" : ""),
        "data-element-id": box.el.id,
      });
      const farben = FARBEN[box.el.typ] || FARBEN.Komponente;
      zeichneBox(gruppe, box.x, box.y, box.z, box.w, box.d, box.h, farben);

      // Umriss der Deckfläche (Auswahl / Option)
      const zh = box.z + box.h;
      const deckpunkte = [
        proj(box.x, box.y, zh), proj(box.x + box.w, box.y, zh),
        proj(box.x + box.w, box.y + box.d, zh), proj(box.x, box.y + box.d, zh),
      ].map((q) => q.x.toFixed(1) + "," + q.y.toFixed(1)).join(" ");
      gruppe.append(svgEl("polygon", { points: deckpunkte, class: "mb-deckel", fill: "none" }));

      // Tooltip
      const kz = opts.kennzeichen ? opts.kennzeichen[box.el.id] : null;
      const titel = svgEl("title", {});
      titel.textContent = box.el.name + (kz && kz.bmk ? "  " + kz.bmk : "") +
        (box.el.verwendung === "option" ? "  (Option)" : "") +
        (box.el.eto ? "  (Sonderlösung ETO)" : "") +
        (!box.enthalten ? "  – in dieser Variante nicht enthalten" : "");
      gruppe.append(titel);

      // Beschriftung: Sockel vorn auf der linken Fläche, Komponenten klein auf dem Deckel
      if (box.fp.kinder.length) {
        const mitte = proj(box.x + box.w / 2, box.y + box.d, box.z + box.h / 2);
        const text = svgEl("text", { x: mitte.x.toFixed(1), y: (mitte.y + 4).toFixed(1), class: "mb-name-sockel" });
        text.textContent = box.el.name;
        gruppe.append(text);
      } else if (box.el.typ !== "Komponente" || opts.auswahlId === box.el.id) {
        const mitte = proj(box.x + box.w / 2, box.y + box.d / 2, zh);
        const text = svgEl("text", { x: mitte.x.toFixed(1), y: (mitte.y - 6).toFixed(1), class: "mb-name-frei" });
        text.textContent = box.el.name;
        gruppe.append(text);
      }
      if (opts.zeigeBmk && kz && kz.bmk && box.el.typ === "Komponente") {
        const mitte = proj(box.x + box.w / 2, box.y + box.d / 2, zh);
        const text = svgEl("text", { x: mitte.x.toFixed(1), y: (mitte.y - 5).toFixed(1), class: "mb-bmk" });
        text.textContent = kz.bmk;
        gruppe.append(text);
      }

      if (opts.onKlick) {
        gruppe.addEventListener("click", (ereignis) => {
          ereignis.stopPropagation();
          opts.onKlick(box.el);
        });
      }
      if (opts.onDrop) {
        gruppe.addEventListener("dragover", (ereignis) => {
          ereignis.preventDefault();
          gruppe.classList.add("mb-dropziel");
        });
        gruppe.addEventListener("dragleave", () => gruppe.classList.remove("mb-dropziel"));
        gruppe.addEventListener("drop", (ereignis) => {
          ereignis.preventDefault();
          ereignis.stopPropagation();
          gruppe.classList.remove("mb-dropziel");
          const vorlageId = ereignis.dataTransfer.getData("text/vorlage");
          if (vorlageId) opts.onDrop(vorlageId, box.el);
        });
      }

      inhalt.append(gruppe);
    }

    // Bildausschnitt anpassen
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const box of boxen) {
      for (const [px, py, pz] of [
        [box.x, box.y, box.z], [box.x + box.w, box.y, box.z + box.h],
        [box.x, box.y + box.d, box.z + box.h], [box.x + box.w, box.y + box.d, box.z],
        [box.x, box.y, box.z + box.h], [box.x + box.w, box.y + box.d, box.z + box.h],
      ]) {
        const q = proj(px, py, pz);
        minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x);
        minY = Math.min(minY, q.y); maxY = Math.max(maxY, q.y);
      }
    }
    if (!boxen.length) { minX = 0; minY = 0; maxX = 100; maxY = 60; }
    const rand = 26;
    svg.setAttribute("viewBox",
      `${(minX - rand).toFixed(0)} ${(minY - rand).toFixed(0)} ${(maxX - minX + 2 * rand).toFixed(0)} ${(maxY - minY + 2 * rand).toFixed(0)}`);

    const behaelter = document.createElement("div");
    behaelter.className = "mb-behaelter";
    const zoom = opts.zoom || 1;
    svg.style.maxHeight = ((opts.maxHoehe || 420) * zoom) + "px";
    if (zoom !== 1) svg.style.minHeight = Math.min((opts.maxHoehe || 420) * zoom, 900) + "px";
    behaelter.append(svg);

    if (opts.onDrop) {
      behaelter.addEventListener("dragover", (ereignis) => ereignis.preventDefault());
      behaelter.addEventListener("drop", (ereignis) => {
        ereignis.preventDefault();
        const vorlageId = ereignis.dataTransfer.getData("text/vorlage");
        if (vorlageId) opts.onDrop(vorlageId, null);
      });
    }
    if (opts.onKlick) {
      svg.addEventListener("click", () => opts.onKlick(null));
    }

    return behaelter;
  }

  /** Kleine Legende zu den Blockfarben. */
  function legende() {
    const div = document.createElement("div");
    div.className = "mb-legende";
    for (const typ of ["Anlage", "Station", "Baugruppe", "Komponente"]) {
      const eintrag = document.createElement("span");
      eintrag.className = "mb-legende-eintrag";
      const farbe = document.createElement("span");
      farbe.className = "mb-legende-farbe";
      farbe.style.background = FARBEN[typ][0];
      farbe.style.borderColor = FARBEN[typ][2];
      eintrag.append(farbe, typ);
      div.append(eintrag);
    }
    const option = document.createElement("span");
    option.className = "mb-legende-eintrag";
    const kaestchen = document.createElement("span");
    kaestchen.className = "mb-legende-farbe mb-legende-option";
    option.append(kaestchen, "Option");
    div.append(option);
    const eto = document.createElement("span");
    eto.className = "mb-legende-eintrag";
    const etoKasten = document.createElement("span");
    etoKasten.className = "mb-legende-farbe mb-legende-eto";
    eto.append(etoKasten, "Sonderlösung (ETO)");
    div.append(eto);
    return div;
  }

  window.Maschinenbild = { render, legende, FARBEN, fussabdruck, hatLayout };
})();
