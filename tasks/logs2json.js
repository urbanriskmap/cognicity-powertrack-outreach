import gulp from 'gulp';
import change from 'gulp-change';
import rename from 'gulp-rename';

const processJSON = (content) => {
  const file = JSON.parse(content.toString());
  const logs = [];

  for (const logString of file.logs) {
    const message = JSON.parse(logString);

    if (message.hasOwnProperty('outgoingReply')
      && message.hasOwnProperty('details')
    ) {
      logs.push({
        outgoingReply: 'Success replying to id: '
        + message.outgoingReply.in_reply_to_status_id,
      });
    } else {
      logs.push(message);
    }
  }

  return JSON.stringify({logs: logs}, null, 2) + '\n';
};

gulp.task('tempJSONparser', () => {
  return gulp
      .src(['temp/log-strings-cleaned.json'])
      // .src(['temp/test-log.json'])
      .pipe(change(processJSON))
      .pipe(rename('final-logs.json'))
      .pipe(gulp.dest('temp/'));
});

gulp.task('default',
    gulp.parallel(
        'tempJSONparser'
    )
);
