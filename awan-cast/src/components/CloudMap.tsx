import { useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  useMap,
} from 'react-leaflet';
import L, { type LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Forecast } from '../types';
import { useAppStore } from '../state/useAppStore';
import { regimeCopy } from '../lib/icons';
import { useT } from '../lib/i18n';
import { CloudIntensityOverlay } from './map/CloudIntensityOverlay';

interface Props {
  forecast: Forecast;
}

const homePinIcon = L.divIcon({
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  html: '<div class="home-pin"></div>',
});

function RecenterOn({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], map.getZoom(), { animate: true });
  }, [map, lat, lon]);
  return null;
}

export function CloudMap({ forecast }: Props) {
  const theme = useAppStore((s) => s.theme);
  const t = useT();

  const center: LatLngExpression = [forecast.location.lat, forecast.location.lon];

  const tileUrl =
    theme === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';

  const arrowPolylines = useMemo(
    () =>
      forecast.cloudVectors.map((v, i) => ({
        key: i,
        positions: [v.from, v.to] as LatLngExpression[],
      })),
    [forecast.cloudVectors],
  );

  return (
    <section
      data-tour="map"
      className="panel relative flex h-full min-h-[360px] flex-col overflow-hidden lg:min-h-0"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-hairline px-4 py-3">
        <div>
          <div className="label-eyebrow">{forecast.location.name}</div>
          <div className="mt-0.5 text-[11px] text-ink-muted">{t('Live cloud · Himawari-9')}</div>
        </div>
        <div className="hidden text-right md:block">
          <div className="text-[11px] text-ink-muted">{t('Sky now')}</div>
          <div className="mt-0.5 text-[12px] font-medium">{t(regimeCopy[forecast.regime].title)}</div>
        </div>
      </div>

      <div className="relative w-full flex-1">
        <MapContainer
          center={center}
          zoom={9}
          minZoom={6}
          maxZoom={12}
          zoomControl={false}
          attributionControl={true}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            url={tileUrl}
            attribution='&copy; OpenStreetMap &middot; CartoDB &middot; Cloud Himawari-9 &copy; JAXA'
          />

          <CloudIntensityOverlay forecast={forecast} theme={theme} />

          <RecenterOn lat={forecast.location.lat} lon={forecast.location.lon} />

          {arrowPolylines.map(({ key, positions }) => (
            <Polyline
              key={key}
              positions={positions}
              pathOptions={{
                color: theme === 'dark' ? '#2dd4bf' : '#0f766e',
                weight: 1.5,
                opacity: 0.85,
                dashArray: '4 4',
              }}
            />
          ))}

          <Marker position={center} icon={homePinIcon} />
        </MapContainer>
      </div>
    </section>
  );
}
