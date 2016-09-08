declare module "kii-sdk" {
  declare function create(): Kii;
}

declare module "blecast_tm" {
   declare function exports(): BlecastTM;
}

declare class Kii {
  KiiSite: Map<*, *>;

  Kii: KiiRoot;
  KiiThing: Class<KiiThing>;
  KiiUser: Class<KiiUser>;
}

declare class KiiRoot {
  initializeWithSite(app_id: string, app_key: string, site: string): void;
}

declare class KiiThing {
  static register(params: Object): Promise<KiiThing>;
  static loadWithVendorThingID(vthid: string): Promise<KiiThing>;
  getThingID(): string;
  bucketWithName(name: string): KiiBucket;
}

declare class KiiBucket {
  createObjectWithID(id: string): any;
}

declare type Callbacks<T> = {
  success: (u: T) => void;
  failure: (u: T, err: any) => void;
}

declare class KiiUser {
  _username: string;
  _password: string;
  _authenticate(cb: Callbacks<KiiUser>): Promise<KiiUser>;
}

declare class BlecastTM {
  on(event: string, callback: Object): void;
}

declare class Error {
  target: string;
}
