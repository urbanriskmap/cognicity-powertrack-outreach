import dotenv from 'dotenv';
dotenv.config();

import rules from './deployment/rules';
import messages from './deployment/messages';

// TODO update doc
/**
 * Configuration for cognicity-reports-powertrack
 * @namespace {object} config
 * @property {object} pg Postgres configuration object
 * @property {string} pg.table_invitees Postgres table name for
 * invited user records
 * @property {object} logger Configuration object for logging module
 * @property {string} logger.level Logging level - info, verbose or debug are
 * most useful. Levels are (defaults): silly, debug, verbose, info, warn, error.
 * @property {number} logger.maxFileSize Max file size in bytes of each log file
 * @property {number} logger.maxFiles Max number of log files kept
 * @property {?string} logger.logDirectory Full path to directory for log files,
 * - if null, logs will be written to the application directory
 * @property {string} logger.filename Name of log file
 * @property {object} gnip Configuration object for Gnip PowerTrack interface
 * @property {boolean} gnip.stream If true, connect to the Gnip stream and
 * process tweets
 * @property {number} gnip.streamTimeout Network timeout for Gnip stream
 * connection, in milliseconds. Must be >30s as a keep-alive is sent
 * at least every 30s.
 * {@link http://support.gnip.com/apis/consuming_streaming_data.html#keepalive_signals}
 * @property {string} gnip.username Username for Gnip PowerTrack
 * @property {string} gnip.password Password for Gnip PowerTrack
 * @property {string} gnip.streamUrl URL for Gnip PowerTrack stream,
 * take from the PowerTrack admin interface.
 * {@link http://support.gnip.com/apis/consuming_streaming_data.html#Backfill}
 * @property {string} gnip.rulesUrl URL for the Gnip PowerTrack rules interface,
 * take from the PowerTrack admin interface.
 * @property {object} gnip.rules Object of Gnip rules, mapping rule names
 * to rule text
 * @property {string} gnip.rules.(name) Rule name
 * @property {string} gnip.rules.(value) Rule text
 * @property {number} gnip.maxReconnectTimeout Maximum reconnection delay in
 * milliseconds. Exponential backoff strategy is used starting at 1000 and
 * will stop growing at this value.
 * @property {object} twitter Configuration object for Twitter interface
 * @property {object} twitter.usernameVerify Twitter username (without @)
 * authorised to verify reports via retweet functionality
 * @property {string} twitter.usernameReplyBlacklist Twitter usernames
 * (without @, comma separated for multiples) which will never be responded
 * to as part of tweet processing
 * @property {string} twitter.consumer_key
 * Take from the twitter dev admin interface
 * @property {string} twitter.consumer_secret
 * Take from the twitter dev admin interface
 * @property {string} twitter.access_token_key
 * Take from the twitter dev admin interface
 * @property {string} twitter.access_token_secret
 * Take from the twitter dev admin interface
 * @property {boolen} twitter.send_enabled If true, send tweets to users asking
 * them to verify their reports
 * @property {number} twitter.url_length
 * Length that URLs in tweets are shortened to
 * @property {string} twitter.screen_name
 * Use screen name to filter out our replies, alt to using blacklisted usernames
 * @property {string} twitter.defaultLanguage The default language code to use
 * if we can't resolve one from the tweet
 * @property {object} twitter.dialogue Stored twitter responses
 * @property {boolean} twitter.addTimestamp
 * If true, append a timestamp to each sent tweet
 * @property {object} twitter.media_id
 * Media to be included with auto-reply tweets
 */

export default {
  // Database
  pg: {
    // Connection
    connection: process.env.PG_CONNECTION
        || 'postgresql://postgres:postgres@127.0.0.1:5432/cognicity',

    // Tables
    table_invitees: 'twitter.invitees',
    table_last_seen: 'twitter.seen_tweet_id',
    table_recipients: 'twitter.recipients',
  },

  // Logging configuration
  logger: {
    // What level to log at; info, verbose or debug are most useful.
    // Levels are (npm defaults): silly, debug, verbose, info, warn, error.
    level: process.env.LOG_LEVEL,

    // Max file size in bytes of each log file; default 100MB
    maxFileSize: 1024 * 1024 * 100,

    // Max number of log files kept
    maxFiles: 10,

    // Set this to a full path to a directory - if not set,
    // logs will be written to the application directory.
    logDirectory: process.env.LOG_DIR,

    // base filename to use
    filename: 'cognicity-reports',
  },

  // Gnip Powertrack API
  gnip: {
    // Connect to stream and log reports
    stream: true,
    // In milliseconds. Must be >30s as a keep-alive is sent at least every 30s
    streamTimeout: 1000 * 60,

    username: process.env.GNIP_USERNAME,
    password: process.env.GNIP_PASSWORD,

    // Gnip stream URL, take from the Gnip admin interface.
    streamUrl: process.env.GNIP_STREAM_URL,
    // Gnip rules URL, take from the Gnip admin interface.
    rulesUrl: process.env.GNIP_RULES_URL,

    // Gnip rules, will be processed at build time
    // from deployments/${dep}/rules.json
    rules: rules,

    // In milliseconds; 5 minutes for max reconnection timeout
    // - will mean ~10 minutes from first disconnection
    maxReconnectTimeout: 1000 * 60 * 5,
    // Backfill in minutes on reconnect to the stream
    backfillMinutes: 5,
  },

  // Twitter app authentication details
  twitter: {
    // Take from the twitter dev admin interface
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,

    // TODO: Twitter username (without @) authorised to verify reports
    // via retweet functionality
    usernameVerify: '',

    // Twitter usernames (without @, comma separated for multiples) which will
    // never be sent to in response to tweet processing
    usernameReplyBlacklist: process.env.USERNAME_BLACKLIST,

    // Twitter parameters
    // Enable sending of tweets?
    send_enabled: true,
    // URLs no longer count as part of tweet limits so this should be 0
    url_length: 0,
    // Append a timestamp to each sent tweet except response to
    // confirmed reports with unique urls
    addTimestamp: true,
    // The default language code to use if we can't resolve one from the tweet
    defaultLanguage: 'en',

    // Dialogue translations, will be processed at build time
    // from deployments/${dep}/messages.js
    dialogue: messages,

    // Add a specified twitter media to replies
    media_id: process.env.TWITTER_MEDIA_ID,
    // Deep link to the twitter chatbot for the specified deployment
    bot_deep_link: process.env.TWITTER_DEEP_LINK,
  },
};
