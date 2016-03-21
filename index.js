/**
 * Updated by crivas on 08/25/2015.
 */

'use strict';

var jsonfile = require('jsonfile'),
  _ = require('underscore-node'),
  fs = require('fs'),
  moment = require('moment'),
  through = require('through2'),
  gutil = require('gulp-util'),
  git = require('git-rev');

module.exports = function (options) {

  var bowerJson,
    brandExists,
    buildDateFile,
    bufferedContents;

  if (_.isUndefined(options.bowerJson)) {
    this.emit('error', new gutil.PluginError('gulp-build-date', 'no bowerJson file found'));
  } else {
    if (typeof options.bowerJson === 'string') {
      bowerJson = jsonfile.readFileSync(options.bowerJson);
    } else if (typeof options.bowerJson === 'object') {
      bowerJson = options.bowerJson;
    }
  }

  brandExists = function (brands) {
    return _.find(brands, function (brand) {
      return brand === options.brand;
    });
  }

  /**
   * populates with build information
   * @param object
   * @returns {object}
   */
  buildDateFile = function (object) {

    var parsedObject = {};
    parsedObject.date = moment().format('MM/DD/YYYY h:mm:ss a');
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

    if (file.isStream()) {

      this.emit('error', new gutil.PluginError('gulp-build-date', 'Streams are not supported!'));
      callback();

    } else if (file.isNull()) {

      callback(null, file); // Do nothing if no contents

    } else {

      var ctx = file.contents.toString('utf8');
      var dateFile = buildDateFile(ctx);
      var dateFileObj = JSON.parse(dateFile);

      // read builds.json and append the new build object to it
      bowerJson = jsonfile.readFileSync('builds.json');
      if (bowerJson.length) {
        if (bowerJson[bowerJson.length - 1].version === dateFileObj.version) {
          dateFileObj.brands = bowerJson[bowerJson.length - 1].brands;
          bowerJson.pop();
        }
      }

        git.branch(function (branch) {
          git.short(function (str) {
            if (options.brand) {
              if (!brandExists(dateFileObj.brands)) {
                dateFileObj.brands = dateFileObj.brands || [];
                dateFileObj.brands.push(options.brand);
              }
            }

            dateFileObj.commit = str;
            dateFileObj.branch = branch;
            bowerJson.push(dateFileObj);
            jsonfile.writeFile('builds.json', bowerJson, {spaces: 2}, function (err) {
              if (!err) {
                gutil.log(gutil.colors.magenta('------------------------------------'));
                gutil.log(gutil.colors.magenta('error occurs when write build.json:'), gutil.colors.red(err));
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
