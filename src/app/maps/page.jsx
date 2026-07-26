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
  ChevronLeft,
  ChevronDown,
  Globe,
  Mountain
} from 'lucide-react';
import { getCairoIsoString } from '../../lib/dateUtils';
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

export default function MapsPage() {
  const { strings, dir, language, formatNumber } = useLanguage();
  const router = useRouter();
  const { triggerBadgeUnlock } = useBadge();
  const [allPlaces, setAllPlaces] = useState([]);
  const [selectedEra, setSelectedEra] = useState(strings.maps.eras_placeholder);
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
  const [infoReads, setInfoReads] = useState(0);

  const mapRef = useRef(null);
  const eraRef = useRef(null);
  const placeRef = useRef(null);
  const searchRef = useRef(null);

  const eras = Object.values(strings.maps.era_names);

  const unlockBadge = async (badgeId) => {
    if (user) {
      try {
        const userRef = doc(firestore, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const currentBadges = userSnap.data()?.badges || [];
        if (!currentBadges.includes(badgeId)) {
          await updateDoc(userRef, { badges: arrayUnion(badgeId) });
          triggerBadgeUnlock(badgeId);
        }
      } catch (e) { console.error(e); }
    } else {
      const localBadges = await StorageService.get('local_badges') || [];
      if (!localBadges.includes(badgeId)) {
        localBadges.push(badgeId);
        await StorageService.save('local_badges', localBadges);
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
        toast.success(strings.maps.toasts.points_earned.replace('{amount}', formatNumber(amount)).replace('{reason}', reason));
      } catch (e) { console.error(e); }
    } else {
        await StorageService.addPoints(amount);
        toast.success(strings.maps.toasts.points_earned.replace('{amount}', formatNumber(amount)).replace('{reason}', reason));
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
      if (u) {
        getDoc(doc(firestore, 'users', u.uid)).then(snap => {
          if (snap.exists()) {
            const data = snap.data();
            setVisitedPoints(new Set(data.visitedMapPoints || []));
            setVisitedEras(new Set(data.visitedEras || []));
            setInfoReads(data.mapInfoReads || 0);
          }
        });
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);

    fetch(`${API_MAPS_URL}?task=style`)
      .then((res) => res.json())
      .then((style) => setMapStyle(style))
      .catch((err) => console.error('Failed to load map style:', err));

    return () => maplibregl.removeProtocol('pmtiles');
  }, []);

  useEffect(() => {
    setMounted(true);
    const initPage = async () => {
      try {
        const response = await fetch(`${API_MAPS_URL}?task=places&lang=${language}`);
        const data = await response.json();
        setAllPlaces(data);
      } catch (error) { console.error("Error loading places:", error); }
      finally { setIsLoading(false); }
    };
    initPage();
  }, [language]);

  const handleEraSelection = async (era) => {
    setSelectedEra(era);
    setIsEraOpen(false);
    setSelectedPoint(null);
    if (era !== strings.maps.eras_placeholder && !visitedEras.has(era)) {
      const newEras = new Set(visitedEras).add(era);
      setVisitedEras(newEras);
      if (user) await updateDoc(doc(firestore, 'users', user.uid), { visitedEras: arrayUnion(era) });
      if (newEras.size === eras.length) await unlockBadge('era_traveler');
    }
  };

  const handlePointSelection = async (point) => {
    setSelectedPoint(point);
    setSelectedJourney(null);
    if (point) {
      const pointId = point.id || point.name;
      if (!visitedPoints.has(pointId)) {
        const newVisited = new Set(visitedPoints).add(pointId);
        setVisitedPoints(newVisited);
        await updateUserPoints(40, strings.maps.points_reason.replace('{name}', point.name));
        if (user) await updateDoc(doc(firestore, 'users', user.uid), { visitedMapPoints: arrayUnion(pointId) });
        if (newVisited.size === 5) await unlockBadge('map_pioneer');
        if (newVisited.size === 20) await unlockBadge('ancient_navigator');
      }
    }
  };

  const normalizeArabic = (text) => {
    if (!text) return "";
    return text.toString().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/[\u064B-\u0652]/g, "").toLowerCase();
  };

  const filteredSearchPlaces = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const normalizedQuery = normalizeArabic(searchQuery);
    return allPlaces.filter(p => normalizeArabic(p.name).includes(normalizedQuery)).slice(0, 8);
  }, [allPlaces, searchQuery]);

  const geojsonPoints = useMemo(() => ({
    type: 'FeatureCollection',
    features: allPlaces
      .filter(p => (selectedEra === strings.maps.eras_placeholder || p.era === selectedEra) && p.type === 'point')
      .map(p => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { ...p }
      }))
  }), [allPlaces, selectedEra]);

  const geojsonPaths = useMemo(() => ({
    type: 'FeatureCollection',
    features: allPlaces
      .filter(p => (selectedEra === strings.maps.eras_placeholder || p.era === selectedEra) && p.type === 'polyline')
      .map(p => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: p.coordinates },
        properties: { ...p }
      }))
  }), [allPlaces, selectedEra]);

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

  return (
    <div dir={dir} className={styles.container}>
      <header className={styles.headerSection}>
        <h1 className={styles.heading}>{strings.maps.title}</h1>
      </header>

      <div className={styles.searchContainer} ref={searchRef}>
        <div className={styles.searchBar}>
          <Search size={20} className={styles.searchIcon} />
          <input
            type="text"
            placeholder={strings.maps.search_placeholder}
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
                mapRef.current?.flyTo({ center: [place.lng, place.lat], zoom: 12 });
                handlePointSelection(place);
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

      <div className={styles.controls}>
        <div className={styles.customSelectWrapper} ref={eraRef}>
          <div className={styles.selectTrigger} onClick={() => setIsEraOpen(!isEraOpen)}>
            <Globe size={18} /> <span>{selectedEra}</span>
            <ChevronDown size={18} />
          </div>
          {isEraOpen && (
            <ul className={styles.dropdownMenu}>
              <li className={styles.dropdownItem} onClick={() => handleEraSelection(strings.maps.eras_placeholder)}>{strings.maps.all_eras}</li>
              {eras.map(era => <li key={era} className={styles.dropdownItem} onClick={() => handleEraSelection(era)}>{era}</li>)}
            </ul>
          )}
        </div>
      </div>

      {!isLoading && mapStyle && (
        <div className={styles.mapContainer}>
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
              <Popup longitude={selectedPoint.lng} latitude={selectedPoint.lat} anchor="bottom" onClose={() => setSelectedPoint(null)}>
                <div className={styles.popupWrapper}>
                  <h3>{selectedPoint.name}</h3>
                  <p>{selectedPoint.info}</p>
                  {selectedPoint.book && (
                    <button className={styles.bibleLinkBtn} onClick={() => router.push(`/bible?book=${encodeURIComponent(selectedPoint.book)}&chapter=${selectedPoint.chapter || 1}`)}>
                      <BookOpen size={18} /> {strings.maps.read_in_bible}
                    </button>
                  )}
                </div>
              </Popup>
            )}
          </Map>

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
      )}
    </div>
  );
}