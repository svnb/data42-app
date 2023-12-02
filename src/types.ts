import { WarehouseArgs } from "./snowflake-core/types";

export enum ENVIRONMENT {
  PROD,
  INT,
}

export interface OutputPort {
  name: string;
}

export interface AppArgs {
  name: string;
  env: ENVIRONMENT | string;
  outputPorts: OutputPort[];
  snowflake: {
    warehouses: WarehouseArgs[];
  };
  datahub: boolean;
}
