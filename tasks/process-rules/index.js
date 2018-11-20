import gulp from 'gulp';
import changedInPlace from 'gulp-changed-in-place';
import change from 'gulp-change';
import rename from 'gulp-rename';
import parseArgs from 'minimist';
import replace from 'gulp-replace';

const args = parseArgs(process.argv.slice(2));
const dep = args.dep;

const buildGnipRules = (content) => {
  const rulesRaw = JSON.parse(content.toString());
  const filterRetweets = rulesRaw.allowRetweets ? '' : ' -is:retweet';
  const rules = {};
  let checkMinimumRules = false;

  // Concatenate kewords with 'OR'
  const keywords = '(' + rulesRaw.keywords.values.join(' OR ') + ')';
  const hashtags = '(' + rulesRaw.hashtags.values.join(' OR ') + ')';

  if (rulesRaw.addressed.values.length) {
    const addressedRuleStrings = [];
    rulesRaw.addressed.values.forEach((username) => {
      addressedRuleStrings.push(
          '((' + keywords + ' OR ' + hashtags + ') ' + username + ')'
      );
    });

    rules.addressed = addressedRuleStrings.join(' OR ')
      + filterRetweets;
    checkMinimumRules = true;
  }

  if (rulesRaw.instances.values.length) {
    rulesRaw.instances.values.forEach((instance) => {
      const placeNameRuleStrings = [];
      instance.locations.forEach((name) => {
        placeNameRuleStrings.push('contains:' + name);
        placeNameRuleStrings.push('bio_location:' + name);
        placeNameRuleStrings.push('place:' + name);
      });

      const boundingBoxStrings = [];
      instance.boundingBoxes.forEach((box) => {
        boundingBoxStrings.push('bounding_box:[' + box.join(' ') + ']');
      });

      const instanceRules = placeNameRuleStrings.concat(boundingBoxStrings);

      rules[instance.tag] = '(' + keywords + ' OR ' + hashtags + ') '
          + '(' + instanceRules.join(' OR ') + ')'
          + filterRetweets;
    });

    checkMinimumRules = true;
  }

  if (!checkMinimumRules) {
    throw new Error(
        'Values for "addressed" or "instances" is required'
        + `in deployments/${dep}/rules.json`
    );
  } else {
    return 'export default ' + JSON.stringify(rules, null, 2) + ';\n';
  }
};

export default gulp.task('processRules', () => {
  return gulp
      .src([`deployments/${dep}/rules.json`])
      .pipe(change(buildGnipRules))
      .pipe(rename((path) => path.extname = '.js'))
      .pipe(replace(`"`, `'`))
      .pipe(changedInPlace({firstPass: true}))
      .pipe(gulp.dest('src/deployment'));
});
