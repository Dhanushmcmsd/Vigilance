export default {
  getItem: async () => null,
  setItem: async () => undefined,
  removeItem: async () => undefined,
  getAllKeys: async () => [] as string[],
  multiGet: async (keys: string[]) => keys.map((k) => [k, null] as const),
};
