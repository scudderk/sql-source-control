import Config from '../common/config';
import Setting from '../common/setting';
import { BumpOptions } from './interfaces';

export default class Bump {
	constructor(private options: BumpOptions) { }

	/**
	 * Invoke action.
	 */
	invoke() {
		const config = new Config();
		const settings = config.getSettings();
		const filteredData: Setting[] = settings.filter((setting: Setting) => {
			return (
				setting.name.toLowerCase() === this.options.conn.toLowerCase()
			);
		});
		filteredData[0].currentVersion = this.options.newversion;
		Config.update(settings);
	}
}
