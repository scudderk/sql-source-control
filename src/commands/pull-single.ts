import chalk from 'chalk';
import * as sql from 'mssql';
import multimatch from 'multimatch';
import ora from 'ora';

import Config from '../common/config';
import FileUtility from '../common/file-utility';
import MSSQLGenerator from '../generators/mssql';
import {
  SqlColumn,
  SqlDataResult,
  SqlForeignKey,
  SqlIndex,
  SqlJob,
  SqlJobSchedule,
  SqlJobStep,
  SqlObject,
  SqlPrimaryKey,
  SqlTable,
  SqlType,
  SqlPermissions,
} from '../queries/interfaces';
import {
  columnsRead,
  foreignKeysRead,
  indexesRead,
  jobSchedulesRead,
  jobsRead,
  jobStepsRead,
  objectRead,
  permissionsRead,
  primaryKeysRead,
  tablesRead,
  typesRead,
} from '../queries/mssql';
import { PullSingleOptions } from './interfaces';

export default class PullSingle {
  constructor(private name: string, private options: PullSingleOptions) {}

  /**
   * Spinner instance.
   */
  private spinner = ora();

  /**
   * Invoke action.
   */
  invoke() {
    const config = new Config(this.options.config);
    const sett = config.getSetting(this.name);

    this.spinner.start(
      `Pulling ${this.options.objname} from ${chalk.blue(sett.connection.server)} ...`
    );

    // connect to db
    return new sql.ConnectionPool(sett.connection)
      .connect()
      .then((pool) => {
        const queries: any[] = [
          pool
            .request()
            .query(objectRead(this.options.type, this.options.objname)),
          pool.request().query(permissionsRead),
        ];
        return Promise.all<sql.IResult<any>>(queries)
          .then((results) => {
            const tables: sql.IRecordSet<SqlTable> = results[1].recordset;
            const names = tables.map((item) => `${item.schema}.${item.name}`);

            const matched = multimatch(names, config.data);

            if (!matched.length) {
              return results;
            }
          })
          .then((results) => {
            pool.close();
            return results;
          });
      })
      .then((results) => this.writeFiles(config, results, this.options))
      .catch((error) => {
        console.error(error);
        this.spinner.fail(error);
      });
  }

  /**
   * Write all files to the file system based on `results`.
   *
   * @param config Current configuration to use.
   * @param results Array of data sets from SQL queries.
   */
  private writeFiles(config: Config, results: any[], options: PullSingleOptions) {
    // note: array order MUST match query promise array
    const objects: SqlObject[] = results[0].recordset;
    const permissions: SqlPermissions[] = results[1].recordset ? results[1].recordset : [];
    
    const generator = new MSSQLGenerator(config);
    const file = new FileUtility(config);
    let name: string
    let content: string 
    switch (options.type) {
      // stored procedures
      case 'P':
        name = `${options.objname}.sql`;
        content = generator.storedProcedure(objects[0]);
        content += generator.permissions(permissions, name);
        file.write(config.output.procs, name, content);
        file.write(`${config.currentVersion}/${config.output.procs}`, name, content);
        break;
      // views
      case 'V':
        name = `${options.objname}.sql`;
        content = generator.view(objects[0]);
        file.write(config.output.views, name, content);
        break;
      // functions
      case 'TF':
      case 'IF':
      case 'FN':
        name = `${options.objname}.sql`;
        content = generator.function(objects[0]);
    
        file.write(config.output.functions, name, content);
        break;
      default:
        break;
    }

    //file.writeUpdate();
    const msg = file.finalize();
    this.spinner.succeed(msg);
  }
}
