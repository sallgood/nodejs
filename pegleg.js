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
    
    //Queries CouchPotato for $moviename and returns speech/text asking if user wants to download the top hit
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
    //If user says "yes" to download question above, this takes the imdb.id (tt1234567) and adds it to the CP queue
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
    //returns next episode on Sonarr's calendar and asks user if they want to hear the tagline
    } else if (event.body.result.metadata.intentName == "shows - calendar") {
        var today = new Date();
        var yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
        var tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);
        sonarr.get("calendar", { "start": yesterday.toISOString(), "end": tomorrow.toISOString() }).then(function (result) {
            show = result[0];
            console.log(show);
            if(show == undefined) {
                var ret = {
                    speech: "You have no shows airing in the next month.",
                    displayText: "You have no shows airing in the next month."
                };
            } else {
                var showTime = new Date(show.airDateUtc); //airDateUtc: '2017-01-01T20:30:00Z'
                var stdate = showTime.toString().substring(0, showTime.toString().length-29); //shorten our UTC date down to something sensible
                var srtime = showTime.toString().substring(16, showTime.toString().length-18); //just snag the converted time
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
    // if the user said "yes" to the tagline questions we play the tagline
    } else if (event.body.result.metadata.intentName == "show_overview - yes") {
        var scontext = event.body.result.contexts.filter(function(d) { return d.name == 'show'; })[0];
        var ret = {
            speech: scontext.parameters.overview,
            displayText: scontext.parameters.overview            
        };
        callback(res, JSON.stringify(ret));
    } else if (event.body.result.metadata.intentName == "shows - history") {
        sonarr.get("history", { "page": 1, "pageSize": 30, "sortkey": "date", "sortDir": "desc" }).then(function (result) {
            //console.log(result);
            var i=0;
            var j=0;
            var mySpeech = "";
            // We only want to list things that completed successfully.
            // It seems the results with eventType as "downloadFolderImported" were downloaded and moved to their final folders successfully.
            for(i; i < 30 && j < 5; i++) {
                if (result.records[i].eventType == "downloadFolderImported") {
                    mySpeech = mySpeech + result.records[i].series.title + ", Season " + result.records[i].episode.seasonNumber + " Episode " + result.records[i].episode.episodeNumber + 
                        ", " + result.records[i].episode.title + ". ";
                    j++;
                }
            }
            if(result == undefined) {
                var ret = {
                    speech: "You have no recent downloads looking back two months.",
                    displayText: "You have no recent downloads looking back two months."
                };
            } else {
                var ret = {
                    speech: "Here are the last five downloads. " + mySpeech,
                    displayText: "Here are the last five downloads. " + mySpeech,
                    /* contextOut: [
                      {
                        name: "show",
                        parameters: {
                            overview: show.overview
                        }
                      } 
                    ] */
                }; 
            }            
            callback(res, JSON.stringify(ret));
        }, function (err) {
            throw new Error("There was a error processing the request: " + err);
        });
    // if the user said "yes" to the tagline questions we play the tagline
    }
};