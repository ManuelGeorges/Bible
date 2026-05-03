'use client';
import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation'; 
import { Map, Source, Layer, NavigationControl, Popup } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import styles from './maps.module.css';
import { getAuth } from "firebase/auth";
import { doc, updateDoc, increment, arrayUnion, getDoc } from "firebase/firestore";
import { db } from '../../lib/firebase';
import { toast } from 'react-hot-toast';

if (typeof window !== 'undefined') {
  maplibregl.setRTLTextPlugin(
    'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.2.3/mapbox-gl-rtl-text.min.js',
    null,
    true
  );
}

const auth = typeof window !== 'undefined' ? getAuth() : null;
const firestore = db;

const MAP_STYLES = {
  streets: 'https://api.maptiler.com/maps/basic-v2/style.json?key=QvkUns3IvYwEEKb9dIJ7',
  satellite: 'https://api.maptiler.com/maps/hybrid/style.json?key=QvkUns3IvYwEEKb9dIJ7',
  topo: 'https://api.maptiler.com/maps/topo-v2/style.json?key=QvkUns3IvYwEEKb9dIJ7'
};

const INITIAL_VIEW_STATE = {
  longitude: 35.0,
  latitude: 31.0,
  zoom: 5,
  pitch: 0,
  bearing: 0,
};

