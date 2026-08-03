'use client';
import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Map, Source, Layer, NavigationControl, Popup, FullscreenControl } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
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
  ChevronDown,
  Globe,
  Shuffle,
  Award,
  Navigation
} from 'lucide-react';
import { getCairoIsoString, getCairoDate } from '../../lib/dateUtils';
import { StorageService, KEYS } from '../../lib/storage';
import { useLanguage } from '../context/LanguageContext';

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

// Using relative path for internal API to avoid CORS and domain issues
const API_MAPS_URL = '/api/maps';

const INITIAL_VIEW_STATE = {
  longitude: 35.0,
  latitude: 31.0,
  zoom: 5,
  pitch: 45,
  bearing: 0,
};

const MAX_BOUNDS = [
  [5.0, 15.0],
  [65.0, 50.0]
];

const TOTAL_MAP_BADGES = 3;

const ERA_COLORS = [
  '#E67E22', // 1. Abraham
  '#D4AC0D', // 2. Exodus & Conquest
  '#8E44AD', // 3. Judges & United Kingdom
  '#C0392B', // 4. Divided Kingdom & Exile
  '#16A085', // 5. Post-Exile / Old Testament
  '#2980B9', // 6. Gospels
  '#27AE60', // 7. Early Church & Apostles' Journeys
];

