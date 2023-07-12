import sql from 'mssql';
import path from 'path';
import Config from '../common/config';
import Setting from '../common/setting';
import fs from 'fs';
import chokidar from 'chokidar';
import { StartOptions } from './interfaces';
import { SqlObject, SqlPermissions } from '../queries/interfaces';
import { objectRead, permissionsRead } from '../queries/mssql';
import MSSQLGenerator from '../generators/mssql';
import FileUtility from '../common/file-utility';

export default class Start {
  constructor(private options: StartOptions) {}

  /**
   * Invoke action.
   */
  invoke() {
    const config = new Config(this.options.config);
    const setts = config.getSettings();

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
          const pathArray = path.split('\\');
          const fileArray = pathArray[pathArray.length - 1].split('.');
          const storedProcedureName = fileArray[0];
          const type = fileArray[1];
          console.log(
            'Stored Procedure',
            storedProcedureName,
            'has been triggered'
          );

          // connect to db
          return new sql.ConnectionPool(sett.connection)
            .connect()
            .then((pool) => {
              const queries: any[] = [
                pool.request().query(objectRead(type, storedProcedureName)),
                pool.request().query(permissionsRead),
              ];
              return Promise.all<sql.IResult<any>>(queries)
                .then((results) => {
                  results[1].recordset;
                  return results;
                })
                .then((results) => {
                  pool.close();
                  fs.unlink(path, (err) => {
                    if (err) {
                      console.error(err);
                    }
                  });
                  return results;
                });
            })
            .then((results) =>
              writeFiles(config, sett, results, storedProcedureName, type)
            )
            .catch((error) => {
              console.error(error);
            });
        })
        .on('change', function (path) {
          console.log('File', path, 'has been changed');
        })
        .on('error', function (error) {
          console.error('Error happened', error);
        });
    });
  }
}
function writeFiles(
  config: Config,
  sett: Setting,
  results: any[],
  name: string,
  type: string
) {
  // note: array order MUST match query promise array
  const objects: SqlObject[] = results[0].recordset;
  const permissions: SqlPermissions[] = results[1].recordset
    ? results[1].recordset
    : [];

  console.log('results: ', results)
  
  const generator = new MSSQLGenerator(config);
  const file = new FileUtility(config, sett);
  let content: string;
  switch (type) {
    // stored procedures
    case 'P':
      console.log(name)
      name = `${name}.sql`;
      content = generator.storedProcedure(objects[0], sett);
      content += generator.permissions(permissions, name.split('.')[0]);
      file.write(`${sett.currentVersion}/${sett.output.procs}`, name, content);
      file.write(`${sett.output.procs}`, name, content);
      break;
    // views
    case 'V':
      name = `${name}.sql`;
      content = generator.view(objects[0], sett);
      file.write(`${sett.currentVersion}/${sett.output.views}`, name, content);
      file.write(sett.output.views, name, content);
      break;
    // functions
    case 'TF':
    case 'IF':
    case 'FN':
      name = `${name}.sql`;
      content = generator.function(objects[0], sett);
      file.write(
        `${sett.currentVersion}/${sett.output.functions}`,
        name,
        content
      );
      file.write(sett.output.functions, name, content);
      break;
    default:
      break;
  }
  
  file.writeUpdate(generator, file);  
  const msg = file.finalize();
  console.log(msg);
}
