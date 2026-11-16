export type TickerCategory = 'ARMADA' | 'CUACA' | 'SOP CPG' | 'SAFETY';

export type TickerSeverity = 'info' | 'success' | 'warning' | 'marine' | 'critical';

export interface NewsTickerItem {
  id: string;
  category: TickerCategory;
  badge: string;
  title: string;
  content: string;
  highlight?: string;
  timestamp?: string;
  severity: TickerSeverity;
}

export interface NewsTickerResponse {
  success: boolean;
  timestamp: string;
  isOnline: boolean;
  totalItems: number;
  items: NewsTickerItem[];
  meta?: {
    armadaCount?: number;
    activeShips?: number;
    weatherLocation?: string;
    temperature?: number;
    windKnots?: number;
    source?: string;
  };
}
