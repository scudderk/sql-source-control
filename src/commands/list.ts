const Table = require('cli-table');

import Config from '../common/config';
import { ListOptions } from './interfaces';

export default class List {
  constructor(private options: ListOptions) {}

  /**
   * Invoke action.
   */
  invoke() {
    const config = new Config(this.options.config);
    //const connections = config.getConnections();
    const settings = config.getSettings();
    const placeholder = 'n/a';

    const table = new Table({
      head: ['Name', 'Server', 'Port', 'Database', 'User', 'Password', 'Options'],
    });

    // connections.forEach((conn) => {
    //   table.push([
    //     conn.name || placeholder,
    //     conn.server || placeholder,
    //     conn.port || placeholder,
    //     conn.database || placeholder,
    //     conn.user || placeholder,
    //     conn.password || placeholder,
    //   ]);
    // });

    settings.forEach((sett) => {
      table.push([
        sett.name || placeholder,
        sett.connection.server || placeholder,
        sett.connection.port || placeholder,
        sett.connection.database || placeholder,
        sett.connection.user || placeholder,
        sett.connection.password || placeholder
      ]);
    });

    // console.log(table.toString());
  }
}
