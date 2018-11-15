import {Pool} from 'pg';

const connectionString = 'postgresql://postgres:postgres@127.0.0.1:5432/cognicity';

const pool = new Pool({
  connectionString: connectionString,
});

/**
 * Get tweet ID from Gnip tweet activity.
 * @param {GnipTweetActivity} tweetActivity Gnip tweet activity object to
 * fetch ID from
 * @return {string} Tweet ID
 */
exports._parseTweetIdFromActivity = (tweetActivity) => {
  return tweetActivity.id.split(':')[2];
};

exports._getlastTweetIDFromDatabase = (callback) => {
  pool.query('SELECT id FROM twitter.seen_tweet_id;',
      function(err, result) {
        if (result.rows && result.rows.length > 0) {
          const lastTweetID = Number(result.rows[0].id);
          callback(null, lastTweetID);
        } else {
          callback(null, 0);
        }
      }
  );
};

exports._checkAgainstLastTweetID = (tweetActivity, callback) => {
  const tweetId = exports._parseTweetIdFromActivity(tweetActivity);
  const lastTweetID = exports._getlastTweetIDFromDatabase((err, res) => {
    if (tweetId > res) {
      callback(tweetActivity);
    }
  });
};

exports._storeTweetID = (tweetActivity, callback) => {
  const tweetId = exports._parseTweetIdFromActivity(tweetActivity);

  pool.query('UPDATE twitter.seen_tweet_id SET id=$1;', [tweetId],
      (err, result) => {
        // self.logger.verbose(
        //    'Recorded tweet ' + tweetId + ' as having been seen.'
        // );
        callback();
      }
  );
};
