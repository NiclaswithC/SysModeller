"use strict";
/*
 * SysModeller – echte 3D-Ansicht (three.js, lokal eingebettet).
 *
 * Zeigt die Anlage aus denselben Daten wie das 2D-Layout: Module mit
 * hinterlegter 3D-Datei (GLB/GLTF) erscheinen als echtes CAD-Modell,
 * Module ohne Datei als maßhaltiger Hüllquader, ETO-Lösungen als
 * transparenter Platzhalter mit Notiz-Vermerk. Drehen/Zoomen mit der Maus.
 *
 * Koordinaten: Layout-x → 3D-x, Layout-y → 3D-z, Höhe → 3D-y (Meter).
 */
const DreiD = (() => {
  let renderer = null;       // ein WebGL-Kontext für die ganze Anwendung
  let animationLaeuft = false;
  let aktuelleSzene = null;
  let aktuelleKamera = null;
  let aktuelleSteuerung = null;

  const TYP_FARBEN = { Station: 0xb9aed6, Baugruppe: 0xdcc99d, Komponente: 0xa9bcd6 };

  function holeRenderer() {
    if (renderer) return renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(window.devicePixelRatio || 1);
      renderer.shadowMap.enabled = true;
    } catch (fehler) {
      renderer = null;
    }
    return renderer;
  }

  function textSprite(text, farbe) {
    const zeichen = document.createElement("canvas");
    const ktx = zeichen.getContext("2d");
    ktx.font = "600 28px Segoe UI, sans-serif";
    const breite = Math.ceil(ktx.measureText(text).width) + 24;
    zeichen.width = breite;
    zeichen.height = 44;
    const k = zeichen.getContext("2d");
    k.font = "600 28px Segoe UI, sans-serif";
    k.fillStyle = "rgba(255,255,255,0.85)";
    k.fillRect(0, 0, breite, 44);
    k.fillStyle = farbe || "#22303f";
    k.textBaseline = "middle";
    k.fillText(text, 12, 24);
    const textur = new THREE.CanvasTexture(zeichen);
    const material = new THREE.SpriteMaterial({ map: textur, depthTest: false });
    const sprite = new THREE.Sprite(material);
    const einheit = 0.011;
    sprite.scale.set(breite * einheit, 44 * einheit, 1);
    return sprite;
  }

  /** Hüllquader-Modul (Fallback ohne CAD-Datei) bzw. ETO-Platzhalter. */
  function quaderModul(el, masse) {
    const gruppe = new THREE.Group();
    const geometrie = new THREE.BoxGeometry(masse.b, masse.h, masse.t);
    geometrie.translate(masse.b / 2, masse.h / 2, masse.t / 2);
    const farbe = TYP_FARBEN[el.typ] || TYP_FARBEN.Station;
    const material = el.eto
      ? new THREE.MeshStandardMaterial({ color: 0xc04545, transparent: true, opacity: 0.18 })
      : new THREE.MeshStandardMaterial({ color: farbe, transparent: true, opacity: 0.55, metalness: 0.1, roughness: 0.8 });
    const koerper = new THREE.Mesh(geometrie, material);
    koerper.castShadow = true;
    gruppe.add(koerper);
    const kanten = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometrie),
      el.eto
        ? new THREE.LineDashedMaterial({ color: 0xc04545, dashSize: 0.25, gapSize: 0.15 })
        : new THREE.LineBasicMaterial({ color: 0x5a6675 }));
    if (el.eto) kanten.computeLineDistances();
    gruppe.add(kanten);
    return gruppe;
  }

  /**
   * Baut die Szene und hängt sie in den Behälter. Läuft asynchron
   * (3D-Dateien kommen aus der Browser-Ablage).
   */
  async function zeige(behaelter, projekt, opts) {
    opts = opts || {};
    const r = holeRenderer();
    if (!r || typeof THREE === "undefined") {
      behaelter.textContent = "3D-Darstellung hier nicht verfügbar (WebGL). Das 2D-Layout und alle Daten funktionieren unabhängig davon.";
      behaelter.classList.add("leer-hinweis");
      return;
    }

    const Model = SysM.Model;
    const wurzel = projekt.elemente.find((e) => !e.elternId);
    const module = wurzel ? Model.kinder(projekt, wurzel.id) : [];

    const szene = new THREE.Scene();
    szene.background = new THREE.Color(0xf4f7fa);
    szene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const licht = new THREE.DirectionalLight(0xffffff, 0.7);
    licht.position.set(12, 18, 8);
    licht.castShadow = true;
    szene.add(licht);

    let maxX = 10;
    let maxZ = 6;

    for (const el of module) {
      if (opts.status && opts.status[el.id] && !opts.status[el.id].effektivEnthalten) continue;
      const pos = Maschinenbild.hatLayout(el) ? el.layout : { x: 0, y: 0 };
      const fp = Maschinenbild.fussabdruck(projekt, el);
      const masse = el.masse && el.masse.b
        ? el.masse
        : { b: fp.w, t: fp.d, h: el.eto ? 1.6 : 1.9 };

      let objekt = null;
      if (el.cad && el.cad.dateiId) {
        try {
          const eintrag = await Dateispeicher.lade(el.cad.dateiId);
          if (eintrag && eintrag.daten) {
            objekt = await new Promise((aufloesen, ablehnen) => {
              new THREE.GLTFLoader().parse(eintrag.daten, "", (gltf) => aufloesen(gltf.scene), ablehnen);
            });
            // Modell so versetzen, dass seine Bodenfläche an der Layout-Position beginnt.
            const box = new THREE.Box3().setFromObject(objekt);
            objekt.position.set(-box.min.x, -box.min.y, -box.min.z);
            const traeger = new THREE.Group();
            traeger.add(objekt);
            objekt = traeger;
          }
        } catch (fehler) {
          console.warn("3D-Datei konnte nicht geladen werden:", fehler);
          objekt = null;
        }
      }
      if (!objekt) objekt = quaderModul(el, masse);

      objekt.position.set(pos.x, 0, pos.y);
      szene.add(objekt);

      const schild = textSprite(el.name + (el.eto ? " (ETO)" : ""), el.eto ? "#c04545" : "#22303f");
      schild.position.set(pos.x + masse.b / 2, masse.h + 0.6, pos.y + masse.t / 2);
      szene.add(schild);

      maxX = Math.max(maxX, pos.x + masse.b + 2);
      maxZ = Math.max(maxZ, pos.y + masse.t + 2);
    }

    // Hallenboden
    const boden = new THREE.Mesh(
      new THREE.PlaneGeometry(maxX + 6, maxZ + 6),
      new THREE.MeshStandardMaterial({ color: 0xe6ebf0 }));
    boden.rotation.x = -Math.PI / 2;
    boden.position.set(maxX / 2 - 1, -0.01, maxZ / 2 - 1);
    boden.receiveShadow = true;
    szene.add(boden);
    const raster = new THREE.GridHelper(Math.max(maxX, maxZ) + 6, Math.max(maxX, maxZ) + 6, 0xc7d0da, 0xdbe2e9);
    raster.position.set(maxX / 2 - 1, 0, maxZ / 2 - 1);
    szene.add(raster);

    const breite = behaelter.clientWidth || 800;
    const hoehe = opts.hoehe || 380;
    const kamera = new THREE.PerspectiveCamera(45, breite / hoehe, 0.1, 500);
    kamera.position.set(maxX * 0.75, Math.max(maxX, maxZ) * 0.6, maxZ + maxX * 0.55);
    r.setSize(breite, hoehe);
    behaelter.replaceChildren(r.domElement);

    const steuerung = new THREE.OrbitControls(kamera, r.domElement);
    steuerung.target.set(maxX / 2 - 1, 0.5, maxZ / 2 - 1);
    steuerung.maxPolarAngle = Math.PI / 2.05;
    steuerung.update();

    aktuelleSzene = szene;
    aktuelleKamera = kamera;
    aktuelleSteuerung = steuerung;

    if (!animationLaeuft) {
      animationLaeuft = true;
      (function schleife() {
        requestAnimationFrame(schleife);
        if (renderer && renderer.domElement.isConnected && aktuelleSzene && aktuelleKamera) {
          if (aktuelleSteuerung) aktuelleSteuerung.update();
          renderer.render(aktuelleSzene, aktuelleKamera);
        }
      })();
    }
  }

  /** Baut den Anzeige-Behälter; die Szene wird asynchron nachgeladen. */
  function render(projekt, opts) {
    const behaelter = document.createElement("div");
    behaelter.className = "d3-behaelter";
    behaelter.style.height = ((opts && opts.hoehe) || 380) + "px";
    // Nach dem Einhängen ins Dokument aufbauen (Breite bekannt).
    setTimeout(() => { zeige(behaelter, projekt, opts); }, 0);
    return behaelter;
  }

  return { render };
})();
