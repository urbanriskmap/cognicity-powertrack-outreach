
const { Pool, Client } = require('pg');

var exports = module.exports = {};

const connectionString = 'postgresql://postgres:postgres@127.0.0.1:5433/cognicity'

const pool = new Pool({
  connectionString: connectionString,
})

/**
 * Get tweet ID from Gnip tweet activity.
 * @param {GnipTweetActivity} tweetActivity The Gnip tweet activity object to fetch ID from
 * @return {string} Tweet ID
 */
exports._parseTweetIdFromActivity = function(tweetActivity) {
	return tweetActivity.id.split(':')[2];
};


exports._getlastTweetIDFromDatabase = function(callback){
    pool.query("SELECT id FROM twitter.seen_tweet_id;",
        function(err, result) {
            if(result.rows && result.rows.length > 0) {
                let lastTweetID = Number(result.rows[0].id);
                callback(null, lastTweetID);
            } else {
                callback(null, 0);
            }
        }
    )
};

exports._checkAgainstLastTweetID = function(tweetActivity, callback){

    var tweet_id = exports._parseTweetIdFromActivity(tweetActivity);
    var lastTweetID = exports._getlastTweetIDFromDatabase(function(err, res){
        if (tweet_id > res){
            callback(tweetActivity);
        }
    });
};

exports._storeTweetID = function(tweetActivity, callback) {
   
    var tweet_id = exports._parseTweetIdFromActivity(tweetActivity);
   
    pool.query("UPDATE twitter.seen_tweet_id SET id=$1;", [tweet_id], 
        function(err, result) {
                //self.logger.verbose('Recorded tweet ' + tweet_id + ' as having been seen.');
                callback();
            }
    );
};