const FALLBACK_HEX = '#00c8ff';
const hexToRgb = (hex) => {
  const clean = /^#([0-9a-f]{6})$/i.test(hex) ? hex : FALLBACK_HEX;
  const bigint = parseInt(clean.replace('#', ''), 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
};
const withAlpha = (hex, alpha) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
const darkenHex = (hex, amount = 0.18) => {
  const { r, g, b } = hexToRgb(hex);
  const d = (c) => Math.max(0, Math.round(c * (1 - amount)));
  return `rgb(${d(r)}, ${d(g)}, ${d(b)})`;
};

const toRad = (deg) => (deg * Math.PI) / 180;
const getDistanceKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function MapsPage() {
  const { strings, dir, language, formatNumber } = useLanguage();
  const router = useRouter();
  const { triggerBadgeUnlock } = useBadge();
  const [allPlaces, setAllPlaces] = useState([]);
  const [selectedEra, setSelectedEra] = useState(strings?.maps?.eras_placeholder || '');
  const [mapStyle, setMapStyle] = useState(null);
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
  const [visitedEras, setVisitedEras] = useState(new Set());
  const [badgesCount, setBadgesCount] = useState(0);
  const [dailyTaskDone, setDailyTaskDone] = useState(false);

  const mapRef = useRef(null);
  const eraRef = useRef(null);
  const placeRef = useRef(null);
  const searchRef = useRef(null);

  const eras = useMemo(() => {
    return strings?.maps?.era_names ? Object.values(strings.maps.era_names) : [];
  }, [strings]);

  const getEraColors = (eraName) => {
    const idx = eras.indexOf(eraName);
    const base = idx >= 0 ? ERA_COLORS[idx % ERA_COLORS.length] : FALLBACK_HEX;
    return {
      base,
      dark: darkenHex(base, 0.2),
      tint10: withAlpha(base, 0.1),
      tint15: withAlpha(base, 0.15),
      tint25: withAlpha(base, 0.25),
    };
  };

  const unlockBadge = async (badgeId) => {
    if (user) {
      try {
        const userRef = doc(firestore, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const currentBadges = userSnap.data()?.badges || [];
        if (!currentBadges.includes(badgeId)) {
          await updateDoc(userRef, { badges: arrayUnion(badgeId) });
          setBadgesCount((prev) => prev + 1);
          triggerBadgeUnlock(badgeId);
        }
      } catch (e) { console.error(e); }
    } else {
      const localBadges = await StorageService.get('local_badges') || [];
      if (!localBadges.includes(badgeId)) {
        localBadges.push(badgeId);
        await StorageService.save('local_badges', localBadges);
        setBadgesCount((prev) => prev + 1);
        triggerBadgeUnlock(badgeId);
      }
    }
  };

  const updateUserPoints = async (amount, reason) => {
    if (user) {
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
        if (amount > 0) {
          toast.success(strings.maps.toasts.points_earned.replace('{amount}', formatNumber(amount)).replace('{reason}', reason));
        }
      } catch (e) { console.error(e); }
    } else {
      await StorageService.addPoints(amount);
      const history = await StorageService.get(KEYS.POINTS_HISTORY) || [];
      history.push({
        type: 'mapExploration',
        points: amount,
        reason: reason,
        timestamp: getCairoIsoString()
      });
      await StorageService.save(KEYS.POINTS_HISTORY, history);
      if (amount > 0) {
        toast.success(strings.maps.toasts.points_earned.replace('{amount}', formatNumber(amount)).replace('{reason}', reason));
      }
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
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      const today = getCairoDate();
      if (u) {
        getDoc(doc(firestore, 'users', u.uid)).then(snap => {
          if (snap.exists()) {
            const data = snap.data();
            setVisitedPoints(new Set(data.visitedMapPoints || []));
            setVisitedEras(new Set(data.visitedEras || []));
            setBadgesCount((data.badges || []).length);

            const history = data.pointsHistory || [];
            const done = history.some(h => {
              if (!h.timestamp) return false;
              const ts = h.timestamp?.toDate ? h.timestamp.toDate() : new Date(h.timestamp);
              return getCairoDate(ts) === today && h.type === 'mapExploration';
            });
            setDailyTaskDone(done);
          }
        });
      } else {
        const localBadges = await StorageService.get('local_badges') || [];
        setBadgesCount(localBadges.length);

        const history = await StorageService.get(KEYS.POINTS_HISTORY) || [];
        const done = history.some(h => h.type === 'mapExploration' && getCairoDate(new Date(h.timestamp)) === today);
        setDailyTaskDone(done);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);

    fetch(`${API_MAPS_URL}/?task=style`)
      .then((res) => {
        if (!res.ok) throw new Error(`Style error: ${res.status}`);
        return res.json();
      })
      .then((style) => setMapStyle(style))
      .catch((err) => console.error('Failed to load map style:', err));

    return () => maplibregl.removeProtocol('pmtiles');
  }, []);

  useEffect(() => {
    setMounted(true);
    const initPage = async () => {
      try {
        const response = await fetch(`${API_MAPS_URL}/?task=places&lang=${language}`);
        if (!response.ok) {
           console.error(`API response error: ${response.status}`);
           setAllPlaces([]);
           return;
        }
        const data = await response.json();
        // Ensure data is an array before setting state
        if (Array.isArray(data)) {
          setAllPlaces(data);
        } else if (data && typeof data === 'object' && !Array.isArray(data)) {
          // If the API returned an object with an error or something else
          console.warn("API returned non-array data:", data);
          setAllPlaces([]);
        } else {
          setAllPlaces([]);
        }
      } catch (error) {
        console.error("Error loading places:", error);
        setAllPlaces([]);
      }
      finally { setIsLoading(false); }
    };
    initPage();
  }, [language]);

  const handleEraSelection = async (era) => {
    setSelectedEra(era);
    setIsEraOpen(false);
    setSelectedPoint(null);
    if (era !== strings?.maps?.eras_placeholder && !visitedEras.has(era)) {
      const newEras = new Set(visitedEras).add(era);
      setVisitedEras(newEras);
      if (user) await updateDoc(doc(firestore, 'users', user.uid), { visitedEras: arrayUnion(era) });
      if (newEras.size === eras.length && eras.length > 0) await unlockBadge('era_traveler');
    }
  };

  const handlePointSelection = async (point) => {
    setSelectedPoint(point);
    setSelectedJourney(null);
    if (point) {
      const pointId = point.id || point.name;

      const isNewDiscovery = !visitedPoints.has(pointId);

      if (isNewDiscovery) {
        const newVisited = new Set(visitedPoints).add(pointId);
        setVisitedPoints(newVisited);
        const reason = (strings?.maps?.points_reason || "Discovered landmark: {name}").replace('{name}', point.name);
        await updateUserPoints(40, reason);
        if (user) await updateDoc(doc(firestore, 'users', user.uid), { visitedMapPoints: arrayUnion(pointId) });
        if (newVisited.size === 5) await unlockBadge('map_pioneer');
        if (newVisited.size === 20) await unlockBadge('ancient_navigator');
        setDailyTaskDone(true);
      } else if (!dailyTaskDone) {
        // Record daily interaction for existing points to complete the daily task
        await updateUserPoints(10, strings?.maps?.title || 'Map Exploration');
        setDailyTaskDone(true);
      }
    }
  };

  const flyToPlace = (place) => {
    mapRef.current?.flyTo({ center: [place.lng, place.lat], zoom: 12 });
    handlePointSelection(place);
  };

  const normalizeArabic = (text) => {
    if (!text) return "";
    return text.toString().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/[\u064B-\u0652]/g, "").toLowerCase();
  };

  const filteredSearchPlaces = useMemo(() => {
    if (!searchQuery.trim() || !Array.isArray(allPlaces)) return [];
    const normalizedQuery = normalizeArabic(searchQuery);
    return allPlaces.filter(p => p.name && normalizeArabic(p.name).includes(normalizedQuery)).slice(0, 8);
  }, [allPlaces, searchQuery]);

  const eraFilteredPoints = useMemo(() => {
    if (!Array.isArray(allPlaces)) return [];
    return allPlaces
      .filter(p => p.type === 'point' && (!selectedEra || selectedEra === strings?.maps?.eras_placeholder || p.era === selectedEra))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', language));
  }, [allPlaces, selectedEra, language, strings]);

  const totalPointsCount = useMemo(() => Array.isArray(allPlaces) ? allPlaces.filter(p => p.type === 'point').length : 0, [allPlaces]);

  const progressPercent = totalPointsCount > 0
    ? Math.round((visitedPoints.size / totalPointsCount) * 100)
    : 0;

  const popupEraColors = useMemo(() => {
    if (!selectedPoint) return null;
    return getEraColors(selectedPoint.era);
  }, [selectedPoint, eras]);

  const nearbyPlaces = useMemo(() => {
    if (!selectedPoint || !Array.isArray(allPlaces)) return [];
    return allPlaces
      .filter(p => p.type === 'point' && p.era === selectedPoint.era && p.name !== selectedPoint.name)
      .map(p => ({ ...p, distanceKm: getDistanceKm(selectedPoint.lat, selectedPoint.lng, p.lat, p.lng) }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 4);
  }, [selectedPoint, allPlaces]);

  const handleRandomDiscover = () => {
    if (eraFilteredPoints.length === 0) return;
    const unvisited = eraFilteredPoints.filter(p => !visitedPoints.has(p.id || p.name));
    const pool = unvisited.length > 0 ? unvisited : eraFilteredPoints;
    const randomPlace = pool[Math.floor(Math.random() * pool.length)];
    flyToPlace(randomPlace);
  };

  const geojsonPoints = useMemo(() => ({
    type: 'FeatureCollection',
    features: (Array.isArray(allPlaces) ? allPlaces : [])
      .filter(p => (!selectedEra || selectedEra === strings?.maps?.eras_placeholder || p.era === selectedEra) && p.type === 'point')
      .map(p => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { ...p }
      }))
  }), [allPlaces, selectedEra, strings]);

  const geojsonPaths = useMemo(() => ({
    type: 'FeatureCollection',
    features: (Array.isArray(allPlaces) ? allPlaces : [])
      .filter(p => (!selectedEra || selectedEra === strings?.maps?.eras_placeholder || p.era === selectedEra) && p.type === 'polyline')
      .map(p => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: p.coordinates },
        properties: { ...p }
      }))
  }), [allPlaces, selectedEra, strings]);

  const handleMapClick = (e) => {
    const feature = e.features && e.features[0];
    if (feature) {
      if (feature.layer.id === 'unclustered-point') {
        handlePointSelection(feature.properties);
      } else if (feature.layer.id === 'line-layer') {
        setSelectedJourney(feature.properties);
        setSelectedPoint(null);
      }
    } else {
      setSelectedPoint(null);
      setSelectedJourney(null);
    }
  };

  if (!mounted) return null;

  const showMap = !isLoading && mapStyle;

  return (
    <div dir={dir} className={styles.container}>
      <header className={styles.headerSection}>
        <h1 className={styles.heading}>{strings?.maps?.title || 'الخرائط الكتابية'}</h1>
      </header>

      <div className={styles.searchContainer} ref={searchRef}>
        <div className={styles.searchBar}>
          <Search size={20} className={styles.searchIcon} />
          <input
            type="text"
            placeholder={strings?.maps?.search_placeholder || 'ابحث عن مكان...'}
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && <X size={18} className={styles.clearSearch} onClick={() => setSearchQuery("")} />}
        </div>
        {searchQuery && (
          <div className={styles.searchResults}>
            {filteredSearchPlaces.map((place, idx) => (
              <div key={idx} className={styles.searchResultItem} onClick={() => {
                flyToPlace(place);
                setSearchQuery("");
              }}>
                <MapPin size={18} />
                <div className={styles.resultDetails}>
                  <span className={styles.resultNameText}>{place.name}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.progressPanel}>
        <div className={styles.progressStat}>
          <MapPin size={18} className={styles.progressIcon} />
          <div className={styles.progressText}>
            <span className={styles.progressValue}>
              {formatNumber(visitedPoints.size)}/{formatNumber(totalPointsCount)}
            </span>
            <span className={styles.progressLabel}>
              {strings?.maps?.progress_places_label || 'أماكن مكتشفة'}
            </span>
          </div>
        </div>
        <div className={styles.progressStat}>
          <Award size={18} className={styles.progressIcon} />
          <div className={styles.progressText}>
            <span className={styles.progressValue}>
              {formatNumber(badgesCount)}/{formatNumber(TOTAL_MAP_BADGES)}
            </span>
            <span className={styles.progressLabel}>
              {strings?.maps?.progress_badges_label || 'أوسمة'}
            </span>
          </div>
        </div>
        <div className={styles.progressBarOuter}>
          <div className={styles.progressBarInner} style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className={styles.controls}>
        <div className={`${styles.customSelectWrapper} ${isEraOpen ? styles.activeWrapper : ''}`} ref={eraRef}>
          <div className={styles.selectTrigger} onClick={() => setIsEraOpen(!isEraOpen)}>
            <Globe size={18} /> <span>{selectedEra || strings?.maps?.eras_placeholder || 'كل العصور'}</span>
            <ChevronDown size={18} className={isEraOpen ? styles.rotateIcon : ''} />
          </div>
          <ul className={`${styles.dropdownMenu} ${isEraOpen ? styles.open : ''}`}>
            <li className={styles.dropdownItem} onClick={() => handleEraSelection(strings?.maps?.eras_placeholder)}>{strings?.maps?.all_eras || 'كل العصور'}</li>
            {eras.map(era => <li key={era} className={styles.dropdownItem} onClick={() => handleEraSelection(era)}>{era}</li>)}
          </ul>
        </div>

        <div className={`${styles.customSelectWrapper} ${isPlaceOpen ? styles.activeWrapper : ''}`} ref={placeRef}>
          <div
            className={`${styles.selectTrigger} ${eraFilteredPoints.length === 0 ? styles.disabledTrigger : ''}`}
            onClick={() => eraFilteredPoints.length > 0 && setIsPlaceOpen(!isPlaceOpen)}
          >
            <MapPin size={18} />
            <span>{selectedPoint ? selectedPoint.name : (strings?.maps?.choose_place_placeholder || 'اختر مكانًا')}</span>
            <ChevronDown size={18} className={isPlaceOpen ? styles.rotateIcon : ''} />
          </div>
          <ul className={`${styles.dropdownMenu} ${isPlaceOpen ? styles.open : ''}`}>
            {eraFilteredPoints.map((place, idx) => (
              <li
                key={place.id || `${place.name}-${idx}`}
                className={styles.dropdownItem}
                onClick={() => {
                  flyToPlace(place);
                  setIsPlaceOpen(false);
                }}
              >
                {place.name}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <button className={styles.discoverBtn} onClick={handleRandomDiscover} disabled={eraFilteredPoints.length === 0}>
        <Shuffle size={18} />
        {strings?.maps?.discover_button_label || 'اكتشف مكانًا عشوائيًا'}
      </button>

      <div className={styles.mapContainer}>
        {showMap ? (
          <Map
            ref={mapRef}
            {...viewState}
            onMove={evt => setViewState(evt.viewState)}
            mapLib={maplibregl}
            mapStyle={mapStyle}
            onClick={handleMapClick}
            interactiveLayerIds={['unclustered-point', 'line-layer']}
            maxZoom={20}
            minZoom={4}
            maxBounds={MAX_BOUNDS}
            style={{ width: '100%', height: '100%' }}
          >
            <NavigationControl position="top-right" showCompass={false} />
            <FullscreenControl position="top-right" />

            <Source id="paths-data" type="geojson" data={geojsonPaths}>
              <Layer id="line-layer" type="line" paint={{ 'line-color': '#00c8ff', 'line-width': 4 }} />
            </Source>

            <Source id="points-data" type="geojson" data={geojsonPoints} cluster={true} clusterMaxZoom={14} clusterRadius={50}>
              <Layer id="clusters" type="circle" filter={['has', 'point_count']} paint={{ 'circle-color': '#191d34', 'circle-radius': 20 }} />
              <Layer id="cluster-count" type="symbol" filter={['has', 'point_count']} layout={{ 'text-field': '{point_count}', 'text-size': 12 }} paint={{ 'text-color': '#fff' }} />
              <Layer id="unclustered-point" type="circle" filter={['!', ['has', 'point_count']]} paint={{ 'circle-radius': 9, 'circle-color': '#00ffff', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' }} />
              <Layer id="label-layer" type="symbol" filter={['!', ['has', 'point_count']]} layout={{ 'text-field': ['get', 'name'], 'text-size': 14, 'text-anchor': 'top', 'text-offset': [0, 1.5], 'text-font': ['Noto Sans Arabic Bold'] }} paint={{ 'text-color': '#fff', 'text-halo-color': '#000', 'text-halo-width': 2 }} />
            </Source>

            {selectedPoint && (
              <Popup
                longitude={selectedPoint.lng}
                latitude={selectedPoint.lat}
                anchor="bottom"
                maxWidth="300px"
                onClose={() => setSelectedPoint(null)}
              >
                <div
                  className={styles.popupCard}
                  style={{
                    '--era-color': popupEraColors?.base || FALLBACK_HEX,
                    '--era-color-dark': popupEraColors?.dark || '#000',
                    '--era-color-tint-10': popupEraColors?.tint10 || 'rgba(0,0,0,0.1)',
                    '--era-color-tint-15': popupEraColors?.tint15 || 'rgba(0,0,0,0.15)',
                    '--era-color-tint-25': popupEraColors?.tint25 || 'rgba(0,0,0,0.25)',
                  }}
                >
                  <div className={styles.popupBand}>
                    <MapPin size={26} className={styles.popupBandIcon} />
                  </div>

                  <div className={styles.popupBody}>
                    {selectedPoint.era && (
                      <span className={styles.popupEraTag}>{selectedPoint.era}</span>
                    )}
                    <h3 className={styles.popupTitle}>{selectedPoint.name}</h3>
                    <p className={styles.popupInfo}>{selectedPoint.info}</p>

                    {selectedPoint.book && (
                      <button
                        className={styles.bibleLinkBtn}
                        onClick={() => router.push(`/bible?book=${encodeURIComponent(selectedPoint.book)}&chapter=${selectedPoint.chapter || 1}`)}
                      >
                        <BookOpen size={18} /> {strings?.maps?.read_in_bible || 'اقرأ في الكتاب'}
                      </button>
                    )}

                    {nearbyPlaces.length > 0 && (
                      <div className={styles.nearbyWrapper}>
                        <span className={styles.nearbyTitle}>
                          <Navigation size={14} /> {strings?.maps?.nearby_places_label || 'أماكن قريبة'}
                        </span>
                        <div className={styles.nearbyList}>
                          {nearbyPlaces.map((np, idx) => (
                            <button key={idx} className={styles.nearbyItem} onClick={() => flyToPlace(np)}>
                              <span className={styles.nearbyDot} />
                              <span className={styles.nearbyName}>{np.name}</span>
                              <span className={styles.nearbyDistance}>
                                {np.distanceKm.toFixed(1)} {strings?.maps?.km_unit || 'كم'}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            )}
          </Map>
        ) : (
          <div className={styles.loadingWrapper}>
            <div className={styles.spinner} />
          </div>
        )}

        {selectedJourney && (
          <div className={styles.journeyCard}>
            <div className={styles.journeyHeader}>
              <Route size={24} /> <h3>{selectedJourney.name}</h3>
              <button onClick={() => setSelectedJourney(null)}><X size={20} /></button>
            </div>
            <p>{selectedJourney.info}</p>
          </div>
        )}
      </div>
    </div>
  );
}
