"use strict";
/*
 * SysModeller – Firmenstandard-Bibliothek.
 *
 * Antwort auf das Wiederverwendungs-Problem: Ein Modul („Förderband Typ A“)
 * wird EINMAL definiert – mit Struktur (Mechanik), Komponenten und
 * Produktklassen (Elektrik), Signalen (Software) und Merkmalen (Vertrieb/
 * Auslegung). Jede Disziplin sieht denselben Schnitt, nur als andere
 * Projektion. Module sind versioniert; eingefügte Instanzen kennen ihre
 * Herkunft, und das Werkzeug erkennt Abweichungen vom Standard.
 *
 * Die Bibliothek lebt getrennt vom Projekt (sie gilt firmenweit) und ist
 * als einzelne Datei exportier-/importierbar.
 */
(function (ns) {

  function dep(name, pfad) {
    if (ns[name]) return ns[name];
    return require(pfad);
  }

  // ---- Normalform: Struktur ohne IDs, Merkmale über Namen referenziert ------

  function merkmalName(projekt, merkmalId) {
    const Model = dep("Model", "./model.js");
    const mk = Model.findeMerkmal(projekt, merkmalId);
    return mk ? mk.name : "?";
  }

  /** Element samt Unterbaum in eine vergleichbare, ID-freie Form bringen. */
  function normalisiereElement(projekt, el) {
    const Model = dep("Model", "./model.js");
    return {
      name: el.name,
      typ: el.typ,
      kuerzel: el.kuerzel || "",
      produktKlasse: el.produktKlasse || "",
      ort: el.ort || "",
      verwendung: el.verwendung === "option" ? "option" : "standard",
      bedingung: (el.bedingung || []).map((b) => ({
        merkmal: merkmalName(projekt, b.merkmalId), op: b.op, wert: b.wert,
      })),
      merkmalwerte: Object.entries(el.merkmalwerte || {})
        .map(([mkId, wert]) => ({ merkmal: merkmalName(projekt, mkId), wert }))
        .sort((a, b) => a.merkmal.localeCompare(b.merkmal)),
      signale: (el.signale || []).map((sig) => ({
        name: sig.name, richtung: sig.richtung, datentyp: sig.datentyp,
      })),
      kinder: Model.kinder(projekt, el.id).map((k) => normalisiereElement(projekt, k)),
    };
  }

  /** Alle im Unterbaum verwendeten Merkmal-IDs einsammeln. */
  function verwendeteMerkmale(projekt, el) {
    const Model = dep("Model", "./model.js");
    const ids = new Set();
    function absteigen(e) {
      for (const b of e.bedingung || []) ids.add(b.merkmalId);
      for (const mkId of Object.keys(e.merkmalwerte || {})) ids.add(mkId);
      for (const kind of Model.kinder(projekt, e.id)) absteigen(kind);
    }
    absteigen(el);
    return Array.from(ids)
      .map((id) => Model.findeMerkmal(projekt, id))
      .filter(Boolean);
  }

  // ---- Veröffentlichen -------------------------------------------------------

  /**
   * Erstellt aus einem Element (samt Unterbaum) ein Bibliotheksmodul.
   * meta: { name, version, beschreibung, stand }
   */
  function schnappschuss(projekt, elementId, meta) {
    const Model = dep("Model", "./model.js");
    const el = Model.findeElement(projekt, elementId);
    if (!el) return null;
    const wurzel = normalisiereElement(projekt, el);
    wurzel.name = meta.name || el.name;
    return {
      id: Model.neueId("md"),
      name: meta.name || el.name,
      version: meta.version || 1,
      beschreibung: meta.beschreibung || "",
      stand: meta.stand || "",
      wurzel,
      merkmale: verwendeteMerkmale(projekt, el).map((mk) => ({
        name: mk.name, typ: mk.typ, einheit: mk.einheit, werte: (mk.werte || []).slice(),
        min: mk.min || "", max: mk.max || "", istKonfiguration: !!mk.istKonfiguration,
        standardwert: mk.standardwert, irdi: mk.irdi || "", kommentar: mk.kommentar || "",
      })),
    };
  }

  // ---- Einfügen ---------------------------------------------------------------

  /**
   * Fügt ein Modul in das Projekt ein. Merkmale werden über IRDI (bevorzugt)
   * oder Namen wiedererkannt; fehlende Merkmale werden angelegt.
   * Liefert das eingefügte Wurzelelement.
   */
  function einfuegen(projekt, modul, elternId) {
    const Model = dep("Model", "./model.js");

    const merkmalIds = {}; // Merkmalname im Modul -> Merkmal-ID im Projekt
    for (const def of modul.merkmale || []) {
      let mk = def.irdi ? projekt.merkmale.find((m) => m.irdi === def.irdi) : null;
      if (!mk) mk = projekt.merkmale.find((m) => m.name === def.name);
      if (!mk) {
        mk = Model.neuesMerkmal(def);
        projekt.merkmale.push(mk);
      }
      merkmalIds[def.name] = mk.id;
    }

    function anlegen(knoten, eltern, istWurzel) {
      const el = Model.neuesElement({
        name: istWurzel ? Model.eindeutigerName(projekt, eltern, knoten.name) : knoten.name,
        typ: knoten.typ,
        elternId: eltern,
        kuerzel: knoten.kuerzel || "",
        produktKlasse: knoten.produktKlasse || "",
        ort: knoten.ort || "",
        verwendung: knoten.verwendung === "option" ? "option" : "standard",
        bedingung: (knoten.bedingung || [])
          .filter((b) => merkmalIds[b.merkmal])
          .map((b) => ({ merkmalId: merkmalIds[b.merkmal], op: b.op, wert: b.wert })),
        signale: (knoten.signale || []).map((sig) => Model.neuesSignal(sig)),
      });
      el.merkmalwerte = {};
      for (const eintrag of knoten.merkmalwerte || []) {
        if (merkmalIds[eintrag.merkmal]) el.merkmalwerte[merkmalIds[eintrag.merkmal]] = eintrag.wert;
      }
      if (istWurzel) {
        el.herkunft = { modulId: modul.id, name: modul.name, version: modul.version };
      }
      projekt.elemente.push(el);
      for (const kind of knoten.kinder || []) anlegen(kind, el.id, false);
      return el;
    }

    return anlegen(modul.wurzel, elternId || null, true);
  }

  // ---- Abweichungs-Prüfung ------------------------------------------------------

  /**
   * Vergleicht eine Instanz im Projekt mit ihrem Bibliotheksmodul.
   * Liefert { gleich, unterschiede: [Text] }. Der Name des Wurzelelements
   * darf abweichen (Instanzen werden nummeriert), Kommentare ebenfalls.
   */
  function vergleiche(projekt, elementId, modul) {
    const Model = dep("Model", "./model.js");
    const el = Model.findeElement(projekt, elementId);
    if (!el || !modul) return { gleich: false, unterschiede: ["Element oder Modul nicht gefunden."] };
    const ist = normalisiereElement(projekt, el);
    ist.name = modul.wurzel.name; // Instanzname darf abweichen
    const unterschiede = [];

    function vergleicheKnoten(a, b, pfad) {
      for (const feld of ["name", "typ", "kuerzel", "produktKlasse", "ort", "verwendung"]) {
        if (String(a[feld]) !== String(b[feld])) {
          unterschiede.push(`${pfad}: ${feld} ist „${a[feld]}“, Standard sagt „${b[feld]}“`);
        }
      }
      if (JSON.stringify(a.bedingung) !== JSON.stringify(b.bedingung)) {
        unterschiede.push(`${pfad}: Options-Bedingung weicht ab`);
      }
      if (JSON.stringify(a.merkmalwerte) !== JSON.stringify(b.merkmalwerte)) {
        unterschiede.push(`${pfad}: Merkmalwerte weichen ab`);
      }
      if (JSON.stringify(a.signale) !== JSON.stringify(b.signale)) {
        unterschiede.push(`${pfad}: Signale weichen ab`);
      }
      const anzahl = Math.max(a.kinder.length, b.kinder.length);
      if (a.kinder.length !== b.kinder.length) {
        unterschiede.push(`${pfad}: ${a.kinder.length} statt ${b.kinder.length} Unterelemente`);
      }
      for (let i = 0; i < anzahl; i += 1) {
        if (a.kinder[i] && b.kinder[i]) {
          vergleicheKnoten(a.kinder[i], b.kinder[i], pfad + " → " + a.kinder[i].name);
        }
      }
    }

    vergleicheKnoten(ist, modul.wurzel, el.name);
    return { gleich: unterschiede.length === 0, unterschiede };
  }

  /** Neueste Version je Modulname. */
  function neuesteVersionen(module) {
    const proName = new Map();
    for (const m of module || []) {
      const bisher = proName.get(m.name);
      if (!bisher || (m.version || 0) > (bisher.version || 0)) proName.set(m.name, m);
    }
    return Array.from(proName.values());
  }

  function findeModul(module, modulId) {
    return (module || []).find((m) => m.id === modulId) || null;
  }

  // ---- Funktionskatalog (RFLP-Gedanke, ohne den Namen zu benutzen) -----------
  //
  // Funktion   = WAS gebraucht wird („Spannen“, „Dosieren“) – Kundensprache.
  // Lösung     = WIE es gelöst wird („Pneumatisch spannen“) – der logische
  //              Lösungsraum. Verweist auf ein Standardmodul (CTO, sofort
  //              konfigurierbar) oder auf keines (ETO – es entsteht eine Hülle,
  //              die das Engineering ausarbeitet).
  // Der Verweis läuft über den Modul-NAMEN, damit Lösungen automatisch auf die
  // jeweils neueste Modulversion zeigen.

  function neueFunktion(vorgabe) {
    const Model = dep("Model", "./model.js");
    return Object.assign({
      id: Model.neueId("fn"),
      name: "Neue Funktion",
      beschreibung: "",
    }, vorgabe || {});
  }

  function neueLoesung(vorgabe) {
    const Model = dep("Model", "./model.js");
    return Object.assign({
      id: Model.neueId("ls"),
      funktionId: "",
      name: "Neue Lösung",
      modulName: "",      // leer = ETO (noch kein Standard)
      beschreibung: "",
    }, vorgabe || {});
  }

  function findeFunktion(bibliothek, funktionId) {
    return (bibliothek.funktionen || []).find((f) => f.id === funktionId) || null;
  }

  function findeLoesung(bibliothek, loesungId) {
    return (bibliothek.loesungen || []).find((l) => l.id === loesungId) || null;
  }

  function loesungenZuFunktion(bibliothek, funktionId) {
    return (bibliothek.loesungen || []).filter((l) => l.funktionId === funktionId);
  }

  /** Modul (neueste Version) zu einer Lösung – null bei ETO. */
  function modulZuLoesung(bibliothek, loesung) {
    if (!loesung || !loesung.modulName) return null;
    return neuesteVersionen(bibliothek.module).find((m) => m.name === loesung.modulName) || null;
  }

  /** Startbestand: Beispielstandards samt Funktionskatalog. */
  function beispielBibliothek(stand) {
    const Model = dep("Model", "./model.js");
    const Vorlagen = dep("Vorlagen", "./vorlagen.js");
    const projekt = Model.neuesProjekt("Vorlage");
    const wurzelId = projekt.elemente[0].id;

    const band = Vorlagen.instanziiere(projekt, "bg-foerderband", wurzelId);
    const schrank = Vorlagen.instanziiere(projekt, "st-steuerung", wurzelId);

    const dosier = Vorlagen.instanziiere(projekt, "st-dosier", wurzelId);
    Vorlagen.instanziiere(projekt, "ko-pumpe", dosier.id).name = "Dosierpumpe";
    Vorlagen.instanziiere(projekt, "ko-durchfluss", dosier.id);
    Vorlagen.instanziiere(projekt, "ko-ventil", dosier.id).name = "Dosierventil";

    const spann = Model.neuesElement({
      name: "Spanneinheit", typ: "Baugruppe", elternId: wurzelId, kuerzel: "SPA",
    });
    projekt.elemente.push(spann);
    Vorlagen.instanziiere(projekt, "ko-magnetventil", spann.id).name = "Spannventil";
    Vorlagen.instanziiere(projekt, "ko-sensor", spann.id).name = "Endlage gespannt";
    Vorlagen.instanziiere(projekt, "ko-sensor", spann.id).name = "Endlage offen";

    const module = [
      schnappschuss(projekt, band.id, {
        name: "Förderband Typ A", version: 1, stand: stand || "",
        beschreibung: "Freigegebenes Standard-Förderband: Bandmotor mit Freigabe/Störung, Lichtschranke am Einlauf.",
      }),
      schnappschuss(projekt, schrank.id, {
        name: "Schaltschrank Standard", version: 1, stand: stand || "",
        beschreibung: "Standard-Schaltschrank: SPS, Hauptschalter, Netzteil – Ort S1.",
      }),
      schnappschuss(projekt, dosier.id, {
        name: "Dosierstation Typ P", version: 1, stand: stand || "",
        beschreibung: "Standard-Dosierstation mit Pumpe, Durchflussmesser und Dosierventil (Vorzugskomponenten).",
      }),
      schnappschuss(projekt, spann.id, {
        name: "Spanneinheit pneumatisch", version: 1, stand: stand || "",
        beschreibung: "Pneumatische Spanneinheit: Spannventil und Endlagenabfrage (Vorzugskomponenten).",
      }),
    ];

    const funktionen = [
      { id: "fn-zufuehren", name: "Zuführen", beschreibung: "Produkte in die Anlage bringen und transportieren." },
      { id: "fn-dosieren", name: "Dosieren", beschreibung: "Definierte Menge abfüllen oder zugeben." },
      { id: "fn-spannen", name: "Spannen", beschreibung: "Werkstück für die Bearbeitung fixieren." },
      { id: "fn-verschliessen", name: "Verschließen", beschreibung: "Behälter oder Verpackung verschließen." },
      { id: "fn-steuern", name: "Steuern", beschreibung: "Anlage steuern und bedienen." },
    ];

    const loesungen = [
      { id: "ls-band", funktionId: "fn-zufuehren", name: "Förderband", modulName: "Förderband Typ A", beschreibung: "" },
      { id: "ls-roboter", funktionId: "fn-zufuehren", name: "Roboter-Zuführung", modulName: "", beschreibung: "Noch kein Standard – Sonderlösung." },
      { id: "ls-pumpendos", funktionId: "fn-dosieren", name: "Pumpendosierung", modulName: "Dosierstation Typ P", beschreibung: "" },
      { id: "ls-schneckendos", funktionId: "fn-dosieren", name: "Schneckendosierung", modulName: "", beschreibung: "Noch kein Standard – Sonderlösung." },
      { id: "ls-spann-pneu", funktionId: "fn-spannen", name: "Pneumatisch spannen", modulName: "Spanneinheit pneumatisch", beschreibung: "" },
      { id: "ls-spann-hydr", funktionId: "fn-spannen", name: "Hydraulisch spannen", modulName: "", beschreibung: "Noch kein Standard – Sonderlösung." },
      { id: "ls-spann-elek", funktionId: "fn-spannen", name: "Elektrisch spannen", modulName: "", beschreibung: "Noch kein Standard – Sonderlösung." },
      { id: "ls-verschl-schraub", funktionId: "fn-verschliessen", name: "Schraubverschließer", modulName: "", beschreibung: "Noch kein Standard – Sonderlösung." },
      { id: "ls-steuer-std", funktionId: "fn-steuern", name: "Standard-Schaltschrank", modulName: "Schaltschrank Standard", beschreibung: "" },
    ];

    return { module, funktionen, loesungen };
  }

  const api = {
    normalisiereElement,
    schnappschuss,
    einfuegen,
    vergleiche,
    neuesteVersionen,
    findeModul,
    neueFunktion,
    neueLoesung,
    findeFunktion,
    findeLoesung,
    loesungenZuFunktion,
    modulZuLoesung,
    beispielBibliothek,
  };

  ns.Bibliothek = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

})(typeof window !== "undefined" ? (window.SysM = window.SysM || {}) : {});
