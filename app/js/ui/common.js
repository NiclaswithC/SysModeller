"use strict";
/*
 * SysModeller – gemeinsame Oberflächen-Hilfen (ohne Framework).
 */
const UI = (() => {

  /** Erzeugt ein DOM-Element. attrs: class, on*-Handler, value, checked, … */
  function h(tag, attrs, ...kinder) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k === "value") el.value = v;
      else if (k === "checked") el.checked = !!v;
      else if (k === "disabled") el.disabled = !!v;
      else if (k === "selected") el.selected = !!v;
      else if (k === "dataset") Object.assign(el.dataset, v);
      else el.setAttribute(k, v);
    }
    for (const kind of kinder.flat(Infinity)) {
      if (kind === undefined || kind === null || kind === false) continue;
      el.append(kind instanceof Node ? kind : document.createTextNode(String(kind)));
    }
    return el;
  }

  /** Auswahlliste. optionen: [{wert, text}] oder Strings. */
  function select(optionen, wert, onChange, attrs) {
    const sel = h("select", Object.assign({ onchange: (e) => onChange && onChange(e.target.value) }, attrs || {}));
    for (const opt of optionen) {
      const o = typeof opt === "string" ? { wert: opt, text: opt } : opt;
      sel.append(h("option", { value: o.wert, selected: String(o.wert) === String(wert ?? "") }, o.text));
    }
    return sel;
  }

  /** Formularzeile: Beschriftung + Eingabe + optionaler Hinweis. */
  function feld(beschriftung, eingabe, hinweis) {
    return h("label", { class: "feld" },
      h("span", { class: "feld-name" }, beschriftung),
      eingabe,
      hinweis ? h("span", { class: "feld-hinweis" }, hinweis) : null);
  }

  /** Texteingabe, die beim Verlassen/Enter übernimmt (kein Neuzeichnen je Taste). */
  function textEingabe(wert, onChange, attrs) {
    return h("input", Object.assign({
      type: "text",
      value: wert ?? "",
      onchange: (e) => onChange(e.target.value),
    }, attrs || {}));
  }

  /**
   * Eingabe für einen Merkmalwert, passend zum Merkmaltyp:
   * Zahl -> Textfeld, Ja/Nein und Auswahl -> Liste, Text -> Textfeld.
   */
  function wertEingabe(merkmal, wert, onChange, attrs) {
    if (!merkmal) return textEingabe(wert, onChange, attrs);
    if (merkmal.typ === "jaNein") {
      return select([{ wert: "", text: "–" }, { wert: "ja", text: "ja" }, { wert: "nein", text: "nein" }], wert ?? "", onChange, attrs);
    }
    if (merkmal.typ === "auswahl") {
      const optionen = [{ wert: "", text: "–" }].concat((merkmal.werte || []).map((w) => ({ wert: w, text: w })));
      if (wert && !(merkmal.werte || []).includes(wert)) optionen.push({ wert, text: wert + " (nicht in Liste)" });
      return select(optionen, wert ?? "", onChange, attrs);
    }
    const eingabe = textEingabe(wert, onChange, attrs);
    if (merkmal.typ === "zahl") eingabe.setAttribute("inputmode", "decimal");
    return eingabe;
  }

  function infoBox(...inhalt) {
    return h("div", { class: "info-box" }, ...inhalt);
  }

  function badge(text, klasse) {
    return h("span", { class: "badge " + (klasse || "") }, text);
  }

  function meldungBox(stufe, text) {
    const klasse = stufe === "Fehler" ? "meldung-fehler" : stufe === "Warnung" ? "meldung-warnung" : "meldung-hinweis";
    return h("div", { class: "meldung " + klasse }, h("strong", {}, stufe + ": "), text);
  }

  function leererHinweis(text) {
    return h("div", { class: "leer-hinweis" }, text);
  }

  /** Datei-Download aus einem String. */
  function download(dateiname, inhalt, mime) {
    const blob = new Blob([inhalt], { type: (mime || "text/plain") + ";charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = dateiname;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return { h, select, feld, textEingabe, wertEingabe, infoBox, badge, meldungBox, leererHinweis, download };
})();

/** Sammelbecken für die Reiter; app.js zeichnet daraus die Navigation. */
window.Tabs = window.Tabs || {};