export default function MapsPage() {
  const router = useRouter(); 
  const [allPlaces, setAllPlaces] = useState([]);
  const [selectedEra, setSelectedEra] = useState("الحقب الزمنية");
  const [currentStyle, setCurrentStyle] = useState(MAP_STYLES.streets);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [isEraOpen, setIsEraOpen] = useState(false);
  const [isPlaceOpen, setIsPlaceOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [visitedPoints, setVisitedPoints] = useState(new Set());

  const mapRef = useRef(null);
  const eraRef = useRef(null);
  const placeRef = useRef(null);

  const eras = [
    "أيام إبراهيم",
    "الخروج والغزو",
    "القضاة والمملكة الموحدة",
    "المملكة المنقسمة والسبي",
    "ما بعد السبي والعهد القديم",
    "الأناجيل",
    "الكنيسة المبكرة ورحلات الرسل"
  ];

  const updateUserPoints = async (amount, reason) => {
    if (!user) return;
    try {
      const userRef = doc(firestore, 'users', user.uid);
      await updateDoc(userRef, {
        totalPoints: increment(amount),
        pointsHistory: arrayUnion({
          type: 'mapExploration',
          points: amount,
          reason: reason,
          timestamp: new Date().toISOString()
        })
      });
      toast.success(`+${amount} نقطة: ${reason}`);
    } catch (e) {
      console.error(e);
    }
  };

  const checkAndAwardBadge = async (badgeId, badgeName) => {
    if (!user) return;
    try {
      const userRef = doc(firestore, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      const currentBadges = userSnap.data()?.badges || [];
      if (!currentBadges.includes(badgeId)) {
        await updateDoc(userRef, {
          badges: arrayUnion(badgeId)
        });
        toast.success(`🎉 مبروك! حصلت على بادج: ${badgeName}`, { icon: '🏅' });
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (eraRef.current && !eraRef.current.contains(event.target)) setIsEraOpen(false);
      if (placeRef.current && !placeRef.current.contains(event.target)) setIsPlaceOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (u) {
        getDoc(doc(firestore, 'users', u.uid)).then(snap => {
          if (snap.exists()) {
            setVisitedPoints(new Set(snap.data().visitedMapPoints || []));
          }
        });
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setMounted(true);
    const fetchData = async () => {
      try {
        const response = await fetch('/data/places/places.json');
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
        properties: { name: p.name, info: p.info, lng: p.lng, lat: p.lat, id: p.id || p.name }
      }))
  }), [allPlaces, selectedEra]);

  const geojsonPaths = useMemo(() => ({
    type: 'FeatureCollection',
    features: allPlaces
      .filter(p => p.era === selectedEra && p.type === 'polyline')
      .map(p => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: p.coordinates },
        properties: { name: p.name, info: p.info }
      }))
  }), [allPlaces, selectedEra]);

  const handlePointSelection = async (point) => {
    setSelectedPoint(point);
    if (point && user) {
      const pointId = point.id || point.name;
      if (!visitedPoints.has(pointId)) {
        setVisitedPoints(prev => new Set(prev).add(pointId));
        await updateUserPoints(40, `اكتشاف معلم: ${point.name}`);
        const userRef = doc(firestore, 'users', user.uid);
        await updateDoc(userRef, {
          visitedMapPoints: arrayUnion(pointId)
        });
        
        const newVisitedSize = visitedPoints.size + 1;
        if (newVisitedSize === 5) await checkAndAwardBadge('map_pioneer', 'رائد الخرائط');
        if (newVisitedSize === 20) await checkAndAwardBadge('ancient_navigator', 'الملاح القديم');
      }
    }
  };

  const flyToLocation = (lng, lat, name, info, id) => {
    mapRef.current?.flyTo({
      center: [lng, lat],
      zoom: 12,
      duration: 1500,
      essential: true
    });
    handlePointSelection({ lng, lat, name, info, id });
  };

  const handleMapClick = (e) => {
    const feature = e.features && e.features[0];
    if (feature && feature.layer.id === 'unclustered-point') {
      handlePointSelection({
        lng: feature.properties.lng,
        lat: feature.properties.lat,
        name: feature.properties.name,
        info: feature.properties.info,
        id: feature.properties.id
      });
    } else {
      setSelectedPoint(null);
    }
  };

  const onMapLoad = (e) => {
    const map = e.target;
    const updateLabels = () => {
      const style = map.getStyle();
      if (style && style.layers) {
        style.layers.forEach((layer) => {
          if (layer.layout && layer.layout['text-field']) {
            map.setLayoutProperty(layer.id, 'text-field', [
              'coalesce', ['get', 'name:ar'], ['get', 'name']
            ]);
          }
        });
      }
    };
    updateLabels();
    map.on('styledata', updateLabels);
  };

  if (!mounted) return null;

  return (
    <div dir="rtl" className={styles.container}>
      <h1 className={styles.heading}>خرائط الكتاب المقدس</h1>
      <div className={styles.controls}>
        <div className={styles.customSelectWrapper} ref={eraRef}>
          <div className={styles.selectTrigger} onClick={() => { setIsEraOpen(!isEraOpen); setIsPlaceOpen(false); }}>
            {selectedEra}
          </div>
          <ul className={`${styles.dropdownMenu} ${isEraOpen ? styles.open : ''}`}>
            {eras.map((era) => (
              <li key={era} className={styles.dropdownItem} onClick={() => { setSelectedEra(era); setIsEraOpen(false); setSelectedPoint(null); }}>
                {era}
              </li>
            ))}
          </ul>
        </div>
        {selectedEra !== "الحقب الزمنية" && (
          <div className={styles.customSelectWrapper} ref={placeRef}>
            <div className={styles.selectTrigger} onClick={() => { setIsPlaceOpen(!isPlaceOpen); setIsEraOpen(false); }}>
              انتقل إلى مكان...
            </div>
            <ul className={`${styles.dropdownMenu} ${isPlaceOpen ? styles.open : ''}`}>
              {allPlaces.filter(p => p.era === selectedEra && p.type === 'point').map((place) => (
                <li key={`${place.name}-${place.lng}`} className={styles.dropdownItem} onClick={() => { flyToLocation(place.lng, place.lat, place.name, place.info, place.id); setIsPlaceOpen(false); }}>
                  {place.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className={styles.styleSelector}>
        <button className={`${styles.styleButton} ${currentStyle === MAP_STYLES.streets ? styles.activeStyle : ''}`} onClick={() => setCurrentStyle(MAP_STYLES.streets)}>خريطة</button>
        <button className={`${styles.styleButton} ${currentStyle === MAP_STYLES.satellite ? styles.activeStyle : ''}`} onClick={() => setCurrentStyle(MAP_STYLES.satellite)}>قمر اصطناعي</button>
        <button className={`${styles.styleButton} ${currentStyle === MAP_STYLES.topo ? styles.activeStyle : ''}`} onClick={() => setCurrentStyle(MAP_STYLES.topo)}>تضاريس</button>
      </div>
      {isLoading ? (
        <div className={styles.loadingMessage}>
          <div className={styles.spinner}></div>
          <p>جارٍ تحميل البيانات...</p>
        </div>
      ) : (
        <div className={styles.mapContainer}>
          <Map
            ref={mapRef}
            {...viewState}
            onMove={evt => setViewState(evt.viewState)}
            mapLib={maplibregl}
            mapStyle={currentStyle}
            onLoad={onMapLoad}
            onClick={handleMapClick}
            interactiveLayerIds={['unclustered-point']}
            maxZoom={currentStyle === MAP_STYLES.satellite ? 15 : 25}
            style={{ width: '100%', height: '100%' }}
          >
            <NavigationControl position="top-right" showCompass={false} />
            <Source id="paths-data" type="geojson" data={geojsonPaths}>
              <Layer id="line-layer" type="line" paint={{ 'line-color': '#00c8ff', 'line-width': 4, 'line-opacity': 0.8 }} />
            </Source>
            <Source id="points-data" type="geojson" data={geojsonPoints} cluster={true} clusterMaxZoom={14} clusterRadius={50}>
              <Layer id="clusters" type="circle" filter={['has', 'point_count']} paint={{ 'circle-color': ['step', ['get', 'point_count'], '#191d34', 10, '#252b4d', 30, '#313966'], 'circle-radius': ['step', ['get', 'point_count'], 20, 10, 30, 30, 40], 'circle-stroke-width': 2, 'circle-stroke-color': '#00c8ff' }} />
              <Layer id="cluster-count" type="symbol" filter={['has', 'point_count']} layout={{ 'text-field': '{point_count}', 'text-size': 12 }} paint={{ 'text-color': '#ffffff' }} />
              <Layer id="unclustered-point" type="circle" filter={['!', ['has', 'point_count']]} paint={{ 'circle-radius': 8, 'circle-color': '#00ffff', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' }} />
              <Layer id="label-layer" type="symbol" filter={['!', ['has', 'point_count']]} layout={{ 'text-field': ['get', 'name'], 'text-size': 14, 'text-offset': [0, 1.5], 'text-anchor': 'top' }} paint={{ 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 1.5 }} />
            </Source>
            {selectedPoint && (
              <Popup longitude={selectedPoint.lng} latitude={selectedPoint.lat} anchor="bottom" onClose={() => setSelectedPoint(null)} closeOnClick={false} maxWidth="300px">
                <div style={{ color: '#1a1a1a', padding: '10px', direction: 'rtl', textAlign: 'right' }}>
                  <h3 style={{ margin: '0 0 8px 0', borderBottom: '1px solid #eee', paddingBottom: '5px', fontSize: '18px', color: '#191d34' }}>{selectedPoint.name}</h3>
                  <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: '#444' }}>{selectedPoint.info || "لا تتوفر معلومات إضافية لهذا الموقع."}</p>
                </div>
              </Popup>
            )}
          </Map>
        </div>
      )}
    </div>
  );
}