import {Pool} from 'pg';

/**
 * Class for handling cognicity database connections
 * @class Database
 */
export class Database {
  /**
   * @constructor
   * @param {object} config database configurations
   */
  constructor(config) {
    this.config = config;
    this.pool = new Pool({
      connectionString: this.config.connection,
    });
  }

  /**
   * Utility function to get tweet ID from Gnip tweet activity.
   * @param {GnipTweetActivity} tweetActivity Gnip tweet activity object to
   * fetch ID from
   * @return {string} Tweet ID
   */
  parseTweetIdFromActivity(tweetActivity) {
    return tweetActivity.id.split(':')[2];
  }

  /**
   * Fetch the id of last stored tweet from the database.
   * @param {function} callback
   */
  getlastTweetIDFromDatabase(callback) {
    this.pool.query('SELECT id FROM twitter.seen_tweet_id;',
        function(err, result) {
          if (result.rows && result.rows.length > 0) {
            const lastTweetID = Number(result.rows[0].id);
            callback(null, lastTweetID);
          } else {
            callback(null, 0);
          }
        }
    );
  }

  /**
   * Utility to compare tweet id of Gnip tweet activity with the last stored id.
   * @param {GnipTweetActivity} tweetActivity Gnip tweet activity object
   * @param {function} callback
   */
  checkAgainstLastTweetID(tweetActivity, callback) {
    const tweetId = this.parseTweetIdFromActivity(tweetActivity);
    this.getlastTweetIDFromDatabase((err, res) => {
      if (tweetId > res) {
        callback();
      }
    });
  }

  /**
   * Store the tweet id of Gnip tweet activity object.
   * @param {GnipTweetActivity} tweetActivity Gnip tweet activity object
   * @param {function} callback
   */
  storeTweetID(tweetActivity, callback) {
    const tweetId = this.parseTweetIdFromActivity(tweetActivity);
    this.pool.query('UPDATE twitter.seen_tweet_id SET id=$1;', [tweetId],
        (err, result) => {
          callback(tweetActivity);
        }
    );
  }
}
