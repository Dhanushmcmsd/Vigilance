export type ChecklistItem = {
  id: string;
  section: string;
  item: string;
};

export const checklistItems: ChecklistItem[] = [
  { id: 'basic-1', section: 'Basic Details', item: 'Any prior complaints on this store' },
  { id: 'general-1', section: 'General Observation', item: 'Store opening/closing discipline maintained' },
  { id: 'general-2', section: 'General Observation', item: 'Cleanliness & hygiene condition' },
  { id: 'general-3', section: 'General Observation', item: 'Customer movement' },
  { id: 'general-4', section: 'General Observation', item: 'Any unusual activity observed' },
  { id: 'general-5', section: 'General Observation', item: 'Staff behaviour towards customers' },
  { id: 'cash-1', section: 'Cash & Billing', item: 'Cash counter functioning smoothly' },
  { id: 'cash-2', section: 'Cash & Billing', item: 'Bills issued for all visible transactions' },
  { id: 'cash-3', section: 'Cash & Billing', item: 'Any manual billing observed' },
  { id: 'cash-4', section: 'Cash & Billing', item: 'Bill person available at counter' },
  { id: 'stock-1', section: 'Stock & Inventory', item: 'Shelves adequately filled' },
  { id: 'stock-2', section: 'Stock & Inventory', item: 'Empty racks or stock-out items' },
  { id: 'stock-3', section: 'Stock & Inventory', item: 'Expired products visible' },
  { id: 'stock-4', section: 'Stock & Inventory', item: 'Damaged or leaking products' },
  { id: 'stock-5', section: 'Stock & Inventory', item: 'MRP tampering observed' },
  { id: 'stock-6', section: 'Stock & Inventory', item: 'Storage condition proper' },
  { id: 'staff-1', section: 'Staff Discipline', item: 'Staff in uniform / ID card' },
  { id: 'staff-2', section: 'Staff Discipline', item: 'Internal conflicts observed' },
  { id: 'staff-3', section: 'Staff Discipline', item: 'Staff actively engaged' },
  { id: 'staff-4', section: 'Staff Discipline', item: 'Unauthorized persons in staff area' },
  { id: 'staff-5', section: 'Staff Discipline', item: 'Late attendance or absenteeism' },
  { id: 'security-1', section: 'Security', item: 'CCTV cameras functional' },
  { id: 'security-2', section: 'Security', item: 'Blind spots noticed' },
  { id: 'security-3', section: 'Security', item: 'Fire safety equipment available' },
  { id: 'security-4', section: 'Security', item: 'Emergency exit accessible' },
  { id: 'security-5', section: 'Security', item: 'Suspicious activity observed' },
  { id: 'regulatory-1', section: 'Regulatory', item: 'Local authority interference' },
  { id: 'regulatory-2', section: 'Regulatory', item: 'Municipality/Panchayat issues' },
  { id: 'regulatory-3', section: 'Regulatory', item: 'Police/political interference' },
  { id: 'regulatory-4', section: 'Regulatory', item: 'Licenses displayed' },
  { id: 'regulatory-5', section: 'Regulatory', item: 'Closure threats or disputes' },
];
