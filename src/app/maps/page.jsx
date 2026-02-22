"use client";
import { useEffect, useState, useRef, useMemo } from 'react';
import { Map, Source, Layer, NavigationControl } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import styles from './maps.module.css';

if (typeof window !== 'undefined') {
  maplibregl.setRTLTextPlugin(
    'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.2.3/mapbox-gl-rtl-text.min.js',
    null,
    true
  );
}

const MAP_STYLE = 'https://api.maptiler.com/maps/basic-v2/style.json?key=QvkUns3IvYwEEKb9dIJ7';

const INITIAL_VIEW_STATE = {
  longitude: 35.0,
  latitude: 31.0,
  zoom: 5,
  pitch: 0,
  bearing: 0,
};

export default function MapsPage() {
  const [allPlaces, setAllPlaces] = useState([]);
  const [selectedEra, setSelectedEra] = useState("الأناجيل");
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const mapRef = useRef(null);

  const eras = [
    "أيام إبراهيم",
    "الخروج والغزو",
    "القضاة والمملكة الموحدة",
    "المملكة المنقسمة والسبي",
    "ما بعد السبي والعهد القديم",
    "الأناجيل",
    "الكنيسة المبكرة ورحلات الرسل"
  ];

  useEffect(() => {
    setMounted(true);
    const fetchData = async () => {
      try {
        const response = await fetch('/data/places/places.json');
        if (!response.ok) throw new Error();
        const data = await response.json();
        setAllPlaces(data);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const geojsonPoints = useMemo(() => ({
    type: 'FeatureCollection',
    features: allPlaces
      .filter(p => p.era === selectedEra && p.type === 'point')
      .map(p => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { name: p.name }
      }))
  }), [allPlaces, selectedEra]);

  const geojsonPaths = useMemo(() => ({
    type: 'FeatureCollection',
    features: allPlaces
      .filter(p => p.era === selectedEra && p.type === 'polyline')
      .map(p => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: p.coordinates },
        properties: { name: p.name }
      }))
  }), [allPlaces, selectedEra]);

  const flyToLocation = (lng, lat) => {
    mapRef.current?.flyTo({
      center: [lng, lat],
      zoom: 11,
      pitch: 0,
      duration: 1500
    });
  };

  const onMapLoad = (e) => {
    const map = e.target;
    const style = map.getStyle();
    if (style && style.layers) {
      style.layers.forEach((layer) => {
        if (layer.layout && layer.layout['text-field']) {
          map.setLayoutProperty(layer.id, 'text-field', [
            'coalesce',
            ['get', 'name:ar'],
            ['get', 'name']
          ]);
        }
      });
    }
  };

  if (!mounted) return null;

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>خرائط الكتاب المقدس</h1>

      <div className={styles.buttonsContainer}>
        {eras.map(era => (
          <button
            key={era}
            onClick={() => setSelectedEra(era)}
            className={`${styles.button} ${selectedEra === era ? styles.active : ''}`}
          >
            {era}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className={styles.loadingMessage}>
          <div className={styles.spinner}></div>
          <p>جارٍ تحميل البيانات...</p>
        </div>
      ) : (
        <>
          <div className={styles.placeButtonsContainer}>
            {allPlaces.filter(p => p.era === selectedEra && p.type === 'point').map(place => (
              <button
                key={`${place.name}-${place.lng}`}
                onClick={() => flyToLocation(place.lng, place.lat)}
                className={styles.placeButton}
              >
                {place.name}
              </button>
            ))}
          </div>

          <div className={styles.mapContainer} style={{ height: '600px', width: '100%', position: 'relative' }}>
            <Map
              ref={mapRef}
              {...viewState}
              onMove={evt => setViewState(evt.viewState)}
              mapLib={maplibregl}
              mapStyle={MAP_STYLE}
              onLoad={onMapLoad}
              dragRotate={false}
              touchZoomRotate={false}
              style={{ width: '100%', height: '100%' }}
            >
              <NavigationControl position="top-right" showCompass={false} />

              <Source id="paths-data" type="geojson" data={geojsonPaths}>
                <Layer
                  id="line-layer"
                  type="line"
                  paint={{
                    'line-color': '#00c8ff',
                    'line-width': 4,
                    'line-opacity': 0.8
                  }}
                />
              </Source>

              <Source id="points-data" type="geojson" data={geojsonPoints}>
                <Layer
                  id="circle-layer"
                  type="circle"
                  paint={{
                    'circle-radius': 7,
                    'circle-color': '#00ffff',
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ffffff'
                  }}
                />
                <Layer
                  id="label-layer"
                  type="symbol"
                  layout={{
                    'text-field': ['get', 'name'],
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': 14,
                    'text-offset': [0, 1.2],
                    'text-anchor': 'top'
                  }}
                  paint={{
                    'text-color': '#ffffff',
                    'text-halo-color': '#000000',
                    'text-halo-width': 1.5
                  }}
                />
              </Source>
            </Map>
          </div>
        </>
      )}
    </div>
  );
}