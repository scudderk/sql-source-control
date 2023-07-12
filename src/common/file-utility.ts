import chalk from 'chalk';
import checksum from 'checksum';
import * as eol from 'eol';
import filenamify from 'filenamify';
import * as fs from 'fs-extra';
import * as glob from 'glob';
import multimatch from 'multimatch';
import * as path from 'path';

import Cache from './cache';
import Config from './config';
import { OperationCounts } from './interfaces';
import Setting from './setting';
var async = require('async');
import MSSQLGenerator from '../generators/mssql';

/**
 * File system interaction and tracking.
 */
export default class FileUtility {
  constructor(config: Config, sett: Setting) {
    this.config = config;
    this.sett = sett;
    this.existingCache = new Cache(config, sett);
    this.newCache = new Cache(config, sett);

    this.load();
  }

  /**
   * Current configuration.
   */
  private config: Config;

  /**
   * Current settings.
   */
  private sett: Setting;

  /**
   * Existing files.
   */
  private existingFiles: string[];

  /**
   * Existing cache.
   */
  private existingCache: Cache;

  /**
   * Cache generated during file writing.
   */
  private newCache: Cache;

  /**
   * Counts about files written / removed.
   */
  private stats: OperationCounts = {
    added: 0,
    removed: 0,
    updated: 0,
  };

  /**
   * Write file to the file system.
   *
   * @param file Directory to write, relative to root.
   * @param file File name to write to.
   * @param content File content to write.
   */
  write(dir: string | false, file: string, content: string) {
    if (dir === false) {
      return;
    }

    // remove unsafe characters
    file = filenamify(file);

    if (!this.shouldWrite(file)) {
      return;
    }

    file = path.join(/*this.config.getRoot()*/this.sett.output.root, dir, file);

    switch (this.config.eol) {
      case 'crlf':
        content = eol.crlf(content);
        break;
      case 'lf':
        content = eol.lf(content);
        break;
      case 'auto':
      default:
        content = eol.auto(content);
        break;
    }

    content = content.trim();

    const cacheKey = this.normalize(file);
    const cacheValue = checksum(content);
    this.newCache.add(cacheKey, cacheValue);

    if (!this.doesExist(file)) {
      this.stats.added++;
    } else if (this.existingCache.didChange(cacheKey, cacheValue)) {
      this.stats.updated++;
    }

    fs.outputFileSync(file, content);
    this.markAsWritten(file);
  }

  /**
   * Delete all paths remaining in `existing`.
   */
  finalize() {
    this.existingFiles.forEach((file) => {
      this.stats.removed++;
      fs.removeSync(file);
    });

    this.newCache.write();

    const added = chalk.green(this.stats.added.toString());
    const updated = chalk.cyan(this.stats.updated.toString());
    const removed = chalk.red(this.stats.removed.toString());

    return `Successfully added ${added}, updated ${updated}, and removed ${removed} files.`;
  }

  /**
   * Check if a file existed.
   *
   * @param file File path to check.
   */
  private doesExist(file: string) {
    if (!this.existingFiles || !this.existingFiles.length) {
      return false;
    }

    file = this.normalize(file);

    const index = this.existingFiles.indexOf(file);
    return index !== -1;
  }

  /**
   * Remove `file` from `existing`, if it exists.
   *
   * @param file File path to check.
   */
  private markAsWritten(file: string) {
    if (!file) {
      return;
    }

    file = this.normalize(file);

    const index = this.existingFiles.indexOf(file);

    if (index !== -1) {
      this.existingFiles.splice(index, 1);
    }
  }

  /**
   * Normalize file path for comparison.
   *
   * @param file File path to normalize.
   */
  private normalize(file: string) {
    const root = this.config.getRoot();

    if (root.startsWith('./') && !file.startsWith('./')) {
      file = `./${file}`;
    }

    return file.replace(/\\/g, '/');
  }

  /**
   * Load existing files and cache for comparison.
   */
  private load() {
    this.existingFiles = glob.sync(`${this.config.getRoot()}/**/*.sql`);
    this.existingCache.load();
  }

  /**
   * Write update file to the file system.
  *
  */
  writeUpdate (generator: MSSQLGenerator, file: FileUtility) {
    let storedProcedureDirectory = path.join(this.sett.output.root, this.sett.currentVersion, 'stored-procedures')
    let functionDirectory = path.join(this.sett.output.root, this.sett.currentVersion, 'function')
    let filesDestinationDirectory = path.join(this.sett.output.root, this.sett.currentVersion, 'Upgrade ' + this.sett.currentVersion + ' - 3 Objects.sql');
    let files = [];
  
    const myPromise = new Promise((resolve, reject) => {
        if (this.sett.output.procs != false) {
          fs.readdir(storedProcedureDirectory, (err, filenames) => {
            if (err) {
                console.log(err);
                return reject(err);
            }
            if (!filenames.includes(`UpgradeAudit_${this.sett.currentVersion}_Object.sql`)) {
              let upgradeAuditName = `UpgradeAudit.sql`;
              let content = generator.upgradeAudit(this.sett.currentVersion, 'Object');
              file.write(`${this.sett.currentVersion}/${this.sett.output.procs}`, upgradeAuditName, content);
            }
          })
          fs.readdir(storedProcedureDirectory, (err, filenames) => {
              files = this.mergeArrays(files, filenames.map(file => path.join(storedProcedureDirectory, file)));
              resolve(files);
          });
        }
    })
    .then(() => {
        if (this.sett.output.functions != false) {
            fs.readdir(functionDirectory, (err, filenames) => {
                if (err) {
                    console.error(err);
                }
                files = this.mergeArrays(files, filenames.map(file => path.join(functionDirectory, file)));
                return files;
            });
        }
    })
    //.then(handleFulfilledB)
    //.then(handleFulfilledC)
    .catch((err) => { console.error(err); })
    .finally(() => {
        async.map(files, fs.readFile, (err, results) => {
            if (err) {
                console.error(err);
                return err;
            }
            //Write the joined results to destination
            fs.writeFile(filesDestinationDirectory, results.join("\n\n\n\n"), (err) => {
                if (err) {
                    console.error(err);
                    return err;
                }
                console.log(chalk.bgMagenta.black.bold('\nUpdate file has been generated.'));
                // resolve();
            });
        });
      })
      .catch((err) => {
        console.error(err);
      });

    if (this.sett.output.procs != false) {
    }
    if (this.sett.output.functions != false) {
    }
  }
  private mergeArrays = function (arr1, arr2) {
    if (arr2.length == 1) {
      arr1.push(arr2[0]);
    }
    else if (arr2.length > 1) {
      arr2.forEach(function (item) {
        arr1.push(item);
      });
    }
    return arr1;
  }
}
