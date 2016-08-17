var Util = function() {
  return {
    getDistanceFromLatLonInKm: function(lat1,lon1,lat2,lon2) {
      var R = 6371; // Radius of the earth in km
      var dLat = this.deg2rad(lat2-lat1);  // deg2rad below
      var dLon = this.deg2rad(lon2-lon1);
      var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
          Math.sin(dLon/2) * Math.sin(dLon/2) ;
      var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      var d = R * c; // Distance in km
      return d;
    },
    deg2rad: function(deg) {
      return deg * (Math.PI/180)
    }
  };
}();

var Geo = function() {
  return {
    location: null,
    addDistancesToStations: function(stations) {
      var closest = null;
      for (var key in stations) {
        console.log("Adding distance to station: ");
        console.log(key);
        var station = Bart.stations[key];
        station.distance = Util.getDistanceFromLatLonInKm(Geo.location.coords.latitude,
          Geo.location.coords.longitude,
          station.lat,
          station.lon)
        if(closest === null || station.distance < closest.distance) {
          closest = station;
        }
      }
      Bart.closestStation = closest;
    },
    getLocation: function() {
      return new Promise(function(resolve, reject) {
        navigator.geolocation.getCurrentPosition(function(pos) {
          console.log("Got position: " + pos);
          Geo.location = pos;
          resolve(pos);
        });
      });
    }
  }
}();

var Bart = function() {
  return {
    apiKey: 'Q34D-PVTK-9Q6T-DWE9',
    stations: null,
    location: null,
    closestStation: null,
    getStations: function() {
      return new Promise(function(resolve, reject) {
        $.ajax({
          type: "GET",
          url: "https://api.bart.gov/api/stn.aspx?cmd=stns&key=" + Bart.apiKey,
          dataType: "xml",
          success: function(xml) {
            var stations = {};
            $(xml).find("station").each(function(i, el) {
              stations[$(el).find("abbr").text()] = {
                name: $(el).find("name").text(),
                abbr: $(el).find("abbr").text(),
                lat: $(el).find("gtfs_latitude").text(),
                lon: $(el).find("gtfs_longitude").text(),
              };
            });
            console.log(stations);
            Bart.stations = stations;
            resolve(stations);
          },
          error: function(err) {
            console.log(err);
            reject(err);
          }
         });
      });
    },
    getStationTimes: function(stations) {
      console.log('Getting station times: ' + stations);
      console.log(stations);
      promises = Array();
      $(stations).each(function(i, station) {
        var promise = new Promise(function(resolve, reject) {
          var url = "https://api.bart.gov/api/etd.aspx?cmd=etd&orig=" + station.abbr + "&key=" + Bart.apiKey;
          $.ajax({
            type: "GET",
            url: url,
            dataType: "xml",
            success: function(xml) {
              station.platforms = {};
              $(xml).find("etd").each(function(i, etd) {
                var destination = $(etd).find("destination").text();
                var abbr = $(etd).find("abbreviation").text();
                $(etd).find("estimate").each(function(i, estimate) {
                  var platform = null;
                  var platformName = 'platform_' + $(estimate).find("platform").text();
                  if (station.platforms[platformName] === undefined) {
                    station.platforms[platformName] = {
                      'name': $(estimate).find("platform").text(),
                      'destinations': {}
                    };
                  }
                  platform = station.platforms[platformName];
                  var minutes = $(estimate).find("minutes").text();
                  if (minutes == 'Leaving') {
                    minutes = 0;
                  }
                  minutes = parseInt(minutes, 10);
                  if (platform.destinations[abbr] === undefined) {
                    platform.destinations[abbr] = {
                      name: destination,
                      abbr: abbr,
                      minutes: Array(),
                      direction: $(estimate).find("direction").text(),
                      color: $(estimate).find("color").text()
                    };
                  }
                  platform.destinations[abbr].minutes.push(minutes);
                });
              });
              resolve(station);
            }
          });
        });
        promises.push(promise);
      });
      return promises;
    },
  }
}();

var UI = function() {
  return {
    doGeo: true,
    stations: Array(),
    init: function() {
      var promises = [Bart.getStations()];
      if (Options.doGeo) {
        promises.push(Geo.getLocation());
      }

      Promise.all(promises).then(function(vals) {
        if (Options.doGeo) {
          Geo.addDistancesToStations(Bart.stations);
          UI.stations.push(Bart.closestStation);
        } else {
          UI.stations.push(Bart.stations[Options.station.abbr])
        }
        Promise.all(Bart.getStationTimes(UI.stations)).then(function() {
          UI.render();
        });
      });
    },
    render: function() {
      $(UI.stations).each(function(i, el) {
        UI.drawStation(el);
      });
    },
    /*
    <div>
      <h1>station.name</h1>
      <div class="platform">
        <h2>platform.name</h2>
        <ul>
          <li>destination.name <span>destination.minutes</span>
         </ul>
      </div>
    </div>
    */
    drawStation: function(station) {
      $("#station").text('');
      $("#departures").empty();
      console.log("Drawing station");
      console.log(station);
      $("#station").text(station.name);
      for (var platformName in station.platforms) {
        var platform = station.platforms[platformName];
        console.log("Platform");
        console.log(platform);
        var platformSpan = $("<span>");
        var platformTitle = $("<div>").addClass("platform-title").text("Platform " + platform.name);
        $(platformSpan).append(platformTitle);
        for (var destinationName in platform.destinations) {
          var destination = platform.destinations[destinationName];
          var stationSpan = $("<span>").text(destination.name);
          var ul = $("<ul>");
          var li = $("<li>");
          $(li).append(stationSpan);
          var timesSpan = $("<span>").text(destination.minutes.join(', '));
          if (!Options.doGeo) {
            if (destination.direction != Options.station.direction || Options.station.lines.indexOf(destination.color) == -1) {
              $(li).addClass("uninterested");
            }
          }
          $(li).append(timesSpan);
          console.log(li);
          $(platformSpan).append(li);
          $(stationSpan).addClass("destStation");
          $(timesSpan).addClass("destTimes");
        }
        $("#departures").append(platformSpan);
      }
    },
    queryString: function() {
      var query_string = {};
      var query = window.location.search.substring(1);
      var vars = query.split("&");
      for (var i=0;i<vars.length;i++) {
        var pair = vars[i].split("=");
        // If first entry with this name
        if (typeof query_string[pair[0]] === "undefined") {
          query_string[pair[0]] = decodeURIComponent(pair[1]);
          // If second entry with this name
        } else if (typeof query_string[pair[0]] === "string") {
          var arr = [ query_string[pair[0]],decodeURIComponent(pair[1]) ];
          query_string[pair[0]] = arr;
          // If third or later entry with this name
        } else {
          query_string[pair[0]].push(decodeURIComponent(pair[1]));
        }
      }
      return query_string;
    }
  };
}();

var Options = function() {
  return {
    readOptions: function() {
      if(UI.queryString().s !== undefined) {
        this.doGeo == false;
      } else {
        this.doGeo == true;
      }
    },
    doGeo: true,
    station: {
      abbr: 'FRMT',
      direction: 'North',
      icon: 'Work',
      lines: ['GREEN']
    }
  };
}();

$(function() {
  Options.readOptions();
  UI.init();
});
