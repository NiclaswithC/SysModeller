"use strict";
/*
 * SysModeller – Geometrie-Hilfen für echte 3D-Maschinendateien.
 *
 * Wird eine 3D-Datei (GLB/GLTF) an ein Modul gehängt, leiten wir daraus ab:
 *   - masse   {b, t, h}   Breite/Tiefe/Höhe in Metern (aus dem Hüllquader)
 *   - grundriss [[x,y],…] die Silhouette von oben (konvexe Hülle der auf den
 *                          Boden projizierten Punkte)
 * Damit wird die 2D-Draufsicht zur echten Skizze des 3D-Modells – keine
 * zweite Datenpflege.
 */
(function (ns) {

  /** Konvexe Hülle (Andrew's monotone chain). punkte: [{x, y}] */
  function konvexeHuelle(punkte) {
    const p = Array.from(new Map(punkte.map((q) => [q.x + "|" + q.y, q])).values())
      .sort((a, b) => a.x - b.x || a.y - b.y);
    if (p.length <= 2) return p;
    const kreuz = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const unten = [];
    for (const q of p) {
      while (unten.length >= 2 && kreuz(unten[unten.length - 2], unten[unten.length - 1], q) <= 0) unten.pop();
      unten.push(q);
    }
    const oben = [];
    for (let i = p.length - 1; i >= 0; i -= 1) {
      const q = p[i];
      while (oben.length >= 2 && kreuz(oben[oben.length - 2], oben[oben.length - 1], q) <= 0) oben.pop();
      oben.push(q);
    }
    unten.pop();
    oben.pop();
    return unten.concat(oben);
  }

  /**
   * Grundriss aus vielen projizierten Punkten: konvexe Hülle, auf höchstens
   * `maxPunkte` Eckpunkte ausgedünnt (gleichmäßig), Werte gerundet.
   */
  function grundrissAusPunkten(punkte, maxPunkte) {
    maxPunkte = maxPunkte || 24;
    let huelle = konvexeHuelle(punkte);
    if (huelle.length > maxPunkte) {
      const schritt = huelle.length / maxPunkte;
      const reduziert = [];
      for (let i = 0; i < maxPunkte; i += 1) reduziert.push(huelle[Math.floor(i * schritt)]);
      huelle = reduziert;
    }
    return huelle.map((q) => [Math.round(q.x * 100) / 100, Math.round(q.y * 100) / 100]);
  }

  /** Maße aus einem Hüllquader (min/max je Achse; y = Höhe wie in glTF). */
  function masseAusBBox(min, max) {
    return {
      b: Math.max(0.1, Math.round((max.x - min.x) * 100) / 100),
      t: Math.max(0.1, Math.round((max.z - min.z) * 100) / 100),
      h: Math.max(0.1, Math.round((max.y - min.y) * 100) / 100),
    };
  }

  const api = { konvexeHuelle, grundrissAusPunkten, masseAusBBox };

  ns.Geometrie = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

})(typeof window !== "undefined" ? (window.SysM = window.SysM || {}) : {});
