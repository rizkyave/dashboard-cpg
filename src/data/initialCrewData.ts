import {
  KapalRekapItem,
  CrewMasterItem,
  LowongItem,
  CadetMonitoringItem,
  AuditLogItem,
  CrewKapalSummary,
} from '@/types/crewKapal';
import crewDataJson from './crewData.json';

export const initialCrewSummary: CrewKapalSummary = crewDataJson.summary as CrewKapalSummary;
export const initialKapalRekap: KapalRekapItem[] = crewDataJson.kapalRekap as KapalRekapItem[];
export const initialMasterCrew: CrewMasterItem[] = crewDataJson.masterCrew as CrewMasterItem[];
export const initialLowong: LowongItem[] = crewDataJson.posisiLowong as LowongItem[];
export const initialCadet: CadetMonitoringItem[] = crewDataJson.cadetMonitoring as CadetMonitoringItem[];
export const initialAuditLogs: AuditLogItem[] = crewDataJson.auditLogs as AuditLogItem[];
