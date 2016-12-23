exports.handler = function(event, res, callback) {
    var CouchPotatoAPI = require('couchpotato-api');
     
    var couchpotato = new CouchPotatoAPI({
      hostname: '10.2.0.26',
      apiKey: secrets.cp_api,
      port: 8082
    });
    
    var SonarrAPI = require('sonarr-api');
 
    var sonarr = new SonarrAPI({
            hostname: '10.2.0.26', 
            apiKey: secrets.sr_api,
            port: 8081
    });
    
    if(event.body.result.metadata.intentName == "search") {
        console.log(event.body.result.parameters.action + " for " + event.body.result.parameters.moviename);
        couchpotato.get("search", {q: event.body.result.parameters.moviename}).then(function (result) {
            var movie = result.movies[0];
            var ret = {
                speech: "Do you want to download " + movie.original_title + " from " + movie.year + "?",
                displayText: "Do you want to download " + movie.original_title + " from " + movie.year + "?",
                contextOut: [
                    {
                        name: "movie",
                        parameters: {
                            imdb: movie.imdb,
                            original: movie.original,
                            index: ((1*movie.index)+1)
                        }
                    }
                ]
            };
            console.log(JSON.stringify(ret));
            
            callback(res, JSON.stringify(ret))
        }).catch(function (err) {
          throw new Error("There was a error processing the request: " + err);
        });
    } else if (event.body.result.metadata.intentName == "download_movie - yes") {
        var fcontext = event.body.result.contexts.filter(function(d) { return d.name == 'movie'; })[0];

        couchpotato.get('movie.add', { identifier: fcontext.parameters.imdb }).then(function(result) {
            var ret = {
                speech: "Downloading!",
                displayText: "Downloading!",
                };
            
            callback(res, JSON.stringify(ret));
        }).catch(function (err) {
            var ret = {
                speech: "I failed at my one duty",
                displayText: "I failed at my one duty",
            };
            
            callback(res, JSON.stringify(ret))
        });
    } else if (event.body.result.metadata.intentName == "shows") {
        var today = new Date();
        var yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
        var tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6);
        sonarr.get("calendar", { "start": yesterday.toISOString(), "end": tomorrow.toISOString() }).then(function (result) {
            show = result[0];
            console.log(show);
            if(show == undefined) {
                var ret = {
                    speech: "You have no shows airing in the next week.",
                    displayText: "You have no shows airing in the next week."
                };
            } else {
                var showTime = new Date(show.airDateUtc); //airDateUtc: '2017-01-01T20:30:00Z'
                stdate = showTime.toString().substring(0, showTime.toString().length-29); //shorten our UTC date down to something sensible
                srtime = showTime.toString().substring(16, showTime.toString().length-18); //just snag the converted time
                var ret = {
                    speech: show.series.title + " will air on " + show.series.network + " on "  + stdate + " at " + srtime + ".  Would you like to hear the overview?",
                    displayText: show.series.title + " will air on " + show.series.network + " on "  + stdate + " at " + srtime + ".  Would you like to hear the overview?",
                    contextOut: [
                      {
                        name: "show",
                        parameters: {
                            overview: show.overview
                        }
                      } 
                    ]
                };
            }
            
            callback(res, JSON.stringify(ret));
        }, function (err) {
            throw new Error("There was a error processing the request: " + err);
        });
    } else if (event.body.result.metadata.intentName == "show_overview - yes") {
        var scontext = event.body.result.contexts.filter(function(d) { return d.name == 'show'; })[0];
        var ret = {
            speech: scontext.parameters.overview,
            displayText: scontext.parameters.overview            
        };
        callback(res, JSON.stringify(ret));
    }
};