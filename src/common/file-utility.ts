import chalk from 'chalk';
import checksum from 'checksum';
import * as eol from 'eol';
import filenamify from 'filenamify';
import * as fs from 'fs-extra';
import * as glob from 'glob';
import * as path from 'path';

import Cache from './cache';
import Config from './config';
import { OperationCounts } from './interfaces';
import Setting from './setting';
const async = require('async');
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

    file = path.join(
      this.sett.output.root,
      dir,
      file
    );

    content = eol.auto(content);
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
    //this.markAsWritten(file);
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
  markAsWritten(file: string, currentVerson: string) {
    if (!file) {
      return;
    }

    file = this.normalize(file);

    console.log(this.existingFiles)
    console.log(file)
    this.existingFiles.splice(0, 1);
    this.existingFiles.push(file)
    console.log(this.existingFiles)
  }

  /**
   * Normalize file path for comparison.
   *
   * @param file File path to normalize.
   */
  private normalize(file: string) {
    const root = this.sett.output.root;

    if (root.startsWith('./') && !file.startsWith('./')) {
      file = `./${file}`;
    }

    return file.replace(/\\/g, '/');
  }

  /**
   * Load existing files and cache for comparison.
   */
  private load() {
    this.existingFiles = glob.sync(`${this.sett.output.root}/**/*.sql`);
    this.existingCache.load();
  }

  /**
   * Write update file to the file system.
   *
   */
  writeUpdate(generator: MSSQLGenerator) {
    const { storedProcedureDirectory, functionDirectory, filesDestinationDirectory } = this.getDirectories();
    let files = [];
    if (!fs.existsSync(storedProcedureDirectory)) {
      fs.mkdirSync(storedProcedureDirectory);
    }
    if (!fs.existsSync(functionDirectory)) {
      fs.mkdirSync(functionDirectory);
    }
    new Promise((resolve, _reject) => {
      if (this.sett.output.procs != false) {
        fs.readdir(storedProcedureDirectory, (err, filenames) => {
          files = this.mergeArrays(
            files,
            filenames.map((file) => path.join(storedProcedureDirectory, file))
          );
          resolve(files);
        });
        return files;
      }
    })
      .then(() => {
        if (this.sett.output.functions != false) {
          fs.readdir(functionDirectory, (err, filenames) => {
            if (err) {
              console.error(err);
            }
            files = this.mergeArrays(
              files,
              filenames.map((file) => path.join(functionDirectory, file))
            );
            return files;
          });
        }
      })
      .finally(() => {
        async.map(files, fs.readFile, (err, results) => {
          if (err) {
            console.error(err);
            return err;
          }

          const content = generator.upgradeAudit(
            this.sett.name,
            this.sett.currentVersion,
            'Object'
          );
          results.splice(0, 0, content)
          //Write the joined results to destination
          fs.writeFile(
            filesDestinationDirectory,
            results.join('\n\n\n\n'),
            (err) => {
              if (err) {
                console.error(err);
                return err;
              }
              console.log(
                chalk.bgMagenta.white.bold('\nUpdate file has been generated.')
              );
            }
          );
        });
      })
      .catch((err) => {
        console.error(err);
      });
  }
  private mergeArrays = function (arr1, arr2) {
    if (arr2.length == 1) {
      arr1.push(arr2[0]);
    } else if (arr2.length > 1) {
      arr2.forEach(function (item) {
        arr1.push(item);
      });
    }
    return arr1;
  };

  private getDirectories() {
    const storedProcedureDirectory = path.join(
      this.sett.output.root,
      this.sett.currentVersion,
      this.sett.output.procs.toString()
    );
    const functionDirectory = path.join(
      this.sett.output.root,
      this.sett.currentVersion,
      this.sett.output.functions.toString()
    );
    const filesDestinationDirectory = path.join(
      this.sett.output.root,
      this.sett.currentVersion,
      `${this.sett.name} Upgrade ${this.sett.currentVersion} - 3 Objects.sql`
    );
    return { storedProcedureDirectory, functionDirectory, filesDestinationDirectory };
  }
}
