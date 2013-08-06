'use strict';

var optimist = require('optimist');
var async = require('async');
var glob = require('glob');
var path = require('path');
var fs = require('fs');

var args = optimist
  .alias('h', 'help')
  .alias('h', '?')
  .options('ignore-event', {
    describe: 'Ignore an event.'
  })
  .argv;

if (args.help) {
  optimist.showHelp();
  return process.exit(1);
}

var ignoredEvents = [];
if (args['ignore-event']) {
  if (typeof(args['ignore-event']) == 'string') {
    ignoredEvents.push(args['ignore-event']);
  } else {
    ignoredEvents = args['ignore-event'];
  }
}

var eventSinks = {};
var eventSources = {};
var fileNameEventSinks = {};
var fileNameEventSources = {};

async.forEach(args._, processDir, function(err) {
  if (err) {
    console.error(err);
    return process.exit(1);
  }

  var graph = createGraphString();
  console.log(graph);
  return 0;
});

function createGraphString() {
  var relationships = {};
  var str = "";
  Object.keys(fileNameEventSources).forEach(function(eventSourceFileName) {
    var events = fileNameEventSources[eventSourceFileName];
    events.forEach(function(event) {
      if (ignoredEvents.indexOf(event) >= 0) {
        return;
      }

      var sinks = eventSinks[event];
      if (sinks) {
        sinks.forEach(function(sink) {
          var relName = eventSourceFileName + '" -> "' + sink;
          relationships[relName] = relationships[relName] || [];
          relationships[relName].push(event);
        });
      } else {
        // TODO no sink
      }
    });
  });

  str += 'digraph {\n';
  str += '\tsplines=curved;\n';
  str += '\tsep="+50,50";';
  str += '\toverlap=scalexy;';
  str += '\tnodesep=0.6;';
  Object.keys(relationships).forEach(function(relName) {
    var events = relationships[relName];
    str += '\t"' + relName + '" [label = "' + events.join('\\l') + '" ];\n';
  });
  str += "}";
  return str;
}

function processDir(dirName, callback) {
  var options = {
    cwd: dirName
  };
  return glob("**/*.js", options, function(err, files) {
    if (err) {
      return callback(err);
    }
    return async.forEach(files, function(file, callback) {
      return processFile(path.join(dirName, file), file, callback);
    }, callback);
  });
}

function processFile(fileName, relFileName, callback) {
  return fs.readFile(fileName, 'utf8', function(err, data) {
    if (err) {
      return callback(err);
    }
    return processFileContents(relFileName, data, callback);
  });
}

function processFileContents(relFileName, data, callback) {
  var i;
  var m = data.match(/\.on\(document, .*?\)/g);
  if (m) {
    for (i = 0; i < m.length; i++) {
      processOnDocumentMatch(relFileName, m[i]);
    }
  }

  m = data.match(/\.trigger\(.*?\)/g);
  if (m) {
    for (i = 0; i < m.length; i++) {
      processTrigger(relFileName, m[i]);
    }
  }

  return callback();
}

function processOnDocumentMatch(relFileName, onDocumentPartialString) {
  var m = onDocumentPartialString.match(/document, ['"](.*?)['"]/);
  if (m) {
    var eventName = m[1];

    eventSinks[eventName] = eventSinks[eventName] || [];
    if (eventSinks[eventName].indexOf(relFileName) < 0) {
      eventSinks[eventName].push(relFileName);
    }

    fileNameEventSinks[relFileName] = fileNameEventSinks[relFileName] || [];
    if (fileNameEventSinks[relFileName].indexOf(eventName) < 0) {
      fileNameEventSinks[relFileName].push(eventName);
    }
  }
}

function processTrigger(relFileName, triggerString) {
  var m = triggerString.match(/document, ['"](.*?)['"]/) || triggerString.match(/\(['"](.*?)['"]/);
  if (m) {
    var eventName = m[1];

    eventSources[eventName] = eventSources[eventName] || [];
    if (eventSources[eventName].indexOf(relFileName) < 0) {
      eventSources[eventName].push(relFileName);
    }

    fileNameEventSources[relFileName] = fileNameEventSources[relFileName] || [];
    if (fileNameEventSources[relFileName].indexOf(eventName) < 0) {
      fileNameEventSources[relFileName].push(eventName);
    }
  }
}
