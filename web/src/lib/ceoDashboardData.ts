import type { ManagementInspection } from './inspectionQueries';

interface CeoMetrics {
  openRedFlags: number;
  storesAtCriticalRisk: number;
  slaBreaches: number;
  activeYellowWarnings: number;
  inspectionsToday: number;
}

interface AlertItem {
  id: string;
  storeName: string;
  section: string;
  itemTitle: string;
  risk: 'RED' | 'YELLOW';
  timeAgo: string;
  verifierName: string;
  timestamp: string;
  remarks?: string;
  statutoryRisk?: string;
}

interface SectionData {
  section: string;
  red: number;
  yellow: number;
  green: number;
}

interface SlaTicket {
  id: string;
  ticketId: string;
  storeName: string;
  section: string;
  issue: string;
  flaggedAt: string;
  slaStatus: 'within' | 'due-soon' | 'breached';
  assignedTo: string;
}

interface StoreCard {
  id: string;
  name: string;
  region: string;
  redCount: number;
  yellowCount: number;
  greenCount: number;
  complianceScore: number;
  lastInspected: string;
  hasOpenRed: boolean;
  hasOpenYellow: boolean;
}

export function computeCeoMetrics(inspections: ManagementInspection[]): CeoMetrics {
  const today = new Date().toISOString().split('T')[0];
  const todayInspections = inspections.filter(i => i.inspection_date === today);

  const redFlags = inspections.flatMap(inspection =>
    inspection.responses.filter(r =>
      r.risk_level === 'RED' &&
      ((r.trigger_on_no && r.response === 'No') || (!r.trigger_on_no && r.response === 'Yes'))
    )
  );

  const yellowFlags = inspections.flatMap(inspection =>
    inspection.responses.filter(r =>
      r.risk_level === 'YELLOW' &&
      ((r.trigger_on_no && r.response === 'No') || (!r.trigger_on_no && r.response === 'Yes'))
    )
  );

  const storeRedCounts = new Map<string, number>();
  inspections.forEach(inspection => {
    const redInStore = inspection.responses.filter(r =>
      r.risk_level === 'RED' &&
      ((r.trigger_on_no && r.response === 'No') || (!r.trigger_on_no && r.response === 'Yes'))
    ).length;
    if (redInStore > 0) {
      storeRedCounts.set(inspection.branch_id, (storeRedCounts.get(inspection.branch_id) || 0) + redInStore);
    }
  });

  const storesAtRisk = Array.from(storeRedCounts.values()).filter(count => count >= 2).length;

  const slaBreachedCount = redFlags.filter(flag => {
    const flagDate = new Date(inspections.find(i =>
      i.responses.some(r => r.id === flag.id)
    )?.submitted_at || '');
    const hoursSince = (Date.now() - flagDate.getTime()) / (1000 * 60 * 60);
    return hoursSince > 24;
  }).length;

  const yellowBreach = yellowFlags.filter(flag => {
    const flagDate = new Date(inspections.find(i =>
      i.responses.some(r => r.id === flag.id)
    )?.submitted_at || '');
    const hoursSince = (Date.now() - flagDate.getTime()) / (1000 * 60 * 60);
    return hoursSince > 72;
  }).length;

  return {
    openRedFlags: redFlags.length,
    storesAtCriticalRisk: storesAtRisk,
    slaBreaches: slaBreachedCount,
    activeYellowWarnings: yellowBreach,
    inspectionsToday: todayInspections.length
  };
}

export function computeAlertFeed(inspections: ManagementInspection[]): AlertItem[] {
  const alerts: AlertItem[] = [];

  inspections.forEach(inspection => {
    inspection.responses.forEach(response => {
      if (response.risk_level === 'RED' || response.risk_level === 'YELLOW') {
        const isTriggered = (response.trigger_on_no && response.response === 'No') ||
                          (!response.trigger_on_no && response.response === 'Yes');
        
        if (isTriggered) {
          const timestamp = new Date(inspection.submitted_at);
          const hoursSince = Math.floor((Date.now() - timestamp.getTime()) / (1000 * 60 * 60));
          
          alerts.push({
            id: `${inspection.id}-${response.id}`,
            storeName: inspection.branch_name,
            section: response.section,
            itemTitle: response.item_text,
            risk: response.risk_level as 'RED' | 'YELLOW',
            timeAgo: hoursSince < 1 ? 'Just now' : `${hoursSince}h ago`,
            verifierName: inspection.officer_name,
            timestamp: inspection.submitted_at,
            remarks: response.remarks || undefined
          });
        }
      }
    });
  });

  return alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 50);
}

