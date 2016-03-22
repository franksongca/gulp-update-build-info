/**
 * @author Frank Song
 * @date Mar 22, 2016
 */

'use strict';

var jsonfile = require('jsonfile'),
  _ = require('underscore-node'),
  fs = require('fs'),
  moment = require('moment'),
  through = require('through2'),
  gutil = require('gulp-util'),
  git = require('git-rev');

gutil.log(gutil.colors.magenta('gulp-update-build-info: v1.0.5'));

module.exports = function (options) {

  var bowerJson,
    brandExists,
    buildDateFile,
    bufferedContents,
    reduceByVersion;

  if (_.isUndefined(options.bowerJson)) {
    this.emit('error', new gutil.PluginError('gulp-build-date', 'no bowerJson file found'));
  } else {
    if (typeof options.bowerJson === 'string') {
      bowerJson = jsonfile.readFileSync(options.bowerJson);
    } else if (typeof options.bowerJson === 'object') {
      bowerJson = options.bowerJson;
    }
  }

  /**
   * detect if brand exists in the array
   * @param object
   * @returns {object}
   */
  brandExists = function (brands) {
    return _.find(brands, function (brand) {
      return brand.name === options.brand;
    });
  };

  /**
   * remove the build from the collection that is with the same
   * @param object
   * @returns {object}
   */
  reduceByVersion = function (builds, version) {
    var brands = [],
      rest = _.reject(builds, function (build) {
        if (build.version === version) {
          brands = build.brands;
          return true;
        }
      });

    return {
      builds: rest,
      brands: brands
    };
  };


  /**
   * populates with build information
   * @param object
   * @returns {object}
   */
  buildDateFile = function (object) {

    var parsedObject = {};
    parsedObject.date = moment().format('MM/DD/YYYY HH:mm:ss');
    parsedObject.version = bowerJson.version;
    gutil.log(gutil.colors.magenta('------------------------------------'));
    _.isUndefined(object) ? gutil.log(gutil.colors.magenta('build.json not found but it\'s okay, we\'ll go ahead anyways')) : gutil.log(gutil.colors.magenta('build.json found, pretty cool'));
    gutil.log(gutil.colors.magenta('build date:'), gutil.colors.green(parsedObject.date));
    gutil.log(gutil.colors.magenta('build version:'), gutil.colors.green(parsedObject.version));
    gutil.log(gutil.colors.magenta('------------------------------------'));
    return JSON.stringify(parsedObject);

  };

  /**
   *
   * @param file
   * @param enc
   * @param callback
   */
  bufferedContents = function (file, enc, callback) {
    var ctx,
      dateFile,
      dateFileObj,
      reducedBuilds,
      brandIndex;

    if (file.isStream()) {

      this.emit('error', new gutil.PluginError('gulp-build-date', 'Streams are not supported!'));
      callback();

    } else if (file.isNull()) {

      callback(null, file); // Do nothing if no contents

    } else {

      ctx = file.contents.toString('utf8');
      dateFile = buildDateFile(ctx);
      dateFileObj = JSON.parse(dateFile);

      // read builds.json and append the new build object to it
      bowerJson = jsonfile.readFileSync('builds.json');

      if (bowerJson.length) {

        reducedBuilds = reduceByVersion(bowerJson, dateFileObj.version)

        if (reducedBuilds.brands) {
          dateFileObj.brands = reducedBuilds.brands;
          bowerJson = reducedBuilds.builds;
        }

      }

      git.branch(function (branch) {
        git.long(function (commit) {
          if (options.brand) {
            if (!brandExists(dateFileObj.brands)) {
              dateFileObj.brands = dateFileObj.brands || [];
              dateFileObj.brands.push({
                name: options.brand,
                commit: commit,
                repo: 'git@totes-gitlab01.rogers.com:ute/ute-ui.git#v' + dateFileObj.version + '.' + options.brand,
                date: moment().format('MM/DD/YYYY HH:mm:ss')
              });
            } else {
              for (brandIndex = 0; brandIndex < dateFileObj.brands.length; brandIndex++) {
                if (dateFileObj.brands[brandIndex].name === options.brand) {
                  dateFileObj.brands[brandIndex].commit = commit;
                  dateFileObj.brands[brandIndex].date = moment().format('MM/DD/YYYY HH:mm:ss');
                  dateFileObj.brands[brandIndex].repo = 'git@totes-gitlab01.rogers.com:ute/ute-ui.git#v' + dateFileObj.version + '.' + options.brand;
                }
              }
            }
          }

          //dateFileObj.commit = str;
          dateFileObj.branch = branch;
          bowerJson.push(dateFileObj);
          jsonfile.writeFile('builds.json', bowerJson, {spaces: 2}, function (err) {
            if (err !== null) {
              gutil.log(gutil.colors.magenta('------------------------------------'));
              gutil.log(gutil.colors.magenta('error occurs when write builds.json:'), gutil.colors.red(err));
              gutil.log(gutil.colors.magenta('------------------------------------'));
            }
          });
        });
      });

      file.contents = new Buffer(dateFile);
      callback(null, file);

    }

  };

  /**
   * returns streamed content
   */
  return through.obj(bufferedContents);


};
