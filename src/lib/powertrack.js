// Core PowerTrack module
import gnip from 'gnip';

import {
  _getlastTweetIDFromDatabase,
  _checkAgainstLastTweetID,
  _storeTweetID,
} from './database';
import {TwitterModule} from './twitter';

/**
 * Class for initializing and connecting to PowerTrack stream
 * @class Powertrack
 * @param {Object} config
 */
export default class Powertrack {
  /**
     * constructor for class Powertrack
     * @param {Object} config - Powertrack parameters
     * @param {Object} logger - Winston logger
     */
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * TODO add jsdoc
   */
  start() {
    // Setup "global" variables
    const logger = this.logger;
    // Timeout reconnection delay, used for exponential backoff
    const _initialStreamReconnectTimeout = 1000;
    let streamReconnectTimeout = _initialStreamReconnectTimeout;
    // Connect Gnip stream and setup event handlers
    let reconnectTimeoutHandle;
    let disconnectionNotificationSent;
    const config = this.config;

    /**
     * TODO add jsdoc
     * Attempt to reconnect the socket.
     * If we fail, wait an increasing amount of time before we try again.
     */
    const reconnectSocket = () => {
      // Try and destroy the existing socket, if it existsconfirmReports
      logger.warn( 'connectStream: Connection lost, destroying socket' );
      if ( stream._req ) stream._req.destroy();

      // If our timeout is above max threshold, cap it & send notification tweet
      if (streamReconnectTimeout >= config.gnip.maxReconnectTimeout) {
        // TODO - logging
        logger.warn(
            'Cognicity Reports PowerTrack Gnip connection has been offline for '
            + config.gnip.maxReconnectTimeout + ' seconds');
      } else {
        streamReconnectTimeout *= 2;
        if (streamReconnectTimeout >= config.gnip.maxReconnectTimeout) {
          streamReconnectTimeout = config.gnip.maxReconnectTimeout;
        }
      }

      // Attempt to reconnect
      logger.info( 'connectStream: Attempting to reconnect stream' );
      _getlastTweetIDFromDatabase(() => {
        stream.start();
      });
    };

    // TODO We get called twice for disconnect, once from error once from end
    // Is this normal? Can we only use one event? Or is it possible to get only
    // one of those handlers called under some error situations.

    /**
     * Attempt to reconnect the Gnip stream.
     * This function handles us getting called multiple
     * times from different error handlers.
     */
    const reconnectStream = () => {
      if (reconnectTimeoutHandle) clearTimeout(reconnectTimeoutHandle);
      logger.info(
          'connectStream: queing reconnect for ' + streamReconnectTimeout
      );
      reconnectTimeoutHandle = setTimeout(
          reconnectSocket, streamReconnectTimeout
      );
    };

    // Configure a Gnip stream with connection details
    const stream = new gnip.Stream({
      url: config.gnip.streamUrl,
      user: config.gnip.username,
      password: config.gnip.password,
      backfillMinutes: config.gnip.backfillMinutes,
    });

    // When stream is connected, setup the stream timeout handler
    stream.on('ready', () => {
      logger.info('connectStream: Stream ready!');
      streamReconnectTimeout = _initialStreamReconnectTimeout;
      disconnectionNotificationSent = false;
      // Augment Gnip.Stream._req (Socket) object with a timeout handler.
      // We are accessing a private member here so updates to gnip could
      // break this, but gnip module does not expose the socket or
      // methods to handle timeout.
      stream._req.setTimeout( config.gnip.streamTimeout, () => {
        logger.error('connectStream: Timeout error on Gnip stream');
        reconnectStream();
      });
    });

    // When we receive a tweetActivity from the Gnip stream this
    // event handler will be called
    stream.on('tweet', (tweetActivity) => {
      logger.debug(
          'connectStream: stream.on(\'tweet\'): tweet = '
          + JSON.stringify(tweetActivity)
      );

      // Catch errors here, otherwise error in filter method is
      // caught as stream error
      try {
        if (tweetActivity.actor) {
          // This looks like a tweet in Gnip activity format, store ID,
          // then check for filter
          _storeTweetID(tweetActivity, () => {
            _checkAgainstLastTweetID(tweetActivity, (tweetActivity) => {
              // this.filter(tweetActivity);

              // Initiate twitter module
              const twitter = new TwitterModule(config.twitter, logger);

              // TODO: send message here.
              twitter.sendReplyTweet(
                  tweetActivity,
                  'en',
                  // need callback?
              );
            });
          });
        } else {
          // This looks like a system message
          logger.info(
              'connectStream: Received system message: '
              + JSON.stringify(tweetActivity)
          );
        }
      } catch (err) {
        logger.error(
            'connectStream: stream.on(\'tweet\'): Error on handler:'
            + err.message + ', ' + err.stack
        );
      }
    });

    // Handle an error from the stream
    stream.on('error', (err) => {
      logger.error('connectStream: Error connecting stream:' + err);
      reconnectStream();
    });

    // TODO Do we need to catch the 'end' event?
    // Handle a socket 'end' event from the stream
    stream.on('end', () => {
      logger.error('connectStream: Stream ended');
      reconnectStream();
    });

    // Construct a Gnip rules connection
    const rules = new gnip.Rules({
      url: config.gnip.rulesUrl,
      user: config.gnip.username,
      password: config.gnip.password,
    });
    // Create rules programatically from config
    // Use key of rule entry as the tag, and value as the rule string
    const newRules = [];
    for (const tag in config.gnip.rules) {
      if ( config.gnip.rules.hasOwnProperty(tag) ) {
        newRules.push({
          tag: tag,
          value: config.gnip.rules[tag],
        });
      }
    }
    logger.debug('connectStream: Rules = ' + JSON.stringify(newRules));

    /**
     * @param {object} err
     * @param {object} result
     */
    const cb = (err, result) => {
      if (err) throw err;
      // logger.info('connectStream: Connecting stream...');
      // If we pushed the rules successfully, get last seen report,
      // and then try and connect the stream
      // _getlastTweetIDFromDatabase(() => {
      stream.start();
      // });
    };

    // Push the parsed rules to Gnip
    logger.info('connectStream: Updating rules...');
    // Bypass the cache, remove all the rules and send them all again
    rules.live.update(newRules, cb);
  }
}
