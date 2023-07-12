import * as fs from 'fs-extra';
import * as path from 'path';
import { isString } from 'ts-util-is';
import { IConfig } from './interfaces';
import Setting from './setting';

/**
 * Configuration options.
 */
export default class Config implements IConfig {
  /**
   * Default connections JSON file.
   */
  static readonly defaultConnectionsJsonFile = 'ssc-connections.json';

  /**
   * Default Web.config file.
   */
  static readonly defaultWebConfigFile = 'Web.config';

  /**
   * Default configuration file.
   */
  static readonly defaultConfigFile = 'ssc.json';

  /**
   * Write a config file with provided configuration.
   *
   * @param config Configuration object to write.
   * @param file Configuration file to write to.
   */
  static write(config: IConfig, file?: string) {
    const configFile = path.join(
      process.cwd(),
      file || Config.defaultConfigFile
    );
    const content = JSON.stringify(config, null, 2);

    fs.outputFile(configFile, content, (error) => {
      if (error) {
        return console.error(error);
      }

      console.log('Config file created!');
    });
  }

  /**
   * Update a config file with provided configuration.
   *
   * @param settings Settings to update config with.
   * @param file Configuration file to write to.
   */
  static update(settings: Setting[], file?: string) {
    const config: IConfig = new Config();
    config.settings = settings;
    const configFile = path.join(
      process.cwd(),
      file || Config.defaultConfigFile
    );
    const content = JSON.stringify(config, null, 2);

    fs.outputFile(configFile, content, (error) => {
      if (error) {
        return console.error(error);
      }
      console.log('Config file updated!');
    });
  }

  /**
   * Check if default configuration file exists.
   */
  static doesDefaultExist() {
    return fs.existsSync(Config.defaultConfigFile);
  }

  /**
   * Safely get connections from a Web.config file.
   *
   * @param file Relative path to Web.config file.
   */
  static getConnectionsFromWebConfig(file?: string) {
    const conns: string = '';
    //   return conns.length ? conns : undefined;
    return conns;
  }

  constructor(file?: string) {
    this.load(file);
  }

  settings: string | Setting[] = [];

  /**
   * Get a setting by name, or the first available if `name` is not provided.
   *
   * @param name Optional connection `name` to get.
   */
  getSetting(name?: string): Setting {
    const setts: Setting[] = this.getSettings();

    let sett: Setting;
    let error: string;

    if (name) {
      sett = setts.find(
        (item) => item.name.toLocaleLowerCase() === name.toLowerCase()
        );
        error = `Could not find settings by name '${name}'!`;
      } else {
        sett = setts[0];
        error = 'Could not find default setting!';
      }
      
    if (!sett) {
      console.error(error);
      process.exit();
    }

    sett.connection = Object.assign(sett.connection, {
      options: {
        // https://github.com/tediousjs/tedious/releases/tag/v7.0.0
        enableArithAbort: true,
        cryptoCredentialsDetails: {
          minVersion: 'TLSv1',
        },
        encrypt: false,
      },
      requestTimeout: 5000,
    });

    return sett;
  }

  /**
   * Safely get all settings.
   */
  getSettings() {
    if (!isString(this.settings)) {
      return this.settings;
    }

    return this.getSettingsFromJson(this.settings);
  }

  /**
   * Load configuration options from file.
   *
   * @param file Configuration file to load.
   */
  private load(file?: string) {

    const configFile = path.join(
      file || Config.defaultConfigFile
    );

    try {
      const config: Config = fs.readJsonSync(configFile);
      this.settings = config.settings || this.settings;
    } catch (error) {
      console.error(
        'Could not find or parse config file. You can use the `init` command to create one!'
      );
      process.exit();
    }
  }

  /**
   * Safely get settings from a JSON file.
   *
   * @param file Relative path to settings JSON file.
   */
  private getSettingsFromJson(file: string) {
    const jsonFile = path.join(process.cwd(), file);

    try {
      const config: Config = fs.readJsonSync(jsonFile);
      return config.settings as Setting[];
    } catch (error) {
      console.error('Could not find or parse settings config file!');
      process.exit();
    }
  }
}
