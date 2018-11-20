import gulp from 'gulp';
import parseArgs from 'minimist';

const args = parseArgs(process.argv.slice(2));
const dep = args.dep;

const deploymentMap = {
  test: 'Local Development',
  in: 'India',
  id: 'Indonesia',
};

if (dep === 'test' || dep === 'in' || dep === 'id') {
  console.log('Specified deployment is ' + deploymentMap[dep]);
} else {
  throw Error(
      'No deployment specified, prefix `export dep=jp|in|us` to command'
  );
}

gulp.task('default',
    gulp.parallel(
        'processRules',
        'fetchMessages'
    )
);