export function computeSectionBreakdown(inspections: ManagementInspection[]): SectionData[] {
  const sectionMap = new Map<string, { red: number; yellow: number; green: number }>();

  inspections.forEach(inspection => {
    inspection.responses.forEach(response => {
      const section = response.section;
      if (!sectionMap.has(section)) {
        sectionMap.set(section, { red: 0, yellow: 0, green: 0 });
      }

      const isViolation = (response.trigger_on_no && response.response === 'No') ||
                         (!response.trigger_on_no && response.response === 'Yes');

      if (isViolation) {
        const data = sectionMap.get(section)!;
        if (response.risk_level === 'RED') data.red++;
        else if (response.risk_level === 'YELLOW') data.yellow++;
        else if (response.risk_level === 'GREEN') data.green++;
      }
    });
  });

  return Array.from(sectionMap.entries())
    .map(([section, counts]) => ({ section, ...counts }))
    .sort((a, b) => (b.red + b.yellow + b.green) - (a.red + a.yellow + a.green));
}

export function computeSlaTickets(inspections: ManagementInspection[]): SlaTicket[] {
  const tickets: SlaTicket[] = [];

  inspections.forEach(inspection => {
    inspection.responses.forEach(response => {
      if (response.risk_level === 'RED') {
        const isTriggered = (response.trigger_on_no && response.response === 'No') ||
                          (!response.trigger_on_no && response.response === 'Yes');
        
        if (isTriggered) {
          const flaggedTime = new Date(inspection.submitted_at);
          const hoursSince = (Date.now() - flaggedTime.getTime()) / (1000 * 60 * 60);
          
          let slaStatus: 'within' | 'due-soon' | 'breached' = 'within';
          if (hoursSince > 24) slaStatus = 'breached';
          else if (hoursSince > 22) slaStatus = 'due-soon';

          tickets.push({
            id: `${inspection.id}-${response.id}`,
            ticketId: `T${inspection.id.slice(0, 6).toUpperCase()}`,
            storeName: inspection.branch_name,
            section: response.section,
            issue: response.item_text,
            flaggedAt: flaggedTime.toLocaleString('en-IN', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            }),
            slaStatus,
            assignedTo: 'Supervisor'
          });
        }
      }
    });
  });

  return tickets.sort((a, b) => {
    if (a.slaStatus === 'breached' && b.slaStatus !== 'breached') return -1;
    if (a.slaStatus !== 'breached' && b.slaStatus === 'breached') return 1;
    return 0;
  });
}

export function computeStoreCards(inspections: ManagementInspection[]): StoreCard[] {
  const storeMap = new Map<string, {
    id: string;
    name: string;
    region: string;
    red: number;
    yellow: number;
    green: number;
    total: number;
    violations: number;
    lastInspected: string;
  }>();

  inspections.forEach(inspection => {
    if (!storeMap.has(inspection.branch_id)) {
      storeMap.set(inspection.branch_id, {
        id: inspection.branch_id,
        name: inspection.branch_name,
        region: inspection.region || 'Unknown',
        red: 0,
        yellow: 0,
        green: 0,
        total: 0,
        violations: 0,
        lastInspected: inspection.inspection_date
      });
    }

    const store = storeMap.get(inspection.branch_id)!;
    
    if (new Date(inspection.inspection_date) > new Date(store.lastInspected)) {
      store.lastInspected = inspection.inspection_date;
    }

    inspection.responses.forEach(response => {
      store.total++;
      const isViolation = (response.trigger_on_no && response.response === 'No') ||
                         (!response.trigger_on_no && response.response === 'Yes');

      if (isViolation) {
        store.violations++;
        if (response.risk_level === 'RED') store.red++;
        else if (response.risk_level === 'YELLOW') store.yellow++;
        else if (response.risk_level === 'GREEN') store.green++;
      }
    });
  });

  return Array.from(storeMap.values()).map(store => {
    const complianceScore = store.total > 0 
      ? Math.round(((store.total - store.violations) / store.total) * 100)
      : 100;

    const lastDate = new Date(store.lastInspected);
    const hoursSince = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60));
    const lastInspected = hoursSince < 24 ? `${hoursSince}h ago` : `${Math.floor(hoursSince / 24)}d ago`;

    return {
      id: store.id,
      name: store.name,
      region: store.region,
      redCount: store.red,
      yellowCount: store.yellow,
      greenCount: store.green,
      complianceScore,
      lastInspected,
      hasOpenRed: store.red > 0,
      hasOpenYellow: store.yellow > 0
    };
  }).sort((a, b) => b.redCount - a.redCount);
}
