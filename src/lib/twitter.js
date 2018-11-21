import Twitter from 'twitter';

/**
 * @class TwitterModule
 */
export class TwitterModule {
  /**
   * @constructor
   * @param {object} config Twitter configurations
   * @param {object} logger Winston logger
   */
  constructor(config, logger) {
    // Use config.twitter to construct this class
    this.config = config;
    this.logger = logger;

    // Configure Twitter client
    this.client = new Twitter({
      consumer_key: this.config.consumer_key,
      consumer_secret: this.config.consumer_secret,
      access_token_key: this.config.access_token_key,
      access_token_secret: this.config.access_token_secret,
    });

    // Configure messages
    this.messages = {
      usernameInBlacklist:
          '_sendReplyTweet: User is in usernameReplyBlacklist, not sending',
      error: (params, error) => {
        return '_sendReplyTweet: Tweet with params "'
        + JSON.stringify(params) + '" failed: '
        + JSON.stringify(error);
      },
      success: (params, tweet) => {
        return '_sendReplyTweet: Successfully sent Tweet, params "'
        + JSON.stringify(params) + '", details: "'
        + JSON.stringify(tweet) + '"';
      },
    };
  }

  /**
   * @param {string} username Twitter recipient username
   * @return {boolean}
   */
  isUsernameInBlacklist(username) {
    if (this.config.usernameReplyBlacklist) {
      const blacklist = this.config.usernameReplyBlacklist.split(',');

      for (const blacklistUsername of blacklist) {
        if (username === blacklistUsername) return true;
      }
    }

    return false;
  }

  /**
   * @param {GnipTweetActivity} tweet
   * @return {string} tweetId
   */
  parseTweetId(tweet) {
    return tweet.id.split(':')[2];
  }

  /**
   * @param {GnipTweetActivity} tweet
   * @return {string} username
   */
  parseUsername(tweet) {
    if (
      tweet.actor.hasOwnProperty('preferredUsername')
      && tweet.actor.preferredUsername
    ) {
      return tweet.actor.preferredUsername;
    }

    return null;
  }

  /**
   * @param {GnipTweetActivity} tweet
   * @return {boolean}
   */
  isTweetFromUs(tweet) {
    // TODO: Use feature for filtering outreach tweets not directed to users
    // Eg. usecase - when @riskmapindia tweets ahead of flood forecast
    // const screenName = tweet.user.screen_name;
    // return (screenName === this.config.screen_name);
    return false;
  }

  /**
   * Send reply Twitter message
   * @param {GnipTweetActivity} tweet
   * @param {string} lang 2-letter language code from deployment
   * @param {function} success Callback function called on success
   */
  sendReplyTweet(tweet, lang, success) {
    this.logger.info('_sendReplyTweet: Attempting send reply...');

    let params;
    let message;
    // TODO: trye parsing language from tweet
    if (lang) {
      message = this.config.dialogue[lang].redirect;
    } else {
      message = this.config.dialogue[this.defaultLanguage].redirect;
    }

    message += ' ' + this.config.bot_deep_link;

    const username = this.parseUsername(tweet);
    const tweetId = this.parseTweetId(tweet);

    if (this.isTweetFromUs(tweet) || this.isUsernameInBlacklist(username)) {
      // Never send replies to tweet users in blacklist
      this.logger.info(this.messages.usernameInBlacklist);
    } else {
      // Tweet is not to ourself, attempt to send
      if (username) {
        message = '@' + username + ' ' + message;
      }

      if (this.config.addTimestamp) {
        params = {
          in_reply_to_status_id: tweetId,
          lang: lang,
          status: message,
          screen_name: this.config.screen_name,
        };

        if (this.config.send_enabled) {
          this.logger.info('_sendReplyTweet: Sending message '
            + JSON.stringify(params) + ' to username: @' + username
          );

          // Make a POST call to send a tweet to the user
          this.client.post(
              'statuses/update',
              params)
              .then((tweet) => {
                this.logger.info(this.messages.success(params, tweet));
                if (success) success();
              })
              .catch((error) => {
                this.logger.error(this.messages.error(params, error));
              });
        } else {
          // TODO: Add code for tests
        }
      }
    }
  }
}
