import path from 'path';
import Config from '../common/config';
import Setting from '../common/setting';
import fs from 'fs';
import chokidar from 'chokidar';

export default class Start {
  constructor() { }

  /**
   * Invoke action.
   */
  invoke() {
    const config = new Config();
    const setts = config.getSettings();
    console.log(setts);
    setts.forEach((sett: Setting) => {
      let temps = '';
      if (!fs.existsSync(sett.output.root)) {
        fs.mkdirSync(sett.output.root);
      }
      if (sett.output.temps != false) {
        const dir = path.join(sett.output.root, sett.output.temps);
        if (!fs.existsSync(dir) && sett.output.temps !== '') {
          fs.mkdirSync(dir);
        }
        temps = path.join(dir);
      }
      console.log('Listening to directory ' + temps);

      chokidar
        .watch(temps, { ignored: /^\./, persistent: true })
        .on('add', function (path) {
          let pathArray = path.split('\\');
          let fileArray = pathArray[pathArray.length - 1].split('.');
          let storedProcedureName = fileArray[0];
          let type = fileArray[1];
          console.log(
            'Stored Procedure',
            storedProcedureName,
            'has been triggered'
          );
        })
        .on('change', function (path) {
          console.log('File', path, 'has been changed');
        })
        .on('unlink', function (path) {
          console.log('File', path, 'has been removed');
        })
        .on('error', function (error) {
          console.error('Error happened', error);
        });
    });
  }
}
