var path = require('path');
var semver = require('semver');
var async = require('async');
var exec = require('child_process').exec;
var _ = require('@sailshq/lodash');
var jsBeautify = require('js-beautify');

var includeAll = require('include-all');
var Prompts = require('machinepack-prompts');
var Filesystem = require('machinepack-fs');

module.exports = (function() {

  // Get the project directory.
  var projectDir = process.cwd();

  console.log();
  console.log('----------------------------------------------------');
  console.log('This utility will kickstart the process of migrating');
  console.log('a pre-Sails-1.0 app to Sails 1.0.x.');
  console.log('----------------------------------------------------');
  console.log();

  return {
    before: function before(scope, done) {

      // Don't say "Created a new migrate-app!" at the end of all this.
      scope.suppressFinalLog = true;

      scope.force = true;

      // Declare a var to hold all the tasks we want to run.
      var tasks = [];

      // Load up the project's package.json file.
      var projectPackageJson = (function() {
        try {
          return require(path.resolve(projectDir, 'package.json'));
        } catch (e) {
          return done(new Error('Could not find a package.json in the current folder.  Are you sure this is a Sails project?'));
        }
      })();

      if (!projectPackageJson.dependencies || !projectPackageJson.dependencies.sails) {
        return done(new Error('This project does not include sails as a dependency.  Are you sure this is a Sails project?'));
      }

      // Load up the existing `config/globals.js` file, if any.
      var globalsConfig = (function() {
        try {
          return require(path.resolve(projectDir, 'config', 'globals')).globals;
        } catch (e) {
          return {};
        }
      })();

      // Load up the existing `config/globals.js` file, if any.
      var modelsConfig = (function() {
        try {
          return require(path.resolve(projectDir, 'config', 'models')).models;
        } catch (e) {
          return {};
        }
      })();

      // Load up the existing `config/connections.js` file, if any.
      var connectionsConfig = (function() {
        try {
          return require(path.resolve(projectDir, 'config', 'connections')).connections;
        } catch (e) {
          return {};
        }
      })();

      //  ██████╗ ██╗   ██╗██╗██╗     ██████╗     ████████╗ █████╗ ███████╗██╗  ██╗███████╗
      //  ██╔══██╗██║   ██║██║██║     ██╔══██╗    ╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝██╔════╝
      //  ██████╔╝██║   ██║██║██║     ██║  ██║       ██║   ███████║███████╗█████╔╝ ███████╗
      //  ██╔══██╗██║   ██║██║██║     ██║  ██║       ██║   ██╔══██║╚════██║██╔═██╗ ╚════██║
      //  ██████╔╝╚██████╔╝██║███████╗██████╔╝       ██║   ██║  ██║███████║██║  ██╗███████║
      //  ╚═════╝  ╚═════╝ ╚═╝╚══════╝╚═════╝        ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝

      //  ┬┌┐┌┌─┐┌┬┐┌─┐┬  ┬    ┌─┐┌─┐┬┬  ┌─┐
      //  ││││└─┐ │ ├─┤│  │    └─┐├─┤││  └─┐
      //  ┴┘└┘└─┘ ┴ ┴ ┴┴─┘┴─┘  └─┘┴ ┴┴┴─┘└─┘

      if (!semver.satisfies(projectPackageJson.dependencies['sails'].replace(/^\D+/,''), '^1.0.0-0')) {

        tasks.push(function(done) {

          Prompts.confirm({
            message: 'First things first -- looks like we need to install Sails 1.0.\n\n'+
                      'Is that okay?'
          }).exec({
            no: function() {
              console.log('Okay, exiting for now.  Run `sails generate migrate-app` again when you\'re ready to migrate to Sails 1.0!\n');
              process.exit(0);
            },
            success: function() {
              console.log('Okay -- installing now (please wait)!\n');
              exec('npm install sails@^1.0.0-0 --save', {cwd: projectDir}, done);
            },
            error: done
          });
        });

      }

      //  ┬┌┐┌┌─┐┌┬┐┌─┐┬  ┬    ┌─┐┌─┐┌─┐┬┌─┌─┐┌─┐┌─┐┌─┐
      //  ││││└─┐ │ ├─┤│  │    ├─┘├─┤│  ├┴┐├─┤│ ┬├┤ └─┐
      //  ┴┘└┘└─┘ ┴ ┴ ┴┴─┘┴─┘  ┴  ┴ ┴└─┘┴ ┴┴ ┴└─┘└─┘└─┘

      // Declare a var to hold the dictionary of packages we need to install.
      var packagesToInstall = {};

      if (!projectPackageJson.dependencies['sails-hook-orm'] || !semver.satisfies(projectPackageJson.dependencies['sails-hook-orm'].replace(/^\D+/,''), '^2.0.0-0')) {
        packagesToInstall['sails-hook-orm'] = '^2.0.0-0';
      }

      if (!projectPackageJson.dependencies['sails-hook-grunt']) {
        packagesToInstall['sails-hook-grunt'] = '^1.0.0-0';
      }

      if (!projectPackageJson.dependencies['sails-hook-sockets'] || !semver.satisfies(projectPackageJson.dependencies['sails-hook-sockets'].replace(/^\D+/,''), '^1.0.0-0')) {
        packagesToInstall['sails-hook-sockets'] = '^1.0.0-0';
      }

      if (projectPackageJson.dependencies['sails-postgresql'] && !semver.satisfies(projectPackageJson.dependencies['sails-postgresql'].replace(/^\D+/,''), '^1.0.0-0')) {
        packagesToInstall['sails-postgresql'] = '^1.0.0-0';
      }

      if (projectPackageJson.dependencies['sails-mysql'] && !semver.satisfies(projectPackageJson.dependencies['sails-mysql'].replace(/^\D+/,''), '^1.0.0-0')) {
        packagesToInstall['sails-mysql'] = '^1.0.0-0';
      }

      if (projectPackageJson.dependencies['sails-mongo'] && !semver.satisfies(projectPackageJson.dependencies['sails-mongo'].replace(/^\D+/,''), '^1.0.0-0')) {
        packagesToInstall['sails-mongo'] = '^1.0.0-0';
      }

      if (projectPackageJson.dependencies['socket.io-redis'] && !semver.satisfies(projectPackageJson.dependencies['socket.io-redis'].replace(/^\D+/,''), '^3.1.0')) {
        packagesToInstall['socket.io-redis'] = '3.1.0';
      }

      if (globalsConfig._ !== false && !projectPackageJson.dependencies['lodash']) {
        packagesToInstall['lodash'] = '3.10.1';
      }

      if (globalsConfig.async !== false && !projectPackageJson.dependencies['async']) {
        packagesToInstall['async'] = '2.1.4';
      }

      // If we have stuff to install, confirm with the user, and then do it.
      if (_.keys(packagesToInstall).length) {

        tasks.push(function(done) {
          var packageList = _.map(packagesToInstall, function(ver, package) {
            return package + '@' + ver;
          }).join('\n');
          Prompts.confirm({
            message: 'Looks like we need to install the following packages: \n\n' +
                      packageList + '\n\n' +
                      'Is that okay?'
          }).exec({
            no: function() {
              console.log('Okay, but your app may not lift without them!\n');
              return done();
            },
            success: function() {
              console.log('Okay -- installing now!\n');
              async.eachSeries(_.keys(packagesToInstall), function(package, cb) {
                var version = packagesToInstall[package];
                console.log('Installing ' + package + '@' + version + '...');
                exec('npm install ' + package + '@' + version + ' --save' + (version[0] !== '^' ? ' --save-exact' : ''), {cwd: projectDir}, cb);
              }, done);
            },
            error: done
          });

        });

      }

      //  ┬─┐┌─┐┌┬┐┌─┐┬  ┬┌─┐  ┌─┐┌─┐┌─┐┬┌─┌─┐┌─┐┌─┐┌─┐
      //  ├┬┘├┤ ││││ │└┐┌┘├┤   ├─┘├─┤│  ├┴┐├─┤│ ┬├┤ └─┐
      //  ┴└─└─┘┴ ┴└─┘ └┘ └─┘  ┴  ┴ ┴└─┘┴ ┴┴ ┴└─┘└─┘└─┘

      // Get an array of packages we can remove.
      var packagesToRemove = _.intersection(_.keys(projectPackageJson.dependencies), [
        // 'ejs',
        'grunt',
        'grunt-contrib-clean',
        'grunt-contrib-coffee',
        'grunt-contrib-concat',
        'grunt-contrib-copy',
        'grunt-contrib-cssmin',
        'grunt-contrib-jst',
        'grunt-contrib-less',
        'grunt-contrib-uglify',
        'grunt-contrib-watch',
        'grunt-sails-linker',
        'grunt-sync',
        'sails-disk'
      ]);

      // If we have stuff to install, confirm with the user, and then do it.
      if (packagesToRemove.length) {

        tasks.push(function(done) {
          Prompts.confirm({
            message: 'Looks like we can remove the following packages: \n\n' +
                      packagesToRemove.join('\n') + '\n\n' +
                      'These packages are now built-in to Sails.  Removing is strictly optional, but will reduce your project\'s file size.\n\nOkay to remove the packages?'
          }).exec({
            no: function() {
              console.log('Okay, no problem -- we\'ll leave those packages in place!\n');
              return done();
            },
            success: function() {
              console.log('Okay -- removing now!\n');
              async.eachSeries(packagesToRemove, function(package, cb) {
                console.log('Removing ' + package + '...');
                exec('npm uninstall ' + package + ' --save', {cwd: projectDir}, cb);
              }, done);
            },
            error: done
          });

        });

      }

      //  ┌─┐┬  ┌─┐┌┐ ┌─┐┬    ┌─┐┌─┐┌┐┌┌─┐┬┌─┐
      //  │ ┬│  │ │├┴┐├─┤│    │  │ ││││├┤ ││ ┬
      //  └─┘┴─┘└─┘└─┘┴ ┴┴─┘  └─┘└─┘┘└┘└  ┴└─┘

      // Unless everything in the current global config is turned off, offer to replace the globals.js file.
      if (globalsConfig !== false && (globalsConfig._ !== false || globalsConfig.async !== false || globalsConfig.models !== false || globalsConfig.sails !== false)) {

        tasks.push(function(done) {

          Prompts.confirm({
            message: 'In order for your project to lift, your `config/globals.js` file needs to be updated.\n' +
                     'We can add a new `config/globals_1.0.js` file for now which should allow your project\n'+
                     'to lift, and then when you\'re ready you can copy that file over to `config/globals.js`\n\n'+
                     'See http://bit.ly/sails_migration_checklist for more info.\n\n'+
                     'Create a new `config/globals_1.0.js file now?'
          }).exec({
            no: function() {
              console.log('Okay, but your app may not lift without it!\n');
              return done();
            },
            success: function() {
              console.log('Okay -- creating now!\n');
              // Get the template for the new globals config file.
              var globalsTemplate = Filesystem.readSync({source: path.resolve(__dirname, 'templates', 'config-globals-1.0.js.template')}).execSync();

              // Fill out the template with the appropriate values based on the project's existing global config.
              var newGlobalsConfig = _.template(globalsTemplate)({
                lodashVal: globalsConfig._ === false ? false : 'require(\'lodash\')',
                asyncVal: globalsConfig.async === false ? false : 'require(\'async\')',
                modelsVal: globalsConfig.models === false ? false : true,
                sailsVal: globalsConfig.sails === false ? false : true
              });

              try {
                Filesystem.writeSync({
                  string: newGlobalsConfig,
                  destination: path.resolve(projectDir, 'config', 'globals_1.0.js'),
                  force: true
                }).execSync();
              } catch (e) {
                return done(e);
              }
              return done();
            },
            error: done
          });

        });

      }

      //  ┌┬┐┌─┐┌┬┐┌─┐┬  ┌─┐  ┌─┐┌─┐┌┐┌┌─┐┬┌─┐
      //  ││││ │ ││├┤ │  └─┐  │  │ ││││├┤ ││ ┬
      //  ┴ ┴└─┘─┴┘└─┘┴─┘└─┘  └─┘└─┘┘└┘└  ┴└─┘

      tasks.push(function(done) {

        Prompts.confirm({
          message: 'If your project uses models, you will likely need to update your `config/models.js`\n'+
                   'before lifting with Sails 1.0.  We can add a new `config/models_1.0.js` file for now\n'+
                   'which should allow your project to lift, and then when you\'re ready you merge that\n'+
                   'file with your existing `config/models.js`.\n\n'+
                   'See http://bit.ly/sails_migration_model_config for more info.\n\n'+
                   'Create a new `config/models_1.0.js file now?'
        }).exec({
          no: function() {
            console.log('Okay, but your app may not lift without it!\n');
            return done();
          },
          success: function() {
            console.log('Okay -- creating now!\n');

            // Get the template for the new globals config file.
            var modelsConfigTemplate = Filesystem.readSync({source: path.resolve(__dirname, 'templates', 'config-models-1.0.js.template')}).execSync();

            // Fill out the template with the appropriate values based on the project's existing global config.
            var newModelsConfig = _.template(modelsConfigTemplate)({
              datastore: (modelsConfig.connection !== 'localDiskDb' ? modelsConfig.connection : 'default') || 'default'
            });

            try {
              Filesystem.writeSync({
                string: newModelsConfig,
                destination: path.resolve(projectDir, 'config', 'models_1.0.js'),
                force: true
              }).execSync();
            } catch (e) {
              return done(e);
            }
            return done();
          },
          error: done
        });

      });

      // Declare a var to hold the model definitions.
      var models;

      // Get all the model definitions into `models`
      tasks.push(function(done) {

        // Load all model files, so we know what we're dealing with.
        includeAll.optional({
          dirname: path.resolve(projectDir, 'api', 'models'),
          filter: /^([^.]+)\.(?:(?!md|txt).)+$/,
          replaceExpr : /^.*\//,
        }, function(err, _models) {
          models = _models;
          return done();
        });

      });

      //  ┌┬┐┌─┐┌┬┐┌─┐┌─┐┌┬┐┌─┐┬─┐┌─┐┌─┐  ┌─┐┌─┐┌┐┌┌─┐┬┌─┐
      //   ││├─┤ │ ├─┤└─┐ │ │ │├┬┘├┤ └─┐  │  │ ││││├┤ ││ ┬
      //  ─┴┘┴ ┴ ┴ ┴ ┴└─┘ ┴ └─┘┴└─└─┘└─┘  └─┘└─┘┘└┘└  ┴└─┘

      if (_.keys(connectionsConfig).length) {
        tasks.push(function(done) {

          Prompts.confirm({
            message: 'The `connections` configuration has been changed to `datastores` in Sails 1.0.\n'+
                     'In addition, _all_ configured datastores will now always be loaded, even if no models\n'+
                     'are actually using them.  We can migrate your existing `config/connections.js` file over\n'+
                     'to `config/datastores.js` for you (and back up the original file).\n\n'+
                     'See http://bit.ly/sails_migration_datastore_config for more info.\n\n'+
                     'Update `config/connections.js` to `config/datastores.js now?'
          }).exec({
            no: function() {
              console.log('Okay, but your app may not lift without it!\n');
              return done();
            },
            success: function() {
              console.log('Okay -- updating now!\n');

              // Build up a list of datastores that are actually in use.
              var datastoresInUse = [];
              if (modelsConfig.connection && modelsConfig.connection !== 'localDiskDb') {
                datastoresInUse.push(modelsConfig.connection);
              }
              _.each(models, function(model) {
                if (model.connection) {
                  datastoresInUse.push(model.connection);
                }
              });

              // Build up a datastores dictionary
              var datastoresStr = _.reduce(datastoresInUse, function(memo, datastoreInUse) {
                if (connectionsConfig[datastoreInUse]) {
                  memo.push('\'' + datastoreInUse + '\': ' + require('util').inspect(connectionsConfig[datastoreInUse], {depth: null}));
                }
                return memo;
              }, []).join(',\n');

              // Get the template for the new globals config file.
              var datastoresConfigTemplate = Filesystem.readSync({source: path.resolve(__dirname, 'templates', 'config-datastores-1.0.js.template')}).execSync();

              // Fill out the template with the appropriate values based on the project's existing global config.
              var newDatastoresConfig = _.template(datastoresConfigTemplate)({
                datastores: jsBeautify('  ' + datastoresStr, {indent_level: 2, indent_size: 2})
              });

              try {
                Filesystem.writeSync({
                  string: newDatastoresConfig,
                  destination: path.resolve(projectDir, 'config', 'datastores.js'),
                  force: true
                }).execSync();
                Filesystem.mv({
                  source: path.resolve(projectDir, 'config', 'connections.js'),
                  destination: path.resolve(projectDir, 'config', 'connections-old.js.txt')
                }).exec(function(err) {
                  return done();
                });
              } catch (e) {
                return done(e);
              }
            },
            error: done
          });


        });

      }

      //  ┌─┐┬ ┬┌─┐┌─┐┌─┐┌─┐┌┬┐┬┌─┐┌┐┌┌─┐
      //  └─┐│ ││ ┬│ ┬├┤ └─┐ │ ││ ││││└─┐
      //  └─┘└─┘└─┘└─┘└─┘└─┘ ┴ ┴└─┘┘└┘└─┘

      tasks.push(function(done) {

        Prompts.confirm({
          message: 'Okay, that\'s about all we can do automatically.\n\n' +
                   'In the next step, we\'ll do a scan of your code and create a report\n'+
                   'of things that may need to be manually updated for Sails 1.0.\n'+
                   'This could take a few moments depending on the size of your project.\n\n'+
                   'Go ahead and scan your project?'
        }).exec({
          no: function() {
            console.log('Okay, no problem.  In that case we\'re done!');
            return done();
          },
          success: function() {

          }

        });

      });

      //  ██████╗ ██╗   ██╗███╗   ██╗    ████████╗ █████╗ ███████╗██╗  ██╗███████╗
      //  ██╔══██╗██║   ██║████╗  ██║    ╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝██╔════╝
      //  ██████╔╝██║   ██║██╔██╗ ██║       ██║   ███████║███████╗█████╔╝ ███████╗
      //  ██╔══██╗██║   ██║██║╚██╗██║       ██║   ██╔══██║╚════██║██╔═██╗ ╚════██║
      //  ██║  ██║╚██████╔╝██║ ╚████║       ██║   ██║  ██║███████║██║  ██╗███████║
      //  ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝       ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝
      //
      async.series(tasks, done);

    },

    templatesDirectory: __dirname,

    targets: {}

  };

})();
