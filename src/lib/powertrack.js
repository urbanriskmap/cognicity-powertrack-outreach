// Core PowerTrack module

import gnip from 'gnip';
import {start} from 'repl';

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

  // TODO - do we need a filter?
  // filter();

  // Start
  start() {
    // Gnip stream
    let stream;
    // Timeout reconnection delay, used for exponential backoff
    const _initialStreamReconnectTimeout = 1000;
    let streamReconnectTimeout = _initialStreamReconnectTimeout;
    // Connect Gnip stream and setup event handlers
    let reconnectTimeoutHandle;

    // Attempt to reconnect the socket.
    // If we fail, wait an increasing amount of time before we try again.
    function reconnectSocket() {
      // Try and destroy the existing socket, if it existsconfirmReports
      this.logger.warn( 'connectStream: Connection lost, destroying socket' );
      if ( stream._req ) stream._req.destroy();

      // If our timeout is above the max threshold, cap it and send a notification tweet
      if (streamReconnectTimeout >= this.config.gnip.maxReconnectTimeout) {
        // TODO - logging
        this.logger.warn('Cognicity Reports PowerTrack Gnip connection has been offline for ' +
                    this.config.gnip.maxReconnectTimeout + ' seconds');
      } else {
        streamReconnectTimeout *= 2;
        if (streamReconnectTimeout >= this.config.gnip.maxReconnectTimeout) streamReconnectTimeout = this.config.gnip.maxReconnectTimeout;
      }

      // Attempt to reconnect
      this.logger.info( 'connectStream: Attempting to reconnect stream' );
      this._getlastTweetIDFromDatabase(function() {
        stream.start();
      });
    }

    // TODO We get called twice for disconnect, once from error once from end
    // Is this normal? Can we only use one event? Or is it possible to get only
    // one of those handlers called under some error situations.

    // Attempt to reconnect the Gnip stream.
    // This function handles us getting called multiple times from different error handlers.
    function reconnectStream() {
      if (reconnectTimeoutHandle) clearTimeout(reconnectTimeoutHandle);
      this.logger.info( 'connectStream: queing reconnect for ' + streamReconnectTimeout );
      reconnectTimeoutHandle = setTimeout( reconnectSocket, streamReconnectTimeout );
    }

    // Configure a Gnip stream with connection details
    stream = new gnip.Stream({
      url: this.config.gnip.streamUrl,
      user: this.config.gnip.username,
      password: this.config.gnip.password,
      backfillMinutes: this.config.gnip.backfillMinutes,
    });

    // When stream is connected, setup the stream timeout handler
    stream.on('ready', function() {
      this.logger.info('connectStream: Stream ready!');
      streamReconnectTimeout = _initialStreamReconnectTimeout;
      disconnectionNotificationSent = false;
      // Augment Gnip.Stream._req (Socket) object with a timeout handler.
      // We are accessing a private member here so updates to gnip could break this,
      // but gnip module does not expose the socket or methods to handle timeout.
      stream._req.setTimeout( this.config.gnip.streamTimeout, function() {
        this.logger.error('connectStream: Timeout error on Gnip stream');
        reconnectStream();
      });
    });

    // When we receive a tweetActivity from the Gnip stream this event handler will be called
    stream.on('tweet', function(tweetActivity) {
      this.logger.debug('connectStream: stream.on(\'tweet\'): tweet = ' + JSON.stringify(tweetActivity));

      // Catch errors here, otherwise error in filter method is caught as stream error
      try {
        if (tweetActivity.actor) {
          // This looks like a tweet in Gnip activity format, store ID, then check for filter
          this._storeTweetID(tweetActivity, function() {
            this._checkAgainstLastTweetID(tweetActivity, function(tweetActivity) {
              //this.filter(tweetActivity);
              // TODO send message here.
              this.logger.info('send message here...')
            });
          });
        } else {
          // This looks like a system message
          this.logger.info('connectStream: Received system message: ' + JSON.stringify(tweetActivity));
        }
      } catch (err) {
        this.logger.error('connectStream: stream.on(\'tweet\'): Error on handler:' + err.message + ', ' + err.stack);
      }
    });

    // Handle an error from the stream
    stream.on('error', function(err) {
      this.logger.error('connectStream: Error connecting stream:' + err);
      reconnectStream();
    });

    // TODO Do we need to catch the 'end' event?
    // Handle a socket 'end' event from the stream
    stream.on('end', function() {
      this.logger.error('connectStream: Stream ended');
      reconnectStream();
    });

    // Construct a Gnip rules connection
    const rules = new gnip.Rules({
      url: this.config.gnip.rulesUrl,
      user: this.config.gnip.username,
      password: this.config.gnip.password,
    });
    // Create rules programatically from config
    // Use key of rule entry as the tag, and value as the rule string
    const newRules = [];
    for (const tag in this.config.gnip.rules) {
      if ( this.config.gnip.rules.hasOwnProperty(tag) ) {
        newRules.push({
          tag: tag,
          value: this.config.gnip.rules[tag],
        });
      }
    }
    this.logger.debug('connectStream: Rules = ' + JSON.stringify(newRules));

    function cb(err, result){
      if (err) throw err;
      this.logger.info('connectStream: Connecting stream...');
      // If we pushed the rules successfully, get last seen report, and then try and connect the stream
      this._getlastTweetIDFromDatabase(function() {
        stream.start();
      });
    }

    // Push the parsed rules to Gnip
    this.logger.info('connectStream: Updating rules...');
    // Bypass the cache, remove all the rules and send them all again
    rules.live.update(newRules, cb);
  }

  // Module exports
  // How should this be operated? -> Tooling for deployment
  // EB?
  //
  // Blacklist, not us...
  // Add button
}
