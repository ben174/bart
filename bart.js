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
  }
}();

var Geo = function() {
  return {
    location: null,
    addDistancesToStations: function(stations) {
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
    stations: null,
    location: null,
    closestStation: null,
    getStations: function() {
      return new Promise(function(resolve, reject) {
        $.ajax({
          type: "GET",
          url: "http://api.bart.gov/api/stn.aspx?cmd=stns&key=MW9S-E7SL-26DU-VV8V",
          dataType: "xml",
          success: function(xml) {
            var stations = $(xml).find("station").map(function(i, el) {
              return {
                name: $(el).find("name").text(),
                abbr: $(el).find("abbr").text(),
                lat: $(el).find("gtfs_latitude").text(),
                lon: $(el).find("gtfs_longitude").text(),
              }
            }).get();
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
    init: function() {
      Promise.all([Geo.getLocation(), this.getStations()]).then(function(vals) {
        Geo.addDistancesToStations(Bart.stations);
        var closestStation = Bart.getClosestStation();
        Bart.getStationTimes(closestStation).then(function() {
          console.log("Got stations times.");
          Bart.drawStation(closestStation);
        });
      });
    },
    getClosestStation: function() {
      var closest = null;
      $(this.stations).each(function(i, el) {
        el.distance = Util.getDistanceFromLatLonInKm(Geo.location.coords.latitude,
          Geo.location.coords.longitude,
          el.lat,
          el.lon)
        if(closest === null || el.distance < closest.distance) {
          closest = el;
        }
      });
      this.closestStation = closest;
      $("#station").text(closest.name);
      return closest;
    },
    getClosestStationTimes: function(data) {
      this.getStationTimes(bart.closestStation.abbr);
    },
    getStationTimes: function(station) {
      return new Promise(function(resolve, reject) {
        var url = "http://api.bart.gov/api/etd.aspx?cmd=etd&orig=" + station.abbr + "&key=MW9S-E7SL-26DU-VV8V";
        $.ajax({
          type: "GET",
          url: url,
          dataType: "xml",
          success: function(xml) {
            station.destinations = [];
            $(xml).find("etd").each(function(i, el) {
              station.destinations.push({
                destination: $(el).find("destination").text(),
                times: $(el).find("estimate > minutes").map(function(i, el) {
                  if ($(el).text() == 'Leaving') {
                    return 0;
                  } else {
                    return parseInt($(el).text(), 10);
                  }
                }).get()
              });
            });
            resolve(station);
          }
        });
      });
    },
    drawStation: function(station) {
      console.log("Drawing station");
      console.log(station);
      $(station.destinations).each(function(i, el) {
        var li = $("<li>");
        var stationSpan = $("<span>").text(el.destination);
        var timesSpan = $("<span>").text(el.times.join(', '));
        $(li).append(stationSpan);
        $(li).append(timesSpan);
        console.log(li);
        $("#departures").append(li);
        $(stationSpan).addClass("destStation");
        $(timesSpan).addClass("destTimes");
      });
    }
  }
}();


$(function() {
  Bart.init();
});
