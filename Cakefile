{exec} = require('child_process')
rmrf = require('rimraf')

callback = (err, stdout, stderr) ->
  throw err if err
  console.log(stdout + stderr)

task 'clean', 'Clean generated files', ->
  rmrf.sync('build')
  rmrf.sync('ext/javascripts')

task 'spec', 'Run Jasmine specs in spec/', ->
  exec 'node_modules/.bin/jasmine-node --coffee spec/', callback

task 'spec:browser', 'Compile Jasmine specs for use with SpecRunner.html', ->
  exec 'coffee --output ext/javascripts --compile --join TabCarousel.js --watch lib/*.coffee', callback
  exec 'coffee --output build --compile --join TabCarouselSpec.js --watch spec/*.coffee', callback
  exec 'open spec/runner.html', callback