const { program } = require('commander');
import updateNotifier from 'update-notifier';

import pkg = require('../package.json');
import Init from './commands/init';
import { InitOptions, ListOptions, PullOptions, PullSingleOptions, PushOptions } from './commands/interfaces';
import List from './commands/list';
import Pull from './commands/pull';
import PullSingle from './commands/pull-single';
import Push from './commands/push';

async function main() {
  program
    .command('init')
    .description('Create default config file.')
    .option('-f, --force', 'Overwrite existing config file, if present.')
    .option('-s, --skip', 'Use defaults only and skip the option prompts.')
    .option('-w, --webconfig [value]', 'Relative path to Web.config file.')
    .action((options: InitOptions) => {
      const action = new Init(options);
      return action.invoke();
    });

  program
    .command('list')
    .alias('ls')
    .description('List all available connections.')
    .option('-c, --config [value]', 'Relative path to config file.')
    .action((options: ListOptions) => {
      const action = new List(options);
      return action.invoke();
    });

  program
    .command('pull [name]')
    .description(
      'Generate SQL files for all tables, stored procedures, functions, etc.'
    )
    .option('-c, --config [value]', 'Relative path to config file.')
    .action((name: string, options: PullOptions) => {
      const action = new Pull(name, options);
      return action.invoke();
    });

  program
    .command('pull-single [name]')
    .description(
      'Generate SQL files for a specific table, stored procedure, function, etc.'
    )
    .option('-c, --config [value]', 'Relative path to config file.')
    .requiredOption('-o, --objname [value]', 'Name of object you wish to pull.')
    .requiredOption('-t, --type [value]', 'Type of object you wish to pull.')
    .action((name: string, options: PullSingleOptions) => {
      const action = new PullSingle(name, options);
      return action.invoke();
    });

  program
    .command('push [name]')
    .description('Execute all scripts against the requested database.')
    .option('-c, --config [value]', 'Relative path to config file.')
    .option('-s, --skip', 'Skip user warning prompt.')
    .action((name: string, options: PushOptions) => {
      const action = new Push(name, options);
      return action.invoke();
    });

  program.version((pkg as any).version);
  await program.parseAsync(process.argv);
}

// init
updateNotifier({ pkg } as any).notify();
main();
