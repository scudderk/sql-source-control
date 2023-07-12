import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as glob from 'glob';
import * as inquirer from 'inquirer';
import * as sql from 'mssql';
import ora from 'ora';
import { EOL } from 'os';
import Config from '../common/config';
import Setting from '../common/setting';
import { PushOptions } from './interfaces';

export default class Push {
  constructor(private name: string, private options: PushOptions) {}

  /**
   * Spinner instance.
   */
  private spinner = ora();

  /**
   * Invoke actions.
   */
  invoke() {
    const prompt = inquirer.createPromptModule();
    return prompt<inquirer.Answers>([
      {
        message: [
          `${chalk.yellow(
            'WARNING!'
          )} All local SQL files will be executed against the requested database.`,
          'This can not be undone!',
          'Make sure to backup your database first.',
          EOL,
          'Are you sure you want to continue?',
        ].join(' '),
        name: 'continue',
        type: 'confirm',
        when: !this.options.skip,
      },
    ])
      .then((answers: inquirer.Answers) => {
        if (answers.continue === false) {
          throw new Error('Command aborted!');
        }
      })
      .then(() => {
        this.spinner.succeed('Successfully pushed!');
      })
      .catch((error: Error) => {
        this.spinner.fail(error.message);
      });
  }

  /**
   * Execute all files against database.
   *
   * @param config Configuration used to execute commands.
   * @param conn Connection used to execute commands.
   */
  private batch(config: Config, sett: Setting) {
    const files = this.getFilesOrdered(sett);
    let promise = new sql.ConnectionPool(sett.connection).connect();

    this.spinner.start(`Pushing to ${chalk.blue(sett.connection.server)} ...`);

    files.forEach((file) => {
      const content = fs.readFileSync(file, 'utf8');
      const statements = content.split('GO' + EOL);

      statements.forEach((statement) => {
        promise = promise.then((pool) => {
          return pool
            .request()
            .batch(statement)
            .then(() => pool);
        });
      });
    });

    return promise;
  }

  /**
   * Get all SQL files in correct execution order.
   *
   * @param config Configuration used to search for connection.
   */
  private getFilesOrdered(setting: Setting) {
    const output: string[] = [];
    const directories = [
      setting.output.schemas,
      setting.output.tables,
      setting.output.types,
      setting.output.views,
      setting.output.functions,
      setting.output.procs,
      setting.output.triggers,
      setting.output.data,
      setting.output.jobs
    ];

    directories.forEach((dir) => {
      if (dir) {
        const files = glob.sync(`${setting.output.root}/${dir}/**/*.sql`);
        output.push(...files);
      }
    });

    return output;
  }
}
