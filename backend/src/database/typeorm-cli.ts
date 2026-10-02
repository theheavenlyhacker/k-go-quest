import 'dotenv/config';
import cliDataSource from './data-source';

/**
 * The TypeORM CLI requires a module that exports a DataSource *instance*, while
 * data-source.ts exports a factory so importing it never reads CLI-only
 * environment values. This file is that instance, for the CLI only.
 */
export default cliDataSource();
