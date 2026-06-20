'use client';
import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation'; 
import { Map, Source, Layer, NavigationControl, Popup, FullscreenControl } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import styles from './maps.module.css';
import { getAuth } from "firebase/auth";
import { doc, updateDoc, increment, arrayUnion, getDoc } from "firebase/firestore";
import { db, getFirebaseRemoteConfig } from '../../lib/firebase';
import { fetchAndActivate, getBoolean } from 'firebase/remote-config';
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
import { StorageService, KEYS } from '../../lib/storage';
import strings from '../data/ar.json';

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
  streets: 'https://tiles.openfreemap.org/styles/liberty',
  satellite: 'https://api.maptiler.com/maps/hybrid/style.json?key=QvkUns3IvYwEEKb9dIJ7',
  topo: 'https://api.maptiler.com/maps/topo-v2/style.json?key=QvkUns3IvYwEEKb9dIJ7'
};

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
  const router = useRouter(); 
  const { triggerBadgeUnlock } = useBadge();
  const [allPlaces, setAllPlaces] = useState([]);
  const [selectedEra, setSelectedEra] = useState(strings.maps.eras_placeholder);
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
  const [visitedEras, setVisitedEras] = useState(new Set());
  const [infoReads, setInfoReads] = useState(0);
  const [mapLoaded, setMapLoaded] = useState(false);

  const [isMapTilerAvailable, setIsMapTilerAvailable] = useState(true);
  const [showMaptilerFeatures, setShowMaptilerFeatures] = useState(true);

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
        toast.success(`+${amount} نقطة: ${reason}`);
      } catch (e) {
        console.error(e);
      }
    } else {
        await StorageService.addPoints(amount);
        const history = await StorageService.get('points_history') || [];
        history.push({
            type: 'mapExploration',
            points: amount,
            reason: reason,
            timestamp: getCairoIsoString()
        });
        await StorageService.save('points_history', history);
        toast.success(`+${amount} نقطة: ${reason}`);
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
      } else {
        const localVisited = await StorageService.get('visited_map_points') || [];
        const localEras = await StorageService.get('visited_eras') || [];
        const localReads = await StorageService.get('map_info_reads') || 0;
        setVisitedPoints(new Set(localVisited));
        setVisitedEras(new Set(localEras));
        setInfoReads(localReads);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setMounted(true);
    const initPage = async () => {
      const remoteConfig = await getFirebaseRemoteConfig();
      if (remoteConfig) {
        try {
          await fetchAndActivate(remoteConfig);
          setShowMaptilerFeatures(getBoolean(remoteConfig, 'show_maptiler_features'));
        } catch (e) {
          console.error("Remote Config Error:", e);
        }
      }

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
    initPage();
  }, []);

  const handleEraSelection = async (era) => {
    setSelectedEra(era);
    setIsEraOpen(false);
    setSelectedPoint(null);

    if (era !== strings.maps.eras_placeholder && !visitedEras.has(era)) {
      const newEras = new Set(visitedEras).add(era);
      setVisitedEras(newEras);

      if (user) {
        const userRef = doc(firestore, 'users', user.uid);
        await updateDoc(userRef, { visitedEras: arrayUnion(era) });
      } else {
        const localEras = await StorageService.get('visited_eras') || [];
        localEras.push(era);
        await StorageService.save('visited_eras', localEras);
      }

      if (newEras.size === eras.length) {
        await unlockBadge('era_traveler');
      }
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

        if (user) {
          const userRef = doc(firestore, 'users', user.uid);
          await updateDoc(userRef, { visitedMapPoints: arrayUnion(pointId) });
        } else {
          const localVisited = await StorageService.get('visited_map_points') || [];
          localVisited.push(pointId);
          await StorageService.save('visited_map_points', localVisited);
        }

        if (newVisited.size === 5) await unlockBadge('map_pioneer');
        if (newVisited.size === 20) await unlockBadge('ancient_navigator');
        if (newVisited.size >= allPlaces.filter(p => p.type === 'point').length && allPlaces.length > 0) {
            await unlockBadge('holy_land_pro');
        }
      }

      const newReads = infoReads + 1;
      setInfoReads(newReads);
      if (user) {
        await updateDoc(doc(firestore, 'users', user.uid), { mapInfoReads: increment(1) });
      } else {
        await StorageService.save('map_info_reads', newReads);
      }
      if (newReads === 50) await unlockBadge('info_addict');
    }
  };

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

  const geojsonPoints = useMemo(() => ({
    type: 'FeatureCollection',
    features: allPlaces
      .filter(p => (selectedEra === strings.maps.eras_placeholder || p.era === selectedEra) && p.type === 'point')
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
      .filter(p => (selectedEra === strings.maps.eras_placeholder || p.era === selectedEra) && p.type === 'polyline')
      .map(p => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: p.coordinates },
        properties: { name: p.name, info: p.info }
      }))
  }), [allPlaces, selectedEra]);

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
    if (!isMapTilerAvailable || !showMaptilerFeatures) return;

    if (!map.getSource('maptiler-terrain')) {
      map.addSource('maptiler-terrain', {
        type: 'raster-dem',
        url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=QvkUns3IvYwEEKb9dIJ7`,
        tileSize: 512
      });
    }

    if (currentStyle === MAP_STYLES.satellite) {
      map.setTerrain({ source: 'maptiler-terrain', exaggeration: 1.8 });
      if (map.setFog) {
        map.setFog({
          'range': [0.5, 10],
          'color': '#111625',
          'horizon-blend': 0.2
        });
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

  const handleMapError = (e) => {
    if (e.error && (e.error.status === 403 || e.error.message?.includes('api.maptiler.com'))) {
        setIsMapTilerAvailable(false);
        setCurrentStyle(MAP_STYLES.streets);
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
                <p>{strings.maps.no_results}</p>
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
              <span>{selectedEra === strings.maps.eras_placeholder ? strings.maps.choose_era : selectedEra}</span>
            </div>
            <ChevronDown size={18} className={isEraOpen ? styles.rotateIcon : ''} />
          </div>
          <ul className={`${styles.dropdownMenu} ${isEraOpen ? styles.open : ''}`}>
            <li className={styles.dropdownItem} onClick={() => handleEraSelection(strings.maps.eras_placeholder)}>
              {strings.maps.all_eras}
            </li>
            {eras.map((era) => (
              <li key={era} className={styles.dropdownItem} onClick={() => handleEraSelection(era)}>
                {era}
              </li>
            ))}
          </ul>
        </div>

        {selectedEra !== strings.maps.eras_placeholder && (
          <div className={`${styles.customSelectWrapper} ${isPlaceOpen ? styles.activeWrapper : ''}`} ref={placeRef}>
            <div className={styles.selectTrigger} onClick={() => { setIsPlaceOpen(!isPlaceOpen); setIsEraOpen(false); }}>
              <div className={styles.triggerLabel}>
                <MapPin size={18} />
                <span>{strings.maps.jump_to_place}</span>
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
          <MapIcon size={16} /> {strings.maps.style_map}
        </button>
        {isMapTilerAvailable && showMaptilerFeatures && (
          <>
            <button className={`${styles.styleButton} ${currentStyle === MAP_STYLES.satellite ? styles.activeStyle : ''}`} onClick={() => setCurrentStyle(MAP_STYLES.satellite)}>
              <Globe size={16} /> {strings.maps.style_satellite}
            </button>
            <button className={`${styles.styleButton} ${currentStyle === MAP_STYLES.topo ? styles.activeStyle : ''}`} onClick={() => setCurrentStyle(MAP_STYLES.topo)}>
              <Mountain size={16} /> {strings.maps.style_topo}
            </button>
          </>
        )}
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
            onError={handleMapError}
            interactiveLayerIds={['unclustered-point', 'line-layer']}
            maxZoom={currentStyle === MAP_STYLES.satellite ? 18 : 25}
            minZoom={4}
            maxBounds={MAX_BOUNDS}
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
                    <span className={styles.popupEraBadge}>{selectedPoint.book || strings.maps.default_point_book}</span>
                  </div>
                  <p className={styles.popupInfoText}>{selectedPoint.info || strings.maps.no_info}</p>

                  {selectedPoint.book && (
                    <button
                      className={styles.bibleLinkBtn}
                      onClick={() => {
                        router.push(`/bible?book=${encodeURIComponent(selectedPoint.book)}&chapter=${selectedPoint.chapter || 1}`);
                      }}
                    >
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
