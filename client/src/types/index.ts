export type ItemType = "app" | "bookmark";

export interface Item {
  id: number;
  type: ItemType;
  name: string;
  url: string;
  icon: string | null;
  description: string | null;
  category_id: number | null;
  sort_order: number;
  is_pinned: 0 | 1;
}

export interface Category {
  id: number;
  name: string;
  sort_order: number;
}

export interface Settings {
  theme: "dark" | "light";
  accent_color: string;
  greeting_name: string;
  search_engine: string;
  sabnzbd_configured: string;
  sabnzbd_url?: string;
  [key: string]: string | undefined;
}

export interface SabnzbdSlot {
  nzo_id: string;
  filename: string;
  status: string;
  percentage: number;
  mb: number;
  mbleft: number;
  timeleft: string;
  size: string;
  sizeleft: string;
  priority: string;
  cat: string;
}

export interface SabnzbdHistorySlot {
  nzo_id: string;
  name: string;
  status: string;
  size: string;
  completed: number;
  fail_message: string;
}

export interface SabnzbdSnapshot {
  configured: boolean;
  reachable: boolean;
  error?: string;
  paused: boolean;
  speed: string;
  speedBps: number;
  kbpersec: string;
  timeleft: string;
  sizeleft: string;
  diskspace: string;
  queue: SabnzbdSlot[];
  history: SabnzbdHistorySlot[];
}

export type ArrService = "sonarr" | "radarr";

export interface MediaItem {
  id: string;
  service: ArrService;
  kind: "movie" | "episode";
  title: string;
  subtitle: string;
  overview: string;
  year: number | null;
  poster: string | null;
  addedAt: string;
  runtime: number | null;
  genres: string[];
  rating: number | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  link: string | null;
  quality: string | null;
}

export interface MediaSnapshot {
  configured: boolean;
  items: MediaItem[];
  errors: { service: ArrService; message: string }[];
}

export interface TeslaSnapshot {
  configured: boolean;
  reachable: boolean;
  error?: string;
  name: string;
  state: string;
  stateSince: string | null;
  healthy: boolean;
  batteryLevel: number | null;
  usableBatteryLevel: number | null;
  chargeLimit: number | null;
  estRange: number | null;
  ratedRange: number | null;
  pluggedIn: boolean;
  charging: boolean;
  chargerPower: number | null;
  chargeEnergyAdded: number | null;
  timeToFullCharge: number | null;
  scheduledChargingStart: string | null;
  odometer: number | null;
  speed: number | null;
  shiftState: string | null;
  insideTemp: number | null;
  outsideTemp: number | null;
  climateOn: boolean;
  geofence: string | null;
  latitude: number | null;
  longitude: number | null;
  locked: boolean;
  sentryMode: boolean;
  windowsOpen: boolean;
  doorsOpen: boolean;
  updateAvailable: boolean;
  version: string | null;
  lengthUnit: string;
  tempUnit: string;
}
