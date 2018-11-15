'use strict';

// RSVP promises module
const RSVP = require('rsvp');

/**
* Constructs the base twitter data source.
* This is not a full data source but should be used as the prototype of a data source object.
* This object provides some common functions for data sources which have twitter interaction.
* @constructor
* @param {Reports} reports An instance of the reports object.
* @param {object} twitter Configured instance of twitter object from ntwitter module
*/
const BaseTwitterDataSource = function BaseTwitterDataSource(
    reports,
    twitter
) {
  this.reports = reports;
  this.logger = reports.logger;
  this.twitter = twitter;
};

BaseTwitterDataSource.prototype = {

  /**
  * Instance of the reports module that the data source uses to interact with Cognicity Server.
  * @type {Reports}
  */
  reports: null,

  /**
  * Configured instance of twitter object from ntwitter module
  * @type {object}
  */
  twitter: null,

  /**
  * Instance of the Winston logger.
  */
  logger: null,

  /**
  * Flag signifying if we are currently able to process incoming data immediately.
  * Turned on if the database is temporarily offline so we can cache for a short time.
  * @type {boolean}
  */
  _cacheMode: false,

  /**
  * Store data if we cannot process immediately, for later processing.
  * @type {Array}
  */
  _cachedData: [],

  /**
  * Only execute the success callback if the user is not currently in the all users table.
  * @param {string} user The twitter screen name to check if exists
  * @param {DbQuerySuccess} callback Callback to execute if the user doesn't exist
  */
  _ifNewUser: function(user, success) {
    const self = this;

    self.reports.dbQuery(
      {
        text: 'SELECT user_hash FROM ' + self.config.pg.table_invitees + ' WHERE user_hash = md5($1);',
        values: [user],
      },
      function(result) {
        if (result && result.rows && result.rows.length === 0) {
          success(result);
        } else {
          self.logger.debug('Not performing callback as user already exists');
        }
      }
    );
  },

  /**
  * Validate the data source configuration.
  * Check twitter credentials and tweet message lengths.
  * @return {Promise} Validation promise, throws an error on any validation error
  */
  validateConfig: function() {
    const self = this;

    // Contain separate validation promises in one 'all' promise
    return RSVP.all([
      self._verifyTwitterCredentials(),
      self._areTweetMessageLengthsOk(),
    ]);
  },

  /**
  * Verify that the twitter connection was successful.
  * @return {Promise} Validation promise, throws an error if twitter credentials cannot be verified
  */
  _verifyTwitterCredentials: function() {
    const self = this;

    return new RSVP.Promise( function(resolve, reject) {
      self.twitter.get('account/verify_credentials', function(err, data, response) {
        if (!err & response.statusCode === 200) {
          self.logger.info('twitter.verifyCredentials: Twitter credentials succesfully verified');
          resolve();
        } else {
          self.logger.error('twitter.verifyCredentials: Error verifying credentials: ' + err);
          self.logger.error('Fatal error: Application shutting down');
          reject('twitter.verifyCredentials: Error verifying credentials: ' + err);
        }
      });
    });
  },

  /**
  * Check that all tweetable message texts are of an acceptable length.
  * This is 109 characters max if timestamps are enabled, or 123 characters max if timestamps are not enabled.
  * @see {@link https://dev.twitter.com/overview/api/counting-characters} (max tweet = 140 chars)
  * @see {@link https://support.twitter.com/articles/14609-changing-your-username} (max username = 15 chars)
  * @return {Promise} Validation promise, throws an error if any message lengths are not acceptable
  */
  _areTweetMessageLengthsOk: function() {
    const self = this;
    const messages = [];

    var getMessagesFromDialogue = function(dialogue) {
      if (typeof dialogue === 'object') {
        Object.keys(dialogue).forEach(function(key) {
          getMessagesFromDialogue(dialogue[key]);
        });
      } else {
        if (typeof dialogue === 'string') {
          messages.push(dialogue);
        }
      }
    };

    return new RSVP.Promise( function(resolve, reject) {
      let valid = true;

      // self.logger.info(self.dialogue);

      getMessagesFromDialogue(self.dialogue);
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        let maxLength = 140; // Maximum tweet length
        maxLength -= 17; // Minus username, @ sign and space = 123
        if ( self.config.twitter.addTimestamp ) maxLength -= 14; // Minus 13 digit timestamp + space = 109 (13 digit timestamp is ok until the year 2286)
        // Twitter shortens (or in some cases lengthens) all URLs to a length, which slowly varies over time.
        // We use config.twitter.url_length to keep track of the current length, and here replace url length
        // with the resulting t.co output length in calculations for checking tweet length
        let length = message.length;
        const matches = message.match(/http[^ ]*/g);
        if (matches) {
          for (let j = 0; j < matches.length; j++) {
            length += self.config.twitter.url_length - matches[j].length;
          }
        }
        if ( length > maxLength ) {
          valid = false;
          self.logger.error( 'Message ' + message + '\' is too long (' + message.length + ' chars)' );
          reject( 'Message ' + message + '\' is too long (' + message.length + ' chars)' );
        }
      }

      if (valid) {
        self.logger.info('_areTweetMessageLengthsOk: Tweet lengths verified');
        resolve();
      }
    });
  },

  /**
  * Send @reply Twitter message
  * @param {string} username Twitter username of user to send reply to
  * @param {string} tweetId ID of tweet to send reply to
  * @param {string} media_id The media_id of twitter media to embedd in tweet
  * @param {string} message The tweet text to send
  * @param {function} success Callback function called on success
  */
  _baseSendReplyTweet: function(username, tweetId, media_id, message, success) {
    const self = this;

    let usernameInBlacklist = false;
    if (self.config.twitter.usernameReplyBlacklist) {
      self.config.twitter.usernameReplyBlacklist.split(',').forEach( function(blacklistUsername) {
        if ( username === blacklistUsername.trim() ) usernameInBlacklist = true;
      });
    }

    if ( usernameInBlacklist ) {
      // Never send tweets to usernames in blacklist
      self.logger.info( '_sendReplyTweet: Tweet user is in usernameReplyBlacklist, not sending' );
    } else {
      // Tweet is not to ourself, attempt to send
      message = '@' + username + ' ' + message;
      if ( self.config.twitter.addTimestamp ) message = message + ' ' + new Date().getTime();
      const params = {
        in_reply_to_status_id: tweetId,
        media_ids: media_id,
        status: message,
      };

      if (self.config.twitter.send_enabled === true) {
        // Make a POST call to send a tweet to the user
        self.twitter.post('statuses/update', params, function(error, tweet, response) {
          if (error) {
            self.logger.error( 'Tweeting "' + message + '" with params "' + JSON.stringify(params) + '" failed: ' + JSON.stringify(error) );
          } else {
            self.logger.info( 'Sent tweet: "' + message + '" with params ' + JSON.stringify(params) );
            if (success) success();
          }
        });
      } else { // for testing
        self.logger.info( '_sendReplyTweet: In test mode - no message will be sent. Callback will still run.' );
        self.logger.info( '_sendReplyTweet: Would have tweeted: "' + message + '" with params ' + JSON.stringify(params) );
        if (success) success();
      }
    }
  },

  /**
  * Insert an invitee - i.e. a user we've invited to participate.
  * @param {string} username Twitter username to log as invited user
  */
  _baseInsertInvitee: function(username) {
    const self = this;

    self.reports.dbQuery(
      {
        text: 'INSERT INTO ' + self.config.pg.table_invitees + ' (user_hash) VALUES (md5($1));',
        values: [username],
      },
      function(result) {
        self.logger.info('Logged new invitee - @' + username);
      }
    );
  },


  /**
  * Stop realtime processing of tweets and start caching tweets until caching mode is disabled.
  */
  enableCacheMode: function() {
    const self = this;

    self.logger.verbose( 'enableCacheMode: Enabling caching mode' );
    self._cacheMode = true;
  },

  /**
  * Resume realtime processing of tweets.
  * Also immediately process any tweets cached while caching mode was enabled.
  */
  disableCacheMode: function() {
    const self = this;

    self.logger.verbose( 'disableCacheMode: Disabling caching mode' );
    self._cacheMode = false;

    self.logger.verbose( 'disableCacheMode: Processing ' + self._cachedData.length + ' cached tweets' );
    self._cachedData.forEach( function(data) {
      self.filter(data);
    });
    self.logger.verbose( 'disableCacheMode: Cached tweets processed' );
    self._cachedData = [];
  },

};

// Export the BaseTwitterDataSource constructor
module.exports = BaseTwitterDataSource;
