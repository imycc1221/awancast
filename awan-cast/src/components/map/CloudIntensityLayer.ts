import L from 'leaflet';
import type { Forecast } from '../../types';
import { buildColorLUT, intensityAt, type CloudTheme } from '../../lib/cloudField';

export interface CloudIntensityLayerOptions extends L.GridLayerOptions {
  forecast: Forecast;
  theme: CloudTheme;
}

const PANE_NAME = 'cloud';
const PANE_Z_INDEX = '350';   // basemap tilePane = 200, overlayPane = 400, markerPane = 600
const TILE_SIZE = 256;
const SAMPLE_STRIDE = 4;      // sample every 4 px → 64×64 samples per tile
const FILL_OPACITY = 0.78;

export class CloudIntensityLayer extends L.GridLayer {
  private forecast: Forecast;
  private themeName: CloudTheme;
  private lut: Uint8ClampedArray;

  constructor(options: CloudIntensityLayerOptions) {
    super({
      tileSize: TILE_SIZE,
      opacity: FILL_OPACITY,
      pane: PANE_NAME,
      ...options,
    });
    this.forecast = options.forecast;
    this.themeName = options.theme;
    this.lut = buildColorLUT(options.theme);
  }

  // Lazily create the dedicated pane the first time the layer is added to a map.
  override onAdd(map: L.Map): this {
    if (!map.getPane(PANE_NAME)) {
      const pane = map.createPane(PANE_NAME);
      pane.style.zIndex = PANE_Z_INDEX;
      pane.style.pointerEvents = 'none';
    }
    return super.onAdd(map);
  }

  setForecast(forecast: Forecast): void {
    this.forecast = forecast;
    this.redraw();
  }

  setTheme(theme: CloudTheme): void {
    if (theme === this.themeName) return;
    this.themeName = theme;
    this.lut = buildColorLUT(theme);
    this.redraw();
  }

  // L.GridLayer.createTile contract: return an HTMLElement (here, a canvas).
  // `done` is called when the tile is ready; we paint synchronously and call it
  // immediately because the workload per tile is small (~4k noise evaluations).
  override createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const canvas = document.createElement('canvas');
    canvas.width = TILE_SIZE;
    canvas.height = TILE_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      // jsdom or other no-canvas environments: hand back an empty canvas.
      queueMicrotask(() => done(undefined, canvas));
      return canvas;
    }

    this.paintTile(ctx, coords);
    queueMicrotask(() => done(undefined, canvas));
    return canvas;
  }

  private paintTile(ctx: CanvasRenderingContext2D, coords: L.Coords): void {
    const map = this.getMap();
    if (!map) return;

    const tileBounds = this.tileLatLngBounds(coords);
    const nw = tileBounds.getNorthWest();
    const se = tileBounds.getSouthEast();
    const latStep = (se.lat - nw.lat) / TILE_SIZE;
    const lonStep = (se.lng - nw.lng) / TILE_SIZE;

    const sampleCount = TILE_SIZE / SAMPLE_STRIDE; // 64
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = sampleCount;
    sampleCanvas.height = sampleCount;
    const sampleCtx = sampleCanvas.getContext('2d');
    if (!sampleCtx) return;

    const img = sampleCtx.createImageData(sampleCount, sampleCount);
    const data = img.data;
    const lut = this.lut;

    for (let sy = 0; sy < sampleCount; sy++) {
      const lat = nw.lat + latStep * (sy * SAMPLE_STRIDE + SAMPLE_STRIDE / 2);
      for (let sx = 0; sx < sampleCount; sx++) {
        const lon = nw.lng + lonStep * (sx * SAMPLE_STRIDE + SAMPLE_STRIDE / 2);
        const i = intensityAt(lat, lon, this.forecast);
        const lutIdx = Math.min(255, Math.max(0, Math.round(i * 255))) * 4;
        const pxIdx = (sy * sampleCount + sx) * 4;
        const r = lut[lutIdx + 0] ?? 0;
        const g = lut[lutIdx + 1] ?? 0;
        const b = lut[lutIdx + 2] ?? 0;
        const a = lut[lutIdx + 3] ?? 0;
        data[pxIdx + 0] = r;
        data[pxIdx + 1] = g;
        data[pxIdx + 2] = b;
        data[pxIdx + 3] = a;
      }
    }

    sampleCtx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sampleCanvas, 0, 0, TILE_SIZE, TILE_SIZE);
  }

  // Convert a tile's (x, y, z) coords to a geographic LatLngBounds covering that tile.
  private tileLatLngBounds(coords: L.Coords): L.LatLngBounds {
    const map = this.getMap();
    const tileSize = this.getTileSize();
    const nwPoint = coords.scaleBy(tileSize);
    const sePoint = nwPoint.add(tileSize);
    const nw = map.unproject(nwPoint, coords.z);
    const se = map.unproject(sePoint, coords.z);
    return L.latLngBounds(se, nw);
  }

  // _map is protected on L.Layer; react-leaflet relies on it. Cast for access.
  private getMap(): L.Map {
    return (this as unknown as { _map: L.Map })._map;
  }
}
