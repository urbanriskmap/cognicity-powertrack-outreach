import { Client } from 'pg';
import Powertrack from './lib/powertrack';
import winston from "winston";

// Local imports
import config from './config';

console.log(config.logger);

// Logger
const logger = winston.createLogger({
    level: config.logger.level,
    format: winston.format.json(),
    maxsize: config.logger.maxFileSize,
    maxFiles: config.logger.maxFiles,
    transports: [
      //
      // - Write to all logs with level `info` and below to `combined.log` 
      // - Write all logs error (and below) to `error.log`.
      //
      new winston.transports.File({ filename: 'error.log', level: 'error' }),
      new winston.transports.File({ filename: 'combined.log' })
    ]
  });
  
  //
  // If we're not in production then log to the `console` with the format:
  // `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
  // 
  if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
      format: winston.format.simple()
    }));
  }

// FIXME This is a workaround for https://github.com/flatiron/winston/issues/228
// If we exit immediately winston does not get a chance to write the last log message.
// So we wait a short time before exiting.
function exitWithStatus(exitStatus) {
	logger.info( "Exiting with status " + exitStatus );
	setTimeout( function() {
		process.exit(exitStatus);
	}, 500 );
}

logger.info("Application starting...");

// Verify DB connection is up
// TODO should this be a pool?
const client = new Client(config.pg.conString)
client.connect(function(err, client, done){
	if (err){
		logger.error("DB Connection error: " + err);
		logger.error("Fatal error: Application shutting down");
		done();
		exitWithStatus(1);
	} else {
		logger.info("DB connection successful");
	}
});

const app = new Powertrack(config, logger);
app.start();

