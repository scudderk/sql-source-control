import mock from 'mock-fs';
import Config from './config';
import { IConnection, IdempotencyConfig, OutputConfig } from './interfaces';

describe('Config class', () => {
  const name = 'dev';
  const server = 'localhost';
  const port = 1433;
  const database = 'awesome-db';
  const user = 'example';
  const password = 'qwerty';
  const connection: IConnection = {
    database,
    password,
    port,
    server,
    user
  };
  const files = ['dbo.*'];
  const data = ['dbo.LookupTable'];
  const output: OutputConfig = { root: './my-database' };
  const idempotency: IdempotencyConfig = { triggers: false };

  beforeEach(() => {
    mock.restore();
  });

  afterAll(() => {
    mock.restore();
  });

  describe('doesDefaultExist method', () => {
    it('should return true if file exists', () => {
      const file = Config.defaultConfigFile;

      mock({
        [file]: '',
      });

      const value = Config.doesDefaultExist();
      expect(value).toEqual(true);
    });
  });

  describe('doesDefaultExist method', () => {
    it('should return false if file not exists', () => {
      mock({});

      let value: boolean;

      // https://github.com/tschaub/mock-fs/issues/256
      try {
        value = Config.doesDefaultExist();
      } catch (ex) {
        value = false;
      }

      expect(value).toEqual(false);
    });
  });

  describe('getConnectionsFromWebConfig method', () => {
    it('should return connections if default web.config exists', () => {
      const file = Config.defaultWebConfigFile;

      mock({
        [file]: `
          <?xml version="1.0" encoding="utf-8"?>
          <configuration>
            <connectionStrings>
            <add
              name="${name}"
              connectionString="server=${server};database=${database};uid=${user};password=${password};" />
            </connectionStrings>
          </configuration>
        `,
      });
    });
  });

  describe('constructor', () => {
    it('should load from default file', () => {
      const file = Config.defaultConfigFile;

      mock({
        [file]: JSON.stringify({
          connections: [connection],
          data,
          files,
          idempotency,
          output,
        }),
      });
    });

    it('should load from specified file', () => {
      const file = 'override-example.json';

      mock({
        [file]: JSON.stringify({
          connections: [connection],
          data,
          files,
          idempotency,
          output,
        }),
      });
    });
  });

  describe('getConnection method', () => {
    it('should return first connection', () => {
      const file = Config.defaultConfigFile;

      mock({
        [file]: JSON.stringify({
          connections: [connection],
        }),
      });
    });

    it('should return connection by name', () => {
      const file = Config.defaultConfigFile;

      mock({
        [file]: JSON.stringify({
          connections: [connection],
        }),
      });
    });
  });

  describe('getConnections method', () => {
    it('should return all conneections', () => {
      const file = Config.defaultConfigFile;

      mock({
        [file]: JSON.stringify({
          connections: [connection],
        }),
      });
    });
  });
});
