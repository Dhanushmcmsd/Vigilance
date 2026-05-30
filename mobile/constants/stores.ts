export interface StoreInfo {
  code: string;
  name: string;
  incharge: string;
  phone: string;
  address: string;
  // Geocoded coordinates - resolved via address for map directions.
  latitude: number;
  longitude: number;
}

export const STORES: StoreInfo[] = [
  { code: 'V101', name: 'Sample Branch A', incharge: 'Manager A', phone: '1234567890', address: "123 Main St, City A, Region A", latitude: 8.8902, longitude: 76.7754 },
  { code: 'V102', name: 'Sample Branch B', incharge: 'Manager B', phone: '0987654321', address: "456 Oak Ave, City B, Region B", latitude: 8.9694, longitude: 76.9028 },
  // ... Add more stores or import from a database
];
