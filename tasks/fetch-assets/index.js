import gulp from 'gulp';
import changedInPlace from 'gulp-changed-in-place';
import parseArgs from 'minimist';

const args = parseArgs(process.argv.slice(2));
const dep = args.dep;

export default gulp.task('fetchAssets', () => {
  return gulp
      .src([`deployments/${dep}/assets/*`])
      .pipe(changedInPlace({firstPass: true}))
      .pipe(gulp.dest('src/deployment/assets'));
});
