import { ENVIRONMENT } from "../types";

export interface WarehouseArgs {
  name: string;
  default: boolean;
}

export interface SnowflakeCoreArgs {
  name: string;
  env: ENVIRONMENT | string;
  warehouses: WarehouseArgs[];
}
