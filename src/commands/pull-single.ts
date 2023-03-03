import sql from 'mssql';
import multimatch from 'multimatch';
import ora from 'ora';

import Config from '../common/config';
import FileUtility from '../common/file-utility';
import MSSQLGenerator from '../generators/mssql';
import { SqlObject, SqlTable, SqlPermissions } from '../queries/interfaces';
import { objectRead, permissionsRead } from '../queries/mssql';
import { PullSingleOptions } from './interfaces';
import chokidar from 'chokidar';
import fs from 'fs';
import Setting from '../common/setting';
import * as path from 'path';

export default class PullSingle {
  constructor(private name: string, private options: PullSingleOptions) {}

  /**
   * Spinner instance.
   */
  private spinner = ora();

  invoke_test() {
    const config = new Config(this.options.config);
    const sett = config.getSetting(this.name);
  }

  /**
   * Invoke action.
   */
  invoke() {
    const config = new Config(this.options.config);
    const sett = config.getSetting(this.name);

    let temps = '';
    if (sett.output.temps != false) {
      const dir = path.join(sett.output.root, sett.output.temps);
      if (!fs.existsSync(dir) && sett.output.temps !== '') {
        fs.mkdirSync(dir);
      }
      temps = path.join(dir);
    }

    /*this.spinner.start(
      // `Pulling ${this.options.objname} from ${chalk.blue(sett.connection.server)} ...`
      `Listening to directory ${chalk.blue(temps)} ...`
    );*/
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
                const tables: sql.IRecordSet<SqlTable> = results[1].recordset;
                const names = tables.map(
                  (item) => `${item.schema}.${item.name}`
                );

                const matched = multimatch(names, config.data);

                if (!matched.length) {
                  return results;
                }
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
            // this.spinner.fail(error);
          });
        // this.writeFiles(config, test, this.options)
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

    // connect to db
    // return new sql.ConnectionPool(sett.connection)
    //   .connect()
    //   .then((pool) => {
    //     console.log(pool);

    //     // const queries: any[] = [
    //     //   pool
    //     //     .request()
    //     //     //.query(objectRead(this.options.type, this.options.objname)),
    //     //   /*pool.request()*/.query(permissionsRead)
    //     // ];
    //     /*return Promise.all<sql.IResult<any>>(queries)
    //       .then((results) => {
    //         const tables: sql.IRecordSet<SqlTable> = results[1].recordset;
    //         const names = tables.map((item) => `${item.schema}.${item.name}`);

    //         const matched = multimatch(names, config.data);

    //         if (!matched.length) {
    //           return results;
    //         }
    //       })
    //       .then((results) => {
    //         pool.close();
    //         return results;
    //       });*/
    //   })
    //   .then((results) => /*this.writeFiles(config, results, this.options)*/results)
    //   .catch((error) => {
    //     console.error(error);
    //     this.spinner.fail(error);
    //   });
  }

  /**
   * Write all files to the file system based on `results`.
   *
   * @param config Current configuration to use.
   * @param results Array of data sets from SQL queries.
   */
  // writeFiles(config: Config, results: any[], options: PullSingleOptions) {
  //   // note: array order MUST match query promise array
  //   const objects: SqlObject[] = results[0].recordset;
  //   const permissions: SqlPermissions[] = results[1].recordset ? results[1].recordset : [];

  //   const generator = new MSSQLGenerator(config);
  //   const file = new FileUtility(config);
  //   let name: string
  //   let content: string
  //   switch (options.type) {
  //     // stored procedures
  //     case 'P':
  //       name = `${options.objname}.sql`;
  //       content = generator.storedProcedure(objects[0]);
  //       content += generator.permissions(permissions, name);
  //       file.write(config.output.procs, name, content);
  //       file.write(`${config.currentVersion}/${config.output.procs}`, name, content);
  //       break;
  //     // views
  //     case 'V':
  //       name = `${options.objname}.sql`;
  //       content = generator.view(objects[0]);
  //       file.write(config.output.views, name, content);
  //       break;
  //     // functions
  //     case 'TF':
  //     case 'IF':
  //     case 'FN':
  //       name = `${options.objname}.sql`;
  //       content = generator.function(objects[0]);

  //       file.write(config.output.functions, name, content);
  //       break;
  //     default:
  //       break;
  //   }

  //   //file.writeUpdate();
  //   const msg = file.finalize();
  //   // this.spinner.succeed(msg);
  //   console.log(msg);
  // }
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

  const generator = new MSSQLGenerator(config);
  const file = new FileUtility(config, sett);
  let content: string;
  switch (type) {
    // stored procedures
    case 'P':
      name = `${name}.sql`;
      content = generator.storedProcedure(objects[0]);
      content += generator.permissions(permissions, name.split('.')[0]);
      file.write(`${sett.currentVersion}/${sett.output.procs}`, name, content);
      break;
    // views
    case 'V':
      name = `${name}.sql`;
      content = generator.view(objects[0]);
      file.write(sett.output.views, name, content);
      break;
    // functions
    case 'TF':
    case 'IF':
    case 'FN':
      name = `${name}.sql`;
      content = generator.function(objects[0]);
      file.write(sett.output.functions, name, content);
      break;
    default:
      break;
  }

  file.writeUpdate(generator, file);
  const msg = file.finalize();
  // this.spinner.succeed(msg);
  console.log(msg);
}
