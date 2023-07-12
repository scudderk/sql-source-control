/**
 * CLI arguments for `init` command.
 */
export interface InitOptions {
  webconfig?: string;
  force?: boolean;
  skip?: boolean;
  config?: string;
}

/**
 * CLI arguments for `list` command.
 */
export interface ListOptions {
  config?: string;
}

/**
 * CLI arguments for `pull` command.
 */
export interface PullOptions {
  config?: string;
}

/**
 * CLI arguments for `start` command.
 */
export interface StartOptions {
  config?: string;
}

/**
 * CLI arguments for `pull-single` command.
 */
export interface PullSingleOptions {
  config?: string;
  objname: string;
  type: string;
}

/**
 * CLI arguments for `push` command.
 */
export interface PushOptions {
  config?: string;
  skip?: boolean;
}

/**
 * CLI arguments for `bump` command.
 */
export interface BumpOptions {
  newversion?: string;
  conn?: string;
}
