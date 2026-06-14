export class MMKV {
  private store = new Map<string, string>();
  constructor(_opts?: { id?: string }) {}
  getString(key: string) {
    return this.store.get(key);
  }
  set(key: string, value: string) {
    this.store.set(key, value);
  }
}
