import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import type { Forecast } from '../../types';
import type { CloudTheme } from '../../lib/cloudField';
import { CloudIntensityLayer } from './CloudIntensityLayer';

interface Props {
  forecast: Forecast;
  theme: CloudTheme;
}

export function CloudIntensityOverlay({ forecast, theme }: Props) {
  const map = useMap();
  const layerRef = useRef<CloudIntensityLayer | null>(null);

  // Mount the layer once when the map is available. Forecast and theme changes
  // are propagated via the two effects below; including them in this dependency
  // array would tear down and re-add the layer on every change.
  useEffect(() => {
    const layer = new CloudIntensityLayer({ forecast, theme });
    layer.addTo(map);
    layerRef.current = layer;
    return () => {
      layer.remove();
      layerRef.current = null;
    };
    // forecast & theme intentionally omitted — see comment above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    layerRef.current?.setForecast(forecast);
  }, [forecast]);

  useEffect(() => {
    layerRef.current?.setTheme(theme);
  }, [theme]);

  return null;
}
