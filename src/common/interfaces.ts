import { IdempotencyData, IdempotencyObject } from './types';

/**
 * Cache object properties.
 */
export interface ICache {
  files: { [key: string]: string };
}

/**
 * File utility operation counts.
 */
export interface OperationCounts {
  added: number;
  updated: number;
  removed: number;
}

/**
 * Configuration object properties.
 */
export interface IConfig {
  settings?: string | ISetting[];
  connections?: string | IConnection[];
  files?: string[];
  data?: string[];
  output?: OutputConfig;
  idempotency?: IdempotencyConfig;
}

/**
 * Connection object properties.
 */
export interface IConnection {
  server: string;
  database: string;
  port?: number;
  user: string;
  password: string;
  //options?: string | IOption[];
}

/**
 * setting object properties.
 */
export interface ISetting {
  name: string;
  connection: IConnection;
  output: OutputConfig;
  idempotency: IdempotencyConfig;
  includeConstraintName: boolean;
  root: string;
  currentVersion: string;
}

/**
 * option object properties.
 */
export interface IOption {
  enableArithAbort: boolean;
  cryptoCredentialsDetails: ICryptoCredentialsDetails;
  encrypt: boolean;
}

/**
 * CryptoCredentialsDetails object properties.
 */
export interface ICryptoCredentialsDetails {
  minVersion: string;
}

/**
 * Supported idempotency configuration.
 */
export interface IdempotencyConfig {
  data?: IdempotencyData;
  functions?: IdempotencyObject;
  jobs?: IdempotencyObject;
  procs?: IdempotencyObject;
  tables?: IdempotencyObject;
  triggers?: IdempotencyObject;
  types?: IdempotencyObject;
  views?: IdempotencyObject;
  temps?: IdempotencyObject;
}

/**
 * Supported output configuration.
 */
export interface OutputConfig {
  root?: string;
  data?: string | false;
  functions?: string | false;
  jobs?: string | false;
  procs?: string | false;
  schemas?: string | false;
  tables?: string | false;
  triggers?: string | false;
  types?: string | false;
  views?: string | false;
  temps?: string | false;
}
