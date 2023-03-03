import {
  IConnection,
  IdempotencyConfig,
  ISetting,
  OutputConfig,
} from './interfaces';

/**
 * Setting configuration.
 */
export default class Setting implements ISetting {
  constructor(sett?: ISetting) {
    this.loadFromObject(sett);
  }

  /**
   * setting name.
   */
  name: string;

  /**
   * connection object.
   */
  connection: IConnection;

  /**
   * output object.
   */
  output: OutputConfig;

  /**
   * idempotency object.
   */
  idempotency: IdempotencyConfig;

  /**
   * includeConstraintName value.
   */
  includeConstraintName: boolean;

  /**
   * root value.
   */
  root: string;

  /**
   * current version value.
   */
  currentVersion: string;

  /**
   * Parse setting string into object.
   *
   * @param name Setting name.
   * @param settString Settings string to parse.
   */
  loadFromString(name: string, settString: string) {
    const parts = settString.split(';');

    // match setting parts
    let server = parts.find((x) => /^(server)/gi.test(x));
    let database = parts.find((x) => /^(database)/gi.test(x));
    let user = parts.find((x) => /^(uid)/gi.test(x));
    let password = parts.find((x) => /^(password|pwd)/gi.test(x));
    let port: number;

    let root = parts.find((x) => /^(root)/gi.test(x));
    let data = parts.find((x) => /^(data)/gi.test(x));
    let functions = parts.find((x) => /^(functions)/gi.test(x));
    let jobs = parts.find((x) => /^(jobs)/gi.test(x));
    let procs = parts.find((x) => /^(procs)/gi.test(x));
    let schemas = parts.find((x) => /^(schemas)/gi.test(x));
    let tables = parts.find((x) => /^(tables)/gi.test(x));
    let triggers = parts.find((x) => /^(triggers)/gi.test(x));
    let types = parts.find((x) => /^(types)/gi.test(x));
    let views = parts.find((x) => /^(views)/gi.test(x));
    let temps = parts.find((x) => /^(temps)/gi.test(x));

    // get values
    server = server && server.split('=')[1];
    database = database && database.split('=')[1];
    user = user && user.split('=')[1];
    password = password && password.split('=')[1];
    root = root && root.split('=')[1];
    data = data && data.split('=')[1];
    functions = functions && functions.split('=')[1];
    jobs = jobs && jobs.split('=')[1];
    procs = procs && procs.split('=')[1];
    schemas = schemas && schemas.split('=')[1];
    tables = tables && tables.split('=')[1];
    triggers = triggers && triggers.split('=')[1];
    types = types && types.split('=')[1];
    views = views && views.split('=')[1];
    temps = temps && temps.split('=')[1];

    // separate server and port
    if (server) {
      // format: `dev.example.com\instance,1435`
      const sub = server.split(',');

      server = sub[0];
      port = parseInt(sub[1], 10) || undefined;
    }

    Object.assign(this.connection, {
      database,
      name,
      password,
      port,
      server,
      user,
    });

    Object.assign(this.output, {
      root,
      data,
      functions,
      jobs,
      procs,
      schemas,
      tables,
      triggers,
      types,
      views,
      temps,
    });
  }

  /**
   * Load setting object.
   *
   * @param conn Setting object to load.
   */
  loadFromObject(sett: ISetting) {
    if (!sett) {
      return;
    }

    Object.assign(this, sett);
  }
}
