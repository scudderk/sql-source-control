import * as inquirer from 'inquirer';
import sql from 'mssql';
import fs from 'fs';
import { dropTriggerWrite, enableTriggerWrite, triggerWrite } from '../queries/mssql';
import Config from '../common/config';
import Setting from '../common/setting';
import { PathChoices } from './eums';
import { InitOptions } from './interfaces';
import { Connection, IConnection } from '../common/interfaces';

export default class Init {
  constructor(private options: InitOptions) { }

  /**
   * Invoke action.
   */
  invoke() {
    const webConfigConns = Config.getConnectionsFromWebConfig(
      this.options.webconfig
    );
    const sett = new Setting();

    if (!this.options.force && Config.doesDefaultExist()) {
      // don't overwrite existing config file
      return console.error('Config file already exists!');
    }
    const prompt = inquirer.createPromptModule();
    return prompt(this.getQuestions(!!webConfigConns))
      .then((answers) => {
        const sett: Setting = this.writeFiles(answers);
        this.createFolderIfNotExists(`${sett.output.root}\\${sett.output.temps}`);
        // connect to db
        const sqlConn = new sql.ConnectionPool(sett.connection)
          .connect()
          .then((pool) => {
            pool.request().query(dropTriggerWrite).then(() => {
              pool.request().query(triggerWrite(answers.root, answers.server)).then(() => {
                pool.request().query(enableTriggerWrite)
              })
            })
          })
          .catch((error) => {
            console.error(error);
          });
      });
  }

  /**
   * Get all applicable questions.
   *
   * @param conn Connection object to use for default values.
   */
  private getQuestions(showWebConfig: boolean) {
    const questions: inquirer.QuestionCollection = [
      {
        choices: () => this.getPathChoices(showWebConfig),
        message: 'Where would you like to store connections?',
        name: 'path',
        type: 'list',
      },
      {
        default: 'localhost',
        message: 'Server URL.',
        name: 'server',
        when: (answers) => answers.path !== PathChoices.WebConfig,
      },
      {
        default: '1433',
        message: 'Server port.',
        name: 'port',
        type: 'number',
        when: (answers) => answers.path !== PathChoices.WebConfig,
      },
      {
        default: 'database',
        message: 'Database name.',
        name: 'database',
        when: (answers) => answers.path !== PathChoices.WebConfig,
      },
      {
        default: 'username',
        message: 'Login username.',
        name: 'user',
        when: (answers) => answers.path !== PathChoices.WebConfig,
      },
      {
        default: 'super_secure_password',
        message: 'Login password.',
        name: 'password',
        type: 'password',
        when: (answers) => answers.path !== PathChoices.WebConfig,
      },
      {
        default: '0.0.1',
        message: 'Current version.',
        name: 'currentVersion',
        when: (answers) => answers.path !== PathChoices.WebConfig,
      },
      {
        default: 'dev',
        message: 'Connection name.',
        name: 'name',
        when: (answers) => answers.path !== PathChoices.WebConfig,
      },
      {
        default: `${process.cwd()}`,
        message: 'Root folder for project.',
        name: 'root',
        when: (answers) => answers.path !== PathChoices.WebConfig,
      },
      {
        default: './procs',
        message: 'Procedure folder.',
        name: 'procs',
        when: (answers) => answers.path !== PathChoices.WebConfig,
      },
      {
        default: './data',
        message: 'Data folder.',
        name: 'data',
        when: (answers) => answers.path !== PathChoices.WebConfig,
      },
      {
        default: './functions',
        message: 'Functions folder.',
        name: 'functions',
        when: (answers) => answers.path !== PathChoices.WebConfig,
      },
      {
        default: './jobs',
        message: 'Jobs folder.',
        name: 'jobs',
        when: (answers) => answers.path !== PathChoices.WebConfig,
      },
      {
        default: './schema',
        message: 'schemas folder.',
        name: 'schemas',
        when: (answers) => answers.path !== PathChoices.WebConfig,
      },
      {
        default: './tables',
        message: 'Tables folder.',
        name: 'tables',
        when: (answers) => answers.path !== PathChoices.WebConfig,
      },
      {
        default: './triggers',
        message: 'Trigger folder.',
        name: 'triggers',
        when: (answers) => answers.path !== PathChoices.WebConfig,
      },
      {
        default: './types',
        message: 'Types folder.',
        name: 'types',
        when: (answers) => answers.path !== PathChoices.WebConfig,
      },
      {
        default: './views',
        message: 'Views folder.',
        name: 'views',
        when: (answers) => answers.path !== PathChoices.WebConfig,
      },
    ];

    return questions;
  }

  /**
   * Get all available configuration file path choices.
   *
   * @param showWebConfig Indicates if Web.config choice should be available.
   */
  private getPathChoices(showWebConfig: boolean) {
    const choices: inquirer.ChoiceOptions[] = [
      {
        name: 'Main configuration file.',
        value: PathChoices.SscConfig,
      },
      {
        name: 'Separate connections configuration file.',
        value: PathChoices.ConnsConfig,
      },
    ];

    if (showWebConfig) {
      choices.push({
        name: 'Web.config file with connection strings.',
        value: PathChoices.WebConfig,
      });
    }

    return choices;
  }

  /**
   * From configuration files(s) based on answers.
   *
   * @param answers Answers from questions.
   */
  private writeFiles(answers: inquirer.Answers) {
    const sett: Setting = {
      name: answers.name,
      connection: {
        server: answers.server,
        database: answers.database,
        port: answers.port,
        user: answers.user,
        password: answers.password,
      },
      output: {
        root: answers.root,
        procs: answers.procs,
        data: answers.data,
        functions: answers.functions,
        jobs: answers.jobs,
        schemas: answers.schemas,
        tables: answers.tables,
        triggers: answers.triggers,
        types: answers.types,
        views: answers.views,
        temps: 'temp_files',
      },
      currentVersion: answers.currentVersion,
      idempotency: {
        procs: "if-exists-drop",
        data: 'truncate',
        functions: 'if-exists-drop',
        jobs: 'if-exists-drop',
        tables: 'if-exists-drop',
        triggers: 'if-exists-drop',
        types: 'if-exists-drop',
        views: 'if-exists-drop',
        temps: 'if-exists-drop',
      },
      includeConstraintName: true,
      loadFromObject: null,
      loadFromString: null,
    };

    if (answers.path === PathChoices.WebConfig) {
    } else if (answers.path === PathChoices.ConnsConfig) {
      Config.write({ settings: [sett] }, Config.defaultConnectionsJsonFile);
    } else {
      Config.write({ settings: [sett] });
    }
    return sett;
  }
  private createFolderIfNotExists = (folderPath: string) => {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
      console.log(`Folder created: ${folderPath}`);
    } else {
      console.log(`Folder already exists: ${folderPath}`);
    }
  };
}
