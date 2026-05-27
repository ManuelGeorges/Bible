'use client';
import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation'; 
import { Map, Source, Layer, NavigationControl, Popup, FullscreenControl } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import styles from './maps.module.css';
import { getAuth } from "firebase/auth";
import { doc, updateDoc, increment, arrayUnion, getDoc } from "firebase/firestore";
import { db } from '../../lib/firebase';
import { toast } from 'react-hot-toast';
import { useBadge } from '../context/BadgeContext';
import {
  Search,
  MapPin,
  Route,
  BookOpen,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Globe,
  Map as MapIcon,
  Mountain
} from 'lucide-react';
import { getCairoIsoString } from '../../lib/dateUtils';

// تفعيل ميزة النصوص العربية بشكل آمن لتجنب التكرار
if (typeof window !== 'undefined') {
  if (maplibregl.getRTLTextPluginStatus() === 'unavailable') {
    maplibregl.setRTLTextPlugin(
      'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.2.3/mapbox-gl-rtl-text.min.js',
      null,
      true
    );
  }
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
  pitch: 45, // إضافة زاوية ميل افتراضية لإظهار التضاريس
  bearing: 0,
};

export default function MapsPage() {
  const router = useRouter(); 
  const { triggerBadgeUnlock } = useBadge();
  const [allPlaces, setAllPlaces] = useState([]);
  const [selectedEra, setSelectedEra] = useState("الحقب الزمنية");
  const [currentStyle, setCurrentStyle] = useState(MAP_STYLES.streets);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [selectedJourney, setSelectedJourney] = useState(null);
  const [isEraOpen, setIsEraOpen] = useState(false);
  const [isPlaceOpen, setIsPlaceOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState(null);
  const [visitedPoints, setVisitedPoints] = useState(new Set());
  const [mapLoaded, setMapLoaded] = useState(false);

  const mapRef = useRef(null);
  const eraRef = useRef(null);
  const placeRef = useRef(null);
  const searchRef = useRef(null);

  const eras = [
    "أيام إبراهيم",
    "الخروج والغزو",
    "القضاة والمملكة الموحدة",
    "المملكة المنقسمة والسبي",
    "ما بعد السبي والعهد القديم",
    "الأناجيل",
    "الكنيسة المبكرة ورحلات الرسل"
  ];

  const normalizeArabic = (text) => {
    if (!text) return "";
    return text.toString()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/[ىي]/g, 'ي')
      .replace(/[\u064B-\u0652]/g, "")
      .toLowerCase();
  };

  const filteredSearchPlaces = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const normalizedQuery = normalizeArabic(searchQuery);
    return allPlaces.filter(p =>
      normalizeArabic(p.name).includes(normalizedQuery) ||
      normalizeArabic(p.info || "").includes(normalizedQuery) ||
      normalizeArabic(p.book || "").includes(normalizedQuery) ||
      normalizeArabic(p.era || "").includes(normalizedQuery)
    ).slice(0, 8);
  }, [allPlaces, searchQuery]);

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
          timestamp: getCairoIsoString()
        })
      });
      toast.success(`+${amount} نقطة: ${reason}`);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (eraRef.current && !eraRef.current.contains(event.target)) setIsEraOpen(false);
      if (placeRef.current && !placeRef.current.contains(event.target)) setIsPlaceOpen(false);
      if (searchRef.current && !searchRef.current.contains(event.target)) setSearchQuery("");
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
      .filter(p => (selectedEra === "الحقب الزمنية" || p.era === selectedEra) && p.type === 'point')
      .map(p => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: {
          name: p.name,
          info: p.info,
          lng: p.lng,
          lat: p.lat,
          id: p.id || p.name,
          book: p.book,
          chapter: p.chapter
        }
      }))
  }), [allPlaces, selectedEra]);

  const geojsonPaths = useMemo(() => ({
    type: 'FeatureCollection',
    features: allPlaces
      .filter(p => (selectedEra === "الحقب الزمنية" || p.era === selectedEra) && p.type === 'polyline')
      .map(p => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: p.coordinates },
        properties: { name: p.name, info: p.info }
      }))
  }), [allPlaces, selectedEra]);

  const handlePointSelection = async (point) => {
    setSelectedPoint(point);
    setSelectedJourney(null);
    if (point && user) {
      const pointId = point.id || point.name;
      if (!visitedPoints.has(pointId)) {
        setVisitedPoints(prev => new Set(prev).add(pointId));
        await updateUserPoints(40, `اكتشاف معلم: ${point.name}`);
        const userRef = doc(firestore, 'users', user.uid);
        await updateDoc(userRef, {
          visitedMapPoints: arrayUnion(pointId)
        });
      }
    }
  };

  const flyToLocation = (place) => {
    mapRef.current?.flyTo({
      center: [place.lng, place.lat],
      zoom: 12,
      duration: 1500,
      essential: true
    });
    handlePointSelection(place);
  };

  const handleMapClick = (e) => {
    const feature = e.features && e.features[0];
    if (feature) {
      if (feature.layer.id === 'unclustered-point') {
        handlePointSelection({
          lng: feature.properties.lng,
          lat: feature.properties.lat,
          name: feature.properties.name,
          info: feature.properties.info,
          id: feature.properties.id,
          book: feature.properties.book,
          chapter: feature.properties.chapter
        });
      } else if (feature.layer.id === 'line-layer') {
        setSelectedJourney(feature.properties);
        setSelectedPoint(null);
      }
    } else {
      setSelectedPoint(null);
      setSelectedJourney(null);
    }
  };

  const setupTerrain = (map) => {
    if (!map.getSource('maptiler-terrain')) {
      map.addSource('maptiler-terrain', {
        type: 'raster-dem',
        url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=QvkUns3IvYwEEKb9dIJ7`,
        tileSize: 512
      });
    }

    if (currentStyle === MAP_STYLES.satellite) {
      map.setTerrain({ source: 'maptiler-terrain', exaggeration: 1.8 }); // زيادة التفاصيل الأرضية

      if (map.setFog) {
        map.setFog({
          'range': [0.5, 10],
          'color': '#111625', // لون الغلاف الجوي الداكن لإعطاء عمق
          'horizon-blend': 0.2
        });
      }

      // تحسين ألوان طبقة القمر الصناعي لتقليل البهتان
      const style = map.getStyle();
      if (style && style.layers) {
        const satelliteLayer = style.layers.find(l => l.type === 'raster');
      }
    } else if (currentStyle === MAP_STYLES.topo) {
      map.setTerrain({ source: 'maptiler-terrain', exaggeration: 1.5 });
      if (map.setFog) {
        map.setFog({
          'range': [0.5, 10],
          'color': '#ffffff',
          'horizon-blend': 0.1
        });
      }
    } else {
      map.setTerrain(null);
      if (map.setFog) map.setFog(null);
    }
  };

  const onMapLoad = (e) => {
    const map = e.target;
    setMapLoaded(true);
    setupTerrain(map);
  };

  const onStyleData = (e) => {
    const map = e.target;
    if (mapLoaded) {
      setupTerrain(map);
    }
  };

  useEffect(() => {
    if (mapLoaded && mapRef.current) {
      const map = mapRef.current.getMap();
      setupTerrain(map);
    }
  }, [currentStyle, mapLoaded]);

  if (!mounted) return null;

  return (
    <div dir="rtl" className={styles.container}>
      <header className={styles.headerSection}>
        <h1 className={styles.heading}>خرائط الكتاب المقدس</h1>
      </header>

      <div className={styles.searchContainer} ref={searchRef}>
        <div className={styles.searchBar}>
          <Search size={20} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="ابحث عن مكان  أو مدينة..."
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && <X size={18} className={styles.clearSearch} onClick={() => setSearchQuery("")} />}
        </div>
        {searchQuery && (
          <div className={styles.searchResults}>
            {filteredSearchPlaces.length > 0 ? (
              filteredSearchPlaces.map((place, idx) => (
                <div
                  key={idx}
                  className={styles.searchResultItem}
                  onClick={() => {
                    if (place.type === 'point') {
                      flyToLocation(place);
                    } else {
                      setSelectedJourney(place);
                      const mid = Math.floor(place.coordinates.length / 2);
                      mapRef.current?.flyTo({ center: place.coordinates[mid], zoom: 6 });
                    }
                    setSearchQuery("");
                  }}
                >
                  <div className={styles.resultIconWrapper}>
                    {place.type === 'point' ? <MapPin size={18} /> : <Route size={18} />}
                  </div>
                  <div className={styles.resultDetails}>
                    <span className={styles.resultNameText}>{place.name}</span>
                    <span className={styles.resultEraText}>{place.era}</span>
                  </div>
                  <ChevronLeft size={16} className={styles.resultArrow} />
                </div>
              ))
            ) : (
              <div className={styles.noResults}>
                <Mountain size={32} className={styles.noResultsIcon} />
                <p>لا توجد نتائج تطابق بحثك</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.controls}>
        <div className={`${styles.customSelectWrapper} ${isEraOpen ? styles.activeWrapper : ''}`} ref={eraRef}>
          <div className={styles.selectTrigger} onClick={() => { setIsEraOpen(!isEraOpen); setIsPlaceOpen(false); }}>
            <div className={styles.triggerLabel}>
              <Globe size={18} />
              <span>{selectedEra === "الحقب الزمنية" ? "اختر الحقبة الزمنية" : selectedEra}</span>
            </div>
            <ChevronDown size={18} className={isEraOpen ? styles.rotateIcon : ''} />
          </div>
          <ul className={`${styles.dropdownMenu} ${isEraOpen ? styles.open : ''}`}>
            <li className={styles.dropdownItem} onClick={() => { setSelectedEra("الحقب الزمنية"); setIsEraOpen(false); setSelectedPoint(null); }}>
              كل الحقب
            </li>
            {eras.map((era) => (
              <li key={era} className={styles.dropdownItem} onClick={() => { setSelectedEra(era); setIsEraOpen(false); setSelectedPoint(null); }}>
                {era}
              </li>
            ))}
          </ul>
        </div>

        {selectedEra !== "الحقب الزمنية" && (
          <div className={`${styles.customSelectWrapper} ${isPlaceOpen ? styles.activeWrapper : ''}`} ref={placeRef}>
            <div className={styles.selectTrigger} onClick={() => { setIsPlaceOpen(!isPlaceOpen); setIsEraOpen(false); }}>
              <div className={styles.triggerLabel}>
                <MapPin size={18} />
                <span>انتقل إلى مكان...</span>
              </div>
              <ChevronDown size={18} className={isPlaceOpen ? styles.rotateIcon : ''} />
            </div>
            <ul className={`${styles.dropdownMenu} ${isPlaceOpen ? styles.open : ''}`}>
              {allPlaces.filter(p => p.era === selectedEra && p.type === 'point').map((place) => (
                <li key={`${place.name}-${place.lng}`} className={styles.dropdownItem} onClick={() => { flyToLocation(place); setIsPlaceOpen(false); }}>
                  {place.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className={styles.styleSelector}>
        <button className={`${styles.styleButton} ${currentStyle === MAP_STYLES.streets ? styles.activeStyle : ''}`} onClick={() => setCurrentStyle(MAP_STYLES.streets)}>
          <MapIcon size={16} /> خريطة
        </button>
        <button className={`${styles.styleButton} ${currentStyle === MAP_STYLES.satellite ? styles.activeStyle : ''}`} onClick={() => setCurrentStyle(MAP_STYLES.satellite)}>
          <Globe size={16} /> قمر اصطناعي
        </button>
        <button className={`${styles.styleButton} ${currentStyle === MAP_STYLES.topo ? styles.activeStyle : ''}`} onClick={() => setCurrentStyle(MAP_STYLES.topo)}>
          <Mountain size={16} /> تضاريس 3D
        </button>
      </div>

      {!isLoading && (
        <div className={styles.mapContainer}>
          <Map
            ref={mapRef}
            {...viewState}
            onMove={evt => setViewState(evt.viewState)}
            mapLib={maplibregl}
            mapStyle={currentStyle}
            onLoad={onMapLoad}
            onStyleData={onStyleData}
            onClick={handleMapClick}
            interactiveLayerIds={['unclustered-point', 'line-layer']}
            maxZoom={currentStyle === MAP_STYLES.satellite ? 18 : 25}
            style={{ width: '100%', height: '100%' }}
          >
            <NavigationControl position="top-right" showCompass={false} />
            <FullscreenControl position="top-right" />

            <Source id="paths-data" type="geojson" data={geojsonPaths}>
              <Layer id="line-layer" type="line" paint={{ 'line-color': '#00c8ff', 'line-width': 4, 'line-opacity': 0.8, 'line-dasharray': [2, 1] }} />
            </Source>

            <Source id="points-data" type="geojson" data={geojsonPoints} cluster={true} clusterMaxZoom={14} clusterRadius={50}>
              <Layer id="clusters" type="circle" filter={['has', 'point_count']} paint={{ 'circle-color': ['step', ['get', 'point_count'], '#191d34', 10, '#252b4d', 30, '#313966'], 'circle-radius': ['step', ['get', 'point_count'], 20, 10, 30, 30, 40], 'circle-stroke-width': 2, 'circle-stroke-color': '#00c8ff' }} />
              <Layer id="cluster-count" type="symbol" filter={['has', 'point_count']} layout={{ 'text-field': '{point_count}', 'text-size': 12 }} paint={{ 'text-color': '#ffffff' }} />
              <Layer id="unclustered-point" type="circle" filter={['!', ['has', 'point_count']]} paint={{ 'circle-radius': 9, 'circle-color': '#00ffff', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' }} />
              <Layer id="label-layer" type="symbol" filter={['!', ['has', 'point_count']]} layout={{ 'text-field': ['get', 'name'], 'text-size': 14, 'text-offset': [0, 1.6], 'text-anchor': 'top', 'text-font': ['Noto Sans Arabic Bold'] }} paint={{ 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 2 }} />
            </Source>

            {selectedPoint && (
              <Popup longitude={selectedPoint.lng} latitude={selectedPoint.lat} anchor="bottom" onClose={() => setSelectedPoint(null)} closeOnClick={false} maxWidth="320px">
                <div className={styles.popupWrapper}>
                  <h3 className={styles.popupTitleText}>{selectedPoint.name}</h3>
                  <div className={styles.popupMeta}>
                    <span className={styles.popupEraBadge}>{selectedPoint.book || "معلم تاريخي"}</span>
                  </div>
                  <p className={styles.popupInfoText}>{selectedPoint.info || "لا تتوفر معلومات إضافية لهذا الموقع."}</p>

                  {selectedPoint.book && (
                    <button
                      className={styles.bibleLinkBtn}
                      onClick={() => {
                        router.push(`/bible?book=${encodeURIComponent(selectedPoint.book)}&chapter=${selectedPoint.chapter || 1}`);
                      }}
                    >
                      <BookOpen size={18} /> اقرأ في الكتاب المقدس
                    </button>
                  )}
                </div>
              </Popup>
            )}
          </Map>

          {selectedJourney && (
            <div className={styles.journeyCard}>
              <div className={styles.journeyHeader}>
                <div className={styles.journeyIconBox}>
                  <Route size={24} className={styles.journeyIcon} />
                </div>
                <h3>{selectedJourney.name}</h3>
                <button className={styles.closeJourney} onClick={() => setSelectedJourney(null)}><X size={20} /></button>
              </div>
              <p className={styles.journeyDesc}>{selectedJourney.info}</p>

            </div>
          )}
        </div>
      )}
    </div>
  );
}
