import chalk from 'chalk';
import * as sql from 'mssql';
import multimatch from 'multimatch';
import ora from 'ora';

import Config from '../common/config';
import FileUtility from '../common/file-utility';
import Setting from '../common/setting';
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
  objectsRead,
  permissionsRead,
  primaryKeysRead,
  tablesRead,
  typesRead,
} from '../queries/mssql';
import { PullOptions } from './interfaces';

export default class Pull {
  constructor(private name: string, private options: PullOptions) {}

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
      `Pulling from ${chalk.blue(sett.connection.server)} ...`
    );

    // connect to db
    return new sql.ConnectionPool(sett.connection)
      .connect()
      .then((pool) => {
        const queries: any[] = [
          pool.request().query(objectsRead),
          pool.request().query(tablesRead),
          pool.request().query(columnsRead),
          pool.request().query(primaryKeysRead),
          pool.request().query(foreignKeysRead),
          pool.request().query(indexesRead),
          pool.request().query(typesRead),
        ];

        if (sett.output.jobs) {
          queries.push(
            pool.request().query(jobsRead(sett.connection.database)),
            pool.request().query(jobStepsRead(sett.connection.database)),
            pool.request().query(jobSchedulesRead())
          );
        } else {
          queries.push(null, null, null);
        }
        queries.push(pool.request().query(permissionsRead));

        return Promise.all<sql.IResult<any>>(queries)
          .then((results) => {
            const tables: sql.IRecordSet<SqlTable> = results[1].recordset;
            return results;
          })
          .then((results) => {
            pool.close();
            return results;
          });
      })
      .then((results) => this.writeFiles(config, sett, results))
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
  private writeFiles(config: Config, sett: Setting, results: any[]) {
    // note: array order MUST match query promise array
    const objects: SqlObject[] = results[0].recordset;
    const tables: SqlTable[] = results[1].recordset;
    const columns: SqlColumn[] = results[2].recordset;
    const primaryKeys: SqlPrimaryKey[] = results[3].recordset;
    const foreignKeys: SqlForeignKey[] = results[4].recordset;
    const indexes: SqlIndex[] = results[5].recordset;
    const types: SqlType[] = results[6].recordset;
    const jobs: SqlJob[] = results[7] ? results[7].recordset : [];
    const jobSteps: SqlJobStep[] = results[8] ? results[8].recordset : [];
    const jobSchedules: SqlJobSchedule[] = results[9]
      ? results[9].recordset
      : [];
    const permissions: SqlPermissions[] = results[10].recordset
      ? results[10].recordset
      : [];
    const data: SqlDataResult[] = results.slice(11);

    const generator = new MSSQLGenerator(config);
    const file = new FileUtility(config, sett);

    // schemas
    tables
      .map((item) => item.schema)
      .filter((value, index, array) => array.indexOf(value) === index)
      .map((value) => ({ name: value }))
      .forEach((item) => {
        const name = `${item.name}.sql`;
        const content = generator.schema(item);

        file.write(sett.output.schemas, name, content);
      });

    // stored procedures
    objects
      .filter((item) => item.type.trim() === 'P')
      .forEach((item) => {
        const name = `${item.name}.sql`;
        let content = generator.storedProcedure(item, sett);
        content += generator.permissions(permissions, name);

        file.write(sett.output.procs, name, content);
      });
    // views
    objects
      .filter((item) => item.type.trim() === 'V')
      .forEach((item) => {
        const name = `${item.schema}.${item.name}.sql`;
        const content = generator.view(item, sett);

        file.write(sett.output.views, name, content);
      });

    // functions
    objects
      .filter((item) => ['TF', 'IF', 'FN'].indexOf(item.type.trim()) !== -1)
      .forEach((item) => {
        const name = `${item.schema}.${item.name}.sql`;
        const content = generator.function(item, sett);

        file.write(sett.output.functions, name, content);
      });

    // triggers
    objects
      .filter((item) => item.type.trim() === 'TR')
      .forEach((item) => {
        const name = `${item.schema}.${item.name}.sql`;
        const content = generator.trigger(item, sett);

        file.write(sett.output.triggers, name, content);
      });

    // tables
    tables.forEach((item) => {
      const name = `${item.schema}.${item.name}.sql`;
      const content = generator.table(
        item,
        columns,
        primaryKeys,
        foreignKeys,
        indexes,
        sett
      );

      file.write(sett.output.tables, name, content);
    });

    // types
    types
      .filter((item) => !item.type)
      .forEach((item) => {
        const name = `${item.schema}.${item.name}.sql`;
        const content = generator.type(item, sett);

        file.write(sett.output.types, name, content);
      });

    // table types
    types
      .filter((item) => item.type && item.type.trim() === 'TT')
      .forEach((item) => {
        const name = `${item.schema}.${item.name}.sql`;
        const content = generator.tableType(item, columns, sett);

        file.write(sett.output.types, name, content);
      });

    // data
    data.forEach((item) => {
      const name = `${item.schema}.${item.name}.sql`;
      const content = generator.data(item, sett);

      file.write(sett.output.data, name, content);
    });

    // jobs
    jobs.forEach((item) => {
      const steps = jobSteps.filter((x) => x.job_id === item.job_id);
      const schedules = jobSchedules.filter((x) => x.job_id === item.job_id);
      const name = `${item.name}.sql`;
      const content = generator.job(item, steps, schedules, sett);

      file.write(sett.output.jobs, name, content);
    });

    const msg = file.finalize();
    this.spinner.succeed(msg);
  }
}
